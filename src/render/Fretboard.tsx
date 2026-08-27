// ============================================================================
// render/Fretboard.tsx — draws the neck as SVG
// ----------------------------------------------------------------------------
// The RENDER layer. It is handed an Instrument, a Tuning, and a list of notes
// to light up (PlacedNote[], produced by theory/fretboard.ts). It draws the
// neck and puts a dot wherever it's told. It contains NO music theory — swap in
// a ukulele Instrument + Tuning and it draws a ukulele, no changes here.
//
// We draw with SVG (scalable vector graphics): shapes described by coordinates,
// so the neck stays crisp at any size and is easy to make touch-friendly later.
// Everything is positioned with a few geometry helpers below.
// ============================================================================

import type { Instrument, Tuning, PlacedNote } from '../theory/types';
import { noteName } from '../theory/notes';
import './Fretboard.css';

// --- Geometry constants (in SVG user units) -------------------------------
const FRET_SPACING = 64; // horizontal gap between fret wires
const STRING_SPACING = 40; // vertical gap between strings
const PAD_LEFT = 56; // room for open-string note labels left of the nut
const PAD_RIGHT = 28;
const PAD_TOP = 30;
// Room for fret numbers under the neck. Generous on purpose: the numbers were
// tucked up close under the bottom string, so they read as part of the dots
// rather than as a ruler beneath them.
const PAD_BOTTOM = 46;
const DOT_RADIUS = 15; // radius of a lit-up note marker

// Frets that get position-marker inlays (the dots fretboards have for the eye).
const SINGLE_INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAYS = [12, 24];

// Sixteen stamps. A note picks one from its position on the neck, so the same
// fret always prints the same way (stable across re-renders) while the board as
// a whole never repeats a mark twice in a row.

// The plain diatonic number (1–7) inside an interval label, so a dot can be
// coloured by scale degree. Handles every shape the app produces: "1", "♭3",
// "♯4" (scale degrees) and "P1", "M3", "m7" (chord intervals). Returns null for
// anything unexpected, and that note just takes the default ink.
function degreeOf(intervalName: string): number | null {
  const m = /([1-7])/.exec(intervalName);
  return m ? Number(m[1]) : null;
}

interface FretboardProps {
  instrument: Instrument;
  tuning: Tuning;
  // Notes to light up. Anything in this list gets a coloured dot + label.
  // Used in "flat" mode (e.g. a scale) where notes aren't grouped into shapes.
  highlights?: PlacedNote[];
  // Grouped mode: each inner array is one chord SHAPE. Drawn as constellations —
  // hovering a shape (or its TAB) lights it and dims the others.
  shapes?: PlacedNote[][];
  // Which shape is currently active (highlighted). Controlled by the parent so
  // the TAB and the neck share one hovered-shape state. null = none.
  activeShapeIndex?: number | null;
  // Or a GROUP of shapes, lit together — a whole string set's worth of chords,
  // say. Takes precedence over activeShapeIndex when given.
  activeShapeIndices?: readonly number[] | null;
  // Called when the pointer enters/leaves a shape on the neck (index, or null).
  onShapeHover?: (index: number | null) => void;
  // Called when a whole shape is clicked (by its index) — used to play + pin it.
  // A click anywhere on the shape triggers this (not a single note).
  onShapeTap?: (index: number) => void;
  // Called when the empty neck (not a shape) is clicked — used to clear a pin.
  onBackgroundClick?: () => void;
  // What to print inside each dot: the note name ("Bb") or its scale degree
  // ("3"). The data carries both; this just picks which to show.
  labelMode?: 'note' | 'degree';
  // Called when a single lit note is tapped (flat mode, e.g. a scale).
  onNoteTap?: (placed: PlacedNote) => void;
  // Draw EVERY shape's constellation at once (none dimmed) — "see all the boxes".
  showAllShapes?: boolean;
}

