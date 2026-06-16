// ============================================================================
// data/scales.ts — scale definitions
// ----------------------------------------------------------------------------
// Each scale is a name + a list of intervals from the root (see ScaleDefinition
// in theory/types.ts). v1 ships the major scale; every other scale and mode in
// the backlog (melodic minor, diminished, ...) is added here as more data.
// ============================================================================

import type { ScaleDefinition } from '../theory/types';
import { P1, M2, M3, P4, P5, M6, M7 } from './intervals';

// The major scale: the reference scale all the modes are derived from.
// Intervals from the root: 1 2 3 4 5 6 7  ->  P1 M2 M3 P4 P5 M6 M7.
export const MAJOR_SCALE: ScaleDefinition = {
  id: 'major-scale',
  name: 'Major Scale',
  kind: 'scale',
  aliases: ['Ionian'],
  intervals: [P1, M2, M3, P4, P5, M6, M7],
  degreeNames: ['1', '2', '3', '4', '5', '6', '7'],
};

// Lookup by id, so the UI can list/select scales by name.
export const SCALES: Record<string, ScaleDefinition> = {
  [MAJOR_SCALE.id]: MAJOR_SCALE,
};
