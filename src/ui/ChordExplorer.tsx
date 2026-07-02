// ============================================================================
// ui/ChordExplorer.tsx — explore one chord's voicings on the neck
// ----------------------------------------------------------------------------
// Given a root + a chord quality, this owns the shared chord UI: the Inversion
// and Structure pickers, the note/degree label toggle, the play button, the
// fretboard, and the TAB. Both the Chords view (absolute chord) and the Harmony
// view (a chord from a key) hand it a root + chord and reuse all of it.
//
// It shows the chosen voicing in ALL its playable positions and string sets: the
// neck lights up every shape (their union), and below it we draw one TAB per
// shape, ordered low -> high up the neck.
//
// Control order follows the agreed priority: Inversion, then Structure. (The
// higher-priority Roman-numeral / triad-vs-7th choices live in the view above.)
// ============================================================================

import { useState } from 'react';
import type { Note, ChordDefinition } from '../theory/types';
import { GUITAR } from '../data/instruments';
import { GUITAR_STANDARD } from '../data/tunings';
import { STRUCTURES } from '../data/voicings';
import {
  placeVoicingAll,
  structuresForChord,
  structureName,
  inversionCount,
  bassDegree,
  bassNoteName,
} from '../theory/chord';
import { midiOf } from '../theory/notes';
import { playChord } from '../audio/player';
import { Fretboard } from '../render/Fretboard';
import { TabView } from '../render/TabView';

export function ChordExplorer({
  root,
  chord,
  labelMode = 'degree',
}: {
  root: Note;
  chord: ChordDefinition;
  // What the dots say — a global display setting, owned by the view above.
  labelMode?: 'note' | 'degree';
}) {
  const [structureId, setStructureId] = useState('close');
  const [inversionIndex, setInversionIndex] = useState(0);
  // Two kinds of selection: a PINNED shape (set by clicking, stays lit) and a
  // HOVERED shape (a temporary preview). Hover wins while the pointer is over a
  // shape; otherwise the pinned one shows. Click the empty neck to unpin.
  const [pinnedShape, setPinnedShape] = useState<number | null>(null);
  const [hoveredShape, setHoveredShape] = useState<number | null>(null);
  const activeShape = hoveredShape ?? pinnedShape;

  const voiceCount = inversionCount(chord);
  const structures = structuresForChord(chord, STRUCTURES);
  const structure = structures.find((s) => s.id === structureId) ?? structures[0];
  const inversion = Math.min(inversionIndex, voiceCount - 1);

  // The inversions, labelled by the note in the BASS and ordered root -> 7th. The
  // inversions are a permutation of the chord's bass notes, so each tone maps to
  // exactly one; for drop voicings that bass differs from the inversion number,
  // which is why we let the player pick the bass directly.
  const bassOptions = chord.intervals
    .map((iv) => {
      const degree = String(iv.diatonicSteps + 1);
      const inv = Array.from({ length: voiceCount }, (_, i) => i).find(
        (i) => bassDegree(chord, structure, i) === degree,
      );
      return inv === undefined ? null : { degree, inv };
    })
    .filter((o): o is { degree: string; inv: number } => o != null);

  // Every playable shape of this voicing across the neck.
  const shapes = placeVoicingAll(
    GUITAR,
    GUITAR_STANDARD,
    root,
    chord,
    structure,
    inversion,
  );

  // If even the easiest shape is a wide stretch, this voicing is hard to grab —
  // flag it and suggest a drop voicing instead of leaving it blank.
  const span = (s: (typeof shapes)[number]) =>
    s.length === 0
      ? 0
      : Math.max(...s.map((p) => p.position.fret)) -
        Math.min(...s.map((p) => p.position.fret));
  const tightestSpan = shapes.length ? Math.min(...shapes.map(span)) : 0;
  const isDifficult = tightestSpan > 4;

  // Play a chord shape (its notes, strummed).
  const playShape = (shape: (typeof shapes)[number]) =>
    playChord(shape.map((p) => midiOf(p.note)));

  // Clicking a shape (neck or TAB) plays it AND pins it as the selection.
  const selectShape = (i: number) => {
    setPinnedShape(i);
    playShape(shapes[i] ?? []);
  };

  return (
    <>
      <div className="view-controls">
        <div className="controls-row">
          <div className="control-group" role="group" aria-label="Bass note">
            {bassOptions.map((o) => (
              <button
                key={o.degree}
                className={o.inv === inversion ? 'pill pill--on' : 'pill'}
                onClick={() => setInversionIndex(o.inv)}
              >
                {bassNoteName(o.degree)}
              </button>
            ))}
          </div>
          <button
            className="pill pill--play"
            onClick={() => playShape(shapes[activeShape ?? 0] ?? [])}
          >
            ▶ Play chord
          </button>
        </div>

        <div className="controls-row">
          <div className="control-group" role="group" aria-label="Structure">
            {structures.map((s) => (
              <button
                key={s.id}
                className={s.id === structure.id ? 'pill pill--on' : 'pill'}
                onClick={() => setStructureId(s.id)}
              >
                {structureName(s, voiceCount)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isDifficult && (
        <p className="control-hint control-hint--warn">
          This voicing is a wide stretch — a Drop 2 or Drop 3 voicing is much
          easier to grab.
        </p>
      )}

      <Fretboard
        instrument={GUITAR}
        tuning={GUITAR_STANDARD}
        shapes={shapes}
        activeShapeIndex={activeShape}
        onShapeHover={setHoveredShape}
        onShapeTap={selectShape}
        onBackgroundClick={() => setPinnedShape(null)}
        labelMode={labelMode}
      />

      {/* One TAB per shape (sorted by string set, low -> high). Hovering a TAB
          previews that shape; clicking it pins the selection. */}
      <div className="tab-shelf">
        {shapes.map((shape, i) => (
          <div
            key={i}
            className={i === activeShape ? 'tab-card tab-card--on' : 'tab-card'}
            onMouseEnter={() => setHoveredShape(i)}
            onMouseLeave={() => setHoveredShape(null)}
            onClick={() => selectShape(i)}
          >
            <TabView
              instrument={GUITAR}
              tuning={GUITAR_STANDARD}
              placed={shape}
              caption={`fr. ${Math.min(...shape.map((p) => p.position.fret))}`}
            />
          </div>
        ))}
      </div>
    </>
  );
}