export function Fretboard({
  instrument,
  tuning,
  highlights = [],
  shapes,
  activeShapeIndex = null,
  activeShapeIndices = null,
  onShapeHover,
  onShapeTap,
  onBackgroundClick,
  labelMode = 'note',
  onNoteTap,
  showAllShapes = false,
}: FretboardProps) {
  const { stringCount, fretCount } = instrument;

  // WHAT MAKES A DOT "THE SAME DOT" WHEN THE KEY CHANGES.
  //
  // Change key and every note shifts along the neck. For that to read as a
  // SHIFT rather than a redraw, React has to reuse the same elements, which
  // means keying them by something that survives the change — and the fret
  // can't, since the fret is the thing that moved.
  //
  // The identity that survives is: which string, which degree of the scale,
  // and WHICH TIME that degree appears on that string counting up from the
  // nut. Change C major to A major and "the 1st degree, first occurrence on
  // the low E" goes from fret 8 to fret 5. It slides three frets down rather
  // than nine up to the next C, which is what makes the movement read as the
  // shortest way round without anyone computing a direction: both lists are in
  // fret order, so matching them up by position matches each note to its
  // nearest cousin.
  //
  // Notes near the nut have no cousin — a degree that had two occurrences on a
  // string may have three after the shift. Those appear rather than slide,
  // which is honest: they came from below the nut, where there is no fret to
  // slide from.
  const occurrences = new Map<string, number>();
  const identityOf = (h: PlacedNote) => {
    const stem = `${h.position.stringIndex}:${h.intervalName}`;
    const nth = occurrences.get(stem) ?? 0;
    occurrences.set(stem, nth + 1);
    return `${stem}:${nth}`;
  };

  // WHAT'S LIT. One shape or a group of them, normalised to a single set so
  // everything downstream asks the same question: is this shape in it?
  const activeSet =
    activeShapeIndices && activeShapeIndices.length > 0
      ? new Set(activeShapeIndices)
      : activeShapeIndex !== null
        ? new Set([activeShapeIndex])
        : null;

  // Overall canvas size derived from how many strings/frets we're drawing.
  const nutX = PAD_LEFT;
  const width = PAD_LEFT + fretCount * FRET_SPACING + PAD_RIGHT;
  const height = PAD_TOP + (stringCount - 1) * STRING_SPACING + PAD_BOTTOM;

  // --- Coordinate helpers -------------------------------------------------
  // Where a fret WIRE sits horizontally (fret 0 = the nut).
  const fretX = (fret: number) => nutX + fret * FRET_SPACING;
  // Where a NOTE dot sits horizontally: centred ON its fret wire. Fret 0 is the
  // nut, so open-string notes sit centred on the nut itself.
  const noteX = (fret: number) => fretX(fret);
  // Where an INLAY marker sits: in the middle of the fret space (as on a real
  // neck), which is offset half a fret from the wire the note dots sit on.
  const inlayX = (fret: number) => nutX + (fret - 0.5) * FRET_SPACING;
  // Where a STRING sits vertically. string 0 (low E) is at the BOTTOM, so we
  // flip the index: higher pitch = higher on screen.
  const stringY = (stringIndex: number) =>
    PAD_TOP + (stringCount - 1 - stringIndex) * STRING_SPACING;
  // Thicker line for lower (bass) strings, like real string gauges. Index 0 is
  // the lowest string AND the bottom row, so the gauge has to count DOWN from
  // it — the neck read thin-at-the-bottom before, which is backwards from a
  // real instrument.
  const stringWidth = (stringIndex: number) =>
    1.3 + (stringCount - 1 - stringIndex) * 0.32;

  return (
    <svg
      className="fretboard"
      viewBox={`0 0 ${width} ${height}`}
      onClick={onBackgroundClick}
      role="img"
      aria-label={`${instrument.name} fretboard in ${tuning.name} tuning`}
    >
      {/* THE PRESS. One grain, laid over the whole notes layer at the end (see
          the <g> below) rather than per-dot — 126 separate filters would be
          126 separate filter passes.

          `feComposite` with `operator="arithmetic" k1="1"` is a multiply, and
          the useful part is that it multiplies ALPHA too: outside the dots the
          source is transparent, so the grain lands on the ink and nowhere
          else, with no clip path to maintain. The colour matrix before it
          squeezes the noise into 0.8–1.0 — full-strength grain over a 30-unit
          dot is dirt, not texture.

          The FREQUENCY is the thing to get right, and it's the same lesson the
          ink stamp taught: a dot is only 30 units across, so noise finer than
          about 1 unit falls below a pixel on screen and averages out to a flat
          grey wash — the texture disappears and all you're left with is dulled
          colour. Features a few units wide (baseFrequency ~0.25) actually read
          as uneven ink. This only varies DENSITY, though; it never cuts the
          edge, which is where the stamp went wrong (see LEARNED.md). */}
      <defs>
        <filter id="press-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.25"
            numOctaves={2}
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix in="noise" type="saturate" values="0" result="grey" />
          <feColorMatrix
            in="grey"
            type="matrix"
            values="0.2 0 0 0 0.8  0 0.2 0 0 0.8  0 0 0.2 0 0.8  0 0 0 0 1"
            result="soft"
          />
          <feComposite
            in="soft"
            in2="SourceGraphic"
            operator="arithmetic"
            k1="1"
            k2="0"
            k3="0"
            k4="0"
          />
        </filter>
      </defs>

      {/* Inlay position dots, drawn first so they sit behind everything. */}
      {[...SINGLE_INLAYS, ...DOUBLE_INLAYS]
        .filter((f) => f <= fretCount)
        .flatMap((f) => {
          const x = inlayX(f);
          const midY = PAD_TOP + ((stringCount - 1) * STRING_SPACING) / 2;
          // Single inlays sit on the centre line; double inlays straddle it.
          const ys = DOUBLE_INLAYS.includes(f)
            ? [midY - STRING_SPACING, midY + STRING_SPACING]
            : [midY];
          return ys.map((y, i) => (
            <circle key={`inlay-${f}-${i}`} className="inlay" cx={x} cy={y} r={5} />
          ));
        })}

      {/* Fret wires (vertical lines). The NUT (fret 0) is drawn further down,
          after the strings, so it sits over them the way it does on a real
          neck instead of being crossed by them. */}
      {Array.from({ length: fretCount }, (_, i) => i + 1).map((f) => (
        <line
          key={`fret-${f}`}
          className="fret"
          x1={fretX(f)}
          y1={stringY(stringCount - 1)}
          x2={fretX(f)}
          y2={stringY(0)}
        />
      ))}

      {/* Strings (horizontal lines), plus the open-string note name at the left. */}
      {Array.from({ length: stringCount }, (_, s) => {
        const y = stringY(s);
        const open = tuning.openNotes[s];
        return (
          <g key={`string-${s}`}>
            <line
              className="string"
              x1={nutX}
              y1={y}
              x2={fretX(fretCount)}
              y2={y}
              strokeWidth={stringWidth(s)}
            />
            <text className="open-label" x={nutX - 40} y={y} dominantBaseline="middle">
              {noteName(open)}
            </text>
          </g>
        );
      })}

      {/* The nut, over the strings. */}
      <line
        className="nut"
        x1={fretX(0)}
        y1={stringY(stringCount - 1)}
        x2={fretX(0)}
        y2={stringY(0)}
      />

      {/* Fret numbers under the neck, aligned with the wire (where dots sit). */}
      {Array.from({ length: fretCount }, (_, i) => {
        const fret = i + 1;
        return (
          <text
            key={`num-${fret}`}
            className="fret-number"
            x={fretX(fret)}
            y={height - 12}
            textAnchor="middle"
          >
            {fret}
          </text>
        );
      })}

      {/* One lit note: a dot + label; roots take the accent colour. `dim` fades
          it when another shape is the active constellation. */}
      <g className="notes-layer" filter="url(#press-grain)">
      {(() => {
        const renderNote = (h: PlacedNote, key: string, dim: boolean) => {
          const x = noteX(h.position.fret);
          const y = stringY(h.position.stringIndex);
          // Use the spelling carried on the PlacedNote (e.g. "Bb"), not a
          // re-derived sharp one, so scale/chord spelling stays correct.
          const label = labelMode === 'degree' ? h.intervalName : noteName(h.note);
          // COLOUR BY SCALE DEGREE (see index.css --deg-1..7): the palette runs
          // warm at the root and cools toward the 7th, so a constellation shows
          // its shape in colour as well as position. `aura-N` varies the glow
          // size a little from note to note — keyed off the position so it's
          // stable between renders, not flickering.
          const deg = degreeOf(h.intervalName);
          const dotClass =
            'note-dot' +
            (deg ? ` note-dot--deg${deg}` : '') +
            (h.isRoot ? ' note-dot--root' : '') +
            (dim ? ' note-dot--dim' : '');
          return (
            <g
              key={key}
              className={
                (onNoteTap ? 'note tappable' : 'note') + (deg ? ` note--deg${deg}` : '')
              }
              onClick={
                onNoteTap
                  ? (e) => {
                      // A note tap wins over the shape/background click beneath it
                      // (so clicking a scale note re-roots, not plays the box).
                      e.stopPropagation();
                      onNoteTap(h);
                    }
                  : undefined
              }
            >
              {/* One flat disc of colour. It was a textured ink stamp for a
                  while — sixteen turbulence masks so no two dots repeated —
                  but at 30 units across the texture only ever read as noise.
                  The solid dot is the stronger mark, and it's the one the
                  transit maps have been using for a century: a saturated
                  circle, no stroke, no shadow, the letter straight through the
                  middle. Recoverable at the `ink-stamp-dots` tag if we ever
                  want it back. */}
              {/* Drawn at the ORIGIN and moved by a transform, rather than
                  drawn at its coordinates. That's what makes the dot able to
                  slide when the key changes: a transform is animatable, cx and
                  x are not (reliably), and the dot and its letter have to move
                  as one thing. */}
              {/* style, NOT the transform attribute. A presentation attribute
                  and a CSS property look identical in the DOM and behave
                  differently: a transition animates the property, and setting
                  the attribute just jumps. This is the whole difference between
                  the pattern sliding along the neck and it teleporting. */}
              <g className="note__at" style={{ transform: `translate(${x}px, ${y}px)` }}>
                <circle className={dotClass} cx={0} cy={0} r={DOT_RADIUS} />
                <text
                  className={dim ? 'note-label note-label--dim' : 'note-label'}
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {label}
                </text>
              </g>
            </g>
          );
        };

        // GROUPED MODE: draw each shape as its own constellation. Hovering a
        // shape (here or via its TAB) makes it active; the rest dim.
        if (shapes) {
          // THE COMPLETE NECK, UNDERNEATH. `highlights` (when given alongside
          // shapes) is every note of the material that exists anywhere on the
          // fretboard — open strings, the frets above the last box, all of it.
          // The boxes are only FINGERINGS chosen from it, so drawing them alone
          // silently deleted real notes: a C major neck was missing its open E
          // and everything from the 15th fret up.
          //
          // A box's positions are a subset of these, so we draw each position
          // exactly once here and let the shapes contribute only their
          // constellation lines and which notes count as "in" the active box.
          const inActive =
            activeSet === null
              ? null
              : new Set(
                  [...activeSet].flatMap((si) =>
                    (shapes[si] ?? []).map(
                      (h) => `${h.position.stringIndex}:${h.position.fret}`,
                    ),
                  ),
                );
          const base = highlights.map((h) => {
            const key = `${h.position.stringIndex}:${h.position.fret}`;
            // Dim anything outside the box you're looking at (unless we're
            // showing every box at once, where nothing is singled out).
            const dim = !showAllShapes && inActive !== null && !inActive.has(key);
            return renderNote(h, identityOf(h), dim);
          });

          // LINES FIRST, DOTS OVER THEM. SVG paints in document order, so the
          // shape groups have to come before the note layer or the joining line
          // runs across the faces of the dots and their letters. It only showed
          // in scale mode: chord shapes draw their own notes inside the same
          // group, after the line, so they were already covered.
          const shapeNodes = shapes.map((shape, si) => {
            const isActive = activeSet !== null && activeSet.has(si);
            // "Show all" lights every box equally; otherwise the active one wins
            // and the rest dim.
            const dim = showAllShapes ? false : activeSet !== null && !isActive;
            const drawLine = showAllShapes ? shape.length > 1 : isActive && shape.length > 1;
            // The connecting "constellation" line, drawn through the shape's
            // notes in string order, only when the shape is active.
            const points = [...shape]
              .sort(
                (a, b) =>
                  a.position.stringIndex - b.position.stringIndex ||
                  a.position.fret - b.position.fret,
              )
              .map((h) => `${noteX(h.position.fret)},${stringY(h.position.stringIndex)}`)
              .join(' ');
            return (
              <g
                key={`shape-${si}`}
                className={onShapeTap ? 'shape tappable' : 'shape'}
                onMouseEnter={() => onShapeHover?.(si)}
                onMouseLeave={() => onShapeHover?.(null)}
                onClick={
                  onShapeTap
                    ? (e) => {
                        // Don't let the click also reach the background handler.
                        e.stopPropagation();
                        onShapeTap(si);
                      }
                    : undefined
                }
              >
                {/* Two passes: a blurred glow, then the fine drawn line on top
                    — a star-chart line rather than a UI connector. */}
                {drawLine && (
                  <>
                    <polyline
                      className={
                        showAllShapes
                          ? 'constellation-glow constellation-glow--all'
                          : 'constellation-glow'
                      }
                      points={points}
                    />
                    <polyline
                      className={
                        showAllShapes ? 'constellation constellation--all' : 'constellation'
                      }
                      points={points}
                    />
                  </>
                )}
                {/* The notes themselves are drawn once by the base layer
                    above; this group only carries the lines and the hit area. */}
                {highlights.length === 0 &&
                  shape.map((h, ni) => renderNote(h, `shape-${si}-note-${ni}`, dim))}
              </g>
            );
          });

          // `base` is empty when the shapes carry their own notes, so this one
          // order is right for both modes.
          return [...shapeNodes, ...base];
        }

        // FLAT MODE: a simple list of notes (e.g. a scale).
        return highlights.map((h) => renderNote(h, identityOf(h), false));
      })()}
      </g>
    </svg>
  );
}
