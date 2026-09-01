// ============================================================================
// theory/scalePositions.ts — the playable position "boxes" of a scale
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). A scale spans the whole neck; players
// learn it in positions, and there's no single "right" fingering — there are a
// few systems and personal blends. We offer THREE, all built from the same idea
// (lay scale tones across the strings) but with different per-string counts:
//
//   - scalePositions (3 notes per string): each string gets exactly 3 scale
//     tones. Even and wide (~6 frets); modern, good for speed and legato.
//   - positionalBoxes (Positional / position-playing, the 7-position system): the
//     hand stays strictly in one ~4-fret position; a minor 3rd / minor 7th crosses
//     DOWN to the next string (below the baseline) rather than shifting the hand.
//     Traditional. (CAGED is a DIFFERENT, 5-shape system — not this.)
//   - hybridBoxes (Hybrid): positional through the lower strings, but once past the
//     G string it switches — keeping a minor 7th ABOVE the baseline on the B string
//     (a light shift up) instead of crossing. Works out to 2 notes on the low E
//     then 3 per string. A common learned blend Stu uses.
//
// Each box is a group of PlacedNotes the renderer shows as a constellation —
// same machinery as chord voicings, different source.
// ============================================================================

import type {
  Instrument,
  Tuning,
  Note,
  PlacedNote,
  ScaleDefinition,
} from './types';
import { realizeScale } from './scale';
import { pitchClassOf, midiOf, octaveForSpelling } from './notes';

export interface ScalePosition {
  notes: PlacedNote[]; // the box, ready for the fretboard
  name: string; // mode / position label
  lowestFret: number;
  /**
   * Which degree of the parent scale this box starts on — 0 for the tonic, 1
   * for the second, and so on. The NAME above says which mode that makes
   * ("Dorian"); this says which note it starts from, so a caller that wants to
   * write "D Dorian" can look the note up without re-deriving it. Kept as an
   * index rather than a formatted note because spelling a note is the UI's job
   * and this file is theory.
   */
  degreeIndex: number;
}

// Shared lookup: scale tone (spelling + degree + root flag) by pitch class.
interface ScaleTone {
  note: Note;
  degreeIndex: number;
  degree: string;
  isRoot: boolean;
}
function toneLookup(root: Note, scale: ScaleDefinition): Map<number, ScaleTone> {
  const map = new Map<number, ScaleTone>();
  realizeScale(root, scale).forEach((t, i) =>
    map.set(pitchClassOf(t.note), {
      note: t.note,
      degreeIndex: i,
      degree: t.degree,
      isRoot: t.isRoot,
    }),
  );
  return map;
}

// Make a PlacedNote for the note sounding at (string, fret), given its tone.
function placeAt(
  tuning: Tuning,
  stringIndex: number,
  fret: number,
  tone: ScaleTone,
): PlacedNote {
  const midi = midiOf(tuning.openNotes[stringIndex]) + fret;
  return {
    position: { stringIndex, fret },
    note: {
      ...tone.note,
      octave: octaveForSpelling(midi, tone.note.letter, tone.note.accidental),
    },
    intervalName: tone.degree,
    isRoot: tone.isRoot,
  };
}

// The lowest 7 frets on the low E string that land on a scale tone — the start
// of each of the 7 positions, low to high.
function lowStringStartFrets(
  tuning: Tuning,
  fretCount: number,
  byPitchClass: Map<number, ScaleTone>,
): number[] {
  const lowOpen = midiOf(tuning.openNotes[0]);
  const starts: number[] = [];
  for (let f = 0; f <= fretCount && starts.length < 7; f++) {
    if (byPitchClass.has(((lowOpen + f) % 12 + 12) % 12)) starts.push(f);
  }
  return starts;
}

