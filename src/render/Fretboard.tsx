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
const PAD_BOTTOM = 34; // room for fret numbers under the neck
const DOT_RADIUS = 15; // radius of a lit-up note marker

// Frets that get position-marker inlays (the dots fretboards have for the eye).
const SINGLE_INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAYS = [12, 24];

// Sixteen stamps. A note picks one from its position on the neck, so the same
// fret always prints the same way (stable across re-renders) while the board as
// a whole never repeats a mark twice in a row.
const STAMP_SEEDS = [2, 7, 11, 13, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67];

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
  onShapeHover,
  onShapeTap,
  onBackgroundClick,
  labelMode = 'note',
  onNoteTap,
  showAllShapes = false,
}: FretboardProps) {
  const { stringCount, fretCount } = instrument;

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
      {/* THE INK STAMPS.
          Every lit note is printed with one of these, so no two dots on the
          neck are quite identical — the way a hand-stamped page never repeats
          exactly. Each is a turbulence mask that eats a slightly different
          bite out of the dot's edge; a different `seed` is a different stamp.
          The mask goes to the EDGE only (a radial gradient keeps the middle
          solid), so the note stays legible however ragged its rim gets.
          Defined once here and referenced by every dot — the browser renders
          the filter a handful of times, not once per note. */}
      <defs>
        {STAMP_SEEDS.map((seed, i) => (
          <mask key={`stamp-${i}`} id={`stamp-${i}`} maskUnits="objectBoundingBox">
            <filter id={`stamp-noise-${i}`}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.14"
                numOctaves={2}
                seed={seed}
              />
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 6.2"
              />
            </filter>
            {/* the ragged bite */}
            <circle
              cx={DOT_RADIUS}
              cy={DOT_RADIUS}
              r={DOT_RADIUS}
              fill="#fff"
              filter={`url(#stamp-noise-${i})`}
            />
            {/* ...held back from the centre, so the label always sits on ink */}
            <circle cx={DOT_RADIUS} cy={DOT_RADIUS} r={DOT_RADIUS * 0.72} fill="#fff" />
          </mask>
        ))}
        {/* The lighter core: ink pools at the rim of a stamp and thins in the
            middle, so a soft radial lift reads as pressure rather than gloss. */}
        <radialGradient id="stamp-core" cx="38%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.30" />
          <stop offset="55%" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
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
            y={height - 10}
            textAnchor="middle"
          >
            {fret}
          </text>
        );
      })}

      {/* One lit note: a dot + label; roots take the accent colour. `dim` fades
          it when another shape is the active constellation. */}
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
          // Which of the sixteen stamps this note prints with — keyed off the
          // position so it's stable between renders, and offset by string so
          // neighbours along a fret don't share a mark.
          const stamp =
            (h.position.fret * 3 + h.position.stringIndex * 7) % STAMP_SEEDS.length;
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
              {/* The stamp: the ink itself, masked ragged at the rim, with a
                  soft core lift over it so it reads as pressed rather than
                  filled. Both are translated into the mask's own box. */}
              <g transform={`translate(${x - DOT_RADIUS} ${y - DOT_RADIUS})`}>
                <circle
                  className={dotClass}
                  cx={DOT_RADIUS}
                  cy={DOT_RADIUS}
                  r={DOT_RADIUS}
                  mask={dim ? undefined : `url(#stamp-${stamp})`}
                />
                {!dim && (
                  <circle
                    className="note-core"
                    cx={DOT_RADIUS}
                    cy={DOT_RADIUS}
                    r={DOT_RADIUS}
                    fill="url(#stamp-core)"
                    mask={`url(#stamp-${stamp})`}
                  />
                )}
              </g>
              <text
                className={dim ? 'note-label note-label--dim' : 'note-label'}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {label}
              </text>
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
            activeShapeIndex !== null && shapes[activeShapeIndex]
              ? new Set(
                  shapes[activeShapeIndex].map(
                    (h) => `${h.position.stringIndex}:${h.position.fret}`,
                  ),
                )
              : null;
          const base = highlights.map((h, i) => {
            const key = `${h.position.stringIndex}:${h.position.fret}`;
            // Dim anything outside the box you're looking at (unless we're
            // showing every box at once, where nothing is singled out).
            const dim = !showAllShapes && inActive !== null && !inActive.has(key);
            return renderNote(h, `neck-${i}`, dim);
          });

          return [
            ...base,
            ...shapes.map((shape, si) => {
            const isActive = activeShapeIndex === si;
            // "Show all" lights every box equally; otherwise the active one wins
            // and the rest dim.
            const dim = showAllShapes ? false : activeShapeIndex !== null && !isActive;
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
          }),
          ];
        }

        // FLAT MODE: a simple list of notes (e.g. a scale).
        return highlights.map((h) =>
          renderNote(h, `hl-${h.position.stringIndex}-${h.position.fret}`, false),
        );
      })()}
    </svg>
  );
}
