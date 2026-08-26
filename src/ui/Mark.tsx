// ============================================================================
// ui/Mark.tsx — the logo
// ----------------------------------------------------------------------------
// Three dots that mean something: a TRIAD — root, third, fifth — drawn in the
// same degree colours the fretboard uses. So the mark is the app's smallest
// possible lesson, and it's made of the same material as everything under it.
//
// The good part is what happens where they overlap. Degrees 1, 3 and 5 land on
// red, yellow and blue — the three primaries — and mixing them gives exactly
// the degrees in between:
//
//     1 red  +  3 yellow  =  2 orange
//     3 yellow + 5 blue   =  4 green
//     1 red  +  5 blue    =  7 violet
//     all three           =  6 indigo   (the centre)
//
// Seven regions, seven degrees. THE TRIAD MAKES THE SCALE — which is more or
// less what this whole app is about. That falls out of ROYGBIV for free.
//
// It's painted rather than blended. `mix-blend-mode: multiply` was the obvious
// way to do it and it looked like mud: red over yellow came out brown, the
// centre went almost black, and at 32px the thing read as a smudge. Naming
// each region and filling it with the palette's actual colour is more code and
// a much better mark — and it keeps the promise above literally true instead
// of approximately true.
//
// Two arrangements:
//   'triad' — the Venn triangle. Compact and square, good small, good favicon.
//   'row'   — three in a line. Reads more like a transit map.
// ============================================================================

export type MarkVariant = 'triad' | 'row';

interface Layout {
  a: { cx: number; cy: number };
  b: { cx: number; cy: number };
  c: { cx: number; cy: number };
  r: number;
}

// Centres sit on a small circle around the middle, close enough that all three
// share a common centre region (that's the 6). r * 0.58 is the classic Venn
// spacing — any wider and the middle closes up.
const LAYOUTS: Record<MarkVariant, Layout> = {
  triad: {
    a: { cx: 50, cy: 37.5 }, // root on top
    b: { cx: 35.3, cy: 63 },
    c: { cx: 64.7, cy: 63 },
    r: 29,
  },
  row: {
    a: { cx: 31, cy: 50 },
    b: { cx: 50, cy: 50 },
    c: { cx: 69, cy: 50 },
    r: 26,
  },
};

export function Mark({
  variant = 'triad',
  className,
}: {
  variant?: MarkVariant;
  className?: string;
}) {
  const { a, b, c, r } = LAYOUTS[variant];
  // Clip ids have to be unique per instance, since both variants can be on
  // screen at once when we're comparing them.
  const p = `mk-${variant}`;

  return (
    <svg
      className={className ? `mark-svg ${className}` : 'mark-svg'}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Fretboard Constellations"
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
        {/* b ∩ c, built by clipping one against the other. Clipping a shape
            INSIDE a clipPath is how you intersect two clips in SVG. */}
        <clipPath id={`${p}-bc`}>
          <circle cx={b.cx} cy={b.cy} r={r} clipPath={`url(#${p}-c)`} />
        </clipPath>
      </defs>

      {/* The three whole dots first. They overlap each other here; every
          overlap gets repainted below, so the stacking order doesn't matter. */}
      <circle className="mark-dot mark-dot--deg1" cx={a.cx} cy={a.cy} r={r} />
      <circle className="mark-dot mark-dot--deg3" cx={b.cx} cy={b.cy} r={r} />
      <circle className="mark-dot mark-dot--deg5" cx={c.cx} cy={c.cy} r={r} />

      {/* The pairs: each drawn as one circle clipped to another. */}
      <circle
        className="mark-dot mark-dot--deg2"
        cx={a.cx}
        cy={a.cy}
        r={r}
        clipPath={`url(#${p}-b)`}
      />
      <circle
        className="mark-dot mark-dot--deg4"
        cx={b.cx}
        cy={b.cy}
        r={r}
        clipPath={`url(#${p}-c)`}
      />
      <circle
        className="mark-dot mark-dot--deg7"
        cx={a.cx}
        cy={a.cy}
        r={r}
        clipPath={`url(#${p}-c)`}
      />

      {/* ...and the middle, where all three agree. */}
      <circle
        className="mark-dot mark-dot--deg6"
        cx={a.cx}
        cy={a.cy}
        r={r}
        clipPath={`url(#${p}-bc)`}
      />
    </svg>
  );
}
