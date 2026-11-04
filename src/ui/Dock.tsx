// ============================================================================
// ui/Dock.tsx — the progression, pinned to the bottom of the screen
// ----------------------------------------------------------------------------
// THE DOCK (sketch A, chosen 2026-11-03). Three or four bars, each its own key
// and control panel, in a strip that never leaves the screen — so while you
// teach from one bar, the whole progression is still there to point at, and
// the fretboard above keeps all its room.
//
// Pick a bar and everything above becomes that bar: its panel, its neck, its
// notation. "+ Bar" adds a copy of the selected bar right after it, because
// the useful move is "set one up, then change one thing". (This replaced the
// "+" that opened a second panel side by side.)
//
// This is the BARS height. A second height, SHAPES — a small fretboard in
// every bar (sketch C) — comes next; the dock is laid out so it can grow into
// it without the bars moving.
//
// The dock reports its own height as `--dock-h` on the page, so the page can
// leave that much room at the bottom and nothing scrolls out of reach behind
// it — the same idea as `--bar-h` for the site bar.
// ============================================================================

import { useEffect, useRef } from 'react';
import type { Interpretation } from '../theory/suggest';
import type { BarSummary } from './bars';
import './Dock.css';

export function Dock({
  bars,
  selectedId,
  keyName,
  functions,
  onSelect,
  onAdd,
  onRemove,
}: {
  /** In order: each bar's id and what it says. */
  bars: { id: string; summary: BarSummary }[];
  selectedId: string;
  /** The key the whole progression reads in, or null if no bar has a chord. */
  keyName: string | null;
  /** One per bar: its job in that key, or null. */
  functions: (Interpretation | null)[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const dock = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = dock.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () =>
      root.style.setProperty('--dock-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      // Gone from the page (another area), so the page needs no room for it.
      root.style.removeProperty('--dock-h');
    };
  }, []);

  return (
    <nav className="dock" ref={dock} aria-label="Progression">
      <div className="dock__inner">
        <div className="dock__head">
          <span className="dock__title">Progression</span>
          {/* WHICH KEY THE SONG READS IN — the one every bar's function label
              is measured against. Said once, here, rather than on every bar. */}
          {keyName && <span className="dock__reads">reads in {keyName}</span>}
          <button className="dock__add" onClick={onAdd}>
            + Bar
          </button>
        </div>
        <ol className="dock__bars">
          {bars.map((bar, i) => {
            const on = bar.id === selectedId;
            const fn = functions[i];
            // A chord the key explains on its own (ii, V) is said quietly; a
            // VISITOR from outside it (V/V, iv borrowed from minor) is said
            // louder, because that's the bar a student needs explained.
            const visitor = fn && fn.kind !== 'diatonic';
            return (
              <li key={bar.id} className={on ? 'dock__cell dock__cell--on' : 'dock__cell'}>
                <button
                  className="dock__bar"
                  onClick={() => onSelect(bar.id)}
                  aria-current={on ? 'true' : undefined}
                  aria-label={`Bar ${i + 1}: ${bar.summary.symbol ?? bar.summary.keyName}${
                    fn ? `, ${fn.label}` : ''
                  }, ${bar.summary.keyName}`}
                >
                  <span className="dock__no">{i + 1}</span>
                  <span className="dock__sym">{bar.summary.symbol ?? bar.summary.keyName}</span>
                  <span className="dock__meta">
                    {fn && (
                      <span className={visitor ? 'dock__fn dock__fn--visitor' : 'dock__fn'}>
                        {fn.label}
                      </span>
                    )}
                    {/* A whole-key bar already says its key in big type. */}
                    {bar.summary.symbol && <span className="dock__key">{bar.summary.keyName}</span>}
                  </span>
                </button>
                {/* Only the selected bar can be removed, and never the last
                    one — a progression with no bars has no panel to show. */}
                {on && bars.length > 1 && (
                  <button
                    className="dock__remove"
                    onClick={() => onRemove(bar.id)}
                    aria-label={`Remove bar ${i + 1}`}
                    title="Remove this bar"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