// ---- System 1: N notes per string ----------------------------------------
//
// Three per string is the familiar one — even, wide, and what most modern
// players learn. Four and five are the same idea pushed further: the same walk
// up the ladder, just more of it before crossing. They're wide stretches and
// deliberately unusual, which is the point of having them — a different set of
// shapes over the same notes shakes loose fingerings the standard ones hide.
//
// One function for all three, because the only thing that differs is how many
// tones you take before moving to the next string.
export function scalePositions(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
  perString = 3,
): ScalePosition[] {
  const byPitchClass = toneLookup(root, scale);
  const scalePcs = new Set(byPitchClass.keys());

  // An ascending ladder of every scale-tone MIDI reachable on the neck.
  const lowOpen = midiOf(tuning.openNotes[0]);
  const topReach = midiOf(tuning.openNotes[instrument.stringCount - 1]) + instrument.fretCount;
  const ladder: number[] = [];
  for (let m = lowOpen; m <= topReach; m++) {
    if (scalePcs.has(((m % 12) + 12) % 12)) ladder.push(m);
  }

  // A box: `perString` consecutive ladder tones on each string, climbing.
  //
  // IT STOPS WHERE THE NECK STOPS, rather than failing. At three per string a
  // full six-string box fits comfortably, and it used to return null the
  // moment one didn't — fine for three, useless for four and five. Five tones
  // on every string is about four and a half octaves, and a seventeen-fret
  // neck holds three, so EVERY five-per-string box failed and the system came
  // up empty. Now the pattern simply runs as far as the neck allows.
  //
  // Two octaves is the floor: below that it isn't a scale pattern, it's a
  // fragment, and it's better to offer nothing than something unplayable.
  //
  // FIVE PER STRING NEVER COMPLETES SIX STRINGS, and that isn't a bug in the
  // neck length — it's arithmetic. Five tones on each of six strings is about
  // four and a half octaves; a guitar would need roughly twenty-five frets,
  // and twenty-two and twenty-four were both checked and fall short. Nobody
  // plays 5NPS across the whole neck for that reason; it's played over fewer
  // strings. So stopping where the neck stops IS the right pattern, not a
  // compromise.
  const TWO_OCTAVES = 2 * scale.intervals.length + 1;
  const buildBox = (startIdx: number): PlacedNote[] | null => {
    const notes: PlacedNote[] = [];
    let idx = startIdx;
    for (let s = 0; s < instrument.stringCount; s++) {
      const open = midiOf(tuning.openNotes[s]);
      for (let j = 0; j < perString; j++) {
        const m = ladder[idx];
        if (m === undefined) return notes.length >= TWO_OCTAVES ? notes : null;
        const fret = m - open;
        if (fret < 0) return null; // can't reach behind the nut — not this box
        if (fret > instrument.fretCount) {
          return notes.length >= TWO_OCTAVES ? notes : null;
        }
        notes.push(placeAt(tuning, s, fret, byPitchClass.get(((m % 12) + 12) % 12)!));
        idx++;
      }
    }
    return notes;
  };

  const positions: ScalePosition[] = [];
  for (let i = 0; i < ladder.length && positions.length < 7; i++) {
    const firstFret = ladder[i] - lowOpen;
    if (firstFret < 0 || firstFret > instrument.fretCount) continue;
    const notes = buildBox(i);
    if (!notes) continue;
    const startDegree = byPitchClass.get(((ladder[i] % 12) + 12) % 12)!.degreeIndex;
    positions.push({
      notes,
      name: scale.modeNames?.[startDegree] ?? `Position ${positions.length + 1}`,
      lowestFret: Math.min(...notes.map((p) => p.position.fret)),
      degreeIndex: startDegree,
    });
  }
  return positions;
}


// ---- System 2: the FIVE SHAPES (CAGED / position playing) -----------------
//
// WHY FIVE AND NOT SEVEN. A seven-note scale offers seven notes to start a
// position on, so it's tempting to build seven boxes. Players don't. A major
// scale runs W W H W W W H, and a box starting on the UPPER note of a half
// step sits one fret from the box below it — which is not a different hand
// position, it's the same one. Those collapse, and seven starts become FIVE.
// In C major the half steps are 3->4 and 7->1, so the F and C starts fall away
// and the shapes begin on E, G, A, B and D.
//
// ROOT TO ROOT, TWO OCTAVES. This is the rule that makes a pattern a pattern:
// it starts on a note and ends on that same note two octaves up — fifteen
// tones for a seven-note scale. An earlier version collected every scale note
// inside a fret window instead, which begins and ends wherever the window
// happens to fall and is a picture of the neck rather than a thing you play.
//
// THE WINDOW IS [start - 1, start + 3]. A hand at the starting fret reaches one
// fret back and three forward. Both halves matter and each was checked against
// a fingering Stu gave:
//
//   Open position (start 0, so the window clamps to 0..3)
//     E 0 1 3 | A 0 2 3 | D 0 2 3 | G 0 2 | B 0 1 3 | e 0
//   The G string stops at 2 because B sits at fret 4, outside the window; and
//   it ends on the open high E, two octaves above where it began.
//
//   Mixolydian (start 3, window 2..6)
//     E 3 5 | A 2 3 5 | D 2 3 5 | G 2 4 5 | B 3 5 6 | e 3
//   The reach BACK is what puts B on the A string at fret 2, below the fret
//   the pattern started on — a five-fret window anchored at the start can't
//   produce this, and that's how the shape was found to be wrong.
const REACH_BACK = 1; // frets below the start the hand can still reach
const REACH_UP = 3; // ...and above it

