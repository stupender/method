// ============================================================================
// theory/pairs.ts — interval-pattern drills through a scale (the palta engine)
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). A drill is built from three named
// ingredients (Stu's model):
//
// 1. The CELL — what's played at each stop: a chain of directed moves from the
//    anchor, in scale steps. [2] = a pair a 3rd up ("C E"); [-3, -1] = down a
//    4th then down a 2nd. The classic pairs are just one-move cells.
// 2. The ANCHOR STEP — the interval nobody states when they say "thirds": how
//    the cell's anchor marches through the scale. +1 = the classic stepwise
//    march; +2 makes the pairs themselves move in 3rds (stacked thirds).
// 3. ALTERNATE / MIRROR — which way each cell is READ. `mirrorCell` reverses
//    every cell (pairs played high→low); `alternate` flips every other one
//    (the zig-zag). The classic 2×2 contour is exactly these two booleans.
//
// THE RUN: anchors travel from the root up TWO OCTAVES and back down to the
// root (Stu's standard for any scale) — or, when the anchor step is negative,
// down two octaves and back up. One continuous exercise, root to root.
//
// Everything is in SCALE STEPS (generic intervals), so the same drill works in
// any scale or mode; pitches and spellings come from the material.
// ============================================================================

export interface PatternSpec {
  cellMoves: number[]; // directed steps from the anchor, e.g. [2] or [-3, -1]
  anchorStep: number; // signed: how the anchor marches (+1 = up a 2nd)
  alternate: boolean; // mirror every other cell (the zig-zag)
  mirrorCell: boolean; // mirror every cell (pairs read high -> low)
}

// The drill as INDICES into the scale (0 = root, n = root an octave up...).
// The caller maps indices to pitches and names, so this stays pure arithmetic.
export function patternRun(n: number, spec: PatternSpec): number[] {
  const { cellMoves, anchorStep, alternate, mirrorCell } = spec;
  if (n <= 0 || cellMoves.length === 0 || anchorStep === 0) return [];

  // The anchor path: multiples of the step, up (or down) as far as two
  // octaves, then the same stops in reverse — root to root, no doubled top.
  // The march is CLAMPED so no note of any cell exceeds the two-octave
  // ceiling (a 7ths pair can't poke past it — the turn folds early instead;
  // that's also what keeps every run playable on a real neck).
  const cums = [0];
  for (const move of cellMoves) cums.push(cums[cums.length - 1] + move);
  const maxOff = Math.max(...cums);
  const minOff = Math.min(...cums);
  const dir = Math.sign(anchorStep);
  const size = Math.abs(anchorStep);
  const reach = Math.max(0, 2 * n - (dir > 0 ? maxOff : -minOff));
  const outward: number[] = [];
  for (let a = 0; Math.abs(a) <= reach; a += dir * size) outward.push(a);
  const anchors = [...outward, ...outward.slice(0, -1).reverse()];

  // Each cell: the anchor plus the cumulative moves; mirrored per the spec.
  const out: number[] = [];
  anchors.forEach((anchor, k) => {
    const cell = [anchor];
    for (const move of cellMoves) cell.push(cell[cell.length - 1] + move);
    const flip = mirrorCell !== (alternate && k % 2 === 1);
    out.push(...(flip ? cell.reverse() : cell));
  });
  return out;
}

// Map a scale index to a pitch: the material is one ascending octave of MIDI
// notes (root first); indices past it wrap into higher/lower octaves.
export function indexToMidi(material: number[], index: number): number {
  const n = material.length;
  const wrapped = ((index % n) + n) % n;
  return material[wrapped] + 12 * Math.floor(index / n);
}

// --- The custom-cell parser -------------------------------------------------
// Reads a typed cell like "3 -2" or "↑3 ↓2" or "u3 d2": each token is an
// interval NUMBER (2 = a 2nd ... 8 = an octave) with an optional direction
// (↓ / - / d = down; ↑ / + / u / nothing = up). Returns the moves in scale
// steps (a 3rd = 2 steps), or null if any token doesn't parse.
export function parseCellMoves(text: string): number[] | null {
  const tokens = text.trim().split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const moves: number[] = [];
  for (const t of tokens) {
    const m = /^([↑↓+\-ud]?)([1-8])$/i.exec(t);
    if (!m) return null;
    const down = m[1] === '↓' || m[1] === '-' || m[1].toLowerCase() === 'd';
    const steps = Number(m[2]) - 1; // a "3rd" spans 2 scale steps
    moves.push(down ? -steps : steps);
  }
  return moves;
}

// A move spelled out for the hint line: +2 -> "up a 3rd", -1 -> "down a 2nd".
const ORDINALS = ['unison', '2nd', '3rd', '4th', '5th', '6th', '7th', 'octave'];
export function describeMove(move: number): string {
  if (move === 0) return 'repeat';
  const name = ORDINALS[Math.abs(move)] ?? `${Math.abs(move) + 1}th`;
  return `${move > 0 ? 'up' : 'down'} a${name === 'octave' ? 'n' : ''} ${name}`;
}
