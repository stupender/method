// ============================================================================
// ui/PatternExplorer.tsx — drill any scale in interval pairs (Possibility)
// ----------------------------------------------------------------------------
// The systematic palta generator, as a study mode beside Scales and Harmony:
// take the CURRENT scale/mode and walk it in pairs — every interval (3rds to
// 7ths) × every contour (up-up, up-down, down-up, down-down), ascending or
// descending. The neck shows the scale constellation; the readout spells the
// run pair by pair; ▶ plays it. Pure reuse: theory/pairs.ts generates, the
// Fretboard shows, playSequence sounds.
// ============================================================================

import { useState } from 'react';
import type { Note, ScaleDefinition, PlacedNote } from '../theory/types';
import { GUITAR } from '../data/instruments';
import { GUITAR_STANDARD } from '../data/tunings';
import { scalePositions } from '../theory/scalePositions';
import { pairIndices, indexToMidi, type PairContour } from '../theory/pairs';
import { realizeScale } from '../theory/scale';
import { midiOf, noteName, spellNoteFromInterval } from '../theory/notes';
import { playSequence } from '../audio/player';
import { Fretboard } from '../render/Fretboard';
import { Segmented } from './Segmented';

// The pair intervals on offer: 2 scale steps = a 3rd, up to 6 = a 7th.
const INTERVAL_CHOICES = [
  { steps: 2, label: '3rds' },
  { steps: 3, label: '4ths' },
  { steps: 4, label: '5ths' },
  { steps: 5, label: '6ths' },
  { steps: 6, label: '7ths' },
];

export function PatternExplorer({
  root,
  scale,
  labelMode = 'degree',
}: {
  root: Note;
  scale: ScaleDefinition;
  // What the dots say — a global display setting, owned by the view above.
  labelMode?: 'note' | 'degree';
}) {
  const [intervalSteps, setIntervalSteps] = useState(2); // 3rds
  const [contour, setContour] = useState<PairContour>('up-up');
  const [direction, setDirection] = useState<'up' | 'down'>('up');

  // One octave of the scale as MIDI notes (root first) — the drill's material —
  // and the spelled tones for naming (F major says B♭, never A♯).
  const material = scale.intervals.map((iv) => midiOf(spellNoteFromInterval(root, iv)));
  const tones = realizeScale(root, scale);
  const n = material.length;

  // One octave of anchors (n pairs, landing back on the root) in the chosen
  // interval, contour and direction.
  const indices = pairIndices(n, intervalSteps, contour, n + 1, 1, direction === 'down');
  const midis = indices.map((i) => indexToMidi(material, i));
  const name = (i: number) => noteName(tones[((i % n) + n) % n].note);

  // The readout, pair by pair: "C E · F D · E G ...".
  const readout = Array.from({ length: indices.length / 2 }, (_, k) =>
    `${name(indices[2 * k])} ${name(indices[2 * k + 1])}`,
  ).join('  ·  ');

  const play = () => playSequence(midis, 0.26);

  // The whole scale lit across the neck (the union of its position boxes) —
  // you SEE the material while the pattern plays through it.
  const constellation: PlacedNote[] = [];
  const seen = new Set<string>();
  for (const pos of scalePositions(GUITAR, GUITAR_STANDARD, root, scale)) {
    for (const p of pos.notes) {
      const key = `${p.position.stringIndex}-${p.position.fret}`;
      if (!seen.has(key)) {
        seen.add(key);
        constellation.push(p);
      }
    }
  }

  return (
    <>
      <div className="view-controls">
        {/* Row 1 — the drill: which interval, and the play action. */}
        <div className="controls-row">
          <Segmented
            ariaLabel="Pair interval"
            options={INTERVAL_CHOICES.map((c) => ({ value: c.steps, label: c.label }))}
            value={intervalSteps}
            onChange={setIntervalSteps}
          />
          <button className="pill pill--play" onClick={play}>
            ▶ Play pattern
          </button>
        </div>

        {/* Row 2 — the contour (how each pair is played) and the direction the
            pairs travel. */}
        <div className="controls-row">
          <span className="control-label">Contour</span>
          <Segmented
            ariaLabel="Contour"
            options={[
              { value: 'up-up' as const, label: '↑ ↑' },
              { value: 'up-down' as const, label: '↑ ↓' },
              { value: 'down-up' as const, label: '↓ ↑' },
              { value: 'down-down' as const, label: '↓ ↓' },
            ]}
            value={contour}
            onChange={setContour}
          />
          <Segmented
            ariaLabel="Direction"
            options={[
              { value: 'up' as const, label: 'Ascending' },
              { value: 'down' as const, label: 'Descending' },
            ]}
            value={direction}
            onChange={setDirection}
          />
        </div>
      </div>

      {/* The run itself, spelled pair by pair. */}
      <p className="pair-readout">{readout}</p>

      <Fretboard
        instrument={GUITAR}
        tuning={GUITAR_STANDARD}
        shapes={[constellation]}
        labelMode={labelMode}
      />

      <footer className="footnote">
        Each pair is the interval; the arrows say which way the odd and even
        pairs are played. The quiet third ingredient: the pairs themselves march
        up a 2nd — naming that step is what unlocks custom pairings next.
      </footer>
    </>
  );
}
