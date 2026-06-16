// ============================================================================
// types.ts — THE SCHEMA  ("paper-in-code")
// ----------------------------------------------------------------------------
// This file is the heart of Method. It defines the *shape* of all theory
// content and the instrument. It contains NO logic — only type definitions
// (descriptions of what the data looks like). The actual functions that turn
// this data into notes, positions and sounds live elsewhere (src/theory/*.ts).
//
// Why types-only matters: a `type` in TypeScript is a contract. If a data file
// (a scale, a chord, a tuning) doesn't match the contract, the editor and the
// build will complain *before* the app ever runs. So these types are the
// guard-rails that let Stu (and a future local AI model) add content safely.
//
// The big idea (read this once): the ENGINE renders DATA. Everything below is
// data. A scale is just a name + a list of intervals. A tuning is just a list
// of open-string notes. The fretboard, the audio and the notation all read
// these structures — they have no music theory baked into them. Add a new
// scale/chord/tuning by adding a data file that matches a type here. No engine
// code changes. That is what makes Method extend by data, not by code.
// ============================================================================


// ----------------------------------------------------------------------------
// 1. PITCH PRIMITIVES
// ----------------------------------------------------------------------------
// We need to talk about notes in two different ways at once:
//
//   (a) How they SOUND  — a "pitch class" 0..11 (C=0, C#=1, ... B=11). Twelve
//       slots, octave ignored. This is what matters for audio and for "is this
//       the same note".
//   (b) How they are SPELLED — the letter + accidental, e.g. F# vs Gb. These
//       sound identical (same pitch class) but are written differently. A jazz
//       musician cares: the F major scale must read B-flat, never A-sharp.
//
// So a Note carries BOTH: a letter, an accidental, and (for audio) an octave.
// The pitch class is derived from letter+accidental by a pure function later.

// The seven letter names. Order matters — it's the musical alphabet, and we
// step through it (A->B->C...) when spelling intervals.
export type Letter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

// Accidental measured in semitones away from the natural letter.
//   -2 = double flat, -1 = flat, 0 = natural, +1 = sharp, +2 = double sharp.
// Storing it as a number (not the string "#") makes the spelling math trivial:
// to sharpen a note you just add 1.
export type Accidental = -2 | -1 | 0 | 1 | 2;

// A fully specified, spelled note — what we draw on the fretboard and play.
//   { letter:'B', accidental:-1, octave:3 }  ->  "Bb" in octave 3.
// Octave uses scientific pitch notation (middle C = C4). Octave is optional in
// some contexts (e.g. a scale "contains a Bb" regardless of register), so it is
// allowed to be undefined when register doesn't matter yet.
export interface Note {
  letter: Letter;
  accidental: Accidental;
  octave?: number;
}

// A pitch class is just 0..11. (TypeScript can't easily restrict a number to a
// range, so this alias is documentation: "this number is meant to be 0..11".)
export type PitchClass = number;


// ----------------------------------------------------------------------------
// 2. INTERVALS — the unit of theory
// ----------------------------------------------------------------------------
// An interval is the DISTANCE between two notes. Method describes scales and
// chords as a *root note* plus a *list of intervals from that root*. This is
// the single most important modelling choice in the app, because:
//
//   - It's transposable for free: the same interval list played from any root
//     gives that scale/chord in any key. No data duplication per key.
//   - It spells correctly: we store BOTH a letter-distance and a semitone-
//     distance, which is exactly what's needed to choose F# vs Gb.
//
// Worked example — a major third up from C:
//   diatonicSteps = 2  (move two letters: C -> D -> E, landing on letter E)
//   semitones     = 4  (four half-steps above C is the pitch E-natural)
//   => the note is E. Correct.
// Same major third up from Eb:
//   diatonicSteps = 2  (Eb -> F -> G, landing on letter G)
//   semitones     = 4  (four half-steps above Eb is G-natural)
//   => G. Correct, and we never accidentally called it "F##".
export interface Interval {
  // Human-readable shorthand: "P1", "m3", "M3", "P5", "b7", "#11", etc.
  // For display and for referring to chord tones in voicings.
  name: string;

  // How many LETTER names to move from the root (0 = unison, 1 = a 2nd,
  // 2 = a 3rd, 3 = a 4th, ...). Drives correct spelling.
  diatonicSteps: number;

