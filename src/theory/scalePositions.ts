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

// ---- System 1: three notes per string ------------------------------------
export function scalePositions(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
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

  // A 3nps box: 3 consecutive ladder tones on each string. Null if it runs off.
  const buildBox = (startIdx: number): PlacedNote[] | null => {
    const notes: PlacedNote[] = [];
    let idx = startIdx;
    for (let s = 0; s < instrument.stringCount; s++) {
      const open = midiOf(tuning.openNotes[s]);
      for (let j = 0; j < 3; j++) {
        const m = ladder[idx];
        if (m === undefined) return null;
        const fret = m - open;
        if (fret < 0 || fret > instrument.fretCount) return null;
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
// WHY FIVE AND NOT SEVEN, which is the thing the old "Positional" got wrong.
//
// A seven-note scale offers seven notes to start a position on, so it's
// tempting to build seven boxes. Players don't, and the reason is in the
// intervals. A major scale runs W W H W W W H: two of its steps are HALF
// steps. A box starting on the upper note of a half step sits in essentially
// the same place on the neck as the box starting on the lower note — one fret
// apart is not a different hand position. So those two collapse, and seven
// starts become FIVE SHAPES. That's the CAGED system, and it's what every
// printed position sheet shows.
//
// Concretely in C major the half steps are 3->4 and 7->1, so the starts on F
// and C fall away and the shapes begin on D, E, G, A and B. It cross-checks
// against a Phrygian sheet: E Phrygian is the same seven notes, E is the 3rd
// of C major, and it survives — so Phrygian's first pattern starts on its own
// root, which is exactly how those sheets are drawn.
//
// A SHAPE IS A WINDOW, not a walk. The old code built a box by stepping along
// a ladder of scale tones and crossing strings when one climbed too high,
// which is how you'd describe 3-notes-per-string. An in-position shape is
// simpler and more honest than that: put your hand at a fret, and the shape is
// EVERY scale note under it, on every string. That's what the diagrams draw
// and it's what the hand actually does.
// A HAND COVERS FOUR FRETS, so the window is the start fret plus three.
//
// This was 4 — a five-fret window — and the extra fret is what broke the open
// position. In C major it reached fret 4 and picked up the B on the G string,
// which isn't in open position; the de-duplication below then dropped the OPEN
// B to compensate, so the G string read 0-2-4 and the B string 1-3 where every
// method book has 0-2 and 0-1-3. One fret too wide, and then a second wrong
// answer covering for the first.
//
// Four frets also makes the shapes naturally duplicate-free: the G/B pair is
// the one that can sound a pitch twice, and at this width the two occurrences
// no longer fall in the same window.
const SHAPE_SPAN = 3;

export function fiveShapes(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  scale: ScaleDefinition,
): ScalePosition[] {
  const byPitchClass = toneLookup(root, scale);
  const { stringCount, fretCount } = instrument;
  const lowOpen = midiOf(tuning.openNotes[0]);
  const degreeCount = scale.intervals.length;

  // WHICH DEGREES SURVIVE. A degree is dropped when it sits a semitone above
  // the one before it — that's the collapse described above. Derived from the
  // scale's own intervals rather than hard-coded, so it gives five for any
  // seven-note scale with two half steps and does the right thing for scales
  // shaped differently (harmonic minor's augmented second keeps all seven).
  const semis = scale.intervals.map((iv) => iv.semitones);
  const startDegrees: number[] = [];
  for (let d = 0; d < degreeCount; d++) {
    const prev = (d - 1 + degreeCount) % degreeCount;
    const step = ((semis[d] - semis[prev]) % 12 + 12) % 12;
    if (step !== 1) startDegrees.push(d); // 1 semitone = same hand position
  }

  const positions: ScalePosition[] = [];
  for (const degree of startDegrees) {
    // Where this degree first sits on the lowest string.
    let startFret = -1;
    for (let f = 0; f <= fretCount; f++) {
      const tone = byPitchClass.get((((lowOpen + f) % 12) + 12) % 12);
      if (tone && tone.degreeIndex === degree) {
        startFret = f;
        break;
      }
    }
    if (startFret < 0) continue;

    // HOW WIDE THE HAND GOES. Four frets first, five if four won't reach.
    //
    // Open position is genuinely narrower than the rest, because the open
    // strings do the work a fret would otherwise have to: four frets there
    // gives a full two octaves. Higher up there are no open strings to lean
    // on and the same four frets came up short — thirteen notes, well under
    // the two octaves a position is supposed to cover — so the hand stretches
    // to a fifth fret, which is what a hand actually does.
    //
    // Written as "reach further only when you must" rather than a per-shape
    // table, so it stays true in every key rather than just this one.
    const TWO_OCTAVES = 2 * degreeCount + 1;

    // The window, and every scale note inside it on every string —
    // BUT EACH PITCH ONLY ONCE.
    //
    // A scale doesn't repeat a note, and a guitar will happily offer you the
    // same one twice: G to B is a major 3rd where every other pair is a 4th,
    // so in most windows one pitch sits on BOTH strings. Taking the window
    // literally put B3 at G-string fret 4 and again at B-string fret 0, and
    // the run played it twice in a row.
    //
    // The duplicate to keep is the one on the LOWER string, which is what
    // "in position" means: climb a string as far as the window reaches, then
    // cross. Strings are walked low to high here, so the first sighting of a
    // pitch is already the right one and the rest are skipped.
    const gather = (span: number): PlacedNote[] => {
      const hi = Math.min(fretCount, startFret + span);
      const found: PlacedNote[] = [];
      const sounded = new Set<number>();
      for (let s = 0; s < stringCount; s++) {
        const open = midiOf(tuning.openNotes[s]);
        for (let f = startFret; f <= hi; f++) {
          const tone = byPitchClass.get((((open + f) % 12) + 12) % 12);
          if (!tone) continue;
          const midi = open + f;
          if (sounded.has(midi)) continue; // already fingered, lower down
          sounded.add(midi);
          found.push(placeAt(tuning, s, f, tone));
        }
      }
      return found;
    };
    let notes = gather(SHAPE_SPAN);
    if (notes.length < TWO_OCTAVES) notes = gather(SHAPE_SPAN + 1);
    // A shape with a string missing isn't a hand position, it's a fragment.
    const stringsCovered = new Set(notes.map((n) => n.position.stringIndex)).size;
    if (stringsCovered < stringCount) continue;

    positions.push({
      notes,
      name: scale.modeNames?.[degree] ?? `Shape ${degree + 1}`,
      lowestFret: startFret,
      degreeIndex: degree,
    });
  }
  // UP THE NECK, in the order you'd read them. They're built in DEGREE order,
  // which for C major puts the D shape (fret 10) first and the E shape (open)
  // second — so the page would start you halfway up the neck and send you back
  // to the nut. Reading down a page walks up the neck everywhere else here.
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
