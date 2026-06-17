// ============================================================================
// theory/voiceLeading.ts — auto voice-leading across a progression
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). Given a progression and ONE anchor
// voicing (a shape the player chose for one chord), pick a playable shape for
// every other chord that moves as little as possible from its neighbour — i.e.
// smooth voice leading. We work in real guitar SHAPES (from the voicing engine)
// so the result is always TAB-able, not an abstract note-stack.
//
// Method: for each chord gather its candidate shapes (every structure ×
// inversion the placement engine can produce), then walk OUT from the anchor in
// both directions, each step keeping the candidate closest to the shape already
// chosen for the neighbour.
// ============================================================================

import type { Note, ChordDefinition, Instrument, Tuning, PlacedNote } from './types';
import { midiOf } from './notes';
import { placeVoicingAll, structuresForChord, inversionCount } from './chord';
import { STRUCTURES } from '../data/voicings';

// Every playable shape for a chord: all structures it allows × all inversions.
export function candidateShapes(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  chord: ChordDefinition,
): PlacedNote[][] {
  const shapes: PlacedNote[][] = [];
  for (const structure of structuresForChord(chord, STRUCTURES)) {
    for (let inv = 0; inv < inversionCount(chord); inv++) {
      shapes.push(...placeVoicingAll(instrument, tuning, root, chord, structure, inv));
    }
  }
  return shapes;
}

const midisOf = (shape: PlacedNote[]) => shape.map((p) => midiOf(p.note));

// How far apart two shapes are, voice-leading-wise: every note of each has to be
// near a note of the other. Lower = smoother (common tones cost ~0, big leaps
// cost a lot). Symmetric so it also rewards the next chord sitting in the same
// register as the previous one.
export function voiceLeadDistance(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return Infinity;
  const nearest = (x: number, set: number[]) =>
    Math.min(...set.map((y) => Math.abs(x - y)));
  let total = 0;
  for (const x of a) total += nearest(x, b);
  for (const y of b) total += nearest(y, a);
  return total;
}

// The shape of `chord` closest to a given set of (previous) pitches.
function closestShape(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  chord: ChordDefinition,
  prevMidis: number[],
): PlacedNote[] {
  const candidates = candidateShapes(instrument, tuning, root, chord);
  let best: PlacedNote[] = candidates[0] ?? [];
  let bestDistance = Infinity;
  for (const shape of candidates) {
    const d = voiceLeadDistance(prevMidis, midisOf(shape));
    if (d < bestDistance) {
      bestDistance = d;
      best = shape;
    }
  }
  return best;
}

// Voice-lead the whole progression around an anchor: result[anchorIndex] is the
// anchor shape; everything before and after is the closest-moving chain.
export function voiceLeadProgression(
  instrument: Instrument,
  tuning: Tuning,
  chords: { root: Note; chord: ChordDefinition }[],
  anchorIndex: number,
  anchorShape: PlacedNote[],
): PlacedNote[][] {
  const result: PlacedNote[][] = new Array(chords.length);
  result[anchorIndex] = anchorShape;

  for (let i = anchorIndex + 1; i < chords.length; i++) {
    result[i] = closestShape(instrument, tuning, chords[i].root, chords[i].chord, midisOf(result[i - 1]));
  }
  for (let i = anchorIndex - 1; i >= 0; i--) {
    result[i] = closestShape(instrument, tuning, chords[i].root, chords[i].chord, midisOf(result[i + 1]));
  }
  return result;
}
