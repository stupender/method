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

// The scale-degree of the LOWEST voice — the note in the bass — of a voicing.
// For close voicings this matches the inversion (root / 3rd / 5th / 7th in bass).
// For DROP-2 / DROP-3 it doesn't: dropping a voice an octave changes which note
// sits on the bottom, so a "drop-2 root position" actually has the 5th in the
// bass. That's why we label the bass note explicitly rather than by inversion #.
export function bassDegree(
  chord: ChordDefinition,
  structure: VoicingStructure,
  inversion: number,
): string {
  // applyDrop sorts low -> high, so the first voice is the bass.
  const stack = applyDrop(invertStack(chord, inversion), structure.dropFromTop);
  return degreeLabel(stack[0].interval); // "1", "3", "5", "7"
}

// "Root in bass", "3rd in bass", "5th in bass", "7th in bass" — the clearest name
// for a voicing's inversion, especially for drop voicings.
const BASS_NAMES: Record<string, string> = {
  '1': 'Root', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th', '6': '6th', '7': '7th',
};
// What to CALL a voicing. Two vocabularies, and which one is honest depends on
// the structure:
//
//   CLOSE — the stack is untouched, so the inversion number and the note in the
//           bass say the same thing. "1st Inversion" is the name a musician
//           reaches for, so use it.
//   OPEN / DROP 2 / DROP 3 — dropping a voice an octave changes which note ends
//           up on the bottom, so "1st inversion" no longer tells you what you'll
//           hear. Name the bass note instead: "3rd in bass".
//
// Same voicing either way; this only picks the more useful of two true names.
export function voicingName(
  chord: ChordDefinition,
  structure: VoicingStructure,
  inversion: number,
): string {
  if (structure.id === 'close') return inversionName(inversion);
  return bassNoteName(bassDegree(chord, structure, inversion));
}

