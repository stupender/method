// ============================================================================
// data/roots.ts — the twelve roots offered in the UI
// ----------------------------------------------------------------------------
// A root is just a Note. We pick one spelling per pitch class for the chooser,
// using the spelling a musician most often reaches for in that key (flats for
// Db/Eb/Gb/Ab/Bb, naturals/sharps elsewhere). Octave 4 is a comfortable
// mid-range starting point for the "play scale" button; the neck recomputes
// octaves per position regardless of this choice.
// ============================================================================

import type { Note } from '../theory/types';

export const ROOT_CHOICES: Note[] = [
  { letter: 'C', accidental: 0, octave: 4 },
  { letter: 'D', accidental: -1, octave: 4 }, // Db
  { letter: 'D', accidental: 0, octave: 4 },
  { letter: 'E', accidental: -1, octave: 4 }, // Eb
  { letter: 'E', accidental: 0, octave: 4 },
  { letter: 'F', accidental: 0, octave: 4 },
  { letter: 'G', accidental: -1, octave: 4 }, // Gb
  { letter: 'G', accidental: 0, octave: 4 },
  { letter: 'A', accidental: -1, octave: 4 }, // Ab
  { letter: 'A', accidental: 0, octave: 4 },
  { letter: 'B', accidental: -1, octave: 4 }, // Bb
  { letter: 'B', accidental: 0, octave: 4 },
];
