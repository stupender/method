// ============================================================================
// ui/InstrumentMenu.tsx — which neck am I looking at
// ----------------------------------------------------------------------------
// Guitar, baritone ukulele, tenor ukulele. The engine has been
// instrument-agnostic since the first session — every placement function takes
// an Instrument and a Tuning and draws whatever it's handed — so this menu is
// the last mile of a promise the architecture already made: adding an
// instrument is a data file, and choosing one is a list.
//
// A MODULE'S CHOICE, NOT THE APP'S. It sits in the site bar because that's
// where the room-level controls live, but it sets the panel it belongs to. With
// two panels open that means a guitar on the left and a ukulele on the right,
// the same key on both — which is the most useful thing two panels have ever
// been for, and exactly what a teacher with a mixed pair of students needs.
//
// TUNINGS APPEAR ONLY WHERE THERE'S A CHOICE. The guitar has one here and the
// baritone has one, so those instruments show no tuning list at all; the tenor
// has two that matter (high G and low G) and shows them. A row that can only
// say one thing isn't a control.
// ============================================================================

import { useId, useState } from 'react';
import type { Instrument, Tuning } from '../theory/types';
import { noteName } from '../theory/notes';
import { TUNINGS } from '../data/tunings';

/**
 * THE SOUND HOLE, WITH THE STRINGS CROSSING IT — a detail crop rather than a
 * whole instrument.
 *
 * Two silhouettes came before this. The first was a diagonal line with a hook
 * at each end, which at 18px is a squiggle. The second was a proper body
 * outline, and it was better, but a whole guitar at 18px asks the shape to
 * carry everything: get the waist a little wrong and it reads as a cello, get
 * the bouts a little wrong and it reads as a cartoon. There isn't much room
 * for error in a square the size of a fingernail.
 *
 * Stu's idea, and the right one: crop in. A hole with strings across it is
 * unmistakably a guitar and has no proportions to get wrong — and it happens
 * to be the app's own vocabulary, since everything here is circles and
 * strings.
 *
 * A SOLID DISC WITH THE STRINGS CUT OUT OF IT, rather than a ring with lines
 * drawn across. Stu's again, and it's the stronger mark by some way: at 18px a
 * thin ring is four faint arcs, while a filled circle is a shape you see
 * before you read it. The strings then read as light rather than as ink, which
 * is what they are when you look into a sound hole.
 */
/**
 * THE SOUND HOLE, WITH SIX STRINGS ACROSS IT — the same mark whatever
 * instrument is selected.
 *
 * It was briefly drawn from the tuning: six gaps for a guitar, four for a
 * ukulele, and the weights taken from the actual open PITCHES so that a
 * high-G tenor came out with a thin string on the left, the way one really
 * looks. It worked, and it's the wrong idea — Stu's call, and he's right. This
 * icon isn't a picture of the current instrument, it's the DOOR to the
 * instrument menu, and a door that changes shape depending on what's behind it
 * is a worse door. Six strings is what "guitar" looks like, the app is called
 * Fretboard Constellations, and the name on the button is the instrument's
 * name anyway.
 *
 * The gauges are a real guitar's, thick to thin left to right — the same rule
 * the neck itself is drawn with (see stringWidth in render/Fretboard.tsx). The
 * taper is the whole thing: evenly weighted gaps would be a barcode, and the
 * gauges are what say "guitar" without drawing one.
 */
const HOLE_R = 9.4;
const ICON_STRINGS = [
  { x: 4.75, w: 1.3 },
  { x: 7.65, w: 1.17 },
  { x: 10.55, w: 1.04 },
  { x: 13.45, w: 0.91 },
  { x: 16.35, w: 0.81 },
  { x: 19.25, w: 0.68 },
];

export function InstrumentIcon() {
  // One id per instance, so two of these on a page can't share a mask.
  const maskId = useId();
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {/* A MASK, NOT AN `evenodd` PATH.
          The first version laid the string rectangles over the disc in one
          path and let `evenodd` cancel them out. Inside the disc that gives
          the gaps; OUTSIDE it, where there's nothing to cancel against, each
          rectangle paints itself — so the mark grew solid bars sticking out of
          the top and bottom of the circle, and read as a barcode.
          A mask says what was actually meant: the disc is the shape, the
          strings take away from it, and nothing exists outside the circle. */}
      <mask id={maskId}>
        {/* White is kept, black is cut away. */}
        <circle cx="12" cy="12" r={HOLE_R} fill="#fff" />
        {ICON_STRINGS.map((s) => (
          <rect
            key={s.x}
            x={s.x - s.w / 2}
            y="0"
            width={s.w}
            height="24"
            fill="#000"
          />
        ))}
      </mask>
      <circle
        cx="12"
        cy="12"
        r={HOLE_R}
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

/** An instrument's open strings, low to high — "E A D G B E". */
function openNotes(t: Tuning | undefined): string {
  return t ? t.openNotes.map(noteName).join(' ') : '';
}

export function InstrumentMenu({
  instruments,
  tunings,
  instrument,
  tuning,
  onPickInstrument,
  onPickTuning,
}: {
  instruments: Instrument[];
  /** The tunings available for the CURRENT instrument. */
  tunings: Tuning[];
  instrument: Instrument;
  tuning: Tuning;
  onPickInstrument: (id: string) => void;
  onPickTuning: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="instrumentmenu">
      <button
        className={open ? 'sitebar__act sitebar__act--on' : 'sitebar__act'}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Instrument — ${instrument.name}`}
        title={instrument.name}
      >
        <InstrumentIcon />
      </button>

      {open && (
        <div className="instrumentmenu__list">
          <p className="instrumentmenu__head">Instrument</p>
          <ul>
            {instruments.map((i) => (
              <li key={i.id}>
                {/* The same dot the CONTROLS panel uses for every choice —
                    lit when it's the one you're on. One grammar everywhere. */}
                <button
                  className={
                    i.id === instrument.id
                      ? 'instrumentmenu__item instrumentmenu__item--on'
                      : 'instrumentmenu__item'
                  }
                  onClick={() => {
                    onPickInstrument(i.id);
                    setOpen(false);
                  }}
                >
                  <span className="seg__tick" aria-hidden="true" />
                  <span className="instrumentmenu__name">{i.name}</span>
                  {/* WHAT IT'S TUNED TO, not how many strings it has. The
                      count was a number you had to translate — 6 means guitar,
                      which you already read on the line beside it. The open
                      notes are the fact you'd actually want: they say what the
                      instrument IS, they tell a baritone ukulele from a tenor
                      at a glance, and they're what changes under you when you
                      pick one. The instrument you're on shows the tuning
                      you're actually in; the others show the one they'd
                      open in. */}
                  <span className="instrumentmenu__strings">
                    {openNotes(i.id === instrument.id ? tuning : TUNINGS[i.defaultTuningId])}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Only when there's more than one — see the note at the top. */}
          {tunings.length > 1 && (
            <>
              <p className="instrumentmenu__head">Tuning</p>
              <ul>
                {tunings.map((t) => (
                  <li key={t.id}>
                    <button
                      className={
                        t.id === tuning.id
                          ? 'instrumentmenu__item instrumentmenu__item--on'
                          : 'instrumentmenu__item'
                      }
                      onClick={() => {
                        onPickTuning(t.id);
                        setOpen(false);
                      }}
                    >
                      <span className="seg__tick" aria-hidden="true" />
                      <span className="instrumentmenu__name">{t.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
