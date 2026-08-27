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

import { useEffect, useRef } from 'react';
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

  // WHAT MAKES A DOT "THE SAME DOT" WHEN THE KEY CHANGES.
  //
  // Change key and every note shifts along the neck. For that to read as a
  // SHIFT rather than a redraw, React has to reuse the same elements, which
  // means keying them by something that survives the change — and the fret
  // can't, since the fret is the thing that moved.
  //
  // The first attempt keyed them by "which occurrence of this degree on this
  // string, counting up from the nut", which is right until a note falls off
  // the bottom. Then every occurrence above it shuffles down a place, so ALL of
  // them get paired with their neighbour twelve frets away and slide the length
  // of the neck — several notes at once, against the direction of everything
  // else.
  //
  // So notes are matched by WHERE THEY WERE instead. Both lists are in fret
  // order, so the question is only how they line up: try sliding one list a
  // couple of places against the other and keep whichever alignment moves the
  // least. A note that left below the nut takes its element with it, a note
  // that arrived gets a new one, and everything else — including a note going
  // from the 1st fret to the 2nd — slides, because it was there a moment ago.
  //
  // A dot only appears when nothing on this string was near enough to be it.
  const prevGroups = useRef(new Map<string, { id: string; x: number }[]>());
  // The same notes keyed by WHERE they are, for the case below.
  const prevByPlace = useRef(new Map<string, string>());
  const freshId = useRef(0);
  const identityOf = new Map<PlacedNote, string>();
  const arrivals = new Set<PlacedNote>();
  const nextGroups = new Map<string, { id: string; x: number }[]>();

  // NOT EVERY CHANGE IS A MOVE. Change GRAVITY inside a key and the neck holds
  // exactly the same notes in exactly the same places — C major and D dorian
  // are the same seven pitches — and all that happens is that they're numbered
  // from somewhere else. Matching by degree can't see that: every degree
  // changed, so nothing matched, and a page where nothing moved dissolved and
  // reassembled itself.
  //
  // So when the set of PLACES is unchanged, notes are matched by place. Every
  // dot keeps its element, stays exactly where it is, and simply takes its new
  // colour and letter. Which is the truth of it: nothing moved, because
  // nothing moved.
  // EVERY NOTE THAT GETS DRAWN, whichever way it arrived. In Scales the neck
  // is `highlights` and the shapes only contribute their lines; in Harmony
  // there are no highlights and each shape draws its own notes. Only the first
  // was being matched, so the chord views dissolved and rebuilt on every
  // change while the scale views slid — and with a set focused you could watch
  // the two behaviours side by side, the dimmed dots doing one thing and the
  // lit ones another.
  const drawn: PlacedNote[] =
    highlights && highlights.length > 0 ? highlights : (shapes ?? []).flat();

  const places = drawn.map(
    (h) => `${h.position.stringIndex}:${h.position.fret}`,
  );
  const sameNeck =
    places.length > 0 &&
    places.length === prevByPlace.current.size &&
    places.every((k) => prevByPlace.current.has(k));

  const nextByPlace = new Map<string, string>();

  if (sameNeck) {
    drawn.forEach((h, i) => {
      const place = places[i];
      const id = prevByPlace.current.get(place)!;
      identityOf.set(h, id);
      nextByPlace.set(place, id);
    });
  } else {
    // One group per string + degree: the notes that could plausibly BE each
    // other from one key to the next.
    const groups = new Map<string, PlacedNote[]>();
    for (const h of drawn) {
      // Grouped by the degree's NUMBER, not its full name: going from major to
      // harmonic minor, the 3 becomes a ♭3 and the 6 a ♭6, and those are the
      // same finger moving a fret — which is the most worth watching of all
      // the movements this thing does. Keyed by the whole name they were
      // different notes and the neck dissolved instead.
      const key = `${h.position.stringIndex}:${degreeOf(h.intervalName) ?? h.intervalName}`;
      const list = groups.get(key);
      if (list) list.push(h);
      else groups.set(key, [h]);
    }

    for (const [key, notes] of groups) {
      notes.sort((a, b) => a.position.fret - b.position.fret);
      const previous = prevGroups.current.get(key) ?? [];

      // How far to slide one list against the other. Zero means "nothing
      // entered or left"; ±1 covers a note appearing at or vanishing past an
      // end, which is the only thing that actually happens between two keys.
      // Matching EVERYTHING beats matching some of it neatly, always. Scored
      // the other way round — average distance with a small penalty per note
      // abandoned — the search happily dropped a note to save a few frets of
      // travel on the rest, and a quarter of the neck ended up appearing
      // instead of sliding. So: fewest notes left over first, and only then
      // the least movement.
      let bestShift = 0;
      let bestLeftOver = Infinity;
      let bestMoved = Infinity;
      for (let shift = -2; shift <= 2; shift++) {
        let moved = 0;
        let matched = 0;
        notes.forEach((h, i) => {
          const was = previous[i + shift];
          if (was) {
            moved += Math.abs(was.x - noteX(h.position.fret));
            matched += 1;
          }
        });
        if (matched === 0) continue;
        const leftOver = notes.length - matched;
        const average = moved / matched;
        if (leftOver < bestLeftOver || (leftOver === bestLeftOver && average < bestMoved)) {
          bestLeftOver = leftOver;
          bestMoved = average;
          bestShift = shift;
        }
      }

      notes.forEach((h, i) => {
        const was = previous[i + bestShift];
        const x = noteX(h.position.fret);
        // A pairing further apart than an octave isn't the same note moving,
        // it's the same note an octave away — the neck repeats every twelve
        // frets, so its true partner left past the end. Sliding across that
        // gap is the one movement that reads as wrong, so it doesn't: the note
        // appears where it is and carries on from there.
        const tooFar = was !== undefined && Math.abs(was.x - x) > FRET_SPACING * 11;
        const keep = was && !tooFar ? was : undefined;
        const id = keep ? keep.id : `${key}:new${freshId.current++}`;
        identityOf.set(h, id);
        if (!keep) arrivals.add(h);
      });
    }
    for (const [h, id] of identityOf) {
      nextByPlace.set(`${h.position.stringIndex}:${h.position.fret}`, id);
    }
  }

  // WHERE EVERYTHING LANDED, under the labels it has NOW. Both paths finish
  // here, and it matters that the by-place path does too: after a GRAVITY
  // change the notes haven't moved but they've all been renumbered, and
  // carrying the old groups forward left the next key change matching against
  // degrees that no longer existed — so the whole neck appeared at once,
  // scattered, exactly the fault this was meant to fix.
  for (const h of drawn) {
    const key = `${h.position.stringIndex}:${degreeOf(h.intervalName) ?? h.intervalName}`;
    const entry = { id: identityOf.get(h)!, x: noteX(h.position.fret) };
    const list = nextGroups.get(key);
    if (list) list.push(entry);
    else nextGroups.set(key, [entry]);
  }
  for (const list of nextGroups.values()) list.sort((a, b) => a.x - b.x);

  // Thicker line for lower (bass) strings, like real string gauges. Index 0 is
  // the lowest string AND the bottom row, so the gauge has to count DOWN from
  // it — the neck read thin-at-the-bottom before, which is backwards from a
  // real instrument.
  const stringWidth = (stringIndex: number) =>
    1.3 + (stringCount - 1 - stringIndex) * 0.32;

  // Remember where everything ended up, so the next render can tell a shift
  // from a jump. Written in an effect rather than during render, because a
  // render can be thrown away and re-run and this has to describe what was
  // actually painted.
  useEffect(() => {
    prevGroups.current = nextGroups;
    prevByPlace.current = nextByPlace;
  });

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
          // Set when nothing on this string was near enough to have been this
          // note — it arrives rather than travelling.
          const jumped = arrivals.has(h);
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
                (onNoteTap ? 'note tappable' : 'note') +
                (deg ? ` note--deg${deg}` : '') +
                (jumped ? ' note--jumped' : '')
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
            return renderNote(h, identityOf.get(h) ?? `neck-${h.position.stringIndex}-${h.position.fret}`, dim);
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
            // The connecting line, as SEGMENTS rather than one polyline, so it
            // can travel with the dots it joins.
            //
            // A polyline's `points` can't be animated — and SVG line geometry
            // isn't a CSS property in browsers, so x1/y1 can't be transitioned
            // either. What CAN be animated everywhere is a transform. So each
            // segment is a one-unit line placed by translate + rotate + scale:
            // its start rides its own dot, its angle swings, its length
            // stretches, and the whole thing interpolates as one property.
            //
            // Each segment is keyed by the two notes it joins, so as long as
            // those two are still connected it keeps its element and moves.
            // (`vector-effect` keeps the stroke an even weight despite the
            // sideways scale, which would otherwise thin it out.)
            const ordered = [...shape]
              .sort(
                (a, b) =>
                  a.position.stringIndex - b.position.stringIndex ||
                  a.position.fret - b.position.fret,
              )
              .map((h) => ({
                h,
                x: noteX(h.position.fret),
                y: stringY(h.position.stringIndex),
              }));
            const segments = ordered.slice(1).map((to, n) => {
              const from = ordered[n];
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              return {
                key: `${identityOf.get(from.h) ?? n}~${identityOf.get(to.h) ?? n + 1}`,
                x: from.x,
                y: from.y,
                angle: (Math.atan2(dy, dx) * 180) / Math.PI,
                length: Math.hypot(dx, dy),
              };
            });
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
                {drawLine &&
                  segments.map((seg) => (
                    <line
                      key={seg.key}
                      className={
                        showAllShapes ? 'constellation constellation--all' : 'constellation'
                      }
                      x1={0}
                      y1={0}
                      x2={1}
                      y2={0}
                      vectorEffect="non-scaling-stroke"
                      style={{
                        transform: `translate(${seg.x}px, ${seg.y}px) rotate(${seg.angle}deg) scale(${seg.length}, 1)`,
                      }}
                    />
                  ))}
                {/* The notes themselves are drawn once by the base layer
                    above; this group only carries the lines and the hit area. */}
                {highlights.length === 0 &&
                  shape.map((h, ni) =>
                    renderNote(
                      h,
                      identityOf.get(h) ?? `shape-${si}-note-${ni}`,
                      dim,
                    ),
                  )}
              </g>
            );
          });

          // `base` is empty when the shapes carry their own notes, so this one
          // order is right for both modes.
          return [...shapeNodes, ...base];
        }

        // FLAT MODE: a simple list of notes (e.g. a scale).
        return highlights.map((h) =>
          renderNote(
            h,
            identityOf.get(h) ?? `hl-${h.position.stringIndex}-${h.position.fret}`,
            false,
          ),
        );
      })()}
      </g>
    </svg>
  );
}
