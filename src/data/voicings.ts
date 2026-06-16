// ============================================================================
// data/voicings.ts — chord voicings as DATA
// ----------------------------------------------------------------------------
// A voicing is a rearrangement of a chord's tones, NOT a new chord. Each entry
// lists its voices LOW -> HIGH as { intervalName, octaveShift }, where the
// intervalName matches a tone in the chord definition (P1, M3, P5, M7) and the
// octaveShift moves that voice up/down whole octaves. The engine stacks the
// chord in close root position, then applies these moves. Add a voicing = add
// data here; no engine change.
//
// `stringSet` is the v1 guitar placement (string indices low->high, 0 = low E).
//
// Voicings are grouped by how many voices they have, so the UI can offer the
// 3-voice ones for triads and the 4-voice ones for seventh chords.
// ============================================================================

import type { VoicingDefinition } from '../theory/types';

// --- Triad voicings (3 voices) -------------------------------------------
// Default string set D-G-B (indices 2,3,4) for the close voicings.
export const TRIAD_VOICINGS: VoicingDefinition[] = [
  {
    id: 'triad-root',
    name: 'Root Position',
    tones: [
      { intervalName: 'P1', octaveShift: 0 },
      { intervalName: 'M3', octaveShift: 0 },
      { intervalName: 'P5', octaveShift: 0 },
    ],
    stringSet: [2, 3, 4],
  },
  {
    id: 'triad-1st',
    name: 'First Inversion',
    // 3rd in the bass: 3, 5, then the root up an octave.
    tones: [
      { intervalName: 'M3', octaveShift: 0 },
      { intervalName: 'P5', octaveShift: 0 },
      { intervalName: 'P1', octaveShift: 1 },
    ],
    stringSet: [2, 3, 4],
  },
  {
    id: 'triad-2nd',
    name: 'Second Inversion',
    // 5th in the bass: 5, then root and 3rd up an octave.
    tones: [
      { intervalName: 'P5', octaveShift: 0 },
      { intervalName: 'P1', octaveShift: 1 },
      { intervalName: 'M3', octaveShift: 1 },
    ],
    stringSet: [2, 3, 4],
  },
  {
    id: 'triad-spread',
    name: 'Spread (Open)',
    // Open voicing wider than an octave: root, 5th, then the 3rd up top.
    tones: [
      { intervalName: 'P1', octaveShift: 0 },
      { intervalName: 'P5', octaveShift: 0 },
      { intervalName: 'M3', octaveShift: 1 },
    ],
    stringSet: [0, 2, 4], // E - D - B, skipping strings for the open sound
  },
];

// --- Seventh-chord voicings (4 voices) -----------------------------------
export const SEVENTH_VOICINGS: VoicingDefinition[] = [
  {
    id: 'seventh-close',
    name: 'Close (Root Position)',
    tones: [
      { intervalName: 'P1', octaveShift: 0 },
      { intervalName: 'M3', octaveShift: 0 },
      { intervalName: 'P5', octaveShift: 0 },
      { intervalName: 'M7', octaveShift: 0 },
    ],
    stringSet: [2, 3, 4, 5], // D-G-B-e
  },
  {
    id: 'seventh-drop2',
    name: 'Drop 2',
    // Take close root position, drop the 2nd voice from the TOP (the 5th) an
    // octave: low->high becomes 5(-8va), 1, 3, 7.
    tones: [
      { intervalName: 'P5', octaveShift: -1 },
      { intervalName: 'P1', octaveShift: 0 },
      { intervalName: 'M3', octaveShift: 0 },
      { intervalName: 'M7', octaveShift: 0 },
    ],
    stringSet: [2, 3, 4, 5], // D-G-B-e
  },
  {
    id: 'seventh-drop3',
    name: 'Drop 3',
    // Drop the 3rd voice from the TOP (the 3rd) an octave: low->high becomes
    // 3(-8va), 1, 5, 7. Played with a string skip (E-D-G-B).
    tones: [
      { intervalName: 'M3', octaveShift: -1 },
      { intervalName: 'P1', octaveShift: 0 },
      { intervalName: 'P5', octaveShift: 0 },
      { intervalName: 'M7', octaveShift: 0 },
    ],
    stringSet: [0, 2, 3, 4], // E - D - G - B (skip the A string)
  },
];

export const ALL_VOICINGS: VoicingDefinition[] = [
  ...TRIAD_VOICINGS,
  ...SEVENTH_VOICINGS,
];
