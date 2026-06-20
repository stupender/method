// ============================================================================
// theory/mode.ts — the mode built on a scale degree
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure function). A "mode" is the same parent scale heard
// from a different starting note: C major played from G is G Mixolydian — same
// seven notes, but now G is home, so the pattern of steps (and the b7) is
// measured from G. This turns the Possibility degree selector into a mode picker
// in the Scales view: pick the 5th degree and you get Mixolydian, in position.
//
// Given a parent root + scale + a degree (0-based), we return the mode's ROOT
// (the spelled note on that degree) and a ScaleDefinition for the mode, with its
// intervals and degree labels measured from that new root.
// ============================================================================

import type { Note, ScaleDefinition, Interval } from './types';
import { realizeScale } from './scale';

// The semitones of a plain major scale by letter-step (1 2 3 4 5 6 7). We compare
// a mode tone against these to label it as "♭3", "♯4", "♭7" and so on — its own
// scale degree, the way a player thinks about a mode. (Assumes a 7-note scale,
// which all of ours are.)
const MAJOR_REFERENCE = [0, 2, 4, 5, 7, 9, 11];

// A degree label like "1", "♭3", "♯4", "♭♭7" from a tone's letter-step + pitch.
function degreeLabel(diatonicSteps: number, semitones: number): string {
  const diff = semitones - MAJOR_REFERENCE[diatonicSteps];
  const accidental = diff === 0 ? '' : diff < 0 ? '♭'.repeat(-diff) : '♯'.repeat(diff);
  return accidental + (diatonicSteps + 1);
}

// Build the mode rooted on `degree` of (parentRoot + parentScale). Degree 0 is
// the scale itself (the tonic mode); degree 4 of a major scale is Mixolydian.
export function modeAt(
  parentRoot: Note,
  parentScale: ScaleDefinition,
  degree: number,
): { modeRoot: Note; modeScale: ScaleDefinition } {
  const tones = realizeScale(parentRoot, parentScale); // the spelled parent tones
  const n = tones.length;
  const d = ((degree % n) + n) % n; // safe wrap

  const modeRoot = tones[d].note; // already correctly spelled (e.g. G in C major)
  const parentSemitones = parentScale.intervals.map((iv) => iv.semitones);

  // Each mode tone: walk j letter-steps up from the mode root, and measure its
  // pitch as semitones above the new root (wrapping past the octave).
  const intervals: Interval[] = [];
  const degreeNames: string[] = [];
  for (let j = 0; j < n; j++) {
    const semitones = (((parentSemitones[(d + j) % n] - parentSemitones[d]) % 12) + 12) % 12;
    const label = degreeLabel(j, semitones);
    intervals.push({ name: label, diatonicSteps: j, semitones });
    degreeNames.push(label);
  }

  const modeScale: ScaleDefinition = {
    id: `${parentScale.id}-mode-${d}`,
    name: parentScale.modeNames?.[d] ?? parentScale.name,
    kind: 'scale',
    intervals,
    degreeNames,
  };
  return { modeRoot, modeScale };
}
