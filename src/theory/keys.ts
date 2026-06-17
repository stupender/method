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

// A key in which an ENTIRE progression fits: every chord is diatonic. `romans`
// gives the Roman numeral each chord plays, in order.
export interface ProgressionKeyMatch {
  tonic: Note;
  scale: ScaleDefinition;
  romans: string[];
}

// Every key that contains ALL of the given chords (the intersection). Adding
// more chords can only shrink this list — that's the "narrowing" of the
// possibility space. Chords may mix triads and sevenths.
export function keysContainingAll(
  chords: { root: Note; chord: ChordDefinition }[],
): ProgressionKeyMatch[] {
  if (chords.length === 0) return [];
  const matches: ProgressionKeyMatch[] = [];

  for (const scale of Object.values(SCALES)) {
    for (const tonic of ROOT_CHOICES) {
      // Compute the key's diatonic triads AND sevenths once, then match each
      // chord against the set of its own size.
      let triads, sevenths;
      try {
        triads = diatonicChords(tonic, scale, false);
        sevenths = diatonicChords(tonic, scale, true);
      } catch {
        continue;
      }

      const romans: string[] = [];
      let allFit = true;
      for (const { root, chord } of chords) {
        const set = chord.intervals.length === 4 ? sevenths : triads;
        const rootPc = pitchClassOf(root);
        const hit = set.find(
          (c) => pitchClassOf(c.chordRoot) === rootPc && c.chord.id === chord.id,
        );
        if (!hit) {
          allFit = false;
          break;
        }
        romans.push(hit.roman);
      }
      if (allFit) matches.push({ tonic, scale, romans });
    }
  }

  return matches;
}
