// ============================================================================
// theory/scalePositions.ts — the playable position "boxes" of a scale
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). A scale spans the whole neck; players
// learn it in positions — compact boxes you can play without shifting. We use
// the "three notes per string" (3nps) system: each box puts 3 consecutive scale
// tones on every string. There are 7 of them, and each starts on a different
// scale degree — which is exactly the 7 MODES of the scale (a box starting on
// the 2nd degree is the Dorian fingering, and so on).
//
// Like chord voicings, each box is a group of PlacedNotes the renderer shows as
// a constellation. Same machinery, different source.
// ============================================================================

import type {
  Instrument,
  Tuning,
  Note,
  PlacedNote,
  ScaleDefinition,
} from './types';
import { realizeScale } from './scale';
import { pitchClassOf, midiOf, octaveForSpelling } from './notes';

export interface ScalePosition {
  notes: PlacedNote[]; // the box, ready for the fretboard
  name: string; // mode / position label
  lowestFret: number;
}

export function scalePositions(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): ScalePosition[] {
  // Look up each scale tone by pitch class (for spelling + degree + root flag).
  const tones = realizeScale(root, scale);
  const byPitchClass = new Map<
    number,
    { note: Note; degreeIndex: number; degree: string; isRoot: boolean }
  >();
  tones.forEach((t, i) =>
    byPitchClass.set(pitchClassOf(t.note), {
      note: t.note,
      degreeIndex: i,
      degree: t.degree,
      isRoot: t.isRoot,
    }),
  );
  const scalePcs = new Set(byPitchClass.keys());

  // An ascending ladder of every scale-tone MIDI reachable on the neck.
  const lowOpen = midiOf(tuning.openNotes[0]);
  const topReach = midiOf(tuning.openNotes[instrument.stringCount - 1]) + instrument.fretCount;
  const ladder: number[] = [];
  for (let m = lowOpen; m <= topReach; m++) {
    if (scalePcs.has(((m % 12) + 12) % 12)) ladder.push(m);
  }

  // Build one 3nps box whose first note is ladder[startIdx]. Returns null if any
  // note runs off the neck (so we only keep boxes that fully fit).
  const buildBox = (startIdx: number): PlacedNote[] | null => {
    const notes: PlacedNote[] = [];
    let idx = startIdx;
    for (let s = 0; s < instrument.stringCount; s++) {
      const open = midiOf(tuning.openNotes[s]);
      for (let j = 0; j < 3; j++) {
        const m = ladder[idx];
        if (m === undefined) return null;
        const fret = m - open;
        if (fret < 0 || fret > instrument.fretCount) return null;
        const tone = byPitchClass.get(((m % 12) + 12) % 12)!;
        notes.push({
          position: { stringIndex: s, fret },
          note: {
            ...tone.note,
            octave: octaveForSpelling(m, tone.note.letter, tone.note.accidental),
          },
          intervalName: tone.degree,
          isRoot: tone.isRoot,
        });
        idx++;
      }
    }
    return notes;
  };

  // Start a box on each scale tone up the low string, lowest first, until we
  // have the 7 (one per degree) or run out of neck.
  const positions: ScalePosition[] = [];
  for (let i = 0; i < ladder.length && positions.length < 7; i++) {
    const firstFret = ladder[i] - lowOpen;
    if (firstFret < 0 || firstFret > instrument.fretCount) continue;
    const notes = buildBox(i);
    if (!notes) continue;
    const startDegree = byPitchClass.get(((ladder[i] % 12) + 12) % 12)!.degreeIndex;
    positions.push({
      notes,
      name: scale.modeNames?.[startDegree] ?? `Position ${positions.length + 1}`,
      lowestFret: Math.min(...notes.map((p) => p.position.fret)),
    });
  }
  return positions;
}
