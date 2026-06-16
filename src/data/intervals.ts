// ============================================================================
// data/intervals.ts — a catalog of common intervals
// ----------------------------------------------------------------------------
// Scales and chords are built from intervals. Rather than re-typing
// { name, diatonicSteps, semitones } everywhere, we name the common ones once
// here and reuse them. This is data, not logic: each constant is just a labelled
// distance from the root. (See the Interval type in theory/types.ts for what
// the three numbers mean.)
//
// Reminder of the two distances:
//   diatonicSteps = how many letter names to move (0 = unison, 2 = a 3rd, ...)
//   semitones     = how many half-steps above the root
// ============================================================================

import type { Interval } from '../theory/types';

// Perfect / major intervals within one octave, plus the few altered ones we
// need for seventh chords. Add more here as new scales/chords require them.
export const P1: Interval = { name: 'P1', diatonicSteps: 0, semitones: 0 };  // unison / root
export const M2: Interval = { name: 'M2', diatonicSteps: 1, semitones: 2 };  // major 2nd
export const m3: Interval = { name: 'm3', diatonicSteps: 2, semitones: 3 };  // minor 3rd
export const M3: Interval = { name: 'M3', diatonicSteps: 2, semitones: 4 };  // major 3rd
export const P4: Interval = { name: 'P4', diatonicSteps: 3, semitones: 5 };  // perfect 4th
export const P5: Interval = { name: 'P5', diatonicSteps: 4, semitones: 7 };  // perfect 5th
export const M6: Interval = { name: 'M6', diatonicSteps: 5, semitones: 9 };  // major 6th
export const m7: Interval = { name: 'm7', diatonicSteps: 6, semitones: 10 }; // minor 7th
export const M7: Interval = { name: 'M7', diatonicSteps: 6, semitones: 11 }; // major 7th