export function fiveShapes(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): ScalePosition[] {
  const byPitchClass = toneLookup(root, scale);
  const scalePcs = new Set(byPitchClass.keys());
  const { stringCount, fretCount } = instrument;
  const lowOpen = midiOf(tuning.openNotes[0]);
  const degreeCount = scale.intervals.length;

  // Every scale tone on the neck, ascending — the path a run walks.
  const topReach = midiOf(tuning.openNotes[stringCount - 1]) + fretCount;
  const ladder: number[] = [];
  for (let m = lowOpen; m <= topReach; m++) {
    if (scalePcs.has(((m % 12) + 12) % 12)) ladder.push(m);
  }

  // WHICH DEGREES START A SHAPE. Drop the ones sitting a semitone above the
  // degree before them — see the note above. Derived from the scale's own
  // intervals, so a scale shaped differently (harmonic minor's augmented
  // second) keeps the starts it should.
  const semis = scale.intervals.map((iv) => iv.semitones);
  const startDegrees = new Set<number>();
  for (let d = 0; d < degreeCount; d++) {
    const prev = (d - 1 + degreeCount) % degreeCount;
    const step = (((semis[d] - semis[prev]) % 12) + 12) % 12;
    if (step !== 1) startDegrees.add(d);
  }

  // Walk `count` tones up from `startIdx`, staying under one hand.
  const buildBox = (startIdx: number, count: number): PlacedNote[] | null => {
    const base = ladder[startIdx] - lowOpen; // the start fret on the low string
    const winLo = Math.max(0, base - REACH_BACK);
    const winHi = base + REACH_UP;
    const notes: PlacedNote[] = [];
    let s = 0;
    for (let k = 0; k < count; k++) {
      const m = ladder[startIdx + k];
      if (m === undefined) return null; // ran off the end of the neck
      // Climb a string until the next tone passes the hand, then cross.
      while (s < stringCount && m - midiOf(tuning.openNotes[s]) > winHi) s++;
      if (s >= stringCount) return null; // ran off the top string
      const fret = m - midiOf(tuning.openNotes[s]);
      if (fret < winLo || fret > fretCount) return null;
      notes.push(placeAt(tuning, s, fret, byPitchClass.get(((m % 12) + 12) % 12)!));
    }
    return notes;
  };

  const positions: ScalePosition[] = [];
  for (let i = 0; i < ladder.length; i++) {
    const fret = ladder[i] - lowOpen;
    if (fret < 0 || fret > fretCount) continue;
    const tone = byPitchClass.get(((ladder[i] % 12) + 12) % 12)!;
    if (!startDegrees.has(tone.degreeIndex)) continue;
    if (positions.some((p) => p.degreeIndex === tone.degreeIndex)) continue;

    // Two octaves if the instrument has the strings for it, otherwise one —
    // still root to root, which is the part that matters. Four strings can't
    // hold fifteen tones under one hand, so a ukulele gets the octave.
    const notes =
      buildBox(i, 2 * degreeCount + 1) ?? buildBox(i, degreeCount + 1);
    if (!notes) continue;

    positions.push({
      notes,
      name: scale.modeNames?.[tone.degreeIndex] ?? `Shape ${tone.degreeIndex + 1}`,
      lowestFret: Math.min(...notes.map((p) => p.position.fret)),
      degreeIndex: tone.degreeIndex,
    });
  }
  // Up the neck, in the order you'd read down a page.
  return positions.sort((a, b) => a.lowestFret - b.lowestFret);
}

// ---- RETIRED: the old 7-box "Positional" and "Hybrid" --------------------
// Kept only until nothing imports them. See fiveShapes above for why seven
// in-position boxes was the wrong count, and why Hybrid was identical to
// Positional in every major-7 scale — two names for one thing.
// ---- Systems 2 & 3: in-position boxes (Positional and Hybrid) -------------
// Both lay TWO OCTAVES of consecutive scale tones across the neck, staying in one
// ~4-fret position: move up a string the moment a tone climbs past the window's
// top, where it sits at a lower fret on the next string. (The major scale's 3rd
// low-E tone lands a whole step past the window, so the low E naturally takes two
// notes — Stu's "notes 2 & 3 of the low E".) They differ by ONE rule at a string
// crossing:
//
//   - Positional (shiftUp = false): a tone ALWAYS crosses down to the next string,
//     even when that puts it BELOW the position (a minor 3rd / 7th "below the
//     baseline"). Where the cross has no room — a ♭7 low on the neck whose next
//     string would be a negative fret — the box simply doesn't form (play it higher
//     up). Strict position playing.
//   - Hybrid (shiftUp = true): a tone crosses down ONLY if it still lands inside the
//     position; if crossing would drop it below the baseline (the ♭7 case) it stays
//     on the current string and shifts UP a fret instead, keeping it on the B
//     string. For a MAJOR-7 scale (Lydian, Ionian) nothing forces a shift, so
//     Hybrid is identical to Positional — the systems diverge ONLY on a ♭7.
const BOX_WIDTH = 4; // a 4-fret hand position

