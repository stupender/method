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

// Demonstration data only (ukulele isn't in the v1 UI). Standard re-entrant
// ukulele tuning G4 C4 E4 A4 — note the G is HIGHER than the C, which is why
// real instruments needed a flexible tuning model and not a hard-coded guitar.
export const UKULELE_STANDARD: Tuning = {
  id: 'ukulele-standard',
  name: 'Standard',
  instrumentId: 'ukulele',
  openNotes: [
    { letter: 'G', accidental: 0, octave: 4 },
    { letter: 'C', accidental: 0, octave: 4 },
    { letter: 'E', accidental: 0, octave: 4 },
    { letter: 'A', accidental: 0, octave: 4 },
  ],
};

// Lookup by tuning id.
export const TUNINGS: Record<string, Tuning> = {
  [GUITAR_STANDARD.id]: GUITAR_STANDARD,
  [UKULELE_STANDARD.id]: UKULELE_STANDARD,
};
