// ============================================================================
// theory/earMaterial.ts — what the ear quizzes are allowed to play at you
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure function). The CONTROLS panel in Ear mode is a set
// of multi-selects — keys, scales, degrees, and whether we're listening to
// scales or harmony. Each extra selection WIDENS the pool rather than
// replacing it, so "C and G major, degrees ii and V" means a question can be
// any of Dm, G, Am, D.
//
// This turns those selections into the actual sounds available. The quizzes
// then don't invent their own pools — they draw from this, so what you hear is
// always something you asked for, and the controls above them tell the truth.
// ============================================================================

import type { Note, ScaleDefinition, ChordDefinition } from './types';
import { SCALES } from '../data/scales';
import { ROOT_CHOICES } from '../data/roots';
import { diatonicChords } from './harmony';

// One chord you could be played, and everything the quizzes need to ask about
// it: what it is, and where it came from.
export interface EarChord {
  root: Note;
  chord: ChordDefinition;
  tonic: Note; // the key it was drawn from
  scale: ScaleDefinition;
  roman: string; // its function in that key, e.g. "ii7"
  degree: number; // 0-based
}

export interface EarScale {
  root: Note;
  scale: ScaleDefinition;
}

export interface EarMaterial {
  chords: EarChord[];
  scales: EarScale[];
}

export interface EarSelection {
  roots: ReadonlySet<number>; // indices into ROOT_CHOICES
  scaleIds: ReadonlySet<string>;
  /**
   * WHICH SOUNDS ARE IN THE POOL, by chord id — "major-triad", "dominant-7".
   *
   * This replaced a degree picker, a Scale/Harmony switch and a
   * triads-or-sevenths toggle, which between them were three ways of asking
   * one question. On the neck those rows earn their place: Gravity frames what
   * you're looking AT. There's nothing to look at here. A listening drill only
   * ever wants to know what it's allowed to play you, and that's a list of
   * qualities — so it asks for one.
   *
   * Triads and sevenths live in the same set on purpose: a pool of "major,
   * minor, and dominant 7" is a perfectly good thing to drill, and the old
   * either/or toggle couldn't express it.
   */
  qualities: ReadonlySet<string>;
}

/**
 * The chord qualities the chosen scales can actually produce, split into the
 * two families the panel offers them in.
 *
 * DERIVED, NEVER LISTED. Choose harmonic minor alongside major and the
 * augmented triad appears in the row because harmonic minor has one — nobody
 * has to remember to add it. Quality doesn't depend on the key, so this asks
 * one arbitrary root and reads off the answers.
 */
export function qualitiesFor(scaleIds: Iterable<string>): {
  triads: ChordDefinition[];
  sevenths: ChordDefinition[];
} {
  const anyRoot = ROOT_CHOICES[0];
  const seen = { triads: new Map<string, ChordDefinition>(), sevenths: new Map<string, ChordDefinition>() };
  for (const scaleId of scaleIds) {
    const scale = SCALES[scaleId];
    if (!scale) continue;
    for (const [family, seventh] of [
      ['triads', false],
      ['sevenths', true],
    ] as const) {
      try {
        for (const d of diatonicChords(anyRoot, scale, seventh)) {
          seen[family].set(d.chord.id, d.chord);
        }
      } catch {
        // A scale whose harmony can't be named contributes nothing.
      }
    }
  }
  return { triads: [...seen.triads.values()], sevenths: [...seen.sevenths.values()] };
}

export function earMaterial(sel: EarSelection): EarMaterial {
  const chords: EarChord[] = [];
  const scales: EarScale[] = [];

  for (const rootIndex of sel.roots) {
    const tonic = ROOT_CHOICES[rootIndex];
    if (!tonic) continue;

    for (const scaleId of sel.scaleIds) {
      const scale = SCALES[scaleId];
      if (!scale) continue;

      scales.push({ root: tonic, scale });

      // EVERY DEGREE, both families — then keep the qualities asked for. The
      // pool is defined by SOUND now rather than by scale degree, so a "minor
      // triad" selection collects the ii, the iii and the vi rather than
      // making you know which degrees those were.
      for (const seventh of [false, true]) {
        let built;
        try {
          built = diatonicChords(tonic, scale, seventh);
        } catch {
          continue; // a scale whose harmony we can't name — nothing to quiz
        }
        built.forEach((d, degree) => {
          if (!sel.qualities.has(d.chord.id)) return;
          chords.push({
            root: d.chordRoot,
            chord: d.chord,
            tonic,
            scale,
            roman: d.roman,
            degree,
          });
        });
      }
    }
  }

  return { chords, scales };
}

// Pick one at random — the quizzes' single source of randomness, kept here so
// "what can be played" and "what was played" can never drift apart.
export function pickOne<T>(items: readonly T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}
