// ============================================================================
// theory/keys.ts — the reverse lookup behind the "GPS reveal"
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). The Harmony view goes KEY -> chords.
// This goes the other way: given a CHORD, which keys could it belong to? We
// sweep every key (all four scale systems × 12 roots), ask `diatonicChords`
// what chords that key contains, and keep the keys where our chord shows up —
// recording the Roman numeral it plays there.
//
// That's the signature idea: one chord belongs to many keys (a big possibility
// space); committing more chords would intersect these and narrow it down.
// ============================================================================

import type { Note, ChordDefinition, ScaleDefinition } from './types';
import { pitchClassOf } from './notes';
import { diatonicChords } from './harmony';
import { SCALES } from '../data/scales';
import { ROOT_CHOICES } from '../data/roots';

// One place the chord could live: a key (tonic + scale system) and the Roman
// numeral the chord plays in it.
export interface KeyMatch {
  tonic: Note;
  scale: ScaleDefinition;
  roman: string;
  degree: number; // 0-based scale degree the chord is built on
}

// Every key in which `chord` (rooted at `chordRoot`) is a diatonic chord.
export function keysContaining(
  chordRoot: Note,
  chord: ChordDefinition,
): KeyMatch[] {
  const seventh = chord.intervals.length === 4;
  const rootPitchClass = pitchClassOf(chordRoot);
  const matches: KeyMatch[] = [];

  for (const scale of Object.values(SCALES)) {
    for (const tonic of ROOT_CHOICES) {
      // A future scale could produce a quality we haven't defined; don't let one
      // bad key crash the whole reveal.
      let chordsInKey;
      try {
        chordsInKey = diatonicChords(tonic, scale, seventh);
      } catch {
        continue;
      }
      // The chord belongs to this key if it matches one of the key's diatonic
      // chords by both root (pitch class) and quality.
      const hit = chordsInKey.find(
        (c) => pitchClassOf(c.chordRoot) === rootPitchClass && c.chord.id === chord.id,
      );
      if (hit) {
        matches.push({ tonic, scale, roman: hit.roman, degree: hit.degree });
      }
    }
  }

  return matches;
}
