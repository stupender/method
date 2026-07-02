// ============================================================================
// theory/suggest.ts — the function engine: what could sit over this bass note?
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). The start of Arc 1 (see BACKLOG.md).
//
// The songwriting/transcription flow: you know the BASS NOTES of a progression
// (you wrote a bass line, or transcribed one by ear) but not yet the chords.
// Given a bass note and a working key, this module lists every chord that could
// sit on top, RANKED by harmonic distance — the "heat map" from most obvious to
// farthest out:
//
//   tier 0 — a diatonic chord of the key with the bass as its ROOT
//   tier 1 — a diatonic chord with the bass as another chord tone (an
//            inversion / slash chord: the bass is its 3rd, 5th or 7th)
//   tier 2 — a SECONDARY DOMINANT (V7 of some degree) containing the bass
//
// This is the GPS reveal read inward (Stu's note): "A7 lives in D's key" is the
// same fact as "A7 is the V7 pointing at D". Later tiers (borrowed chords from
// the parallel key, chords of related keys, true slash chords over non-chord
// tones) extend the same list — see BACKLOG "Bass-first input".
// ============================================================================

import type { Note, ChordDefinition, ScaleDefinition } from './types';
import { pitchClassOf, spellNoteFromInterval } from './notes';
import { realizeScale } from './scale';
import { diatonicChords } from './harmony';
import { SCALES } from '../data/scales';
import { ROOT_CHOICES } from '../data/roots';
import { DOMINANT_SEVENTH } from '../data/chords';
import { P5 } from '../data/intervals';

// One suggested chord over the bass.
export interface BassSuggestion {
  chordRoot: Note; // the suggested chord's root, correctly spelled
  chord: ChordDefinition; // its quality
  bassRole: string; // which chord tone the bass is: '1' | '3' | '5' | '7'
  tier: number; // 0 = most obvious … 2 = secondary dominant
  roman: string; // its function in the key, e.g. "ii7" or "V7/IV"
}

// Which chord tone (if any) a bass pitch class is in a chord — '1'/'3'/'5'/'7',
// or null if the bass isn't a chord tone at all.
function roleOfBass(
  chordRoot: Note,
  chord: ChordDefinition,
  bassPc: number,
): string | null {
  const rootPc = pitchClassOf(chordRoot);
  for (const iv of chord.intervals) {
    if ((rootPc + iv.semitones) % 12 === bassPc % 12) {
      return String(iv.diatonicSteps + 1);
    }
  }
  return null;
}

// Every chord that could sit over `bass` in the key of (tonic, scale), ranked.
// Offers both triads and sevenths. Deduped by (root, quality, bass role),
// keeping the closest (lowest-tier) interpretation.
export function chordsOverBass(
  bass: Note,
  tonic: Note,
  scale: ScaleDefinition,
): BassSuggestion[] {
  const bassPc = pitchClassOf(bass);
  const out: BassSuggestion[] = [];
  const seen = new Set<string>();
  const add = (s: BassSuggestion) => {
    const key = `${pitchClassOf(s.chordRoot)}:${s.chord.id}:${s.bassRole}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  };

  // Tiers 0 & 1 — the key's own chords (triads and sevenths) that contain the
  // bass. Root in the bass = tier 0; any other chord tone = tier 1 (a slash).
  let triads;
  try {
    triads = diatonicChords(tonic, scale, false);
  } catch {
    return []; // a scale whose harmony we can't name — nothing to suggest
  }
  for (const seventh of [false, true]) {
    let inKey;
    try {
      inKey = diatonicChords(tonic, scale, seventh);
    } catch {
      continue;
    }
    for (const d of inKey) {
      const role = roleOfBass(d.chordRoot, d.chord, bassPc);
      if (!role) continue;
      add({
        chordRoot: d.chordRoot,
        chord: d.chord,
        bassRole: role,
        tier: role === '1' ? 0 : 1,
        roman: d.roman,
      });
    }
  }

  // Tier 2 — secondary dominants: the V7 pointing at each (non-diminished)
  // degree of the key. Its root sits a perfect 5th above the target's root.
  const tones = realizeScale(tonic, scale);
  for (let degree = 0; degree < tones.length; degree++) {
    const target = triads[degree];
    if (target.chord.id === 'diminished-triad') continue; // no V7 of °
    const domRoot = spellNoteFromInterval(tones[degree].note, P5);
    const role = roleOfBass(domRoot, DOMINANT_SEVENTH, bassPc);
    if (!role) continue;
    add({
      chordRoot: domRoot,
      chord: DOMINANT_SEVENTH,
      bassRole: role,
      tier: 2,
      roman: `V7/${target.roman}`,
    });
  }

  // Most obvious first: by tier, then root-in-bass before slashes, then by the
  // chord tone the bass plays (3rd before 5th before 7th).
  out.sort(
    (a, b) => a.tier - b.tier || Number(a.bassRole) - Number(b.bassRole),
  );
  return out;
}

// A key that could hold a whole BASS LINE: every bass pitch class is a scale
// tone. This is the note-level cousin of `keysContainingAll` — the bass line
// alone already narrows the key space.
export interface NoteKeyMatch {
  tonic: Note;
  scale: ScaleDefinition;
}

export function keysContainingNotes(notes: Note[]): NoteKeyMatch[] {
  if (notes.length === 0) return [];
  const pcs = [...new Set(notes.map(pitchClassOf))];
  const matches: NoteKeyMatch[] = [];
  for (const scale of Object.values(SCALES)) {
    for (const tonic of ROOT_CHOICES) {
      const scalePcs = new Set(
        realizeScale(tonic, scale).map((t) => pitchClassOf(t.note)),
      );
      if (pcs.every((pc) => scalePcs.has(pc))) matches.push({ tonic, scale });
    }
  }
  return matches;
}
