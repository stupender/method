// ============================================================================
// theory/notes.ts — pure functions about single notes
// ----------------------------------------------------------------------------
// This is the start of the THEORY LOGIC layer. Everything here is a pure
// function: same input -> same output, no side effects, no React, no drawing.
// That makes it easy to test and easy for a local model to reason about.
//
// The central trick is the "pitch class": every note collapses to a number
// 0..11 (C=0, C#=1, D=2, ... B=11), ignoring which octave it's in. Two notes
// with the same pitch class are "the same note" for the purpose of lighting up
// the fretboard. Octave still matters for AUDIO (a high C vs a low C), so we
// also compute a MIDI number when we need pitch height.
// ============================================================================

import type { Note, Letter, PitchClass, Interval } from './types';

// The musical alphabet in stepping order. We walk this (wrapping past B back to
// C) to find the correct LETTER for an interval before fixing its accidental.
const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// The pitch class of each natural letter, measured from C.
// C D E F G A B  ->  0 2 4 5 7 9 11. (No sharps yet; the accidental is added on.)
const LETTER_PITCH_CLASS: Record<Letter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

// The 12 pitch classes named with sharps. Used to LABEL notes on a bare neck,
// where we have no key/scale to tell us whether to prefer sharps or flats.
// (Once a root + scale is chosen, Session 3 will spell notes correctly.)
const SHARP_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

// The pitch class (0..11) of a note: letter's value, shifted by its accidental,
// wrapped into the 0..11 range. The "+ 12) % 12" guards against negatives (e.g.
// Cb would be -1 before wrapping).
export function pitchClassOf(note: Note): PitchClass {
  const raw = LETTER_PITCH_CLASS[note.letter] + note.accidental;
  return ((raw % 12) + 12) % 12;
}

// The MIDI note number of a note (needs the octave). MIDI 60 = middle C = C4.
// Formula: 12 * (octave + 1) + pitchClass-from-C. We use this for audio later
// and to track octaves as we move up the neck. If octave is missing we assume 4.
export function midiOf(note: Note): number {
  const octave = note.octave ?? 4;
  const fromC = LETTER_PITCH_CLASS[note.letter] + note.accidental;
  return 12 * (octave + 1) + fromC;
}

// A short display label for a note from its own spelling, e.g. "C#", "Eb", "F".
// Accidentals are rendered with the musician-friendly ♭/♯ symbols.
export function noteName(note: Note): string {
  const marks: Record<number, string> = {
    [-2]: '𝄫',
    [-1]: '♭',
    [0]: '',
    [1]: '♯',
    [2]: '𝄪',
  };
  return note.letter + (marks[note.accidental] ?? '');
}

// Build a note from a pitch class using sharp spelling and a given octave.
// Handy when we know a pitch class (e.g. computed at a fret) and just need
// *some* valid Note to display. Not context-aware spelling — that comes later.
export function noteFromPitchClassSharp(
  pitchClass: PitchClass,
  octave: number,
): Note {
  const name = SHARP_NAMES[pitchClass]; // e.g. "C#"
  const letter = name[0] as Letter;
  const accidental: Note['accidental'] = name.length > 1 ? 1 : 0;
  return { letter, accidental, octave };
}

// CORRECT SPELLING: the note an interval above a root, spelled the way a
// musician would write it. This is the whole reason F major reads "Bb" and not
// "A#". Two steps:
//   1. Pick the LETTER by walking the alphabet `interval.diatonicSteps` places
//      from the root's letter (a 3rd above C lands on the letter E, always).
//   2. Pick the ACCIDENTAL so the note's pitch matches `interval.semitones`
//      above the root — i.e. nudge the natural letter up/down to the right pitch.
// The octave is chosen so the result really is that interval ABOVE the root.
export function spellNoteFromInterval(root: Note, interval: Interval): Note {
  // Step 1 — the letter.
  const rootLetterIndex = LETTERS.indexOf(root.letter);
  const targetLetter = LETTERS[(rootLetterIndex + interval.diatonicSteps) % 7];

  // Step 2 — the accidental. Compare the pitch we WANT to the natural letter's
  // pitch, then express the gap as a small accidental (-2..+2).
  const wantedPitchClass = (pitchClassOf(root) + interval.semitones) % 12;
  const naturalPitchClass = LETTER_PITCH_CLASS[targetLetter];
  let gap = wantedPitchClass - naturalPitchClass;
  // Wrap the gap into the nearest -6..+6 range so e.g. "11 vs 0" reads as -1
  // (a flat) rather than +11 (eleven sharps).
  if (gap > 6) gap -= 12;
  if (gap < -6) gap += 12;
  const accidental = gap as Note['accidental'];

  // Octave: the actual sounding pitch is the root's MIDI plus the semitones.
  // Solve the MIDI formula backwards for the octave of our spelled note.
  const soundingMidi = midiOf(root) + interval.semitones;
  const octave = octaveForSpelling(soundingMidi, targetLetter, accidental);

  return { letter: targetLetter, accidental, octave };
}

// Given the MIDI pitch a note must sound at, and the letter+accidental we've
// chosen to spell it with, return the octave that makes them agree. (Needed
// because a flat spelling can sit in a different octave than a sharp one — e.g.
// Cb and B are the same pitch but written with different letters.)
export function octaveForSpelling(
  midi: number,
  letter: Letter,
  accidental: Note['accidental'],
): number {
  const fromC = LETTER_PITCH_CLASS[letter] + accidental;
  return (midi - fromC) / 12 - 1;
}
