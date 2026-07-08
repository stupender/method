// ============================================================================
// theory/chordScale.ts — which scale does a chord ask for?
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure function). The "chord scale" idea: every chord
// implies a scale you can run over it. Two ways to answer, tried in order:
//
// 1. IN THE KEY (best): if the chord is diatonic to the working key, its scale
//    is simply the key heard from the chord's root — the MODE on that degree.
//    Dm7 in C major → D dorian: the same seven notes as the key, so the run
//    and the song agree completely.
// 2. FROM THE QUALITY (fallback, for visitors): a chord outside the key still
//    implies a default scale — the standard jazz chord-scale pairings:
//    maj7 → ionian, 7 → mixolydian, m7 → dorian, ø7 → locrian,
//    m(maj7) → melodic minor. Each mode is "a major scale heard from another
//    degree", so we find the parent major a fixed interval from the chord root
//    and take the mode (mixolydian on G = C major heard from G, and C sits a
//    perfect 4th above G).
//
// Returns the scale MEASURED FROM THE CHORD ROOT (interval semitones 0..11),
// plus a friendly name for the UI — or null when we honestly don't have a
// scale for the quality (diminished/augmented, until those scales are data).
// ============================================================================

import type { Note, ChordDefinition, ScaleDefinition, Interval } from './types';
import { pitchClassOf, spellNoteFromInterval, noteName } from './notes';
import { diatonicChords } from './harmony';
import { modeAt } from './mode';
import { MAJOR_SCALE, SCALES } from '../data/scales';
import { P1, m2, P4, m7 } from '../data/intervals';

export interface ChordScale {
  scale: ScaleDefinition; // intervals measured from the chord root
  name: string; // e.g. "D Dorian" or "G Mixolydian"
}

// The default pairing for a chord quality when the key can't help: which
// interval above the chord root the parent MAJOR scale sits, and which degree
// of it the chord root is. (Dorian = degree 1 of the major a m7 above… i.e.
// D dorian's parent C major sits a m7 above D, wrapping the octave.)
const QUALITY_MODE: Record<string, { parentAbove: Interval; degree: number }> = {
  'major-triad': { parentAbove: P1, degree: 0 }, // ionian
  'major-seventh': { parentAbove: P1, degree: 0 }, // ionian
  'dominant-seventh': { parentAbove: P4, degree: 4 }, // mixolydian
  'minor-triad': { parentAbove: m7, degree: 1 }, // dorian
  'minor-seventh': { parentAbove: m7, degree: 1 }, // dorian
  'half-diminished': { parentAbove: m2, degree: 6 }, // locrian
};

export function chordScaleFor(
  root: Note,
  chord: ChordDefinition,
  keyTonic?: Note,
  keyScale?: ScaleDefinition,
): ChordScale | null {
  const rootPc = pitchClassOf(root);

  // 1. Diatonic in the working key → the mode on that degree. We require the
  // QUALITY to match too: a blues F7 in C major shares F's pitch but not
  // Fmaj7's quality, so it should fall through to mixolydian, not get lydian.
  if (keyTonic && keyScale) {
    try {
      const seventh = chord.intervals.length === 4;
      const hit = diatonicChords(keyTonic, keyScale, seventh).find(
        (c) => pitchClassOf(c.chordRoot) === rootPc && c.chord.id === chord.id,
      );
      if (hit) {
        const { modeRoot, modeScale } = modeAt(keyTonic, keyScale, hit.degree);
        return { scale: modeScale, name: `${noteName(modeRoot)} ${modeScale.name}` };
      }
    } catch {
      /* a key whose harmony we can't name — fall through to the quality */
    }
  }

  // 2. The quality's default scale. m(maj7) is special (melodic minor is a
  // scale of its own, not a major-scale mode); the rest are modes of a parent
  // major sitting a fixed interval above the chord root.
  if (chord.id === 'minor-major-seventh') {
    const mm = SCALES['melodic-minor'];
    return { scale: mm, name: `${noteName(root)} ${mm.name}` };
  }
  const pairing = QUALITY_MODE[chord.id];
  if (!pairing) return null; // diminished/augmented — no scale in our data yet

  const parentRoot = spellNoteFromInterval(root, pairing.parentAbove);
  const { modeRoot, modeScale } = modeAt(parentRoot, MAJOR_SCALE, pairing.degree);
  return { scale: modeScale, name: `${noteName(modeRoot)} ${modeScale.name}` };
}

// The scale as a playable ascending RUN from a root MIDI note: each scale tone
// as semitones above the root, topped with the octave. (Playback needs pitches,
// not spellings, so semitone offsets are all we take from the scale.)
export function scaleRunMidis(rootMidi: number, cs: ChordScale): number[] {
  return [...cs.scale.intervals.map((iv) => rootMidi + iv.semitones), rootMidi + 12];
}