  // How many SEMITONES (half-steps) above the root. Drives the actual pitch.
  semitones: number;
}


// ----------------------------------------------------------------------------
// 3. THEORY UNITS — scales and chords
// ----------------------------------------------------------------------------
// A "theory unit" is one teachable object: a scale type, a chord type, etc.
// Each is root-agnostic: it's defined by intervals, then realised on a chosen
// root by the theory logic. These are the things Stu authors as data files.

// The kinds of unit we support. Adding a new kind later (e.g. 'rhythm') is the
// only time this union changes; new *instances* of existing kinds are pure data.
export type TheoryUnitKind = 'scale' | 'chord';

// Fields shared by every theory unit.
interface TheoryUnitBase {
  id: string;          // stable machine id, e.g. "major-scale" (used in data refs)
  name: string;        // display name, e.g. "Major Scale"
  kind: TheoryUnitKind;
  aliases?: string[];  // other names, e.g. ["Ionian"] — handy for search later
}

// A SCALE: an ordered set of intervals from the root, spanning one octave.
// The major scale is [P1, M2, M3, P4, P5, M6, M7]. That's the whole definition.
export interface ScaleDefinition extends TheoryUnitBase {
  kind: 'scale';
  intervals: Interval[];        // includes the root (P1) as the first entry
  degreeNames?: string[];       // optional labels: ["1","2","♭3","4","5","♭6","7"]
  // The name of the mode/position starting on each scale degree (index 0 = the
  // box starting on the root). Used to label the position boxes on the neck.
  modeNames?: string[];
}

// A CHORD TYPE: the intervals that make up the chord, from the root.
//   Major triad   = [P1, M3, P5]
//   Major seventh = [P1, M3, P5, M7]
// Inversions, drop-2 / drop-3 and spread voicings are NOT separate chord types —
// they are *rearrangements* of these same chord tones. We model those as
// Voicings (section 4) so one chord definition powers every voicing of it.
export interface ChordDefinition extends TheoryUnitBase {
  kind: 'chord';
  symbol: string;          // chord-symbol suffix, e.g. "" (major), "maj7", "m7"
  intervals: Interval[];   // chord tones from the root, including P1
}

// Convenience union when a function accepts "any theory unit".
export type TheoryUnit = ScaleDefinition | ChordDefinition;


// ----------------------------------------------------------------------------
// 4. VOICINGS — how chord tones are arranged in space
// ----------------------------------------------------------------------------
// A voicing is the SAME chord tones, rearranged. It has TWO independent axes:
//
//   - INVERSION: which chord tone is in the bass. An N-note chord has N
//     inversions (root position, 1st, 2nd, ... up to the (N-1)th). A triad has
//     3, a seventh chord has 4. We COMPUTE these by rotating the stack — no data
//     per inversion.
//   - STRUCTURE: how the voices are spread once the bass is chosen. "Close"
//     packs them tightest; "Drop 2"/"Drop 3" lower the 2nd/3rd voice from the
//     top by an octave to open the chord up (an "open"/"spread" triad is just a
//     dropped triad). We COMPUTE these too, from the structure's `dropFromTop`.
//
// So a chosen voicing = (chord, structure, inversion). The theory layer turns
// that into ordered pitches; the placement engine finds a playable shape. The
// only DATA we keep is the small list of structures below — inversions and the
// shapes themselves are derived, because they are fixed theory operations, not
// content you'd author.
export interface VoicingStructure {
  id: string;   // "close", "drop2", "drop3"
  name: string; // display name, e.g. "Drop 2"
  // Which voice (counting from the TOP, 1 = top voice) to drop by an octave.
  // 0 = no drop (close position). "Drop 2" = 2, "Drop 3" = 3.
  dropFromTop: number;
}


// ----------------------------------------------------------------------------
// 5. INSTRUMENT & TUNING — parameterised from day one
// ----------------------------------------------------------------------------
// The fretboard renderer must never assume "guitar". It is handed an Instrument
// and a Tuning and draws whatever it's given. v1 ships guitar/standard tuning,
// but ukulele or drop-D are then just new data, with zero engine changes.

