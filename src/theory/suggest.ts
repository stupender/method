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
//   tier 3 — a chord BORROWED from the parallel minor (major keys only)
//
// This is the GPS reveal read inward (Stu's note): "A7 lives in D's key" is the
// same fact as "A7 is the V7 pointing at D". Later extensions (chords of related
// keys, true slash chords over non-chord tones) join the same list — see BACKLOG
// "Bass-first input".
// ============================================================================

import type { Note, ChordDefinition, ScaleDefinition } from './types';
import { pitchClassOf, spellNoteFromInterval } from './notes';
import { realizeScale } from './scale';
import { diatonicChords } from './harmony';
import { modeAt } from './mode';
import { SCALES, MAJOR_SCALE } from '../data/scales';
import { ROOT_CHOICES } from '../data/roots';
import { DOMINANT_SEVENTH } from '../data/chords';
import { P5, m3 } from '../data/intervals';

// One suggested chord over the bass.
export interface BassSuggestion {
  chordRoot: Note; // the suggested chord's root, correctly spelled
  chord: ChordDefinition; // its quality
  bassRole: string; // which chord tone the bass is: '1' | '3' | '5' | '7'
  tier: number; // 0 = most obvious … 3 = borrowed
  roman: string; // its function in the key, e.g. "ii7" or "V7/IV"
  borrowed?: boolean; // true = from the parallel minor, not the key itself
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

// The PARALLEL (natural) minor of a major tonic. Natural minor is deliberately
// NOT in the SCALES data (every natural minor is its relative major's notes, so
// listing it would double every key in the reveal). Derive it instead: aeolian
// on this tonic = the 6th mode of the major scale a minor 3rd up (C aeolian =
// the notes of E♭ major, from C). Exported: the function quiz borrows from it too.
export function parallelMinorOf(tonic: Note) {
  const relativeMajor = spellNoteFromInterval(tonic, m3);
  return modeAt(relativeMajor, MAJOR_SCALE, 5); // { modeRoot, modeScale }
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

  // Tier 3 — chords BORROWED from the parallel (natural) minor, for major keys.
  if (scale.id === MAJOR_SCALE.id) {
    const { modeRoot, modeScale } = parallelMinorOf(tonic);
    for (const seventh of [false, true]) {
      let borrowedChords;
      try {
        borrowedChords = diatonicChords(modeRoot, modeScale, seventh);
      } catch {
        continue;
      }
      for (const d of borrowedChords) {
        const role = roleOfBass(d.chordRoot, d.chord, bassPc);
        if (!role) continue;
        // The roman already carries the ♭ against the major key (III of the
        // minor arrives as ♭III) — harmony.ts prefixes all numerals that way.
        add({
          chordRoot: d.chordRoot,
          chord: d.chord,
          bassRole: role,
          tier: 3,
          roman: d.roman,
          borrowed: true,
        });
      }
    }
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

// ---------------------------------------------------------------------------
// The other face of the engine: given a chord and a key, what IS it there?
// This is what the Context strip shows, and what ear training's function layer
// will quiz. Checked from nearest to farthest — the first reading wins:
//   diatonic → secondary dominant (V7/x) → borrowed → blues IV7 →
//   tritone sub (subV7/x).
// ---------------------------------------------------------------------------

export interface Interpretation {
  label: string; // "ii7", "V7/IV", "subV7", "♭VI", "IV7", or "?" when unexplained
  kind: 'diatonic' | 'secondary' | 'borrowed' | 'blues' | 'tritone' | 'outside';
}

export function interpretInKey(
  root: Note,
  chord: ChordDefinition,
  tonic: Note,
  scale: ScaleDefinition,
): Interpretation {
  const rootPc = pitchClassOf(root);
  const seventh = chord.intervals.length === 4;

  // 1. Diatonic — the chord is simply one of the key's own.
  try {
    const hit = diatonicChords(tonic, scale, seventh).find(
      (c) => pitchClassOf(c.chordRoot) === rootPc && c.chord.id === chord.id,
    );
    if (hit) return { label: hit.roman, kind: 'diatonic' };
  } catch {
    return { label: '?', kind: 'outside' }; // a key whose harmony we can't name
  }

  // 2. A secondary dominant — a dominant 7th (or major triad, "V of x") whose
  // root sits a perfect 5th above one of the key's (non-diminished) degrees.
  if (chord.id === 'dominant-seventh' || chord.id === 'major-triad') {
    const tones = realizeScale(tonic, scale);
    const triads = diatonicChords(tonic, scale, false);
    for (let degree = 0; degree < tones.length; degree++) {
      if (triads[degree].chord.id === 'diminished-triad') continue;
      const domPc = pitchClassOf(spellNoteFromInterval(tones[degree].note, P5));
      if (domPc === rootPc) {
        const v = chord.id === 'dominant-seventh' ? 'V7' : 'V';
        return { label: `${v}/${triads[degree].roman}`, kind: 'secondary' };
      }
    }
  }

  // 3. Borrowed from the parallel minor (major keys only), ♭-labelled against
  // the major key (III of the minor = ♭III here).
  if (scale.id === MAJOR_SCALE.id) {
    const { modeRoot, modeScale } = parallelMinorOf(tonic);
    try {
      const hit = diatonicChords(modeRoot, modeScale, seventh).find(
        (c) => pitchClassOf(c.chordRoot) === rootPc && c.chord.id === chord.id,
      );
      // The roman already carries the ♭ against the major key (harmony.ts).
      if (hit) return { label: hit.roman, kind: 'borrowed' };
    } catch {
      /* fall through to tritone / outside */
    }
  }

  // 4. The blues subdominant — a dominant 7th ON the fourth degree of a major
  // key (F7 in C). Everyone calls this IV7 (the blues colour on IV), never the
  // technically-derivable subV7/iii — Stu's call: label IV7 here, but a tonic
  // dominant (C7 in C) KEEPS its V7/IV arrow, which names the pull toward IV.
  if (chord.id === 'dominant-seventh' && scale.id === MAJOR_SCALE.id) {
    const fourth = realizeScale(tonic, scale)[3].note;
    if (pitchClassOf(fourth) === rootPc) return { label: 'IV7', kind: 'blues' };
  }

  // 5. Tritone substitution — a dom7 standing in for a secondary dominant, its
  // root a HALF-STEP ABOVE the target (so it shares that dominant's tritone and
  // resolves down by a half step). D♭7 subs for G7 → "subV7"; A♭7 subs for D7
  // (=V7/V) → "subV7/V". Checked AFTER borrowed, so a chord with a stronger
  // in-key reading (e.g. B♭7 = the backdoor ♭VII7) keeps it. Standard jazz label:
  // "subV7" of the tonic, "subV7/x" otherwise.
  if (chord.id === 'dominant-seventh') {
    const tones = realizeScale(tonic, scale);
    const triads = diatonicChords(tonic, scale, false);
    for (let degree = 0; degree < tones.length; degree++) {
      if (triads[degree].chord.id === 'diminished-triad') continue; // don't tonicize vii°
      const subPc = (pitchClassOf(tones[degree].note) + 1) % 12; // half step above target
      if (subPc === rootPc) {
        const label = degree === 0 ? 'subV7' : `subV7/${triads[degree].roman}`;
        return { label, kind: 'tritone' };
      }
    }
  }

  return { label: '?', kind: 'outside' };
}

// Every key, ranked by how well it EXPLAINS a whole progression. Unlike the
// strict `keysContainingAll`, a chord outside the key doesn't eliminate it —
// real songs tonicize and borrow — it just reads as secondary/borrowed/'?'.
// Best key = fewest unexplained chords, then the most plainly diatonic ones.
export interface RankedKey {
  tonic: Note;
  scale: ScaleDefinition;
  labels: Interpretation[]; // one per chord, in order
  diatonicCount: number;
  allExplained: boolean; // no chord read as 'outside'
}

export function rankKeys(
  chords: { root: Note; chord: ChordDefinition }[],
): RankedKey[] {
  if (chords.length === 0) return [];
  const ranked: RankedKey[] = [];
  for (const scale of Object.values(SCALES)) {
    for (const tonic of ROOT_CHOICES) {
      const labels = chords.map((c) => interpretInKey(c.root, c.chord, tonic, scale));
      const diatonicCount = labels.filter((l) => l.kind === 'diatonic').length;
      if (diatonicCount === 0) continue; // a key sharing nothing isn't a hypothesis
      ranked.push({
        tonic,
        scale,
        labels,
        diatonicCount,
        allExplained: labels.every((l) => l.kind !== 'outside'),
      });
    }
  }
  ranked.sort(
    (a, b) =>
      Number(b.allExplained) - Number(a.allExplained) ||
      b.diatonicCount - a.diatonicCount,
  );
  return ranked;
}
