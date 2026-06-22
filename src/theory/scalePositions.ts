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
//     hand stays strictly in one ~4-fret position; a minor 3rd / minor 7th crosses
//     DOWN to the next string (below the baseline) rather than shifting the hand.
//     Traditional. (CAGED is a DIFFERENT, 5-shape system — not this.)
//   - hybridBoxes (Hybrid): positional through the lower strings, but once past the
//     G string it switches — keeping a minor 7th ABOVE the baseline on the B string
//     (a light shift up) instead of crossing. Works out to 2 notes on the low E
//     then 3 per string. A common learned blend Stu uses.
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

// ---- Systems 2 & 3: in-position boxes (Positional and Hybrid) -------------
// Both lay TWO OCTAVES of consecutive scale tones across the neck, staying in one
// ~4-fret position: move up a string the moment a tone climbs past the window's
// top, where it sits at a lower fret on the next string. (The major scale's 3rd
// low-E tone lands a whole step past the window, so the low E naturally takes two
// notes — Stu's "notes 2 & 3 of the low E".) They differ by ONE rule at a string
// crossing:
//
//   - Positional (shiftUp = false): a tone ALWAYS crosses down to the next string,
//     even when that puts it BELOW the position (a minor 3rd / 7th "below the
//     baseline"). Where the cross has no room — a ♭7 low on the neck whose next
//     string would be a negative fret — the box simply doesn't form (play it higher
//     up). Strict position playing.
//   - Hybrid (shiftUp = true): a tone crosses down ONLY if it still lands inside the
//     position; if crossing would drop it below the baseline (the ♭7 case) it stays
//     on the current string and shifts UP a fret instead, keeping it on the B
//     string. For a MAJOR-7 scale (Lydian, Ionian) nothing forces a shift, so
//     Hybrid is identical to Positional — the systems diverge ONLY on a ♭7.
const BOX_WIDTH = 4; // a 4-fret hand position

function positionScan(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
  shiftUp: boolean,
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

  // Is the scale's 7th a MINOR 7th (♭7)? That's the only note Hybrid fingers
  // differently from Positional, so a major-7 scale fingers identically in both.
  const lastDegree = scale.intervals.length - 1;
  const seventhIsMinor = scale.intervals[lastDegree].semitones % 12 === 10;

  // Build one in-position box: `boxNotes` consecutive ladder tones from `startIdx`,
  // crossing strings per the Positional / Hybrid rule above.
  const buildBox = (startIdx: number): PlacedNote[] | null => {
    const base = ladder[startIdx] - lowOpen; // the box's start fret on the low E
    const winLo = Math.max(0, base - 1); // allow one fret below for open-side notes
    const winHi = winLo + (BOX_WIDTH - 1);
    const fretOn = (m: number, s: number) => m - midiOf(tuning.openNotes[s]);
    const notes: PlacedNote[] = [];
    let s = 0;
    for (let k = 0; k < boxNotes; k++) {
      const m = ladder[startIdx + k];
      if (m === undefined) return null; // ran off the end of the neck
      // Both cross down a string while the tone climbs past the window's top.
      while (s < stringCount && fretOn(m, s) > winHi) {
        // Hybrid's ONE exception: a ♭7 that would have to drop BELOW the position
        // to cross stays on its string and shifts up a fret instead. This only
        // kicks in once we're past the G string (the top two strings — B and high
        // E on guitar); lower down, and everywhere in Positional, the note crosses
        // down. So a major-7 scale fingers identically in both systems.
        if (
          shiftUp &&
          seventhIsMinor &&
          toneAt(m).degreeIndex === lastDegree &&
          s >= stringCount - 2 &&
          s + 1 < stringCount &&
          fretOn(m, s + 1) < winLo
        ) {
          break;
        }
        s++;
      }
      if (s >= stringCount) return null; // ran off the top string
      const fret = fretOn(m, s);
      if (fret < 0 || fret > fretCount) return null; // can't place it in this box
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

// Positional — strict position playing (minor 3rds/7ths cross DOWN to the next
// string, below the baseline; boxes that can't make the cross don't form).
export function positionalBoxes(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): ScalePosition[] {
  return positionScan(instrument, tuning, root, scale, false);
}

// Hybrid — like Positional, but a tone that would cross BELOW the baseline (a ♭7 at
// the top) stays on the B string and shifts up instead. Same as Positional for
// major-7 scales; the two diverge only on a ♭7.
export function hybridBoxes(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): ScalePosition[] {
  return positionScan(instrument, tuning, root, scale, true);
}
