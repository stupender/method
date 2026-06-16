// ============================================================================
// theory/scale.ts — realize a scale from data onto the neck
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). This is the payoff of the data-driven
// design: hand it a root note, a ScaleDefinition (from src/data), an instrument
// and a tuning, and it returns every place that scale's notes sit on the neck —
// correctly spelled and labelled by scale degree. The renderer just draws the
// result; it never learns what a "scale" is.
// ============================================================================

import type {
  Note,
  ScaleDefinition,
  Instrument,
  Tuning,
  PlacedNote,
  PitchClass,
} from './types';
import { pitchClassOf, spellNoteFromInterval, octaveForSpelling, midiOf } from './notes';
import { allPositions, noteAtPosition } from './fretboard';

// One entry of a realized scale: the correctly-spelled note for a degree, plus
// its degree label ("1", "2", "3"...) and whether it's the root.
export interface ScaleTone {
  note: Note; // spelled relative to the root, e.g. Bb in F major
  degree: string; // label from the data, e.g. "3"
  isRoot: boolean;
}

// Turn "root + scale" into the list of spelled scale tones, in order. From C +
// major you get C D E F G A B; from F + major you get F G A Bb C D E (note the
// Bb, never A#). Degrees come from the data's degreeNames, falling back to the
// interval shorthand.
export function realizeScale(root: Note, scale: ScaleDefinition): ScaleTone[] {
  return scale.intervals.map((interval, i) => ({
    note: spellNoteFromInterval(root, interval),
    degree: scale.degreeNames?.[i] ?? interval.name,
    isRoot: i === 0,
  }));
}

// Place a realized scale across the whole neck. For every fret position whose
// pitch class belongs to the scale, we emit a PlacedNote carrying the scale's
// spelling (so a Bb fret reads "Bb") and its degree label.
export function placeScale(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): PlacedNote[] {
  // Build a quick lookup: pitch class -> which scale tone it is.
  const tones = realizeScale(root, scale);
  const byPitchClass = new Map<PitchClass, ScaleTone>();
  for (const tone of tones) {
    byPitchClass.set(pitchClassOf(tone.note), tone);
  }

  const placed: PlacedNote[] = [];
  for (const position of allPositions(instrument)) {
    // The actual pitch sounding at this position (sharp-spelled, correct pitch).
    const sounding = noteAtPosition(tuning, position);
    const pc = pitchClassOf(sounding);
    const tone = byPitchClass.get(pc);
    if (!tone) continue; // this fret isn't in the scale

    // Re-spell the note with the SCALE's letter/accidental but keep the real
    // sounding octave, so the label is right AND audio plays the right pitch.
    const midi = midiOf(sounding);
    const octave = octaveForSpelling(midi, tone.note.letter, tone.note.accidental);

    placed.push({
      position,
      note: { ...tone.note, octave },
      intervalName: tone.degree,
      isRoot: tone.isRoot,
    });
  }

  return placed;
}
