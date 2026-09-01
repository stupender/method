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

/** A headstock and three strings — small enough to read at 18px. */
export function InstrumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {/* The body: a rounded shape low-left, the way a guitar hangs. */}
      <path
        d="M8.6 21.2a4.1 4.1 0 1 1 2.7-7.2l7.4-7.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* The headstock at the top of the neck. */}
      <path
        d="M16.6 4.4 19.7 7.5 21.4 5.8a2.2 2.2 0 0 0-3.1-3.1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* The sound hole. */}
      <circle cx="8.6" cy="17.1" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
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
