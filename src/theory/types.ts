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
  degreeNames?: string[];       // optional labels: ["1","2","3","4","5","6","7"]
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
// 4. VOICINGS — how chord tones are arranged in space  (fully built in Session 4)
// ----------------------------------------------------------------------------
// A voicing takes a chord's tones and decides their ORDER and OCTAVE. Root
// position, first/second inversion, drop-2, drop-3 and spread voicings are all
// just different orderings + octave shifts of the same chord tones. Modelling
// this as data (not as a hard-coded function per voicing) means new voicings
// are added as data later. Sketched now so the seam exists; refined in Session 4.
export interface VoicingTone {
  // Which chord tone, named by its interval shorthand from the chord definition
  // (e.g. "M3", "P5", "M7"). Lets a voicing pick tones without re-listing pitches.
  intervalName: string;
  // Octave shift applied to that tone, in octaves: 0 = as written, -1 = down an
  // octave (this is exactly what "drop 2" does to the 2nd-from-top voice), etc.
  octaveShift: number;
}

export interface VoicingDefinition {
  id: string;            // e.g. "drop2", "root-position", "first-inversion"
  name: string;          // display name, e.g. "Drop 2"
  // The voices from LOW to HIGH. Length usually matches the chord's tone count.
  tones: VoicingTone[];
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
// 7. CHORD SEQUENCES — the seam for iReal Pro import (v2, NOT built now)
// ----------------------------------------------------------------------------
// We don't build the importer yet, but we shape the progression model now so a
// future iReal Pro import has somewhere to land with no rearchitecting. iReal
// charts carry: a title, a key, a time signature, and a list of measures with
// chord symbols, grouped into sections with repeats/endings. The minimal model
// below mirrors that shape.
export interface ChordRef {
  // A chord symbol as written on a chart, e.g. "Cmaj7", "A-7", "G7". Parsing
  // this into a root + ChordDefinition is a later job; we store the text now.
  symbol: string;
}

export interface Bar {
  chords: ChordRef[];   // one or more chords in the measure
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
}
