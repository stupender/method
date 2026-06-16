// ============================================================================
// data/voicings.ts — voicing STRUCTURES (the only voicing data we keep)
// ----------------------------------------------------------------------------
// Inversions and the actual shapes are COMPUTED in theory/chord.ts — they are
// fixed theory operations, not content. The one thing worth listing as data is
// the set of structures (how spread out the voices are). Add a structure (e.g.
// "Drop 2 & 4") = add an entry here. See VoicingStructure in theory/types.ts.
//
// `dropFromTop`: which voice from the top to lower by an octave.
//   0 = close position (no drop); 2 = Drop 2; 3 = Drop 3.
// A structure only applies to a chord if it has more voices than dropFromTop
// (you can't "drop" the bottom voice), so Drop 3 shows up only for 7th chords.
// ============================================================================

import type { VoicingStructure } from '../theory/types';

export const STRUCTURES: VoicingStructure[] = [
  { id: 'close', name: 'Close', dropFromTop: 0 },
  { id: 'drop2', name: 'Drop 2', dropFromTop: 2 },
  { id: 'drop3', name: 'Drop 3', dropFromTop: 3 },
];
