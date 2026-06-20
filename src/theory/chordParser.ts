// ============================================================================
// theory/chordParser.ts — read chord symbols typed as text
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). Turn a written chord symbol like "F-7",
// "Cmaj7" or "Bø" into the indices the chart stores (which root, which chord
// type). And read a whole pasted progression ("Dm7 | G7 | Cmaj7") into bars.
//
// This is the inverse of how we DISPLAY a chord (root note + chord symbol). The
// hard part is that musicians spell the same quality many ways — "-7", "m7" and
// "min7" all mean a minor seventh — so most of this file is an alias table.
// ============================================================================

import type { Note } from './types';
import { CHORDS } from '../data/chords';
import { ROOT_CHOICES } from '../data/roots';
import { pitchClassOf } from './notes';

// A parsed chord as the chart stores it: which root (index into ROOT_CHOICES),
// which chord type (a CHORDS id), and how long it lasts in beats.
export interface ParsedChord {
  rootIndex: number;
  chordId: string;
  durationBeats: number;
}

// Every way we accept a chord QUALITY written, mapped to a CHORDS id. Keys are
// the quality text AFTER normalization (see normalizeQuality), and are CASE-
// SENSITIVE on purpose: "M7" is a major seventh but "m7" is a minor seventh.
const QUALITY_ALIASES: Record<string, string> = {
  // Triads
  '': 'major-triad',
  maj: 'major-triad',
  major: 'major-triad',
  M: 'major-triad',
  ma: 'major-triad',
  m: 'minor-triad',
  min: 'minor-triad',
  minor: 'minor-triad',
  '-': 'minor-triad',
  mi: 'minor-triad',
  dim: 'diminished-triad',
  o: 'diminished-triad',
  aug: 'augmented-triad',
  '+': 'augmented-triad',
  '#5': 'augmented-triad',
  '+5': 'augmented-triad',
  // Sevenths
  maj7: 'major-seventh',
  Maj7: 'major-seventh',
  M7: 'major-seventh',
  ma7: 'major-seventh',
  major7: 'major-seventh',
  j7: 'major-seventh',
  m7: 'minor-seventh',
  min7: 'minor-seventh',
  '-7': 'minor-seventh',
  mi7: 'minor-seventh',
  minor7: 'minor-seventh',
  '7': 'dominant-seventh',
  dom7: 'dominant-seventh',
  dom: 'dominant-seventh',
  m7b5: 'half-diminished',
  min7b5: 'half-diminished',
  '-7b5': 'half-diminished',
  'm7-5': 'half-diminished',
  halfdim: 'half-diminished',
  mmaj7: 'minor-major-seventh',
  mMaj7: 'minor-major-seventh',
  minmaj7: 'minor-major-seventh',
  '-maj7': 'minor-major-seventh',
  mM7: 'minor-major-seventh',
  mma7: 'minor-major-seventh',
  dim7: 'diminished-seventh',
  o7: 'diminished-seventh',
  'maj7#5': 'augmented-major-seventh',
  'M7#5': 'augmented-major-seventh',
  'maj7+5': 'augmented-major-seventh',
  augmaj7: 'augmented-major-seventh',
  '+maj7': 'augmented-major-seventh',
};

// Fold the many ways of writing symbols into the plain spellings above, WITHOUT
// touching the m/M case (that's the one distinction we must keep).
function normalizeQuality(q: string): string {
  return q
    .replace(/ø7/g, 'm7b5') // half-diminished symbol (with or without a 7)
    .replace(/ø/g, 'm7b5')
    .replace(/[Δ∆]/g, 'maj') // a triangle means major-seventh's "maj"
    .replace(/[°º]/g, 'o') // a degree ring means diminished
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .replace(/[–—]/g, '-') // en/em dashes -> a plain minus
    .replace(/[()]/g, '') // drop the parentheses in "m(maj7)"
    .replace(/\s+/g, '');
}

// Parse one chord symbol, e.g. "F-7" -> { rootIndex: <F>, chordId: 'minor-seventh' }.
// Returns null if the root or the quality isn't recognised. A slash bass ("C/E")
// is accepted but ignored for now (slash chords aren't modelled yet).
export function parseChordSymbol(
  text: string,
): { rootIndex: number; chordId: string } | null {
  const main = text.trim().split('/')[0]; // drop any "/bass"
  // Root: a letter A–G, then any run of sharps/flats.
  const match = main.match(/^([A-Ga-g])([#♯b♭]*)/);
  if (!match) return null;
  const letter = match[1].toUpperCase();
  let accidental = 0;
  for (const ch of match[2]) accidental += ch === '#' || ch === '♯' ? 1 : -1;

  const root: Note = { letter: letter as Note['letter'], accidental: accidental as Note['accidental'], octave: 4 };
  const pc = pitchClassOf(root);
  const rootIndex = ROOT_CHOICES.findIndex((n) => pitchClassOf(n) === pc);
  if (rootIndex < 0) return null;

  // Quality: whatever follows the root.
  const quality = normalizeQuality(main.slice(match[0].length));
  const chordId = QUALITY_ALIASES[quality];
  if (!chordId || !CHORDS[chordId]) return null;

  return { rootIndex, chordId };
}

// Read a whole progression. Bars are separated by "|", "," or a newline; chords
// within a bar are separated by spaces and SHARE that bar (split its beats). If
// there are no bar separators at all, every chord is treated as its own bar — so
// "Cmaj7 Am7 Dm7 G7" reads as four one-bar chords, the most common case.
// Unrecognised tokens are skipped. Returns [] if nothing parsed.
export function parseProgression(text: string, beatsPerBar: number): ParsedChord[] {
  const hasBarLines = /[|,\n]/.test(text);
  const out: ParsedChord[] = [];

  if (!hasBarLines) {
    for (const token of text.split(/\s+/).filter(Boolean)) {
      const parsed = parseChordSymbol(token);
      if (parsed) out.push({ ...parsed, durationBeats: beatsPerBar });
    }
    return out;
  }

  for (const bar of text.split(/[|,\n]/)) {
    const tokens = bar.trim().split(/\s+/).filter(Boolean);
    const parsed = tokens.map(parseChordSymbol).filter((p): p is NonNullable<typeof p> => p != null);
    if (parsed.length === 0) continue;
    const durationBeats = beatsPerBar / parsed.length; // chords in a bar share it
    for (const p of parsed) out.push({ ...p, durationBeats });
  }
  return out;
}
