// ============================================================================
// data/chords.ts — chord-type definitions
// ----------------------------------------------------------------------------
// Each chord type is a name + symbol + the intervals (chord tones) from the
// root (see ChordDefinition in theory/types.ts). Inversions, drop-2/drop-3 and
// spread voicings are NOT separate entries here — they are rearrangements of
// these same tones, handled by the voicing engine (theory/chord.ts).
//
// These are also the qualities the diatonic-harmony engine (theory/harmony.ts)
// matches against: stack the major scale in thirds and you get exactly these
// (major/minor/diminished triads; maj7 / m7 / dom7 / m7b5 sevenths).
// ============================================================================

import type { ChordDefinition } from '../theory/types';
import { P1, m3, M3, d5, P5, m7, M7 } from './intervals';

// --- Triads ---------------------------------------------------------------
export const MAJOR_TRIAD: ChordDefinition = {
  id: 'major-triad',
  name: 'Major Triad',
  kind: 'chord',
  symbol: '',            // e.g. "C"
  intervals: [P1, M3, P5],
};

export const MINOR_TRIAD: ChordDefinition = {
  id: 'minor-triad',
  name: 'Minor Triad',
  kind: 'chord',
  symbol: 'm',           // e.g. "Cm"
  intervals: [P1, m3, P5],
};

export const DIMINISHED_TRIAD: ChordDefinition = {
  id: 'diminished-triad',
  name: 'Diminished Triad',
  kind: 'chord',
  symbol: 'dim',         // e.g. "Bdim"
  intervals: [P1, m3, d5],
};

// --- Seventh chords -------------------------------------------------------
export const MAJOR_SEVENTH: ChordDefinition = {
  id: 'major-seventh',
  name: 'Major Seventh',
  kind: 'chord',
  symbol: 'maj7',        // e.g. "Cmaj7"
  intervals: [P1, M3, P5, M7],
};

export const MINOR_SEVENTH: ChordDefinition = {
  id: 'minor-seventh',
  name: 'Minor Seventh',
  kind: 'chord',
  symbol: 'm7',          // e.g. "Dm7"
  intervals: [P1, m3, P5, m7],
};

export const DOMINANT_SEVENTH: ChordDefinition = {
  id: 'dominant-seventh',
  name: 'Dominant Seventh',
  kind: 'chord',
  symbol: '7',           // e.g. "G7"
  intervals: [P1, M3, P5, m7],
};

export const HALF_DIMINISHED: ChordDefinition = {
  id: 'half-diminished',
  name: 'Half-Diminished (m7♭5)',
  kind: 'chord',
  symbol: 'm7b5',        // e.g. "Bm7b5"
  intervals: [P1, m3, d5, m7],
};

// Lookup by id, in a sensible display order (triads then sevenths).
export const CHORDS: Record<string, ChordDefinition> = {
  [MAJOR_TRIAD.id]: MAJOR_TRIAD,
  [MINOR_TRIAD.id]: MINOR_TRIAD,
  [DIMINISHED_TRIAD.id]: DIMINISHED_TRIAD,
  [MAJOR_SEVENTH.id]: MAJOR_SEVENTH,
  [MINOR_SEVENTH.id]: MINOR_SEVENTH,
  [DOMINANT_SEVENTH.id]: DOMINANT_SEVENTH,
  [HALF_DIMINISHED.id]: HALF_DIMINISHED,
};
