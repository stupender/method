// ============================================================================
// data/patterns.ts — the interval-pattern presets (paltas)
// ----------------------------------------------------------------------------
// DATA layer. Each pattern is a repeating chain of directed steps through
// whatever material the bar plays (scale tones or chord tones) — see
// PatternDefinition in theory/types.ts for how to read `steps`. Adding a
// pattern = adding a line here; the engine never changes.
// ============================================================================

import type { PatternDefinition } from '../theory/types';

// The list is the source of truth (it keeps this teaching order — a plain
// object would hoist the numeric-looking '1235' key to the front).
export const PATTERN_LIST: PatternDefinition[] = [
  {
    id: 'thirds',
    label: '3rds',
    name: 'in 3rds',
    steps: [2, -1], // up a 3rd, down a 2nd: C E, D F, E G ...
  },
  {
    id: 'fourths',
    label: '4ths',
    name: 'in 4ths',
    steps: [3, -2], // up a 4th, down a 3rd: C F, D G, E A ...
  },
  {
    id: '1235',
    label: '1-2-3-5',
    name: '1-2-3-5 from each degree',
    steps: [1, 1, 2, -3], // C D E G, D E F A ...
  },
  {
    id: 'up4-down2',
    label: '↑4 ↓2',
    name: 'up a 4th, down a 2nd',
    steps: [3, -1], // C F E A G C ... (the endless staircase)
  },
  {
    id: 'down4-down2-up4-down2',
    label: '↓4 ↓2 ↑4 ↓2',
    name: 'down a 4th, down a 2nd, up a 4th, down a 2nd',
    steps: [-3, -1, 3, -1], // Stu's zig-zag — net descending
  },
];

export const PATTERNS: Record<string, PatternDefinition> = Object.fromEntries(
  PATTERN_LIST.map((p) => [p.id, p]),
);
