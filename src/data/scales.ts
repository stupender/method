// ============================================================================
// data/scales.ts — scale definitions
// ----------------------------------------------------------------------------
// Each scale is a name + a list of intervals from the root (see ScaleDefinition
// in theory/types.ts), plus degree labels and the names of the modes that start
// on each degree. The harmony engine (theory/harmony.ts) derives each scale's
// diatonic chords automatically, so adding a scale here also adds its harmony.
//
// Mode names use the most common names; where Stu's teacher Vic Juris labels a
// mode differently in his Harmonic Syllabus, that's noted in a comment.
// ============================================================================

import type { ScaleDefinition } from '../theory/types';
import { P1, M2, m3, M3, P4, P5, m6, M6, M7 } from './intervals';

// The major scale (Ionian) — the reference scale all its modes derive from.
export const MAJOR_SCALE: ScaleDefinition = {
  id: 'major-scale',
  name: 'Major',
  kind: 'scale',
  aliases: ['Ionian'],
  intervals: [P1, M2, M3, P4, P5, M6, M7],
  degreeNames: ['1', '2', '3', '4', '5', '6', '7'],
  modeNames: [
    'Ionian',
    'Dorian',
    'Phrygian',
    'Lydian',
    'Mixolydian',
    'Aeolian',
    'Locrian',
  ],
};

// Melodic minor (ascending / "jazz" minor): 1 2 ♭3 4 5 6 7.
export const MELODIC_MINOR: ScaleDefinition = {
  id: 'melodic-minor',
  name: 'Melodic Minor',
  kind: 'scale',
  aliases: ['Jazz Minor'],
  intervals: [P1, M2, m3, P4, P5, M6, M7],
  degreeNames: ['1', '2', '♭3', '4', '5', '6', '7'],
  modeNames: [
    'Melodic Minor',
    'Dorian ♭2', // Vic: "Dorian ♭2"  (a.k.a. Phrygian ♮6)
    'Lydian Augmented', // Vic: "Lydian Augmented"
    'Lydian Dominant', // Vic: "Lydian ♭7"  (a.k.a. Acoustic / Overtone)
    'Mixolydian ♭6', // Vic: "Mixolydian ♭6"  (a.k.a. Melodic Major)
    'Locrian ♮2', // Vic: "Locrian ♯2"  (a.k.a. half-diminished)
    'Altered', // Vic: "Super Locrian / Altered"  (a.k.a. diminished whole-tone)
  ],
};

// Harmonic minor: 1 2 ♭3 4 5 ♭6 7.
export const HARMONIC_MINOR: ScaleDefinition = {
  id: 'harmonic-minor',
  name: 'Harmonic Minor',
  kind: 'scale',
  intervals: [P1, M2, m3, P4, P5, m6, M7],
  degreeNames: ['1', '2', '♭3', '4', '5', '♭6', '7'],
  modeNames: [
    'Harmonic Minor',
    'Locrian ♮6', // Vic: "Dorian ♭2 ♭5"
    'Ionian Augmented', // Vic: "Ionian ♯5"
    'Dorian ♯4', // Vic: "Dorian ♯4"  (a.k.a. Ukrainian Dorian / Romanian)
    'Phrygian Dominant', // Vic: "Mixolydian ♭2 ♭6 / Phrygian Major" (Spanish)
    'Lydian ♯2', // Vic: "Lydian ♯2 ♯9"
    'Ultralocrian', // Vic: "Diminished / Altered 7th"  (Super Locrian ♭♭7)
  ],
};

// Harmonic major: 1 2 3 4 5 ♭6 7.
export const HARMONIC_MAJOR: ScaleDefinition = {
  id: 'harmonic-major',
  name: 'Harmonic Major',
  kind: 'scale',
  intervals: [P1, M2, M3, P4, P5, m6, M7],
  degreeNames: ['1', '2', '3', '4', '5', '♭6', '7'],
  modeNames: [
    'Harmonic Major',
    'Dorian ♭5', // Vic: "Dorian ♭5"
    'Phrygian ♭4', // Vic: "Altered ♭5 (no 4th)"
    'Lydian ♭3', // Vic: "Lydian Diminished"  (a.k.a. Melodic Minor ♯4)
    'Mixolydian ♭2', // Vic: "Mixolydian ♭2"
    'Lydian Augmented ♯2', // Vic: "Lydian ♯2 ♯5"
    'Locrian ♭♭7', // Vic: "Diminished ♭9"
  ],
};

// Lookup by id, so the UI can list/select scales by name.
export const SCALES: Record<string, ScaleDefinition> = {
  [MAJOR_SCALE.id]: MAJOR_SCALE,
  [MELODIC_MINOR.id]: MELODIC_MINOR,
  [HARMONIC_MINOR.id]: HARMONIC_MINOR,
  [HARMONIC_MAJOR.id]: HARMONIC_MAJOR,
};