// An instrument describes the PHYSICAL layout: how many strings, how many frets.
// It does NOT fix the pitches — that's the tuning's job (so one instrument can
// have many tunings).
export interface Instrument {
  id: string;             // "guitar", "ukulele", ...
  name: string;           // "Guitar"
  stringCount: number;    // 6 for guitar, 4 for ukulele
  fretCount: number;      // how many frets to draw, e.g. 15
  defaultTuningId: string; // which Tuning to load first
}

// A tuning is the list of OPEN-STRING notes for an instrument.
//
// CONVENTION (write it down once, obey it everywhere):
//   openNotes is ordered LOW pitch -> HIGH pitch.
//   index 0 = the lowest-sounding string (the thick low E on a guitar),
//   last index = the highest-sounding string (the thin high E).
// This is the *opposite* of how strings are often drawn top-to-bottom, so the
// renderer will reverse for display. Keeping the data in pitch order keeps the
// theory math simple; display is a presentation concern.
export interface Tuning {
  id: string;            // "standard", "drop-d", "ukulele-standard"
  name: string;          // "Standard"
  instrumentId: string;  // which Instrument this tuning is for
  openNotes: Note[];     // open-string notes, low -> high (length = stringCount)
}


// ----------------------------------------------------------------------------
// 6. FRETBOARD POSITIONS — where a note physically sits
// ----------------------------------------------------------------------------
// A single place to put a finger: a string + a fret. The theory logic turns
// (tuning + Position) into a concrete Note, and (root + scale/chord) into a set
// of Positions to light up. The renderer only ever deals in Positions.
export interface Position {
  stringIndex: number;  // 0-based, using the low->high convention above
  fret: number;         // 0 = open string, 1 = first fret, ...
}

// A note placed on the fretboard: a Position plus what it is and why it's lit.
// `degree` lets the UI colour/label notes by their role (root vs 3rd vs 5th),
// which is what powers the GPS reveal in Session 5.
export interface PlacedNote {
  position: Position;
  note: Note;
  intervalName: string; // its role relative to the current root, e.g. "M3"
  isRoot: boolean;
}


// ----------------------------------------------------------------------------
// 7. CHORD SEQUENCES / SONGS — the seam for the progression workbench (v2)
// ----------------------------------------------------------------------------
// We don't build the progression builder, MIDI in/out, or iReal Pro import yet,
// but we shape the model now so those land with no rearchitecting. See
// BACKLOG.md (items C–G). The fields beyond `symbol` are documented SEAMS:
// optional, unused today, here so the shape is right when we build v2.
//
// A chord is understood in three layers, most-open to most-specific:
//   (1) the neutral chord symbol,
//   (2) its Roman-numeral function relative to a key center — kept PLURAL while
//       open, because one chord can be (e.g.) ii in C / vi in F / iii in Bb, and
//       that multiplicity is the same "possibility space" as the GPS reveal,
//   (3) the chosen voicing to actually play.
export interface ChordRef {
  // (1) The chord symbol as written, e.g. "Cmaj7", "A-7", "G7". Parsing this
  // into a root + ChordDefinition is a later job; we store the text now.
  symbol: string;

  // (2) SEAM: possible Roman-numeral interpretations and the key center(s) they
  // are measured against. Plural = not yet committed to one reading (open).
  keyCenter?: string;       // e.g. "C" — the tonic this function is relative to
  romanNumerals?: string[]; // e.g. ["ii", "vi", "iii"] across candidate keys

  // (3) SEAM: the chosen voicing to play — referenced by the ids the chord/
  // voicing engine already uses (see ChordDefinition + VoicingStructure).
  voicing?: {
    chordId: string;
    structureId: string;
    inversion: number;
  };

  // SEAM: timing in BEATS from the start of the song. Absolute (not per-bar) so
  // a chord can cross bar lines. Bars (below) are a display grid, not the clock.
  startBeat?: number;
  endBeat?: number;
}

export interface Bar {
  chords: ChordRef[];   // one or more chords sounding in this measure
}

export interface Section {
  label?: string;       // "A", "B", "Intro", ...
  bars: Bar[];
}

export interface Progression {
  title: string;
  key?: string;             // e.g. "C", "Eb"
  timeSignature?: string;   // e.g. "4/4"
  sections: Section[];
  // A song can be as small as one bar with one chord — a tool to practice over a
  // single chord — or a full chart imported from iReal Pro.
}
