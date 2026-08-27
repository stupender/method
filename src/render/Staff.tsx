// ============================================================================
// render/Staff.tsx — the notes, on a staff
// ----------------------------------------------------------------------------
// RENDERING layer: it deals in PlacedNote and pitch, never in theory. Give it
// notes and it draws them; it doesn't know what a chord or a scale is.
//
// WHY THIS ISN'T VEXFLOW. VexFlow is the right tool for NOTATION — rhythm,
// beaming, ties, voices, bar lines — and we need none of that here. What we
// need is "where does this pitch sit on five lines", and the app's `Note`
// already answers that: it carries a LETTER and an OCTAVE separately from the
// accidental, which is exactly a staff position (that's why the app has always
// stored spelling rather than pitch classes). A notation engine would have us
// convert our notes into its own format so it could convert them back into the
// positions we started with. When Play needs real rhythmic notation, VexFlow
// is still the answer; for note heads on lines, this is 150 lines.
//
// GUITAR IS A TRANSPOSING INSTRUMENT. It's written an octave HIGHER than it
// sounds, which is why guitar music fits on a treble staff instead of living
// permanently below it on ledger lines. So we draw octave + 1 and mark the
// clef with an 8 beneath, which is what that 8 has always meant.
// ============================================================================

import type { PlacedNote } from '../theory/types';
import './Staff.css';

// Half a staff step — the distance from a line to the space above it. Every
// vertical measurement here is a multiple of this.
const STEP = 5;
const LINE_GAP = STEP * 2;
const STAFF_HEIGHT = LINE_GAP * 4; // five lines
const HEAD_RX = STEP * 1.15;
const HEAD_RY = STEP * 0.92;
const NOTE_GAP = 22; // between successive notes when they're a sequence

// THE STAFF AND THE TAB ARE ONE SYSTEM, so these have to agree with TabView's
// geometry exactly: the same left column for the clef (where the TAB prints its
// string letters), the same width of ruled line, and a bar line down the left
// that continues into the TAB below. That's how notation and tablature are set
// together on paper, and it's the thing that stops them reading as two
// unrelated pictures of the same chord.
const LEFT_COLUMN = 48; // clef sits here; the lines begin after it
const LINE_WIDTH = 120; // matches .tab-line
const PAD_RIGHT = 16;
// The gap between the staff and the TAB — part of the SVG, so the bar line can
// be drawn through it and meet the TAB's own.
const SYSTEM_GAP = 12;
// A fixed window, so every card's staff is the same height and they line up
// across a row. Generous enough for the voicings the app produces.
const WINDOW_TOP = 14;
const WINDOW_BOTTOM = -8;

// C=0 … B=6. A note's DIATONIC index is octave * 7 + this: the thing a staff
// actually measures, which is why a staff can tell B♭ from A♯ and a piano
// keyboard can't.
const LETTER_STEP: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// The bottom line of a treble staff is E4 — diatonic index 4 * 7 + 2.
const BOTTOM_LINE = 30;

const ACCIDENTAL: Record<number, string> = {
  [-2]: '𝄫',
  [-1]: '♭',
  [1]: '♯',
  [2]: '𝄪',
};

// Where a note sits, in diatonic steps above the staff's bottom line. Written
// pitch, so an octave above where it sounds.
function staffStep(p: PlacedNote): number {
  const octave = (p.note.octave ?? 4) + 1;
  return octave * 7 + LETTER_STEP[p.note.letter] - BOTTOM_LINE;
}

