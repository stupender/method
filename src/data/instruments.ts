// ============================================================================
// data/instruments.ts — the instruments Method can draw
// ----------------------------------------------------------------------------
// An Instrument is the PHYSICAL layout only (how many strings, how many frets).
// The pitches live in a Tuning (see data/tunings.ts), so one instrument can
// have many tunings. v1 surfaces the guitar; the ukulele entry is included to
// PROVE the engine is instrument-agnostic — it's real, valid data the fretboard
// could draw with no code change, even though the v1 UI only offers guitar.
// ============================================================================

import type { Instrument } from '../theory/types';

export const GUITAR: Instrument = {
  id: 'guitar',
  name: 'Guitar',
  stringCount: 6,
  fretCount: 17, // enough frets for all 7 three-notes-per-string scale positions
  defaultTuningId: 'guitar-standard',
};

// Not surfaced in the v1 UI — here only to demonstrate that adding an
// instrument is pure data. (A future session can drop a switch in the UI.)
export const UKULELE: Instrument = {
  id: 'ukulele',
  name: 'Ukulele',
  stringCount: 4,
  fretCount: 12,
  defaultTuningId: 'ukulele-standard',
};

// A lookup so the rest of the app can find an instrument by id.
export const INSTRUMENTS: Record<string, Instrument> = {
  [GUITAR.id]: GUITAR,
  [UKULELE.id]: UKULELE,
};
