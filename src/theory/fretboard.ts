// ============================================================================
// theory/fretboard.ts — pure functions that place notes on the neck
// ----------------------------------------------------------------------------
// Still the THEORY LOGIC layer: no React, no SVG. These functions answer two
// questions the renderer needs:
//   1. "What note sounds at this string + fret?"           -> noteAtPosition
//   2. "Where do these target notes appear on the neck?"   -> findPositions
// The renderer (src/render/Fretboard.tsx) only ever consumes their output, so
// it never has to know any music theory.
// ============================================================================

import type {
  Tuning,
  Instrument,
  Position,
  PlacedNote,
  PitchClass,
} from './types';
import {
  pitchClassOf,
  midiOf,
  noteFromPitchClassSharp,
  noteName,
} from './notes';

// The note that sounds when you press a given string at a given fret.
// Moving up one fret raises the pitch by one semitone, so we take the open
// string's MIDI number and add the fret number, then read back the pitch class
// and octave. Spelling is sharp-based for now (no key context yet).
export function noteAtPosition(tuning: Tuning, position: Position) {
  const openNote = tuning.openNotes[position.stringIndex];
  const midi = midiOf(openNote) + position.fret; // one fret = one semitone
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1; // inverse of the MIDI formula
  return noteFromPitchClassSharp(pitchClass, octave);
}

// Every playable position on an instrument: each string, fret 0 (open) up to
// the instrument's fret count. This is the full grid the renderer draws onto.
export function allPositions(instrument: Instrument): Position[] {
  const positions: Position[] = [];
  for (let stringIndex = 0; stringIndex < instrument.stringCount; stringIndex++) {
    for (let fret = 0; fret <= instrument.fretCount; fret++) {
      positions.push({ stringIndex, fret });
    }
  }
  return positions;
}

// Find every position on the neck whose note matches one of the target pitch
// classes. This is how we "light up an arbitrary set of notes passed as data":
// hand it [0, 4, 7] (C, E, G) and it returns all the places a C, E or G sits.
//
// `rootPitchClass` (optional) marks which target is the root, so the UI can
// colour it differently. This small hook is what the GPS reveal builds on later.
export function findPositions(
  instrument: Instrument,
  tuning: Tuning,
  targetPitchClasses: PitchClass[],
  rootPitchClass?: PitchClass,
): PlacedNote[] {
  const lit: PlacedNote[] = [];

  for (const position of allPositions(instrument)) {
    const note = noteAtPosition(tuning, position);
    const pc = pitchClassOf(note);

    // Skip this position if its note isn't one we're looking for.
    if (!targetPitchClasses.includes(pc)) continue;

    lit.push({
      position,
      note,
      intervalName: noteName(note), // bare neck: label with the note name itself
      isRoot: pc === rootPitchClass,
    });
  }

  return lit;
}
