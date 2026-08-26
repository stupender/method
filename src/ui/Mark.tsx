// ============================================================================
// ui/Mark.tsx — the logo
// ----------------------------------------------------------------------------
// Three dots that mean something: a TRIAD — root, third, fifth — drawn in the
// same degree colours the fretboard uses. So the mark is the app's smallest
// possible lesson, and it's made of the same material as everything under it.
//
// The good part is what happens where they overlap. Degrees 1, 3 and 5 land on
// red, yellow and blue — the three primaries — and mixing them gives exactly
// the degrees in between: red + yellow = the 2's orange, yellow + blue = the
// 4's green. The triad generates the steps between its own notes. That falls
// out of ROYGBIV for free.
//
// TWO ARRANGEMENTS, and the geometry decides how much of that you get:
//
//   'row'   — three in a line, adjacent dots overlapping, the outer two just
//             clear of each other. Five regions: 1 2 3 4 5, ascending left to
//             right, like a run up the scale. This is the one in the site bar.
//
//   'triad' — the Venn triangle. Seven regions (the outer pair also meet, so
//             you get the 7's violet, and all three agree on the 6's indigo in
//             the middle) — but the radial symmetry reads as a browser logo.
//
// A straight row CANNOT hold seven, and it's worth knowing why: with three
// equal circles on a line, if the outer two reach each other at all, that lens
// sits entirely inside the middle circle. There's nowhere for the 7 to show.
// Pull them apart to free it and the middle dot's own colour shrinks to a
// sliver instead. Five clean regions beats seven with two of them invisible.
//
// The regions are PAINTED — each one clipped and filled with the palette's
// real colour — rather than produced with `mix-blend-mode: multiply`. Honest
// overprint on inks this saturated goes to mud: red over blue computes to
// #272121, a dead grey. `press` adds back what multiply was really for — ink
// that lets a little paper through, and a grain over the top.
// ============================================================================

export type MarkVariant = 'triad' | 'row';

interface Dot {
  cx: number;
  cy: number;
}
interface Region {
  deg: number; // which degree colour this patch takes
  from: 'a' | 'b'; // the circle we draw...
  clip?: 'a' | 'b' | 'c' | 'bc'; // ...and what we cut it against
}
interface Arrangement {
  a: Dot;
  b: Dot;
  c: Dot;
  r: number;
  regions: Region[];
}

const ARRANGEMENTS: Record<MarkVariant, Arrangement> = {
  // Adjacent dots overlap by a good margin; the outer two miss each other by a
  // hair (centres 44 apart, diameters 42), which is what keeps all five
  // regions honest — see the note above.
  row: {
    a: { cx: 28, cy: 50 },
    b: { cx: 50, cy: 50 },
    c: { cx: 72, cy: 50 },
    r: 21,
    regions: [
      { deg: 2, from: 'a', clip: 'b' },
      { deg: 4, from: 'b', clip: 'c' },
    ],
  },
  // Centres on a small circle around the middle — the classic Venn spacing.
  triad: {
    a: { cx: 50, cy: 37.5 }, // root on top
    b: { cx: 35.3, cy: 63 },
    c: { cx: 64.7, cy: 63 },
    r: 29,
    regions: [
      { deg: 2, from: 'a', clip: 'b' },
      { deg: 4, from: 'b', clip: 'c' },
      { deg: 7, from: 'a', clip: 'c' },
      { deg: 6, from: 'a', clip: 'bc' },
    ],
  },
};

export function Mark({
  variant = 'row',
  press = false,
  className,
}: {
  variant?: MarkVariant;
  /** Ink that lets a little paper through, plus a press grain over the top. */
  press?: boolean;
  className?: string;
}) {
  const { a, b, c, r, regions } = ARRANGEMENTS[variant];
  const dots = { a, b, c };
  // Ids have to be unique per instance, since both variants can be on screen
  // at once when we're comparing them.
  const p = `mk-${variant}`;

  return (
    <svg
      className={className ? `mark-svg ${className}` : 'mark-svg'}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Fretboard Constellations"
      opacity={press ? 0.94 : undefined}
    >
      <defs>
        <clipPath id={`${p}-a`}>
          <circle cx={a.cx} cy={a.cy} r={r} />
        </clipPath>
        <clipPath id={`${p}-b`}>
          <circle cx={b.cx} cy={b.cy} r={r} />
        </clipPath>
        <clipPath id={`${p}-c`}>
          <circle cx={c.cx} cy={c.cy} r={r} />
        </clipPath>
        {/* b ∩ c. Clipping a shape INSIDE a clipPath is how SVG intersects two
            clips; only the triangle needs it. */}
        <clipPath id={`${p}-bc`}>
          <circle cx={b.cx} cy={b.cy} r={r} clipPath={`url(#${p}-c)`} />
        </clipPath>
        {/* The union, for laying the grain over the ink and nowhere else. */}
        <clipPath id={`${p}-all`}>
          <circle cx={a.cx} cy={a.cy} r={r} />
          <circle cx={b.cx} cy={b.cy} r={r} />
          <circle cx={c.cx} cy={c.cy} r={r} />
        </clipPath>
        <filter id={`${p}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves={4}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>

      {/* The three whole dots. They overlap here; every overlap is repainted
          below, so the stacking order doesn't matter. */}
      <circle className="mark-dot mark-dot--deg1" cx={a.cx} cy={a.cy} r={r} />
      <circle className="mark-dot mark-dot--deg3" cx={b.cx} cy={b.cy} r={r} />
      <circle className="mark-dot mark-dot--deg5" cx={c.cx} cy={c.cy} r={r} />

      {/* ...then each overlap, as its own degree. */}
      {regions.map((rg) => (
        <circle
          key={rg.deg}
          className={`mark-dot mark-dot--deg${rg.deg}`}
          cx={dots[rg.from].cx}
          cy={dots[rg.from].cy}
          r={r}
          clipPath={`url(#${p}-${rg.clip})`}
        />
      ))}

      {press && (
        <rect
          width="100"
          height="100"
          filter={`url(#${p}-grain)`}
          clipPath={`url(#${p}-all)`}
          opacity="0.3"
          style={{ mixBlendMode: 'multiply' }}
        />
      )}
    </svg>
  );
}
