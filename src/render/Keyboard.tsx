// ============================================================================
// render/Keyboard.tsx — draws the keyboard as SVG
// ----------------------------------------------------------------------------
// THE TWIN OF Fretboard.tsx, and it takes exactly the same props. Hand it an
// Instrument whose `layout` is 'keys' and it draws a keyboard; everything above
// it — the scale engine, the chord engine, the views, the audio — carries on
// thinking in strings and frets, because on a keyboard there is one string and
// a fret IS a semitone. That's the whole trick, and it's why adding a keyboard
// to this app needed no new theory at all:
//
//     string 0, fret 7   on a guitar = the B on the low E string
//     string 0, fret 7   on a keyboard = the seventh key up from the bottom
//
// Both are "seven semitones above the open pitch". The theory layer never has
// to know which one it's talking to.
//
// WHAT'S DIFFERENT is only the drawing. A neck is a grid — pick a string, pick
// a fret. A keyboard is a line — one note after another — but drawn in two
// ranks, because that's the shape your hand has learned to read. So the work
// here is laying out white and black keys, and then putting the app's own dot
// on whichever ones are lit.
//
// IT BORROWS THE FRETBOARD'S CSS. The class on the <svg> is `fretboard` as well
// as `keyboard`, so every rule for the dots, their seven degree colours, the
// labels, the dimming and the constellation lines applies unchanged. That's
// deliberate: a lit 3rd should be the same mark on both instruments, and one
// copy of that mark means it can't drift.
// ============================================================================

import type { Instrument, Tuning, PlacedNote } from '../theory/types';
import { noteName } from '../theory/notes';
import { midiOf } from '../theory/notes';
import './Fretboard.css';
import './Keyboard.css';

// --- Geometry (SVG user units) ---------------------------------------------
const WHITE_W = 38; // one white key's width
const WHITE_H = 150;
const BLACK_W = 26;
const BLACK_H = 94;
const PAD_LEFT = 10;
const PAD_TOP = 8;
const PAD_RIGHT = 10;
const PAD_BOTTOM = 32; // room for the octave labels under the C keys
const DOT_RADIUS = 13;

// Which pitch classes are black keys. C=0, so 1=C♯, 3=D♯, 6=F♯, 8=G♯, 10=A♯.
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

// The plain diatonic number (1–7) inside an interval label, so a dot can be
// coloured by scale degree. Same rule as the fretboard's — see Fretboard.tsx.
function degreeOf(intervalName: string): number | null {
  const m = /([1-7])/.exec(intervalName);
  return m ? Number(m[1]) : null;
}

/** Everything the drawing needs to know about one key, worked out once. */
interface Key {
  fret: number;
  black: boolean;
  x: number; // left edge of the key
  /** Where a dot on this key sits — near the bottom of it, where a finger goes. */
  dotX: number;
  dotY: number;
  /** The C at the start of each octave gets its name written under the board. */
  octaveLabel?: string;
}

