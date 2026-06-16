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

import type { Note, Letter, PitchClass } from './types';

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
