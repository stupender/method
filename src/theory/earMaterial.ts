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
  degrees: ReadonlySet<number>; // 0-based scale degrees
  views: ReadonlySet<'scale' | 'harmony'>;
  sevenths: boolean; // quiz seventh chords instead of triads
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

      if (sel.views.has('scale')) {
        scales.push({ root: tonic, scale });
      }

      if (sel.views.has('harmony')) {
        let built;
        try {
          built = diatonicChords(tonic, scale, sel.sevenths);
        } catch {
          continue; // a scale whose harmony we can't name — nothing to quiz
        }
        for (const degree of sel.degrees) {
          const d = built[degree];
          if (!d) continue;
          chords.push({
            root: d.chordRoot,
            chord: d.chord,
            tonic,
            scale,
            roman: d.roman,
            degree,
          });
        }
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
