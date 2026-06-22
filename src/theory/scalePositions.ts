// ============================================================================
// theory/scalePositions.ts — the playable position "boxes" of a scale
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). A scale spans the whole neck; players
// learn it in positions, and there's no single "right" fingering — there are a
// few systems and personal blends. We offer THREE, all built from the same idea
// (lay scale tones across the strings) but with different per-string counts:
//
//   - scalePositions (3 notes per string): each string gets exactly 3 scale
//     tones. Even and wide (~6 frets); modern, good for speed and legato.
//   - positionalBoxes (Positional / position-playing, the 7-position system): the
//     hand stays in one ~4-fret position; strings carry 2–3 notes as they fit.
//     Traditional. (CAGED is a DIFFERENT, 5-shape system — not this.)
//   - hybridBoxes (Hybrid): two octaves, TWO notes on the low E (you start on its
//     2nd note), then THREE per string. A common blend — a positional start with
//     a 3-notes-per-string body.
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
// Like 3-notes-per-string, but the hand STAYS in one ~4-fret position instead of
// shifting up every string. We lay TWO OCTAVES of consecutive scale tones across
// the neck, string by string, moving up a string as soon as the next tone would
// climb past the position's window. Because the major scale's third tone on the
// low E lands a whole step past the window, the low E naturally takes just TWO
// notes (e.g. F major starts F–G, skipping the open E) — Stu's "notes 2 & 3 of
// the low E string" — and the box stays put (F major, position I = frets 0–3).
const BOX_WIDTH = 4; // a 4-fret hand position

export function positionalBoxes(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): ScalePosition[] {
  const byPitchClass = toneLookup(root, scale);
  const scalePcs = new Set(byPitchClass.keys());
  const lowOpen = midiOf(tuning.openNotes[0]);
  const { stringCount, fretCount } = instrument;
  const boxNotes = 2 * scale.intervals.length + 1; // two octaves (15 for a 7-note scale)
  const toneAt = (m: number) => byPitchClass.get(((m % 12) + 12) % 12)!;

  // An ascending ladder of every scale-tone MIDI reachable on the neck.
  const topReach = midiOf(tuning.openNotes[stringCount - 1]) + fretCount;
  const ladder: number[] = [];
  for (let m = lowOpen; m <= topReach; m++) {
    if (scalePcs.has(((m % 12) + 12) % 12)) ladder.push(m);
  }

  // Build one in-position box: `boxNotes` consecutive ladder tones from `startIdx`,
  // staying inside a 4-fret window. We move to the next string the moment a tone
  // would sit above the window (where it has a lower, in-window fret).
  const buildBox = (startIdx: number): PlacedNote[] | null => {
    const base = ladder[startIdx] - lowOpen; // the box's start fret on the low E
    const winLo = Math.max(0, base - 1); // allow one fret below for open-side notes
    const winHi = winLo + (BOX_WIDTH - 1);
    const notes: PlacedNote[] = [];
    let s = 0;
    for (let k = 0; k < boxNotes; k++) {
      const m = ladder[startIdx + k];
      if (m === undefined) return null; // ran off the end of the neck
      // Step up strings until this tone fits at or below the top of the window.
      while (s < stringCount && m - midiOf(tuning.openNotes[s]) > winHi) s++;
      if (s >= stringCount) return null; // ran off the top string
      const fret = m - midiOf(tuning.openNotes[s]);
      if (fret < 0 || fret > fretCount) return null; // doesn't sit in this position
      notes.push(placeAt(tuning, s, fret, toneAt(m)));
    }
    return notes;
  };

  const positions: ScalePosition[] = [];
  for (const start of lowStringStartFrets(tuning, fretCount, byPitchClass)) {
    const startIdx = ladder.indexOf(lowOpen + start);
    if (startIdx < 0) continue;
    const notes = buildBox(startIdx);
    if (!notes) continue;
    const startDegree = toneAt(lowOpen + start).degreeIndex;
    positions.push({
      notes,
      name: scale.modeNames?.[startDegree] ?? `Position ${positions.length + 1}`,
      lowestFret: Math.min(...notes.map((p) => p.position.fret)),
    });
  }
  return positions;
}

// ---- System 3: hybrid (2 on the low E, then 3 notes per string) -----------
// Two octaves of consecutive scale tones: the low E starts you on its 2nd note so
// it gets only TWO, then every string above gets THREE — a positional start with a
// 3-notes-per-string body. F Mixolydian, e.g.: E:F G | A:A B♭ C | D:D E♭ F | G:G A
// B♭ | B:C D E♭ | e:F. Positions whose 3rd low-E note can't reach the next string
// (the open-E box) simply don't form, so every hybrid box has 2 on the low E.
export function hybridBoxes(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): ScalePosition[] {
  const byPitchClass = toneLookup(root, scale);
  const scalePcs = new Set(byPitchClass.keys());
  const lowOpen = midiOf(tuning.openNotes[0]);
  const { stringCount, fretCount } = instrument;
  const boxNotes = 2 * scale.intervals.length + 1; // two octaves
  const toneAt = (m: number) => byPitchClass.get(((m % 12) + 12) % 12)!;

  const topReach = midiOf(tuning.openNotes[stringCount - 1]) + fretCount;
  const ladder: number[] = [];
  for (let m = lowOpen; m <= topReach; m++) {
    if (scalePcs.has(((m % 12) + 12) % 12)) ladder.push(m);
  }

  // 2 tones on the low E, 3 on every string above, stopping at two octaves.
  const buildBox = (startIdx: number): PlacedNote[] | null => {
    const notes: PlacedNote[] = [];
    let idx = startIdx;
    for (let s = 0; s < stringCount; s++) {
      const open = midiOf(tuning.openNotes[s]);
      const count = s === 0 ? 2 : 3;
      for (let j = 0; j < count; j++) {
        if (notes.length >= boxNotes) return notes; // two octaves laid down
        const m = ladder[idx];
        if (m === undefined) return null;
        const fret = m - open;
        if (fret < 0 || fret > fretCount) return null; // doesn't fit this string
        notes.push(placeAt(tuning, s, fret, toneAt(m)));
        idx++;
      }
    }
    return notes;
  };

  const positions: ScalePosition[] = [];
  for (const start of lowStringStartFrets(tuning, fretCount, byPitchClass)) {
    const startIdx = ladder.indexOf(lowOpen + start);
    if (startIdx < 0) continue;
    const notes = buildBox(startIdx);
    if (!notes) continue;
    const startDegree = toneAt(lowOpen + start).degreeIndex;
    positions.push({
      notes,
      name: scale.modeNames?.[startDegree] ?? `Position ${positions.length + 1}`,
      lowestFret: Math.min(...notes.map((p) => p.position.fret)),
    });
  }
  return positions;
}
