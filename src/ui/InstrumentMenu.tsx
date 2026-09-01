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

import { useState } from 'react';
import type { Instrument, Tuning } from '../theory/types';

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
 * The strings, as gaps across the hole: EVENLY SPACED, and thick to thin left
 * to right. The taper is the whole thing — evenly weighted gaps would be a
 * barcode, and the gauges are what say "guitar" without drawing one. Same rule
 * the neck itself is drawn with (see stringWidth in render/Fretboard.tsx).
 *
 * FOUR, NOT SIX. Six is the honest number and it doesn't survive: at 3 units
 * apart on a 24-unit grid the gaps land 2.2px apart at the size this actually
 * renders, and six thin slivers that close up into grey is a worse lie about a
 * guitar than four clear ones. Four reads as strings; six reads as hatching.
 */
const ICON_STRINGS = [
  { x: 5.7, w: 1.45 },
  { x: 9.9, w: 1.2 },
  { x: 14.1, w: 0.98 },
  { x: 18.3, w: 0.8 },
];

export function InstrumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      {/* ONE PATH, with `evenodd`: the disc, then six tall rectangles laid over
          it. Overlapping subpaths cancel, so the rectangles become GAPS —
          actual holes in the mark rather than lines painted over it in the
          background colour. That matters because the bar sits on paper in one
          theme and on slate in the other, and a hole is right in both. */}
      <path
        fillRule="evenodd"
        d={
          'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z ' +
          ICON_STRINGS.map(
            (s) => `M${s.x - s.w / 2} 1.5h${s.w}v21h${-s.w}z`,
          ).join(' ')
        }
      />
    </svg>
  );
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
                  <span className="instrumentmenu__strings">{i.stringCount}</span>
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
