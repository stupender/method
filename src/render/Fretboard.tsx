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
  // What to print inside each dot: the note name ("Bb") or its scale degree
  // ("3"). The data carries both; this just picks which to show.
  labelMode?: 'note' | 'degree';
  // Called when a lit note is tapped — the UI uses this to play the note.
  onNoteTap?: (placed: PlacedNote) => void;
}

export function Fretboard({
  instrument,
  tuning,
  highlights = [],
  shapes,
  activeShapeIndex = null,
  onShapeHover,
  labelMode = 'note',
  onNoteTap,
}: FretboardProps) {
  const { stringCount, fretCount } = instrument;

  // Overall canvas size derived from how many strings/frets we're drawing.
  const nutX = PAD_LEFT;
  const width = PAD_LEFT + fretCount * FRET_SPACING + PAD_RIGHT;
  const height = PAD_TOP + (stringCount - 1) * STRING_SPACING + PAD_BOTTOM;

  // --- Coordinate helpers -------------------------------------------------
  // Where a fret WIRE sits horizontally (fret 0 = the nut).
  const fretX = (fret: number) => nutX + fret * FRET_SPACING;
  // Where a NOTE dot sits horizontally: open notes go just left of the nut;
  // fretted notes sit centred ON their fret wire.
  const noteX = (fret: number) => (fret === 0 ? nutX - 28 : fretX(fret));
  // Where an INLAY marker sits: in the middle of the fret space (as on a real
  // neck), which is offset half a fret from the wire the note dots sit on.
  const inlayX = (fret: number) => nutX + (fret - 0.5) * FRET_SPACING;
  // Where a STRING sits vertically. string 0 (low E) is at the BOTTOM, so we
  // flip the index: higher pitch = higher on screen.
  const stringY = (stringIndex: number) =>
    PAD_TOP + (stringCount - 1 - stringIndex) * STRING_SPACING;
  // Thicker line for lower (bass) strings, like real string gauges.
  const stringWidth = (stringIndex: number) => 1.3 + stringIndex * 0.32;

  return (
    <svg
      className="fretboard"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${instrument.name} fretboard in ${tuning.name} tuning`}
    >
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

      {/* Fret wires (vertical lines). Fret 0 is the nut — drawn thicker. */}
      {Array.from({ length: fretCount + 1 }, (_, f) => (
        <line
          key={`fret-${f}`}
          className={f === 0 ? 'nut' : 'fret'}
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
          const dotClass =
            (h.isRoot ? 'note-dot note-dot--root' : 'note-dot') +
            (dim ? ' note-dot--dim' : '');
          return (
            <g
              key={key}
              className={onNoteTap ? 'note tappable' : 'note'}
              onClick={onNoteTap ? () => onNoteTap(h) : undefined}
            >
              <circle className={dotClass} cx={x} cy={y} r={DOT_RADIUS} />
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
          return shapes.map((shape, si) => {
            const isActive = activeShapeIndex === si;
            const dim = activeShapeIndex !== null && !isActive;
            // The connecting "constellation" line, drawn through the shape's
            // notes in string order, only when the shape is active.
            const points = [...shape]
              .sort((a, b) => a.position.stringIndex - b.position.stringIndex)
              .map((h) => `${noteX(h.position.fret)},${stringY(h.position.stringIndex)}`)
              .join(' ');
            return (
              <g
                key={`shape-${si}`}
                className="shape"
                onMouseEnter={() => onShapeHover?.(si)}
                onMouseLeave={() => onShapeHover?.(null)}
              >
                {isActive && shape.length > 1 && (
                  <polyline className="constellation" points={points} />
                )}
                {shape.map((h, ni) =>
                  renderNote(h, `shape-${si}-note-${ni}`, dim),
                )}
              </g>
            );
          });
        }

        // FLAT MODE: a simple list of notes (e.g. a scale).
        return highlights.map((h) =>
          renderNote(h, `hl-${h.position.stringIndex}-${h.position.fret}`, false),
        );
      })()}
    </svg>
  );
}
