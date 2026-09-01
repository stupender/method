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

// TENOR — G C E A. Take the baritone's four strings, start at the 5th fret
// (D->G, G->C, B->E, E->A), and that's a tenor.
//
// IT OPENS IN LOW G, which is not the commoner tuning of the two. Stu's call,
// and the reasoning is worth keeping: on a re-entrant (high G) tenor the
// lowest-numbered string sounds ABOVE the one next to it, which breaks the
// assumption the voicing engine rests on and makes an inversion label name a
// bass note that isn't sounding. Low G climbs like every other tuning here, so
// everything the app says is exactly true — and a player holding a high-G uke
// reads the same shapes and adjusts for the one string without being told
// anything wrong. High G is one tap away in the menu.
export const UKULELE_TENOR: Instrument = {
  id: 'uke-tenor',
  name: 'Tenor Ukulele',
  stringCount: 4,
  fretCount: 15,
  defaultTuningId: 'uke-tenor-low-g',
};

// THE KEYBOARD — one string, and every fret a semitone.
//
// That sentence is the whole design. A piano is a single unbroken course of
// notes: press the key a semitone above the last one and you get the next
// note. A guitar string is the same thing, once. So a keyboard is a one-string
// instrument with as many "frets" as it has keys, and every pure function in
// theory/ works on it with no changes at all — a scale is still a set of
// (string 0, fret n) positions, a chord is still a set of pitches placed on
// the neck it's given.
//
// What changes is the PICTURE, which is what `layout: 'keys'` says: draw keys,
// not a neck. And what falls away is everything that only exists because a
// guitar has six strings — which fingering, which string set. There's one way
// to play a C on a keyboard.
//
// THREE OCTAVES FROM C2, which is 36 semitones and 37 keys. Wide enough that a
// scale has room to run in more than one register and a chord can be voiced
// low or high; narrow enough to stay legible across a phone. The bottom note
// is C because a keyboard's octaves are read from C — the two-black-key group
// is the landmark your eye finds, and starting anywhere else would put that
// landmark in a different place from every real piano.
export const KEYBOARD: Instrument = {
  id: 'keyboard',
  name: 'Keyboard',
  stringCount: 1,
  fretCount: 36,
  defaultTuningId: 'keyboard-c2',
  layout: 'keys',
};

// A lookup so the rest of the app can find an instrument by id.
export const INSTRUMENTS: Record<string, Instrument> = {
  [GUITAR.id]: GUITAR,
  [UKULELE_BARITONE.id]: UKULELE_BARITONE,
  [UKULELE_TENOR.id]: UKULELE_TENOR,
  [KEYBOARD.id]: KEYBOARD,
};

/** The order they're offered in: the fretted ones, then the keyboard. */
export const INSTRUMENT_LIST: Instrument[] = [
  GUITAR,
  UKULELE_BARITONE,
  UKULELE_TENOR,
  KEYBOARD,
];
