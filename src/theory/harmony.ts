// ============================================================================
// theory/harmony.ts — the chords of a key (diatonic harmony)
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). "Diatonic harmony" = the chords you get
// by building on each note of a scale using ONLY notes from that scale. Stack
// scale tones in thirds (take every other note) and the QUALITY of each chord
// falls out of where in the scale you started — that's the Roman-numeral idea:
// in a major key you always get  I  ii  iii  IV  V  vi  vii°.
//
// We don't hard-code those qualities. We build each chord from the scale, then
// MATCH its interval pattern to a known chord definition (data/chords.ts). Add
// a new scale and its harmony comes out automatically.
// ============================================================================

import type { Note, ScaleDefinition, ChordDefinition } from './types';
import { pitchClassOf, noteName } from './notes';
import { realizeScale } from './scale';
import { CHORDS } from '../data/chords';

// One diatonic chord: where it sits in the key and what it is.
export interface DiatonicChord {
  degree: number; // 0-based scale degree it's built on
  roman: string; // Roman-numeral label, e.g. "ii", "V7", "vii°"
  chordRoot: Note; // the spelled root of this chord (e.g. D in C major)
  chord: ChordDefinition; // the matched quality (minor triad, dominant 7th...)
  name: string; // friendly name, e.g. "D minor"
}

// The "fingerprint" of a chord: its tones as semitone offsets from the root,
// inside one octave, sorted. Major triad -> [0,4,7]; minor 7th -> [0,3,7,10].
// Two chords with the same fingerprint are the same quality.
function signature(semitoneOffsets: number[]): string {
  return [...new Set(semitoneOffsets.map((s) => ((s % 12) + 12) % 12))]
    .sort((a, b) => a - b)
    .join(',');
}

// Pre-compute the fingerprint of every known chord quality, once.
const CHORD_BY_SIGNATURE = new Map<string, ChordDefinition>();
for (const chord of Object.values(CHORDS)) {
  CHORD_BY_SIGNATURE.set(
    signature(chord.intervals.map((i) => i.semitones)),
    chord,
  );
}

// How each quality is written as a Roman numeral: whether the numeral is upper-
// or lower-case (major vs minor third) and the small suffix after it.
const ROMAN_STYLE: Record<string, { upper: boolean; suffix: string }> = {
  'major-triad': { upper: true, suffix: '' },
  'minor-triad': { upper: false, suffix: '' },
  'diminished-triad': { upper: false, suffix: '°' },
  'augmented-triad': { upper: true, suffix: '+' },
  'major-seventh': { upper: true, suffix: 'maj7' },
  'minor-seventh': { upper: false, suffix: '7' },
  'dominant-seventh': { upper: true, suffix: '7' },
  'half-diminished': { upper: false, suffix: 'ø7' },
  'minor-major-seventh': { upper: false, suffix: '(maj7)' },
  'diminished-seventh': { upper: false, suffix: '°7' },
  'augmented-major-seventh': { upper: true, suffix: 'maj7♯5' },
};

const ROMAN_BASE = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

// Build the diatonic chords of a key. `seventh` chooses 4-note (7th) chords
// instead of 3-note triads. Returns one DiatonicChord per scale degree.
export function diatonicChords(
  root: Note,
  scale: ScaleDefinition,
  seventh: boolean,
): DiatonicChord[] {
  const tones = realizeScale(root, scale); // the 7 spelled scale tones
  const n = tones.length;
  // Which scale steps to stack: thirds = every other tone. Triad 1-3-5, 7th adds 7.
  const steps = seventh ? [0, 2, 4, 6] : [0, 2, 4];

  return tones.map((tone, degree) => {
    const chordRoot = tone.note;
    const rootPc = pitchClassOf(chordRoot);

    // Gather the chord's tones by stepping through the scale in thirds, and
    // measure each as a semitone offset above the chord root.
    const offsets = steps.map((step) => {
      const member = tones[(degree + step) % n].note;
      return (pitchClassOf(member) - rootPc + 12) % 12;
    });

    const chord = CHORD_BY_SIGNATURE.get(signature(offsets));
    if (!chord) {
      // Shouldn't happen for the major scale; guard so a new scale fails loudly.
      throw new Error(
        `No known chord matches the tones built on degree ${degree + 1}.`,
      );
    }

    const style = ROMAN_STYLE[chord.id] ?? { upper: true, suffix: '' };
    const numeral = style.upper
      ? ROMAN_BASE[degree]
      : ROMAN_BASE[degree].toLowerCase();

    return {
      degree,
      roman: numeral + style.suffix,
      chordRoot,
      chord,
      name: `${noteName(chordRoot)} ${chord.name}`,
    };
  });
}