function positionScan(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
  shiftUp: boolean,
): ScalePosition[] {
  const byPitchClass = toneLookup(root, scale);
  const scalePcs = new Set(byPitchClass.keys());
  const lowOpen = midiOf(tuning.openNotes[0]);
  const { stringCount, fretCount } = instrument;
  // HOW MANY NOTES A BOX HOLDS — which depends on how many strings there are.
  //
  // This asked for two octaves flat, 15 tones for a 7-note scale, and two
  // octaves is a SIX-STRING ambition. A four-fret hand position holds about
  // two and a half scale tones per string, so fifteen needs six strings to
  // land on. On a ukulele's four, `buildBox` ran off the top string on every
  // single attempt and returned null — which is why Positional and Hybrid
  // came up completely empty there rather than merely cramped.
  //
  // So the box is measured in STRINGS now, not octaves: as much as the hand
  // can actually reach across the neck it's on. A guitar still gets exactly
  // fifteen and nothing about it changes; a ukulele gets ten, which is an
  // octave and a half and fills all four strings. The floor of one octave
  // keeps a box a box on any smaller instrument that turns up later.
  const REACH_PER_STRING = 2.5; // scale tones under one hand, per string
  const boxNotes = Math.min(
    2 * scale.intervals.length + 1,
    Math.max(
      scale.intervals.length + 1,
      Math.round(stringCount * REACH_PER_STRING),
    ),
  );
  const toneAt = (m: number) => byPitchClass.get(((m % 12) + 12) % 12)!;

  // An ascending ladder of every scale-tone MIDI reachable on the neck.
  const topReach = midiOf(tuning.openNotes[stringCount - 1]) + fretCount;
  const ladder: number[] = [];
  for (let m = lowOpen; m <= topReach; m++) {
    if (scalePcs.has(((m % 12) + 12) % 12)) ladder.push(m);
  }

  // Is the scale's 7th a MINOR 7th (♭7)? That's the only note Hybrid fingers
  // differently from Positional, so a major-7 scale fingers identically in both.
  const lastDegree = scale.intervals.length - 1;
  const seventhIsMinor = scale.intervals[lastDegree].semitones % 12 === 10;

  // Build one in-position box: `boxNotes` consecutive ladder tones from `startIdx`,
  // crossing strings per the Positional / Hybrid rule above.
  const buildBox = (startIdx: number): PlacedNote[] | null => {
    const base = ladder[startIdx] - lowOpen; // the box's start fret on the low E
    const winLo = Math.max(0, base - 1); // allow one fret below for open-side notes
    const winHi = winLo + (BOX_WIDTH - 1);
    const fretOn = (m: number, s: number) => m - midiOf(tuning.openNotes[s]);
    const notes: PlacedNote[] = [];
    let s = 0;
    for (let k = 0; k < boxNotes; k++) {
      const m = ladder[startIdx + k];
      if (m === undefined) return null; // ran off the end of the neck
      // Both cross down a string while the tone climbs past the window's top.
      while (s < stringCount && fretOn(m, s) > winHi) {
        // Hybrid's ONE exception: a ♭7 that would have to drop BELOW the position
        // to cross stays on its string and shifts up a fret instead. This only
        // kicks in once we're past the G string (the top two strings — B and high
        // E on guitar); lower down, and everywhere in Positional, the note crosses
        // down. So a major-7 scale fingers identically in both systems.
        if (
          shiftUp &&
          seventhIsMinor &&
          toneAt(m).degreeIndex === lastDegree &&
          s >= stringCount - 2 &&
          s + 1 < stringCount &&
          fretOn(m, s + 1) < winLo
        ) {
          break;
        }
        s++;
      }
      if (s >= stringCount) return null; // ran off the top string
      const fret = fretOn(m, s);
      if (fret < 0 || fret > fretCount) return null; // can't place it in this box
      notes.push(placeAt(tuning, s, fret, toneAt(m)));
    }
    return notes;
  };

  const positions: ScalePosition[] = [];
  for (const start of lowStringStartFrets(tuning, fretCount, byPitchClass)) {
    const startIdx = ladder.indexOf(lowOpen + start);
    if (startIdx < 0) continue;
    const notes = buildBox(startIdx);
    if (!notes) continue;
    const startDegree = toneAt(lowOpen + start).degreeIndex;
    positions.push({
      notes,
      name: scale.modeNames?.[startDegree] ?? `Position ${positions.length + 1}`,
      lowestFret: Math.min(...notes.map((p) => p.position.fret)),
      degreeIndex: startDegree,
    });
  }
  return positions;
}

