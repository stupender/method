// ============================================================================
// theory/pairs.ts — interval-pair drills through a scale (the palta generator)
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure function). The systematic version of the classic
// practice drills: walk a scale in PAIRS a fixed interval apart —
//
//   in 3rds, up-up   :  C E · D F · E G ...   (every pair played low -> high)
//   in 3rds, up-down :  C E · F D · E G ...   (odd pairs up, even pairs down)
//   in 3rds, down-up :  E C · D F · G E ...   (odd pairs down, even pairs up)
//   in 3rds, down-down: E C · F D · G E ...   (every pair played high -> low)
//
// Three ideas, kept separate on purpose:
// 1. The PAIR INTERVAL (3rd, 4th ... 7th): how far apart the two notes sit.
// 2. The CONTOUR: which way each pair is played, by whether it's an odd or
//    even pair (that's the whole 2×2 above).
// 3. The ANCHOR STEP: how the pairs THEMSELVES move through the scale. It's
//    the interval nobody states when they say "thirds" — the pairs march up a
//    2nd (anchor C, then D, then E...). Stu's note: naming it now is what makes
//    custom pairings possible later (pairs marching in 3rds, in 4ths...).
//
// Everything is in SCALE STEPS (generic intervals), so the same drill works in
// any scale or mode — the actual pitches come from the material.
// ============================================================================

export type PairContour = 'up-up' | 'up-down' | 'down-up' | 'down-down';

// The drill as INDICES into the scale (0 = root, 7 = root an octave up, -1 =
// the 7th below the root...). The caller maps indices to pitches and names, so
// this stays pure arithmetic.
//
// `n` = scale length; `intervalSteps` = pair width in steps (2 = a 3rd);
// `pairCount` = how many pairs; `anchorStep` = how far each pair's anchor moves
// (+1 = the classic stepwise march); `descending` starts the anchors an octave
// up and walks them down instead.
export function pairIndices(
  n: number,
  intervalSteps: number,
  contour: PairContour,
  pairCount: number,
  anchorStep = 1,
  descending = false,
): number[] {
  const out: number[] = [];
  for (let k = 0; k < pairCount; k++) {
    const anchor = descending ? n - k * anchorStep : k * anchorStep;
    const lo = anchor;
    const hi = anchor + intervalSteps;
    // Odd/even pairs each have a fixed direction — that's the contour.
    const firstPairUp = contour === 'up-up' || contour === 'up-down';
    const alternates = contour === 'up-down' || contour === 'down-up';
    const up = alternates && k % 2 === 1 ? !firstPairUp : firstPairUp;
    out.push(...(up ? [lo, hi] : [hi, lo]));
  }
  return out;
}

// Map a scale index to a pitch: the material is one ascending octave of MIDI
// notes (root first); indices past it wrap into higher/lower octaves.
export function indexToMidi(material: number[], index: number): number {
  const n = material.length;
  const wrapped = ((index % n) + n) % n;
  return material[wrapped] + 12 * Math.floor(index / n);
}
