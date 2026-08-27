// ============================================================================
// theory/agree.ts — does the TAB show what the neck is lighting?
// ----------------------------------------------------------------------------
// A card's TAB, its staff, and the shape the fretboard lights are meant to be
// the same four notes in the same places. They were not: the inversion grid
// numbered its rows and THEN sorted them, so on the D G B E strings clicking
// "7th in bass" lit root position. Nothing on screen said so — both halves
// looked plausible on their own, and you had to read the frets to catch it.
//
// The structural fix is that a row's index is now its position in the very
// array the fretboard is handed, so the two can't drift. This is the belt to
// that pair of braces: an actual comparison, run in development, that says so
// out loud if it ever stops being true. It costs nothing in a build — the
// whole thing is behind `import.meta.env.DEV` and drops out.
//
// It compares POSITIONS, not pitches, on purpose: two notes can sound the same
// and be different places on the neck, and it's the place that's in question.
// ============================================================================

import type { PlacedNote } from './types';

const at = (p: PlacedNote) => `${p.position.stringIndex}:${p.position.fret}`;

/** Same notes in the same places, in any order. */
export function samePlaces(a: PlacedNote[], b: PlacedNote[]): boolean {
  if (a.length !== b.length) return false;
  const left = a.map(at).sort();
  const right = b.map(at).sort();
  return left.every((v, i) => v === right[i]);
}

/**
 * Development-only check that each row's shape really is the one the fretboard
 * will light for that row's index. Silent when everything agrees.
 */
export function checkRowsAgree(
  where: string,
  rows: { shape: PlacedNote[]; index: number }[],
  shapes: PlacedNote[][],
): void {
  if (!import.meta.env.DEV) return;
  for (const row of rows) {
    const lit = shapes[row.index];
    if (!lit || !samePlaces(row.shape, lit)) {
      // eslint-disable-next-line no-console
      console.error(
        `[${where}] row ${row.index} disagrees with the fretboard.\n` +
          `  the TAB shows: ${row.shape.map(at).join(' ')}\n` +
          `  the neck lights: ${(lit ?? []).map(at).join(' ')}`,
      );
    }
  }
}
