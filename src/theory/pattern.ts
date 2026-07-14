// ============================================================================
// theory/pattern.ts — walk an interval pattern through some material
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure function). Given one octave of MATERIAL (scale tones
// or chord tones as ascending MIDI notes, root first) and a pattern's step
// chain, produce the actual run of pitches: start on a root, then keep applying
// the chain — up a 3rd, down a 2nd, up a 3rd... — walking the material across
// octaves as needed.
//
// Two details do the musical work:
// 1. The material repeats every octave, so "position 9" in a 7-note scale is
//    the 3rd degree an octave up: material[9 % 7] + 12 * floor(9 / 7).
// 2. The walk STARTS ON A ROOT, in the lowest octave that keeps the whole run
//    in range: an ascending pattern starts on the root itself; a net-descending
//    chain (like ↓4 ↓2 ↑4 ↓2) starts on a root an octave or two up so it has
//    room to fall — exactly where a player would start it.
// ============================================================================

// The cumulative positions the chain visits, starting from 0: for [2, -1] and
// six notes that's 0, 2, 1, 3, 2, 4 (thirds climbing a scale).
function walkPositions(steps: number[], count: number): number[] {
  const positions = [0];
  for (let i = 1; i < count; i++) {
    positions.push(positions[i - 1] + steps[(i - 1) % steps.length]);
  }
  return positions;
}

// Realize `count` notes of a pattern over the material. `material` is ONE
// ascending octave of MIDI notes with the root first (e.g. a scale's 7 tones,
// or a chord's 3–4 tones).
export function realizePattern(
  material: number[],
  steps: number[],
  count: number,
): number[] {
  const n = material.length;
  if (n === 0 || count <= 0 || steps.length === 0) return [];

  const positions = walkPositions(steps, count);
  const lowest = Math.min(...positions);

  // Start on the lowest ROOT (a multiple of n positions) that keeps the whole
  // walk at or above position 0.
  const start = Math.ceil(Math.max(0, -lowest) / n) * n;

  return positions.map((p) => {
    const idx = start + p;
    return material[idx % n] + 12 * Math.floor(idx / n);
  });
}
