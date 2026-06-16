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
  highlights?: PlacedNote[];
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
  // Where a NOTE sits horizontally: open notes go just left of the nut; fretted
  // notes sit in the middle of their fret space (where a finger would press).
  const noteX = (fret: number) =>
    fret === 0 ? nutX - 28 : nutX + (fret - 0.5) * FRET_SPACING;
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
          const x = noteX(f);
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

      {/* Fret numbers under the neck. */}
      {Array.from({ length: fretCount }, (_, i) => {
        const fret = i + 1;
        return (
          <text
            key={`num-${fret}`}
            className="fret-number"
            x={noteX(fret)}
            y={height - 10}
            textAnchor="middle"
          >
            {fret}
          </text>
        );
      })}

      {/* The lit-up notes. Each highlight becomes a dot + label; roots get the
          accent colour. This is the data-driven payload — change `highlights`
          and the neck relights with no other change. Tapping plays the note. */}
      {highlights.map((h) => {
        const x = noteX(h.position.fret);
        const y = stringY(h.position.stringIndex);
        // Show the note name or the degree, depending on the chosen mode. We use
        // the spelling carried on the PlacedNote (e.g. "Bb"), not a re-derived
        // sharp one, so scale spelling stays correct.
        const label = labelMode === 'degree' ? h.intervalName : noteName(h.note);
        return (
          <g
            key={`hl-${h.position.stringIndex}-${h.position.fret}`}
            className={onNoteTap ? 'note tappable' : 'note'}
            onClick={onNoteTap ? () => onNoteTap(h) : undefined}
          >
            <circle
              className={h.isRoot ? 'note-dot note-dot--root' : 'note-dot'}
              cx={x}
              cy={y}
              r={DOT_RADIUS}
            />
            <text className="note-label" x={x} y={y} textAnchor="middle" dominantBaseline="central">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
