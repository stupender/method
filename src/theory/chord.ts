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

// The CONTIGUOUS string sets for N voices: every run of N adjacent strings.
// These are the standard home of close and drop-2 voicings — 4 for a triad
// (E-A-D, A-D-G, D-G-B, G-B-e), 3 for a seventh chord.
function contiguousStringSets(voiceCount: number, stringCount: number): number[][] {
  const sets: number[][] = [];
  for (let start = 0; start + voiceCount <= stringCount; start++) {
    sets.push(Array.from({ length: voiceCount }, (_, i) => start + i));
  }
  return sets;
}

// String sets that SKIP one interior string. Open triads and drop-3 voicings
// can't sit on adjacent strings, so they live here instead — the exceptions.
function skipStringSets(voiceCount: number, stringCount: number): number[][] {
  const sets: number[][] = [];
  for (let start = 0; start + voiceCount + 1 <= stringCount; start++) {
    for (let skip = start + 1; skip < start + voiceCount; skip++) {
      const strings: number[] = [];
      for (let s = start; s <= start + voiceCount; s++) {
        if (s !== skip) strings.push(s);
      }
      sets.push(strings);
    }
  }
  return sets;
}

// The widest fret span we'll accept as a grabbable shape on a string set. Close
// and drop-2 voicings sit within ~3 frets on adjacent strings; drop-3 and open
// voicings stretch much wider on adjacent strings (which is exactly why they
// belong on skip string sets), so this cutoff routes them there.
const MAX_SPAN = 4;

// Try to place the voicing on each of the given string sets, once per set, at
// its lowest playable position. (Span is octave-independent for a fixed string
// set, so a set either fits or it doesn't; when it fits we take the lowest octave
// that keeps every fret on the neck — the "least stretch / lowest" choice.)
function placeOnStringSets(
  instrument: Instrument,
  tuning: Tuning,
  voices: Voice[],
  stringSets: number[][],
  maxSpan = MAX_SPAN,
): PlacedNote[][] {
  const shapes: PlacedNote[][] = [];
  for (const strings of stringSets) {
    const baseFrets = voices.map(
      (v, i) => midiOf(v.note) - openMidi(tuning, strings[i]),
    );
    if (Math.max(...baseFrets) - Math.min(...baseFrets) > maxSpan) continue;

    const minShift = Math.ceil(-Math.min(...baseFrets) / 12);
    const maxShift = Math.floor(
      (instrument.fretCount - Math.max(...baseFrets)) / 12,
    );
    if (minShift > maxShift) continue; // doesn't fit the neck on this string set

    const octaveShift = minShift; // lowest playable position
    shapes.push(
      voices.map((v, i) => ({
        position: { stringIndex: strings[i], fret: baseFrets[i] + 12 * octaveShift },
        note: { ...v.note, octave: (v.note.octave ?? 4) + octaveShift },
        intervalName: v.degree,
        isRoot: v.isRoot,
      })),
    );
  }
  return shapes;
}

// The fret span (stretch) of a shape: highest fret minus lowest.
function fretSpan(shape: PlacedNote[]): number {
  const frets = shape.map((p) => p.position.fret);
  return Math.max(...frets) - Math.min(...frets);
}

// PLACEMENT PRINCIPLE — one shape per register, the least-stretch one.
// We show a voicing once per "register" (the lowest string it starts on). When a
// register offers several string sets — e.g. a drop-3 from the low E could skip
// the A string OR stretch up it — we keep only the LEAST-STRETCH fingering. That's
// the whole point of a skipped string: it lines up with the voicing's big interval
// gap, so the next note lands on the D string (close to the rest) instead of high
// up the A string. Same idea keeps every voicing in its closest, most grabbable
// range. Contiguous sets each start on a different string, so this leaves the
// triad's four / the 7th's three shapes untouched.
function leastStretchPerRegister(shapes: PlacedNote[][]): PlacedNote[][] {
  const lowestString = (shape: PlacedNote[]) =>
    Math.min(...shape.map((p) => p.position.stringIndex));
  const best = new Map<number, PlacedNote[]>();
  for (const shape of shapes) {
    const key = lowestString(shape);
    const current = best.get(key);
    if (!current || fretSpan(shape) < fretSpan(current)) best.set(key, shape);
  }
  return [...best.values()];
}

// Step 4 — place the built voicing on the neck, ONCE PER REGISTER it fits.
// We want the voicing shown wherever it sits comfortably so the player sees every
// place to grab it: a triad on its four contiguous 3-string sets (E-A-D, A-D-G,
// D-G-B, G-B-e), a 7th on its three contiguous 4-string sets. Voicings that can't
// sit on adjacent strings (open triads, drop-3) won't fit any contiguous set — for
// those we fall back to the skip string sets, then keep the least-stretch fingering
// per register (see leastStretchPerRegister). Shapes are ordered low to high.
export function placeVoicingAll(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  chord: ChordDefinition,
  structure: VoicingStructure,
  inversion: number,
): PlacedNote[][] {
  const voices = buildVoices(root, chord, structure, inversion);

  // Standard home: the contiguous string sets. Only if NONE fits (open / drop-3)
  // do we use the skip string sets — those are the exceptions.
  let shapes = placeOnStringSets(
    instrument,
    tuning,
    voices,
    contiguousStringSets(voices.length, instrument.stringCount),
  );
  if (shapes.length === 0) {
    shapes = placeOnStringSets(
      instrument,
      tuning,
      voices,
      skipStringSets(voices.length, instrument.stringCount),
    );
  }
  // Last resort: some voicings (e.g. certain 7th-chord inversions) don't fit ANY
  // string set within a comfortable span. Rather than show nothing, place it on
  // every string set ignoring the span limit and keep the single least-stretch
  // one — the most playable version (the UI flags it as a difficult stretch).
  if (shapes.length === 0) {
    const all = placeOnStringSets(
      instrument,
      tuning,
      voices,
      [
        ...contiguousStringSets(voices.length, instrument.stringCount),
        ...skipStringSets(voices.length, instrument.stringCount),
      ],
      Infinity,
    );
    all.sort((a, b) => fretSpan(a) - fretSpan(b));
    if (all.length) shapes = [all[0]];
  }

  // Keep just the most-grabbable fingering in each register (least stretch).
  shapes = leastStretchPerRegister(shapes);

  // Order shapes by STRING SET, lowest strings first (then by fret within a
  // string set). So all the shapes on the lowest strings come first, then the
  // next string set up, and so on.
  const stringsOf = (shape: PlacedNote[]) =>
    shape.map((p) => p.position.stringIndex).sort((x, y) => x - y);
  const lowestFret = (shape: PlacedNote[]) =>
    Math.min(...shape.map((p) => p.position.fret));
  shapes.sort((a, b) => {
    const sa = stringsOf(a);
    const sb = stringsOf(b);
    for (let i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return sa[i] - sb[i];
    }
    return lowestFret(a) - lowestFret(b);
  });
  return shapes;
}
