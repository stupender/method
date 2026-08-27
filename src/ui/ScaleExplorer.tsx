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
import { placeScale } from '../theory/scale';
import { midiOf, noteName } from '../theory/notes';
import { playSequence, type Sequence } from '../audio/player';
import { Fretboard } from '../render/Fretboard';
import { NeckPanel } from './NeckPanel';
import { SHOW_PLAY_BUTTONS } from './flags';
import { DegreeLegend } from './DegreeLegend';
import { useScrollFocus } from './useScrollFocus';
import { System } from '../render/System';
import { Segmented } from './Segmented';
import { useStepper } from './ShapeStepper';
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
  // A scale run goes UP AND BACK DOWN — that's how anyone actually practises
  // one, and it's how you hear the top note resolve. There used to be an
  // Ascending / Descending toggle here; it made you pick half the exercise.
  // Pinned (clicked, stays lit) vs hovered (temporary preview). Hover wins while
  // over a box; otherwise the pinned one shows. Click the empty neck to unpin.
  // What the floating neck is showing. SCROLLING sets it — whichever position
  // is under the neck is the one lit — so there's no hover state any more:
  // hovering did nothing on a phone and made the neck flicker as the pointer
  // crossed the page on its way somewhere else.
  const [pinnedShape, setPinnedShape] = useState<number | null>(null);
  const activeShape = pinnedShape;

  const positions =
    fingering === '3nps'
      ? scalePositions(GUITAR, GUITAR_STANDARD, root, scale)
      : fingering === 'box'
        ? positionalBoxes(GUITAR, GUITAR_STANDARD, root, scale)
        : hybridBoxes(GUITAR, GUITAR_STANDARD, root, scale);
  const shapes = positions.map((p) => p.notes);

  // Reading down the page walks the positions: whichever card is under the
  // floating neck becomes the shape the neck shows. Re-measures whenever the
  // list changes length, which is when the old measurements stop meaning
  // anything.
  const focusRef = useScrollFocus(positions.length, (i) => {
    setPinnedShape(i);
    // Scrolling onto a position is choosing it, so it leaves "All notes".
    // Only when the focused row actually CHANGES, which is the hook's own
    // rule — a nudge within one position doesn't count as picking another.
    if (i !== null) setShowAll(false);
  });

  // The run as it's read and played: up, then back down, with the top note
  // sounded once rather than twice at the turn.
  const upAndDown = (notes: (typeof positions)[number]['notes']) => {
    const up = [...notes].sort((a, b) => midiOf(a.note) - midiOf(b.note));
    return [...up, ...up.slice(0, -1).reverse()];
  };

  // EVERY note of the scale that exists on the neck — open strings and the
  // frets above the last box included. The position boxes are fingerings
  // chosen from this, not the whole truth: drawing only the boxes was leaving
  // 8–12 real notes off every key (C major lost its open E and everything from
  // fret 15 up). The neck shows the scale; the boxes light a path through it.
  const wholeNeck = placeScale(GUITAR, GUITAR_STANDARD, root, scale);

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

  // WHICH POSITION IS SOUNDING. Playback is a state, not a fire-and-forget:
  // the row's button shows ⏸ while its own run is playing and returns to ▶ when
  // it finishes (or when you stop it, or start another one).
  const [playing, setPlaying] = useState<number | null>(null);
  const run = useRef<{ seq: Sequence; timer: number } | null>(null);

  const stopPlayback = () => {
    if (run.current) {
      run.current.seq.stop();
      clearTimeout(run.current.timer);
      run.current = null;
    }
    setPlaying(null);
  };

  // Play position `i` in the chosen direction (low->high, or high->low), or
  // stop it if it's the one already sounding.
  const togglePlay = (i: number) => {
    if (playing === i) {
      stopPlayback();
      return;
    }
    stopPlayback();
    const midis = upAndDown(shapes[i] ?? []).map((p) => midiOf(p.note));
    if (midis.length === 0) return;
    const seq = playSequence(midis, 0.18);
    // Hand the button back to ▶ when the last note has rung out.
    const timer = window.setTimeout(() => {
      run.current = null;
      setPlaying(null);
    }, seq.durationSec * 1000);
    run.current = { seq, timer };
    setPlaying(i);
  };

  // Cut any sound when the positions change under us (a new key, scale,
  // fingering or direction makes the running position meaningless) and on
  // unmount. This is a CLEANUP rather than an effect body on purpose: React
  // guarantees a cleanup runs before its effect re-runs, so no dependency
  // change can slip past and leave a row stuck showing ⏸.
  useEffect(() => () => stopPlayback(), [modeKey]);

  // Selecting a position lights it on the neck. It does NOT play — playing is
  // its own action now, on each row's button.
  const selectShape = (i: number) => setPinnedShape(i);

  // The ← → arrow keys walk the positions (the visible stepper is gone; the
  // keys stay, because stepping through positions by hand is the whole point).
  const viewRef = useRef<HTMLDivElement>(null);
  useStepper(viewRef, shapes.length, activeShape, selectShape);

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
        </div>
      </div>

      <div className="workbench">
        <NeckPanel
          name={`${noteName(root)} ${scale.name}`}
          legend={<DegreeLegend root={root} scale={scale} />}
          aside={activeShape != null ? positions[activeShape]?.name : undefined}
        >
        <Fretboard
          instrument={GUITAR}
          tuning={GUITAR_STANDARD}
          highlights={wholeNeck}
          shapes={shapes}
          activeShapeIndex={activeShape}
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
      </NeckPanel>

      {/* One TAB per position (the modal fingerings), low -> high — a table of
          tracks. Each row names itself ABOVE its staff and carries its own play
          button, like a track listing. Scrolling a row under the floating neck
          is what lights it: reading down the page walks the positions. */}
      <div className="tab-shelf tab-shelf--lines">
        {/* ALL NOTES — the whole scale at once, as the first row of the list
            rather than a loose button above the neck. It belongs here: it's the
            same kind of choice as the positions under it, one step wider, and
            it sits where Harmony puts its string-set heading. */}
        <div
          className={showAll ? 'tab-allnotes tab-allnotes--on' : 'tab-allnotes'}
          onClick={() => {
            setShowAll(true);
            setPinnedShape(null);
          }}
        >
          <div className="tab-row-head">
            <span className="tab-row-mark" aria-hidden="true" />
            <span className="tab-row-title">All notes</span>
          </div>
        </div>
        {positions.map((pos, i) => (
          <div
            key={i}
            ref={focusRef(i)}
            className={
              'tab-card' +
              (i === activeShape ? ' tab-card--on' : '') +
              (playing === i ? ' tab-card--playing' : '')
            }
            onClick={() => {
              setShowAll(false);
              setPinnedShape(i);
            }}
          >
            <div className="tab-row-head">
              {/* Same lamp as everything else — see the note in the ladders on
                  why the margin bar went. */}
              <span className="tab-row-mark" aria-hidden="true" />
              {SHOW_PLAY_BUTTONS && (
                <button
                  className="tab-play"
                  aria-label={`${playing === i ? 'Stop' : 'Play'} ${pos.name}`}
                  onClick={(e) => {
                    e.stopPropagation(); // playing shouldn't double as selecting
                    setPinnedShape(i);
                    togglePlay(i);
                  }}
                >
                  {playing === i ? '❙❙' : '▶'}
                </button>
              )}
              <span className="tab-row-title">{pos.name}</span>
            </div>
            {/* The run as notation over tablature — one note per moment, in
                the order it's played. */}
            <System
              events={upAndDown(pos.notes).map((n) => [n])}
              width={860}
            />
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