// Positional — strict position playing (minor 3rds/7ths cross DOWN to the next
// string, below the baseline; boxes that can't make the cross don't form).
export function positionalBoxes(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): ScalePosition[] {
  return positionScan(instrument, tuning, root, scale, false);
}

// Hybrid — like Positional, but a tone that would cross BELOW the baseline (a ♭7 at
// the top) stays on the B string and shifts up instead. Same as Positional for
// major-7 scales; the two diverge only on a ♭7.
export function hybridBoxes(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): ScalePosition[] {
  return positionScan(instrument, tuning, root, scale, true);
}

// ---- System 3: octave runs, for an instrument with no strings to choose -----
//
// A KEYBOARD HAS NO FINGERING SYSTEMS, because it has no choice to make: every
// note is in exactly one place. CAGED and the notes-per-string family are all
// answers to "which of the six places do I play this in", and on a keyboard
// that question doesn't arise.
//
// So what takes their place? The thing a keyboard player actually practises:
// the scale from each of its degrees, one octave, in order. Start on the
// tonic and it's Ionian; start on the second and the same seven notes are
// Dorian; and so on. That's the same list of seven rows the guitar shows —
// same names, same colours, same order — but cut by MODE rather than by
// position, which on a keyboard is the only cut there is.
//
// The run is n+1 notes long: an octave, ending on the note it began on, so it
// closes the way you'd play it.
export function octaveRuns(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): ScalePosition[] {
  const byPitchClass = toneLookup(root, scale);
  const open = midiOf(tuning.openNotes[0]);
  // Every fret on this one course that belongs to the scale, low to high.
  const frets: number[] = [];
  for (let f = 0; f <= instrument.fretCount; f++) {
    if (byPitchClass.has((((open + f) % 12) + 12) % 12)) frets.push(f);
  }

  const size = scale.intervals.length; // 7 for the usual scales
  // WHERE THE HAND ACTUALLY SITS: around MIDDLE C. You don't practise a scale
  // at the very bottom of a keyboard, and a run taken at the lowest place its
  // degree occurs is exactly that — three octaves of instrument with the notes
  // all crowded into the leftmost one, written on a bass staff you'd never
  // read them from. So each run is taken from whichever occurrence of its
  // degree lands nearest middle C, and only falls back to the middle of the
  // range on an instrument that doesn't reach it.
  const MIDDLE_C = 60;
  const middle = Math.min(
    Math.max(MIDDLE_C - open, 0),
    instrument.fretCount,
  ) || instrument.fretCount / 2;
  const positions: ScalePosition[] = [];
  for (let degree = 0; degree < size; degree++) {
    // Every place this degree occurs, as an index into the scale tones above.
    const starts = frets
      .map((f, i) => ({ f, i }))
      .filter(
        ({ f }) =>
          byPitchClass.get((((open + f) % 12) + 12) % 12)?.degreeIndex === degree,
      )
      // ...that have a whole octave above them still on the instrument.
      .filter(({ i }) => i + size < frets.length);
    if (starts.length === 0) continue;
    // Nearest the middle, measured from the run's own centre.
    const startAt = starts.reduce((best, s) => {
      const centre = (n: { i: number }) => (frets[n.i] + frets[n.i + size]) / 2;
      return Math.abs(centre(s) - middle) < Math.abs(centre(best) - middle) ? s : best;
    }).i;
    const run = frets.slice(startAt, startAt + size + 1);
    // An octave that doesn't finish inside the instrument's range isn't a run.
    if (run.length < size + 1) continue;
    positions.push({
      notes: run.map((f) =>
        placeAt(tuning, 0, f, byPitchClass.get((((open + f) % 12) + 12) % 12)!),
      ),
      name: scale.modeNames?.[degree] ?? `Position ${degree + 1}`,
      lowestFret: run[0],
      degreeIndex: degree,
    });
  }
  return positions;
}