export function Staff({
  placed,
  /** Stack the notes in one column (a chord) instead of spacing them out. */
  chord = false,
}: {
  placed: PlacedNote[];
  chord?: boolean;
}) {
  if (placed.length === 0) return null;

  const notes = [...placed].sort((a, b) => staffStep(a) - staffStep(b));
  const steps = notes.map(staffStep);
  // A FIXED window rather than one sized to these particular notes: every
  // staff in a row is then the same height and they line up with each other,
  // which is most of what makes a page of them read as a table instead of a
  // scatter. It's wide enough for the clef, which runs well above and below the
  // five lines, and for the ledger lines these voicings need.
  const lowest = Math.min(...steps, WINDOW_BOTTOM);
  const highest = Math.max(...steps, WINDOW_TOP);
  const padTop = (highest - 8) * STEP + STEP * 2;
  const padBottom = -lowest * STEP + STEP * 2;
  const height = STAFF_HEIGHT + padTop + padBottom + SYSTEM_GAP;
  const bottomLineY = padTop + STAFF_HEIGHT;
  const y = (step: number) => bottomLineY - step * STEP;

  const firstNoteX = LEFT_COLUMN + 16;
  const width = chord
    ? LEFT_COLUMN + LINE_WIDTH + PAD_RIGHT
    : Math.max(
        LEFT_COLUMN + LINE_WIDTH + PAD_RIGHT,
        firstNoteX + Math.max(1, notes.length) * NOTE_GAP + PAD_RIGHT,
      );

  // A note off the staff needs a ledger line at every LINE it passes — the
  // even steps beyond 0 (bottom line) and 8 (top line).
  const ledgersFor = (step: number): number[] => {
    const out: number[] = [];
    for (let s = -2; s >= step; s -= 2) out.push(s);
    for (let s = 10; s <= step; s += 2) out.push(s);
    return out;
  };
  const ledgers = new Set(notes.flatMap((n) => ledgersFor(staffStep(n))));

  return (
    <svg
      className="notation"
      viewBox={`0 0 ${width} ${height}`}
      style={{ width, height }}
      role="img"
      aria-label="Staff notation"
    >
      {/* The five lines, starting where the TAB's lines start. */}
      {[0, 2, 4, 6, 8].map((step) => (
        <line
          key={step}
          className="notation__line"
          x1={LEFT_COLUMN}
          x2={width - PAD_RIGHT}
          y1={y(step)}
          y2={y(step)}
        />
      ))}

      {/* THE BAR LINE, down the left of the system — and carried all the way to
          the bottom of this box, which includes the gap below, so it meets the
          one the TAB draws from its own top edge. Two halves of one line. */}
      <line
        className="notation__bar"
        x1={LEFT_COLUMN}
        x2={LEFT_COLUMN}
        y1={y(8)}
        y2={height}
      />

      {/* Treble clef, with the 8 that says "sounds an octave lower". It sits in
          the left column, where the TAB prints its string names. */}
      <text className="notation__clef" x={6} y={y(2)}>
        𝄞
      </text>
      <text className="notation__octave" x={17} y={y(-3)}>
        8
      </text>

      {/* Ledger lines, drawn once each however many notes need them. */}
      {[...ledgers].map((step) => {
        const cx = chord ? firstNoteX : null;
        return notes
          .filter((n) => ledgersFor(staffStep(n)).includes(step))
          .map((n, i) => {
            const x = cx ?? firstNoteX + notes.indexOf(n) * NOTE_GAP;
            return (
              <line
                key={`${step}-${i}`}
                className="notation__ledger"
                x1={x - HEAD_RX - 3}
                x2={x + HEAD_RX + 3}
                y1={y(step)}
                y2={y(step)}
              />
            );
          });
      })}

      {/* The notes. */}
      {notes.map((n, i) => {
        const step = staffStep(n);
        const cx = chord ? firstNoteX : firstNoteX + i * NOTE_GAP;
        // A chord's seconds would collide, so a note a single step above the
        // one below it moves to the other side of the stem — the way it's
        // always been done.
        const crowded = chord && i > 0 && step - staffStep(notes[i - 1]) === 1;
        const x = crowded ? cx + HEAD_RX * 2 : cx;
        return (
          <g key={i}>
            {n.note.accidental !== 0 && (
              <text className="notation__accidental" x={x - HEAD_RX - 4} y={y(step)}>
                {ACCIDENTAL[n.note.accidental]}
              </text>
            )}
            <ellipse className="notation__head" cx={x} cy={y(step)} rx={HEAD_RX} ry={HEAD_RY} />
          </g>
        );
      })}
    </svg>
  );
}
