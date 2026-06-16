// ============================================================================
// theory/chord.ts — realize a chord voicing onto the neck
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). A voicing is (chord, structure,
// inversion). The pipeline:
//   1. invertStack    — rotate the chord tones so the chosen inversion's tone is
//      in the bass (root position, 1st, 2nd, 3rd...).
//   2. applyDrop       — for Drop 2 / Drop 3, lower the 2nd / 3rd voice from the
//      top by an octave, then re-order low->high.
//   3. buildVoices     — spell those tones as real Notes with octaves.
//   4. placeVoicing    — find a playable shape: try string sets + octaves and
//      keep the most compact, lowest one. (This replaces the old hand-written
//      string-set hints — placement is now automatic.)
// ============================================================================

import type {
  Note,
  ChordDefinition,
  VoicingStructure,
  Instrument,
  Tuning,
  PlacedNote,
  Interval,
} from './types';
import { spellNoteFromInterval, midiOf } from './notes';

// A scale-degree label for a chord tone, from its interval (P1->1, M3->3, ...).
function degreeLabel(interval: Interval): string {
  return String(interval.diatonicSteps + 1);
}

// One voice mid-computation: a chord tone plus how many octaves it's shifted.
interface StackedTone {
  interval: Interval;
  octaveShift: number;
}

// One finished voice: the spelled note plus its role.
export interface Voice {
  note: Note;
  degree: string;
  isRoot: boolean;
}

// How many inversions a chord has = how many tones it has.
export function inversionCount(chord: ChordDefinition): number {
  return chord.intervals.length;
}

// The structures that apply to a chord: you can only "drop" a voice that isn't
// the bottom one, so a structure needs more voices than its dropFromTop.
export function structuresForChord(
  chord: ChordDefinition,
  structures: VoicingStructure[],
): VoicingStructure[] {
  return structures.filter((s) => s.dropFromTop < inversionCount(chord));
}

// Display name for a structure on a given chord: a Drop 2 triad is what players
// call an "Open" voicing, so we show that friendlier name for 3-note chords.
export function structureName(structure: VoicingStructure, voiceCount: number): string {
  if (structure.id === 'drop2' && voiceCount === 3) return 'Open';
  return structure.name;
}

const INVERSION_NAMES = [
  'Root Position',
  '1st Inversion',
  '2nd Inversion',
  '3rd Inversion',
];

export function inversionName(inversion: number): string {
  return INVERSION_NAMES[inversion] ?? `Inversion ${inversion}`;
}

// Step 1 — rotate the close stack so `inversion`'s tone is in the bass. Tones
// that end up below their original position (the ones that "wrapped") move up an
// octave so the stack stays ascending. Root position (0) is the chord as-is.
function invertStack(chord: ChordDefinition, inversion: number): StackedTone[] {
  const n = chord.intervals.length;
  const stack: StackedTone[] = [];
  for (let i = 0; i < n; i++) {
    const index = (inversion + i) % n;
    // If we wrapped past the top of the list, this tone goes up an octave.
    const octaveShift = inversion + i >= n ? 1 : 0;
    stack.push({ interval: chord.intervals[index], octaveShift });
  }
  return stack;
}

// The relative pitch of a stacked tone (semitones), used for ordering.
function relativePitch(tone: StackedTone): number {
  return tone.interval.semitones + 12 * tone.octaveShift;
}

// Step 2 — apply a Drop voicing: lower the Nth-from-top voice by an octave, then
// re-sort low->high (the dropped voice usually becomes the new bass).
function applyDrop(stack: StackedTone[], dropFromTop: number): StackedTone[] {
  if (dropFromTop <= 0) return stack;
  const dropped = stack.map((t) => ({ ...t }));
  const index = dropped.length - dropFromTop; // count from the top
  dropped[index].octaveShift -= 1;
  return dropped.sort((a, b) => relativePitch(a) - relativePitch(b));
}

// Steps 1–3 — turn (root, chord, structure, inversion) into ordered, spelled
// voices, low -> high.
export function buildVoices(
  root: Note,
  chord: ChordDefinition,
  structure: VoicingStructure,
  inversion: number,
): Voice[] {
  const stack = applyDrop(invertStack(chord, inversion), structure.dropFromTop);
  return stack.map((tone) => {
    const spelled = spellNoteFromInterval(root, tone.interval);
    return {
      note: { ...spelled, octave: (spelled.octave ?? 4) + tone.octaveShift },
      degree: degreeLabel(tone.interval),
      isRoot: tone.interval.diatonicSteps === 0,
    };
  });
}

// The MIDI number of an open string.
function openMidi(tuning: Tuning, stringIndex: number): number {
  return midiOf(tuning.openNotes[stringIndex]);
}

// Candidate string sets for N voices: every run of N adjacent strings, plus runs
// that skip one interior string (drop-3 shapes need a string skip). Each is a
// list of string indices low->high, flagged whether it skips.
function candidateStringSets(
  voiceCount: number,
  stringCount: number,
): { strings: number[]; skipped: boolean }[] {
  const sets: { strings: number[]; skipped: boolean }[] = [];

  // Contiguous windows.
  for (let start = 0; start + voiceCount <= stringCount; start++) {
    const strings = Array.from({ length: voiceCount }, (_, i) => start + i);
    sets.push({ strings, skipped: false });
  }

  // Windows spanning one extra string with a single interior string skipped.
  for (let start = 0; start + voiceCount + 1 <= stringCount; start++) {
    for (let skip = start + 1; skip < start + voiceCount; skip++) {
      const strings: number[] = [];
      for (let s = start; s <= start + voiceCount; s++) {
        if (s !== skip) strings.push(s);
      }
      sets.push({ strings, skipped: true });
    }
  }

  return sets;
}

// The widest fret span we'll accept as a grabbable shape. Voicings stretched
// wider than this across an "unnatural" string set aren't really playable, so we
// drop them rather than show nonsense.
const MAX_SPAN = 5;

// Step 4 — place the built voicing on the neck, EVERYWHERE it's playable. The
// voices' relative pitches and order are fixed; the freedom is which string set
// and which octave. We return one shape per valid (string set × octave) that
// fits the neck and isn't too wide a stretch — so the UI can show the voicing in
// all its positions and string sets, not just one spot. Shapes are ordered low
// (near the nut) to high.
export function placeVoicingAll(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  chord: ChordDefinition,
  structure: VoicingStructure,
  inversion: number,
): PlacedNote[][] {
  const voices = buildVoices(root, chord, structure, inversion);
  const shapes: PlacedNote[][] = [];
  const seen = new Set<string>(); // dedupe identical shapes

  for (const set of candidateStringSets(voices.length, instrument.stringCount)) {
    for (let octaveShift = -2; octaveShift <= 4; octaveShift++) {
      const frets = voices.map(
        (v, i) =>
          midiOf(v.note) + 12 * octaveShift - openMidi(tuning, set.strings[i]),
      );
      if (!frets.every((f) => f >= 0 && f <= instrument.fretCount)) continue;
      if (Math.max(...frets) - Math.min(...frets) > MAX_SPAN) continue;

      const key = set.strings.map((s, i) => `${s}:${frets[i]}`).join('|');
      if (seen.has(key)) continue;
      seen.add(key);

      shapes.push(
        voices.map((v, i) => ({
          position: { stringIndex: set.strings[i], fret: frets[i] },
          note: { ...v.note, octave: (v.note.octave ?? 4) + octaveShift },
          intervalName: v.degree,
          isRoot: v.isRoot,
        })),
      );
    }
  }

  // Order shapes low -> high so they read left-to-right up the neck.
  const lowestFret = (shape: PlacedNote[]) =>
    Math.min(...shape.map((p) => p.position.fret));
  shapes.sort((a, b) => lowestFret(a) - lowestFret(b));
  return shapes;
}
