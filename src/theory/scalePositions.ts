// ============================================================================
// theory/scalePositions.ts — the playable position "boxes" of a scale
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). A scale spans the whole neck; players
// learn it in positions. We offer TWO fingering systems, both producing 7 boxes
// (one per scale degree = the 7 MODES):
//
//   - scalePositions (3 notes per string): each string gets exactly 3 scale
//     tones. Even and wide (~6 frets); modern, good for speed.
//   - positionalBoxes (in-position / "box"): all the scale tones that fall in a
//     compact ~4-fret hand position. Mostly 2 notes per string (sometimes 3);
//     the low E starts the box. Traditional, stays in one hand position.
//
// Each box is a group of PlacedNotes the renderer shows as a constellation —
// same machinery as chord voicings, different source.
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

// Shared lookup: scale tone (spelling + degree + root flag) by pitch class.
interface ScaleTone {
  note: Note;
  degreeIndex: number;
  degree: string;
  isRoot: boolean;
}
function toneLookup(root: Note, scale: ScaleDefinition): Map<number, ScaleTone> {
  const map = new Map<number, ScaleTone>();
  realizeScale(root, scale).forEach((t, i) =>
    map.set(pitchClassOf(t.note), {
      note: t.note,
      degreeIndex: i,
      degree: t.degree,
      isRoot: t.isRoot,
    }),
  );
  return map;
}

// Make a PlacedNote for the note sounding at (string, fret), given its tone.
function placeAt(
  tuning: Tuning,
  stringIndex: number,
  fret: number,
  tone: ScaleTone,
): PlacedNote {
  const midi = midiOf(tuning.openNotes[stringIndex]) + fret;
  return {
    position: { stringIndex, fret },
    note: {
      ...tone.note,
      octave: octaveForSpelling(midi, tone.note.letter, tone.note.accidental),
    },
    intervalName: tone.degree,
    isRoot: tone.isRoot,
  };
}

// The lowest 7 frets on the low E string that land on a scale tone — the start
// of each of the 7 positions, low to high.
function lowStringStartFrets(
  tuning: Tuning,
  fretCount: number,
  byPitchClass: Map<number, ScaleTone>,
): number[] {
  const lowOpen = midiOf(tuning.openNotes[0]);
  const starts: number[] = [];
  for (let f = 0; f <= fretCount && starts.length < 7; f++) {
    if (byPitchClass.has(((lowOpen + f) % 12 + 12) % 12)) starts.push(f);
  }
  return starts;
}

// ---- System 1: three notes per string ------------------------------------
export function scalePositions(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): ScalePosition[] {
  const byPitchClass = toneLookup(root, scale);
  const scalePcs = new Set(byPitchClass.keys());

  // An ascending ladder of every scale-tone MIDI reachable on the neck.
  const lowOpen = midiOf(tuning.openNotes[0]);
  const topReach = midiOf(tuning.openNotes[instrument.stringCount - 1]) + instrument.fretCount;
  const ladder: number[] = [];
  for (let m = lowOpen; m <= topReach; m++) {
    if (scalePcs.has(((m % 12) + 12) % 12)) ladder.push(m);
  }

  // A 3nps box: 3 consecutive ladder tones on each string. Null if it runs off.
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
        notes.push(placeAt(tuning, s, fret, byPitchClass.get(((m % 12) + 12) % 12)!));
        idx++;
      }
    }
    return notes;
  };

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

// ---- System 2: in-position "box" (mostly 2 notes per string) -------------
const BOX_WIDTH = 4; // a 4-fret hand position

export function positionalBoxes(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): ScalePosition[] {
  const byPitchClass = toneLookup(root, scale);
  const lowOpen = midiOf(tuning.openNotes[0]);

  const positions: ScalePosition[] = [];
  for (const start of lowStringStartFrets(tuning, instrument.fretCount, byPitchClass)) {
    const end = Math.min(instrument.fretCount, start + BOX_WIDTH - 1);
    const notes: PlacedNote[] = [];
    // Every scale tone that falls inside the hand position, string by string.
    for (let s = 0; s < instrument.stringCount; s++) {
      const open = midiOf(tuning.openNotes[s]);
      let onThisString = 0;
      for (let f = start; f <= end; f++) {
        const tone = byPitchClass.get(((open + f) % 12 + 12) % 12);
        if (!tone) continue;
        notes.push(placeAt(tuning, s, f, tone));
        onThisString++;
        // The box should START WITH TWO NOTES on the low E string, so cap it at
        // two even when a half-step would otherwise put a third in the window.
        if (s === 0 && onThisString === 2) break;
      }
    }
    // The box starts on whatever degree sits at `start` on the low E string.
    const startDegree = byPitchClass.get(((lowOpen + start) % 12 + 12) % 12)!.degreeIndex;
    positions.push({
      notes,
      name: scale.modeNames?.[startDegree] ?? `Position ${positions.length + 1}`,
      lowestFret: start,
    });
  }
  return positions;
}
