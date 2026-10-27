// ============================================================================
// render/crossing.ts — do two shapes' joining lines cross each other?
// ----------------------------------------------------------------------------
// A shape on the neck is drawn as dots joined by a line, string by string,
// low to high. When several shapes are lit at once, those lines can either
// sit side by side — three triad inversions spread up the neck, each its own
// little island — or run THROUGH each other, which is what four drop-3
// inversions do when they share the same few frets. Side by side, the lines
// help you read each grip. Crossing, they turn into a scribble.
//
// This file answers just that question, as geometry. It works on frets and
// string numbers, not screen pixels: the neck is drawn by scaling and
// flipping those, and scaling or flipping a picture never makes two lines
// cross that didn't before (or un-cross ones that did). So the answer here is
// the answer on screen.
//
// Pure: same shapes in, same answer out. No music theory — a shape is just
// a list of positions.
// ============================================================================

import type { PlacedNote } from '../theory/types';

/** A point on the neck: x is the fret, y is the string (0 = lowest). */
interface Point {
  x: number;
  y: number;
}

/**
 * A shape's joining line as a list of points, in the SAME order the
 * Fretboard draws it: by string, low to high (and by fret within a string).
 * If the order here ever differs from Fretboard.tsx, the answer stops
 * describing the picture — keep the two sorts identical.
 */
function lineOf(shape: readonly PlacedNote[]): Point[] {
  return [...shape]
    .sort(
      (a, b) =>
        a.position.stringIndex - b.position.stringIndex ||
        a.position.fret - b.position.fret,
    )
    .map((h) => ({ x: h.position.fret, y: h.position.stringIndex }));
}

/**
 * Which side of the line through a→b does c fall on?
 * Positive one side, negative the other, zero exactly on the line.
 */
function side(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/**
 * Do segments p1–p2 and q1–q2 genuinely CROSS — each one's ends on opposite
 * sides of the other?
 *
 * Strict on purpose. Two grips that share a note meet at that dot, and two
 * lines touching at a shared dot don't read as a tangle; neither does a line
 * that merely runs along another. Only an X counts.
 */
function segmentsCross(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const d1 = side(q1, q2, p1);
  const d2 = side(q1, q2, p2);
  const d3 = side(p1, p2, q1);
  const d4 = side(p1, p2, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/**
 * Does any segment of one shape's line cross a segment of ANOTHER shape's?
 * (A shape's own segments never count — they join end to end by design.)
 *
 * The sizes involved are tiny — a handful of shapes of three or four notes —
 * so checking every pair is both the simplest way and plenty fast.
 */
export function shapesCross(shapes: readonly (readonly PlacedNote[])[]): boolean {
  const lines = shapes.map(lineOf);
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      for (let s = 0; s + 1 < a.length; s++) {
        for (let t = 0; t + 1 < b.length; t++) {
          if (segmentsCross(a[s], a[s + 1], b[t], b[t + 1])) return true;
        }
      }
    }
  }
  return false;
}
