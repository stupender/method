// ============================================================================
// ui/ScaleExplorer.tsx — explore a scale's position boxes on the neck
// ----------------------------------------------------------------------------
// The scale twin of ChordExplorer. Given a root + scale it shows the scale's
// playable position boxes (the 7 modal fingerings) as constellations: by
// default the whole scale is lit across the neck (the union of all boxes), and
// hovering a box (or its TAB) lights that one and dims the rest. Clicking a box
// plays that position ascending. Reuses the same Fretboard + TAB machinery as
// chords — the only difference is where the shapes come from.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import type { Note, ScaleDefinition } from '../theory/types';
import { GUITAR } from '../data/instruments';
import { GUITAR_STANDARD } from '../data/tunings';
import { scalePositions, positionalBoxes, hybridBoxes } from '../theory/scalePositions';
import { midiOf } from '../theory/notes';
import { playSequence } from '../audio/player';
import { Fretboard } from '../render/Fretboard';
import { TabSequence } from '../render/TabSequence';
import { Segmented } from './Segmented';
import { ShapeStepper, useStepper } from './ShapeStepper';
import type { PlacedNote } from '../theory/types';

export function ScaleExplorer({
  root,
  scale,
  onPickRoot,
  focus,
  labelMode = 'degree',
}: {
  root: Note;
  scale: ScaleDefinition;
  // Click a note on the neck to make it the new root (re-root the mode).
  onPickRoot?: (placed: PlacedNote) => void;
  // After a re-root, the fret the user clicked — pin the position covering it, so
  // the mode lands "in position" where they clicked. `seq` bumps per click so the
  // same fret clicked twice still re-pins.
  focus?: { fret: number; seq: number };
  // What the dots say — a global display setting, owned by the view above.
  labelMode?: 'note' | 'degree';
}) {
  // Which fingering system: 3-notes-per-string, in-position (Positional), or the
  // hybrid (2 on the low E, then 3 per string).
  const [fingering, setFingering] = useState<'3nps' | 'box' | 'hybrid'>('3nps');
  // Show every position's box outlined at once (see the whole mode tile the neck).
  const [showAll, setShowAll] = useState(false);
  // Read/play the run ascending (low -> high) or descending (high -> low).
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  // Pinned (clicked, stays lit) vs hovered (temporary preview). Hover wins while
  // over a box; otherwise the pinned one shows. Click the empty neck to unpin.
  const [pinnedShape, setPinnedShape] = useState<number | null>(null);
  const [hoveredShape, setHoveredShape] = useState<number | null>(null);
  const activeShape = hoveredShape ?? pinnedShape;

  const positions =
    fingering === '3nps'
      ? scalePositions(GUITAR, GUITAR_STANDARD, root, scale)
      : fingering === 'box'
        ? positionalBoxes(GUITAR, GUITAR_STANDARD, root, scale)
        : hybridBoxes(GUITAR, GUITAR_STANDARD, root, scale);
  const shapes = positions.map((p) => p.notes);

  // A stable key for "which scale, in which fingering" — when it changes the set
  // of positions changes, so any pinned index is stale and we clear it.
  const modeKey = `${scale.id}:${root.letter}${root.accidental}:${fingering}`;
  useEffect(() => {
    setPinnedShape(null);
  }, [modeKey]);

  // When a note is clicked (focus.seq bumps), pin the position that sits at that
  // fret, preferring the box whose ROOT is right there. This runs AFTER the new
  // mode's positions are computed, so it pins the right (re-rooted) box.
  useEffect(() => {
    if (!focus) return;
    let best = -1;
    let bestScore = Infinity;
    positions.forEach((pos, i) => {
      const frets = pos.notes.map((n) => n.position.fret);
      const min = Math.min(...frets);
      const max = Math.max(...frets);
      let score = Math.abs((min + max) / 2 - focus.fret); // nearest box centre
      if (focus.fret < min || focus.fret > max) score += 100; // must contain it
      if (pos.notes.some((n) => n.isRoot && n.position.fret === focus.fret))
        score -= 50; // best: the root is exactly where they clicked
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best >= 0) setPinnedShape(best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.seq]);

  // Play a position in the chosen direction (low->high, or high->low).
  const playPosition = (shape: (typeof shapes)[number]) => {
    const midis = [...shape]
      .sort((a, b) => midiOf(a.note) - midiOf(b.note))
      .map((p) => midiOf(p.note));
    if (direction === 'down') midis.reverse();
    playSequence(midis, 0.18);
  };

  // Clicking a position (neck or TAB) plays it AND pins it as the selection.
  const selectShape = (i: number) => {
    setPinnedShape(i);
    playPosition(shapes[i] ?? []);
  };

  // Walk the positions in playing order: the ‹ › buttons or the ← → arrow keys
  // move to the next/previous box and play it (only while this view is visible).
  const viewRef = useRef<HTMLDivElement>(null);
  const stepShape = useStepper(viewRef, shapes.length, activeShape, selectShape);

  return (
    <>
      <div className="view-controls" ref={viewRef}>
        {/* Row 1 — the primary choice (which fingering system) + the play action. */}
        <div className="controls-row">
          <Segmented
            ariaLabel="Fingering"
            options={[
              { value: '3nps' as const, label: '3 per string' },
              { value: 'box' as const, label: 'Positional' },
              { value: 'hybrid' as const, label: 'Hybrid' },
            ]}
            value={fingering}
            onChange={setFingering}
          />
          <button
            className="pill pill--play"
            onClick={() => playPosition(shapes[activeShape ?? 0] ?? [])}
          >
            ▶ Play position
          </button>
          <ShapeStepper
            index={activeShape}
            count={shapes.length}
            onStep={stepShape}
            label="position"
          />
        </div>

        {/* Row 2 — how to read it: direction of the run, one box vs all boxes. */}
        <div className="controls-row">
          <Segmented
            ariaLabel="Direction"
            options={[
              { value: 'up' as const, label: 'Ascending' },
              { value: 'down' as const, label: 'Descending' },
            ]}
            value={direction}
            onChange={setDirection}
          />
          <button
            className={showAll ? 'pill pill--on' : 'pill'}
            onClick={() => {
              setShowAll((v) => !v);
              setPinnedShape(null);
            }}
          >
            All positions
          </button>
        </div>
      </div>

      <Fretboard
        instrument={GUITAR}
        tuning={GUITAR_STANDARD}
        shapes={shapes}
        activeShapeIndex={activeShape}
        onShapeHover={setHoveredShape}
        onShapeTap={selectShape}
        onBackgroundClick={() => setPinnedShape(null)}
        onNoteTap={
          onPickRoot
            ? (p) => {
                setShowAll(false); // focusing a position exits the all-boxes view
                onPickRoot(p);
              }
            : undefined
        }
        showAllShapes={showAll}
        labelMode={labelMode}
      />

      {/* One TAB per position (the modal fingerings), low -> high. Hovering a
          TAB previews that position; clicking it pins the selection. */}
      <div className="tab-shelf">
        {positions.map((pos, i) => (
          <div
            key={i}
            className={i === activeShape ? 'tab-card tab-card--on' : 'tab-card'}
            onMouseEnter={() => setHoveredShape(i)}
            onMouseLeave={() => setHoveredShape(null)}
            onClick={() => selectShape(i)}
          >
            <TabSequence
              instrument={GUITAR}
              tuning={GUITAR_STANDARD}
              placed={pos.notes}
              descending={direction === 'down'}
              caption={pos.name}
            />
          </div>
        ))}
      </div>
    </>
  );
}
