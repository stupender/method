// ============================================================================
// theory/placeRun.ts — put a run of notes on the neck, the way a hand would
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure function). A pattern run is a long line of pitches;
// TAB needs each one on a specific STRING and FRET. The rule a player follows:
//
//   STAY IN POSITION while you can, and when the line outgrows the position,
//   SHIFT GRADUALLY — drift diagonally up (or down) the neck rather than leap.
//
// We get exactly that behaviour from a least-total-movement search: every note
// lists its possible placements (each string where it exists within the fret
// range); we then pick one placement per note minimising the total movement
// cost between neighbours (fret travel, plus a smaller cost for crossing
// strings). Staying put costs nothing, so positions hold themselves; when the
// pitch forces movement, the cheapest path is the gradual diagonal. (Dynamic
// programming — the same "cheapest path through choices" idea as GPS routing.)
//
// If the run overruns the fretboard (two octaves up from a mid-neck root can),
// we first slide the WHOLE run down/up an octave until it fits.
// ============================================================================

import type { Instrument, Tuning, Note, PlacedNote } from './types';
import { midiOf } from './notes';

// Movement cost between two placements: fret travel dominates (that's the
// hand actually shifting); string crossings are cheaper (fingers, not arm).
function moveCost(
  a: { string: number; fret: number },
  b: { string: number; fret: number },
): number {
  return Math.abs(b.fret - a.fret) + 0.7 * Math.abs(b.string - a.string);
}

// Every playable placement of a MIDI pitch: one per string where the fret
// falls on the neck.
function candidatesFor(
  midi: number,
  tuning: Tuning,
  fretCount: number,
): { string: number; fret: number }[] {
  const out: { string: number; fret: number }[] = [];
  tuning.openNotes.forEach((open, s) => {
    const fret = midi - midiOf(open);
    if (fret >= 0 && fret <= fretCount) out.push({ string: s, fret });
  });
  return out;
}

// What the caller hands in: each note's musical identity (spelling, role,
// root-ness). Placement's whole job is to add the POSITION.
export interface RunNote {
  note: Note;
  intervalName: string; // its role in the scale, e.g. "1" or "♭3"
  isRoot: boolean;
}

// Place a run of identified notes (order preserved). Returns one PlacedNote
// per input — with the octave corrected if the whole run had to slide — or
// null if it can't fit the neck in any octave.
export function placeRun(
  instrument: Instrument,
  tuning: Tuning,
  notes: RunNote[],
): PlacedNote[] | null {
  if (notes.length === 0) return [];
  const baseMidis = notes.map((r) => midiOf(r.note));

  // Slide the whole run by octaves until every note is playable — try where it
  // is first, then down (runs usually overrun at the top), then up.
  let shift: number | null = null;
  for (const trial of [0, -12, 12, -24, 24]) {
    const ok = baseMidis.every(
      (m) => candidatesFor(m + trial, tuning, instrument.fretCount).length > 0,
    );
    if (ok) {
      shift = trial;
      break;
    }
  }
  if (shift == null) return null;
  const midis = baseMidis.map((m) => m + shift);

  // The cheapest path through the placement choices. dp[i][c] = least total
  // movement to reach candidate c of note i; parents rebuild the path.
  const options = midis.map((m) => candidatesFor(m, tuning, instrument.fretCount));
  let costs = options[0].map((o) => o.fret * 0.05); // start slightly neck-ward
  let parents: number[][] = [options[0].map(() => -1)];
  for (let i = 1; i < options.length; i++) {
    const next: number[] = [];
    const par: number[] = [];
    for (const [c, cur] of options[i].entries()) {
      let best = Infinity;
      let from = 0;
      for (const [p, prev] of options[i - 1].entries()) {
        const cost = costs[p] + moveCost(prev, cur);
        if (cost < best) {
          best = cost;
          from = p;
        }
      }
      next[c] = best;
      par[c] = from;
    }
    costs = next;
    parents.push(par);
  }

  // Walk back from the cheapest ending.
  let c = costs.indexOf(Math.min(...costs));
  const chosen: { string: number; fret: number }[] = [];
  for (let i = options.length - 1; i >= 0; i--) {
    chosen.unshift(options[i][c]);
    c = parents[i][c];
  }

  return chosen.map((pos, i) => ({
    note: { ...notes[i].note, octave: (notes[i].note.octave ?? 4) + shift / 12 },
    intervalName: notes[i].intervalName,
    isRoot: notes[i].isRoot,
    position: { stringIndex: pos.string, fret: pos.fret },
  }));
}
