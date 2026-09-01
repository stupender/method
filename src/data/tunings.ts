// ============================================================================
// data/tunings.ts — open-string notes for each instrument
// ----------------------------------------------------------------------------
// A Tuning is just the list of open-string notes, ordered LOW pitch -> HIGH
// pitch (index 0 = thick low string). See the Tuning type in theory/types.ts
// for the full convention. Alternate tunings (drop-D, DADGAD, etc.) are added
// here as more data — no engine changes.
// ============================================================================

import type { Tuning } from '../theory/types';

// Standard guitar tuning, low to high: E2 A2 D3 G3 B3 E4.
// Each open note is fully spelled (letter + accidental + octave) so audio and
// notation both have what they need.
export const GUITAR_STANDARD: Tuning = {
  id: 'guitar-standard',
  name: 'Standard',
  instrumentId: 'guitar',
  openNotes: [
    { letter: 'E', accidental: 0, octave: 2 }, // string 0 — low E
    { letter: 'A', accidental: 0, octave: 2 }, // string 1
    { letter: 'D', accidental: 0, octave: 3 }, // string 2
    { letter: 'G', accidental: 0, octave: 3 }, // string 3
    { letter: 'B', accidental: 0, octave: 3 }, // string 4
    { letter: 'E', accidental: 0, octave: 4 }, // string 5 — high E
  ],
};

// BARITONE UKULELE — D3 G3 B3 E4. The guitar's top four strings, at the guitar's
// own pitches. Nothing about the convention above is strained: it climbs low to
// high like a guitar, and every shape the engine finds is one a guitarist
// already half knows.
export const UKE_BARITONE_STANDARD: Tuning = {
  id: 'uke-baritone-standard',
  name: 'Standard',
  instrumentId: 'uke-baritone',
  openNotes: [
    { letter: 'D', accidental: 0, octave: 3 }, // string 0 — nearest your face
    { letter: 'G', accidental: 0, octave: 3 },
    { letter: 'B', accidental: 0, octave: 3 },
    { letter: 'E', accidental: 0, octave: 4 }, // string 3
  ],
};

// TENOR UKULELE — G4 C4 E4 A4, RE-ENTRANT, which is the standard tuning and
// the one nearly every tenor arrives in.
//
// THIS IS THE ONE THAT BENDS THE RULE at the top of this file. The G is the
// string nearest your face, so it belongs at index 0 by POSITION — but it
// sounds a fourth ABOVE the C next to it, so index 0 is no longer the lowest
// pitch. Both readings can't be satisfied at once and position is the one that
// matters here, because everything this app draws is a diagram of where your
// fingers go: the fretboard, the TAB staff, the string labels. Order these by
// pitch instead and the fretboard would draw the strings in an order no
// ukulele has ever been strung in.
//
// WHAT THAT COSTS, honestly: the voicing engine assumes a higher string index
// means a higher pitch, which is true of every other tuning here. On a
// re-entrant tenor a chord it labels "1st inversion" is voiced correctly by
// FRET but the G string sounds an octave above where the engine thinks it
// does, so the sounding bass note may not be the one named. Scales, note
// names, the fretboard and the TAB are all exactly right — it's only the
// inversion LABEL in Harmony that inherits the assumption. Low-G tenor below
// avoids it entirely.
export const UKE_TENOR_STANDARD: Tuning = {
  id: 'uke-tenor-standard',
  name: 'Standard (high G)',
  instrumentId: 'uke-tenor',
  openNotes: [
    { letter: 'G', accidental: 0, octave: 4 }, // string 0 — re-entrant: sounds ABOVE the C
    { letter: 'C', accidental: 0, octave: 4 },
    { letter: 'E', accidental: 0, octave: 4 },
    { letter: 'A', accidental: 0, octave: 4 }, // string 3
  ],
};

// TENOR, LOW G — the same instrument strung so it climbs like a guitar. Common
// enough to be worth having, and the one to reach for if the inversion labels
// in Harmony need to be exactly right.
export const UKE_TENOR_LOW_G: Tuning = {
  id: 'uke-tenor-low-g',
  name: 'Low G',
  instrumentId: 'uke-tenor',
  openNotes: [
    { letter: 'G', accidental: 0, octave: 3 },
    { letter: 'C', accidental: 0, octave: 4 },
    { letter: 'E', accidental: 0, octave: 4 },
    { letter: 'A', accidental: 0, octave: 4 },
  ],
};

// Lookup by tuning id.
export const TUNINGS: Record<string, Tuning> = {
  [GUITAR_STANDARD.id]: GUITAR_STANDARD,
  [UKE_BARITONE_STANDARD.id]: UKE_BARITONE_STANDARD,
  [UKE_TENOR_STANDARD.id]: UKE_TENOR_STANDARD,
  [UKE_TENOR_LOW_G.id]: UKE_TENOR_LOW_G,
};

/** Every tuning an instrument can be in, in the order they're offered. */
export function tuningsFor(instrumentId: string): Tuning[] {
  return Object.values(TUNINGS).filter((t) => t.instrumentId === instrumentId);
}
