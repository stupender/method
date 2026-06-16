// ============================================================================
// data/chords.ts — chord-type definitions
// ----------------------------------------------------------------------------
// Each chord type is a name + symbol + the intervals (chord tones) from the
// root (see ChordDefinition in theory/types.ts). Inversions, drop-2/drop-3 and
// spread voicings are NOT separate entries here — they are rearrangements of
// these same tones, handled by Voicings in Session 4. v1 seeds a couple; the
// rest of the backlog is added here as data.
// ============================================================================

import type { ChordDefinition } from '../theory/types';
import { P1, M3, P5, M7 } from './intervals';

// Major triad: root, major 3rd, perfect 5th.
export const MAJOR_TRIAD: ChordDefinition = {
  id: 'major-triad',
  name: 'Major Triad',
  kind: 'chord',
  symbol: '',            // a plain major chord has no suffix, e.g. "C"
  intervals: [P1, M3, P5],
};

// Major seventh: the triad plus a major 7th.
export const MAJOR_SEVENTH: ChordDefinition = {
  id: 'major-seventh',
  name: 'Major Seventh',
  kind: 'chord',
  symbol: 'maj7',        // e.g. "Cmaj7"
  intervals: [P1, M3, P5, M7],
};

// Lookup by id.
export const CHORDS: Record<string, ChordDefinition> = {
  [MAJOR_TRIAD.id]: MAJOR_TRIAD,
  [MAJOR_SEVENTH.id]: MAJOR_SEVENTH,
};