export function Keyboard({
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
}: {
  instrument: Instrument;
  tuning: Tuning;
  highlights?: PlacedNote[];
  shapes?: PlacedNote[][];
  activeShapeIndex?: number | null;
  activeShapeIndices?: readonly number[] | null;
  onShapeHover?: (index: number | null) => void;
  onShapeTap?: (index: number) => void;
  onBackgroundClick?: () => void;
  labelMode?: 'note' | 'degree';
  onNoteTap?: (placed: PlacedNote) => void;
  showAllShapes?: boolean;
  /** Accepted and ignored — the keyboard doesn't animate. See ui/flags.ts. */
  animate?: boolean;
}) {
  const { fretCount } = instrument;

  // WHAT'S LIT. One shape or a group of them, normalised to a single set so
  // everything downstream asks the same question: is this shape in it?
  const activeSet =
    activeShapeIndices && activeShapeIndices.length > 0
      ? new Set(activeShapeIndices)
      : activeShapeIndex !== null
        ? new Set([activeShapeIndex])
        : null;

  // ---- Lay the keys out ----------------------------------------------------
  // Walk up from the open pitch a semitone at a time. White keys take the next
  // slot along; a black key has no slot of its own — it straddles the join
  // between the white key just passed and the one coming, which is exactly
  // where a piano puts it.
  const openMidi = midiOf(tuning.openNotes[0]);
  const keys: Key[] = [];
  let whites = 0;
  for (let fret = 0; fret <= fretCount; fret++) {
    const midi = openMidi + fret;
    const pc = ((midi % 12) + 12) % 12;
    const black = BLACK_PITCH_CLASSES.has(pc);
    if (black) {
      // `whites` is already the index of the white key AFTER this one, so its
      // left edge is the join this black key sits over.
      const join = PAD_LEFT + whites * WHITE_W;
      keys.push({
        fret,
        black: true,
        x: join - BLACK_W / 2,
        dotX: join,
        dotY: PAD_TOP + BLACK_H - 20,
      });
    } else {
      const x = PAD_LEFT + whites * WHITE_W;
      keys.push({
        fret,
        black: false,
        x,
        dotX: x + WHITE_W / 2,
        dotY: PAD_TOP + WHITE_H - 24,
        // Every C is labelled, because a keyboard is read from its Cs — the
        // group of two black keys is the landmark and the C is its left edge.
        octaveLabel: pc === 0 ? `C${Math.floor(midi / 12) - 1}` : undefined,
      });
    }
    if (!black) whites++;
  }

  const width = PAD_LEFT + whites * WHITE_W + PAD_RIGHT;
  const height = PAD_TOP + WHITE_H + PAD_BOTTOM;
  const byFret = new Map(keys.map((k) => [k.fret, k]));

  // ---- Drawing one lit note ------------------------------------------------
  const renderNote = (h: PlacedNote, key: string, dim: boolean) => {
    const k = byFret.get(h.position.fret);
    if (!k) return null;
    const label = labelMode === 'degree' ? h.intervalName : noteName(h.note);
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
          (onNoteTap ? 'note tappable' : 'note') +
          (deg ? ` note--deg${deg}` : '')
        }
        onClick={
          onNoteTap
            ? (e) => {
                e.stopPropagation(); // a note tap wins over the background
                onNoteTap(h);
              }
            : undefined
        }
      >
        <g
          className="note__at"
          style={{ transform: `translate(${k.dotX}px, ${k.dotY}px)` }}
        >
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

  return (
    <svg
      className="fretboard fretboard--still keyboard"
      viewBox={`0 0 ${width} ${height}`}
      onClick={onBackgroundClick}
      role="img"
      aria-label={`Keyboard, ${tuning.name}`}
    >
      {/* The same one-pass grain the fretboard uses on its dots. See the long
          note in Fretboard.tsx for why it's a single filter over the whole
          layer rather than one per dot. */}
      <defs>
        <filter id="keys-grain" x="0" y="0" width="100%" height="100%">
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

      {/* WHITE KEYS FIRST, then black over them — the order a piano is built in
          and the order it has to be drawn in, since the black keys overlap. */}
      {keys
        .filter((k) => !k.black)
        .map((k) => (
          <rect
            key={`w-${k.fret}`}
            className="key key--white"
            x={k.x}
            y={PAD_TOP}
            width={WHITE_W}
            height={WHITE_H}
            rx={3}
          />
        ))}
      {keys
        .filter((k) => k.black)
        .map((k) => (
          <rect
            key={`b-${k.fret}`}
            className="key key--black"
            x={k.x}
            y={PAD_TOP}
            width={BLACK_W}
            height={BLACK_H}
            rx={2}
          />
        ))}

      {/* Which octave you're looking at, under every C. The keyboard's answer
          to fret numbers. */}
      {keys
        .filter((k) => k.octaveLabel)
        .map((k) => (
          <text
            key={`oct-${k.fret}`}
            className="fret-number"
            x={k.x + WHITE_W / 2}
            y={height - 12}
            textAnchor="middle"
          >
            {k.octaveLabel}
          </text>
        ))}

      <g className="notes-layer" filter="url(#keys-grain)">
        {(() => {
          // GROUPED MODE — the same contract as the fretboard: `highlights` is
          // everything the material puts on the instrument, and `shapes` are
          // paths chosen through it. Draw each note once from the highlights,
          // and let the shapes contribute only their joining lines and which
          // notes count as "in" the one you're looking at.
          if (shapes) {
            const inActive =
              activeSet === null
                ? null
                : new Set(
                    [...activeSet].flatMap((si) =>
                      (shapes[si] ?? []).map((h) => h.position.fret),
                    ),
                  );
            const base = highlights.map((h) => {
              const dim =
                !showAllShapes &&
                inActive !== null &&
                !inActive.has(h.position.fret);
              return renderNote(h, `key-${h.position.fret}`, dim);
            });

            // NO JOINING LINES HERE. On a neck the line between two notes says
            // something you can't otherwise see — it crosses strings, so it
            // draws the SHAPE your hand makes. On a keyboard every note is on
            // the same course, so the line can only ever run left to right and
            // says nothing the left-to-right order didn't already say. All it
            // did was rule a line through the keys.
            const shapeNodes = shapes.map((shape, si) => {
              const isActive = activeSet !== null && activeSet.has(si);
              const dim = showAllShapes
                ? false
                : activeSet !== null && !isActive;
              return (
                <g
                  key={`shape-${si}`}
                  className={onShapeTap ? 'shape tappable' : 'shape'}
                  onMouseEnter={() => onShapeHover?.(si)}
                  onMouseLeave={() => onShapeHover?.(null)}
                  onClick={
                    onShapeTap
                      ? (e) => {
                          e.stopPropagation();
                          onShapeTap(si);
                        }
                      : undefined
                  }
                >
                  {/* When there are no highlights the shapes carry their own
                      notes — the same rule the fretboard follows. */}
                  {highlights.length === 0 &&
                    shape.map((h, ni) =>
                      renderNote(h, `shape-${si}-note-${ni}`, dim),
                    )}
                </g>
              );
            });

            return [...shapeNodes, ...base];
          }

          // FLAT MODE: a simple list of notes.
          return highlights.map((h) =>
            renderNote(h, `hl-${h.position.fret}`, false),
          );
        })()}
      </g>
    </svg>
  );
}
