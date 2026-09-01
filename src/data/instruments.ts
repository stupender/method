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

// THE TWO UKULELES, as separate instruments rather than one with two tunings.
// They really are different instruments to the person holding one — different
// size, different string count of frets, and above all a different answer to
// "what is this tuned to" that you don't want to have to set separately. The
// menu asks which instrument you have; the tuning follows from that.

// BARITONE — D3 G3 B3 E4, which is exactly the top four strings of a guitar at
// exactly the same pitches. Everything a guitarist knows about those four
// strings is already true here, which is what makes it the easy one: no
// transposition, no re-entrant surprise, and every shape the engine finds is a
// shape you already half know.
export const UKULELE_BARITONE: Instrument = {
  id: 'uke-baritone',
  name: 'Baritone Ukulele',
  stringCount: 4,
  fretCount: 15,
  defaultTuningId: 'uke-baritone-standard',
};

// TENOR — G4 C4 E4 A4. Take the baritone's four strings, start at the 5th fret
// (D->G, G->C, B->E, E->A) and put the lowest one up an octave. That octave is
// the whole character of the instrument: the G sounds ABOVE the C beside it,
// so the four strings don't climb in pitch the way a guitar's do. See the
// note on the tuning in data/tunings.ts for what that costs.
export const UKULELE_TENOR: Instrument = {
  id: 'uke-tenor',
  name: 'Tenor Ukulele',
  stringCount: 4,
  fretCount: 15,
  defaultTuningId: 'uke-tenor-standard',
};

// A lookup so the rest of the app can find an instrument by id.
export const INSTRUMENTS: Record<string, Instrument> = {
  [GUITAR.id]: GUITAR,
  [UKULELE_BARITONE.id]: UKULELE_BARITONE,
  [UKULELE_TENOR.id]: UKULELE_TENOR,
};

/** The order they're offered in: the big one first, then down. */
export const INSTRUMENT_LIST: Instrument[] = [GUITAR, UKULELE_BARITONE, UKULELE_TENOR];