export function bassNoteName(degree: string): string {
  return `${BASS_NAMES[degree] ?? degree} in bass`;
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
// ...and the widest a hand will actually reach. Between the two lies a real
// voicing that's a stretch — most close-voiced seventh chords live here.
const REACH_SPAN = 6;

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

// Is this grip wider than comfortable? Between MAX_SPAN and REACH_SPAN sit the
// voicings a hand can reach but wouldn't choose — worth saying out loud on the
// page rather than letting someone wonder why a shape feels impossible.
export function isStretch(shape: PlacedNote[]): boolean {
  return shape.length > 0 && fretSpan(shape) > MAX_SPAN;
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

// PLACEMENT FOR A STRING-SET-GROUPED PAGE.
// ----------------------------------------------------------------------------
// `placeVoicingAll` below answers "where's the best grip for this voicing?" —
// one shape per REGISTER, the least-stretch one. That's the right question when
// the neck is the whole answer, and the wrong one for a page whose sections ARE
// the string sets, because collapsing per register throws away whole sets: a
// drop 3 starting on the low E can skip the A or stretch up it, and only the
// winner survived. On a page that asks "show me this chord on E A D G, then on
// A D G B", deleting one of them looks like the voicing doesn't exist.
//
// So this answers the other question: what's the most playable grip on EACH
// string set? One shape per set, contiguous sets and skipped-string sets alike.
//
// The fallback matters as much as the rule. Some voicings — close-voiced
// seventh chords in their inversions, most of all — don't sit within a
// comfortable span ANYWHERE; a close 7th with the 3rd in the bass wants six
// frets. The old code kept a single least-stretch shape for the whole neck,
// which is why those showed up on the A D G B strings and nowhere else, as if
// the other two sets couldn't play them. They can; it's a stretch on all three.
// So when nothing fits comfortably we show the best grip on every contiguous
// set and let the UI say it's a stretch. Six frets is a real voicing that real
// guitarists really play — it just isn't a comfortable one.
/**
 * The voicing on ONE named string set, or null if the neck can't hold it there.
 *
 * `placeVoicingByStringSet` below answers "where can this chord live", and to
 * do that it keeps one grip per register — the best of the sets that could
 * hold it. That's right for a single chord and wrong for a CHORD SCALE, where
 * the whole point is that every chord takes the SAME shape on the SAME strings
 * as you climb the key. Asked that way it dropped chords: an open triad with
 * the 5th in the bass sat on E-D-G as a major and E-A-G as a minor, so no set
 * held all seven and the page came up empty — even though all seven fit E-D-G
 * with spans of three and four frets.
 *
 * So this asks the narrow question instead: put it HERE. No span limit, because
 * a chord scale is allowed its stretches — the shape holding is worth more than
 * every grip being comfortable, and the UI already says when one is a reach.
 */
export function placeVoicingOnSet(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  chord: ChordDefinition,
  structure: VoicingStructure,
  inversion: number,
  strings: number[],
): PlacedNote[] | null {
  const voices = buildVoices(root, chord, structure, inversion);
  if (voices.length !== strings.length) return null;
  const [shape] = placeOnStringSets(instrument, tuning, voices, [strings], Infinity);
  return shape ?? null;
}

/**
 * THE SAME QUESTION FOR AN INSTRUMENT WITH NO STRINGS TO CHOOSE.
 *
 * Everything above this line exists because a guitar can play the same note in
 * five places and something has to decide which. A keyboard can't: a pitch is
 * one key, and that's the end of it. So placing a voicing on a keyboard isn't
 * a search at all — it's arithmetic. Take the voices the theory already built,
 * put each one on the key that sounds it, and slide the whole chord by octaves
 * until it lands inside the range the instrument is drawn over.
 *
 * Sliding by OCTAVES rather than clamping is the one thing to get right: the
 * chord has to stay the chord. A voicing shoved note-by-note into range would
 * be a different voicing wearing the same name.
 *
 * Returns null when even that can't fit it — a spread voicing wider than the
 * three octaves on screen has nowhere to go.
 */
export function placeVoicingOnKeys(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  chord: ChordDefinition,
  structure: VoicingStructure,
  inversion: number,
): PlacedNote[] | null {
  const voices = buildVoices(root, chord, structure, inversion);
  const open = openMidi(tuning, 0);
  const frets = voices.map((v) => midiOf(v.note) - open);

  // How many octaves to move it so the lowest voice is on the board and the
  // highest still is. Both bounds, because either end can be the one hanging
  // off — a bass-heavy voicing falls off the bottom, a spread one off the top.
  const minShift = Math.ceil(-Math.min(...frets) / 12);
  const maxShift = Math.floor((instrument.fretCount - Math.max(...frets)) / 12);
  if (minShift > maxShift) return null;

  return voices.map((v, i) => ({
    position: { stringIndex: 0, fret: frets[i] + 12 * minShift },
    note: { ...v.note, octave: (v.note.octave ?? 4) + minShift },
    intervalName: v.degree,
    isRoot: v.isRoot,
  }));
}

/** Every string set a voicing of this many voices could use, widest first. */
export function candidateStringSets(
  voiceCount: number,
  stringCount: number,
): number[][] {
  return [
    ...contiguousStringSets(voiceCount, stringCount),
    ...skipStringSets(voiceCount, stringCount),
  ];
}

export function placeVoicingByStringSet(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  chord: ChordDefinition,
  structure: VoicingStructure,
  inversion: number,
): PlacedNote[][] {
  const voices = buildVoices(root, chord, structure, inversion);
  const contiguous = contiguousStringSets(voices.length, instrument.stringCount);
  const skipping = skipStringSets(voices.length, instrument.stringCount);

  // TWO LIMITS, not one. MAX_SPAN (4 frets) is what's COMFORTABLE; REACH_SPAN
  // (6) is what a hand can actually do. A single cutoff at 4 was quietly
  // deciding that real voicings don't exist: a close ii7 in root position wants
  // five frets across E A D G, so it vanished from that string set while the
  // Imaj7 — which happens to want four — stayed. Same voicing, same key, and
  // the string set flickering in and out chord by chord.
  //
  // So show every set the hand can reach, and let the UI flag the stretches.
  // `placeOnStringSets` already emits at most one shape per set (its lowest
  // playable octave), so there's nothing to collapse.
  // The reach applies to CONTIGUOUS sets only. A skipped string is there to
  // make a wide-gap voicing comfortable — if it isn't comfortable there, the
  // voicing doesn't belong on that set, and allowing stretches let close triads
  // sprawl onto skipped strings, which is not a close grip by any definition.
  const reachable = [
    ...placeOnStringSets(instrument, tuning, voices, contiguous, REACH_SPAN),
    ...placeOnStringSets(instrument, tuning, voices, skipping, MAX_SPAN),
  ];
  if (reachable.length > 0) return sortByStringSet(bestPerRegister(reachable));

  // Beyond even that: the best grip on each contiguous set, so a hard voicing
  // still shows everywhere it's possible rather than in one arbitrary place.
  return sortByStringSet(
    placeOnStringSets(instrument, tuning, voices, contiguous, Infinity),
  );
}

// ONE GRIP PER REGISTER, and a skipped string has to EARN its place.
//
// A "register" is the lowest string the voicing starts on. Within one, the
// guitar usually offers several ways to hold the same notes — E A D G, or E A G
// B, or E D G B — and they are not equally good. Listing them all was the
// mistake: a drop 2 came out with five string sets, three of which were
// awkward novelties nobody would choose, and blocks appeared holding a single
// chord because only one inversion happened to fit some odd skip.
//
// So: the least-stretch grip wins its register, and a SKIPPED string carries a
// penalty — it must be more than a fret and a half easier than the adjacent
// grip to be worth showing. That's the difference between a drop 3, where
// skipping the A string turns a six-fret stretch into a one-fret grab, and a
// drop 2, where skipping just makes an easy shape harder.
//
// This is the placement principle from CLAUDE.md, restored: it was removed
// wholesale to fix a different bug (the chord scale needed every string set,
// not the best one), which threw out the rule along with the problem.
const SKIP_PENALTY = 1.5;
function bestPerRegister(shapes: PlacedNote[][]): PlacedNote[][] {
  const cost = (shape: PlacedNote[]) => {
    const strings = shape.map((p) => p.position.stringIndex).sort((a, b) => a - b);
    const adjacent = strings.every((s, i) => i === 0 || s === strings[i - 1] + 1);
    return fretSpan(shape) + (adjacent ? 0 : SKIP_PENALTY);
  };
  const best = new Map<number, PlacedNote[]>();
  for (const shape of shapes) {
    const register = Math.min(...shape.map((p) => p.position.stringIndex));
    const current = best.get(register);
    if (!current || cost(shape) < cost(current)) best.set(register, shape);
  }
  return [...best.values()];
}

// Low strings first, then by fret — so a page of sets reads up the neck the way
// the guitar is strung.
function sortByStringSet(shapes: PlacedNote[][]): PlacedNote[][] {
  const strings = (shape: PlacedNote[]) =>
    shape.map((p) => p.position.stringIndex).sort((x, y) => x - y);
  return [...shapes].sort((a, b) => {
    const sa = strings(a);
    const sb = strings(b);
    for (let i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return sa[i] - sb[i];
    }
    return Math.min(...a.map((p) => p.position.fret)) -
      Math.min(...b.map((p) => p.position.fret));
  });
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

// A voicing repeated UP THE NECK. `placeVoicingAll` returns each shape at its
// lowest playable position, but the fretboard repeats every 12 frets, so the
// same grip exists an octave higher wherever the neck still has room. Showing
// only the lowest one leaves the top half of the neck empty and hides the very
// repetition a player relies on.
//
// Given shapes (from placeVoicingAll) this returns them plus every octave copy
// that still fits, ordered low to high.
export function withOctaveCopies(
  instrument: Instrument,
  shapes: PlacedNote[][],
): PlacedNote[][] {
  const out: PlacedNote[][] = [];
  for (const shape of shapes) {
    if (shape.length === 0) continue;
    let s = shape;
    for (;;) {
      out.push(s);
      const highest = Math.max(...s.map((p) => p.position.fret));
      if (highest + 12 > instrument.fretCount) break;
      s = s.map((p) => ({
        ...p,
        position: { ...p.position, fret: p.position.fret + 12 },
        note: { ...p.note, octave: (p.note.octave ?? 4) + 1 },
      }));
    }
  }
  // Low to high, so the TAB below the neck reads up the fretboard.
  out.sort(
    (a, b) =>
      Math.min(...a.map((p) => p.position.fret)) -
      Math.min(...b.map((p) => p.position.fret)),
  );
  return out;
}

// Every playable form of a chord in one structure: each inversion, on each
// string set, at every octave. This is the complete grid a player actually has
// available — 3 inversions x 4 string sets for triads, 4 x 3 for drop-2
// sevenths — plus their repeats up the neck.
export function allVoicings(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  chord: ChordDefinition,
  structure: VoicingStructure,
): { shape: PlacedNote[]; inversion: number }[] {
  const out: { shape: PlacedNote[]; inversion: number }[] = [];
  for (let inv = 0; inv < inversionCount(chord); inv++) {
    const base = placeVoicingAll(instrument, tuning, root, chord, structure, inv);
    for (const shape of withOctaveCopies(instrument, base)) {
      out.push({ shape, inversion: inv });
    }
  }
  return out;
}
