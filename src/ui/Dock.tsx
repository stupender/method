// ============================================================================
// ui/Dock.tsx — the progression, pinned to the bottom of the screen
// ----------------------------------------------------------------------------
// THE DOCK (sketch A, chosen 2026-11-03). Three or four bars, each its own key
// and control panel, in a strip that never leaves the screen — so while you
// teach from one bar, the whole progression is still there to point at, and
// the fretboard above keeps all its room.
//
// NOTHING BUT THE BARS (Stu, 2026-11-04). No title, no header row, no button:
// each bar is one line — the chord, then its job in the song and its key in
// small type — and the strip is exactly as wide as the page's column. The key
// the progression "reads in" is still worked out, and said to screen readers
// in the strip's label, but not printed: the function labels already say it.
//
// Adding a bar lives where the music is, not down here: the "+" in the
// control panel's header copies the current bar, and the "+" on a chord's
// TAB card adds that chord. Pick a bar here and everything above becomes it.
//
// This is the BARS height. A second height, SHAPES — a small fretboard in
// every bar (sketch C) — comes next.
//
// TWO PLACES IT CAN SIT (BARS_ON_TOP in ui/flags.ts). At the BOTTOM it's fixed
// to the screen and reports its height as `--dock-h`, so the page leaves that
// much room and nothing scrolls out of reach behind it. On TOP it's an ordinary
// row inside the control panel's box, which floats it for free.
// ============================================================================

import { useEffect, useRef } from 'react';
import type { Interpretation } from '../theory/suggest';
import type { BarSummary } from './bars';
import './Dock.css';

export function Dock({
  placement = 'bottom',
  bars,
  selectedId,
  keyName,
  functions,
  onSelect,
  onRemove,
}: {
  /** Fixed to the bottom of the screen, or a row on top of the control panel. */
  placement?: 'bottom' | 'top';
  /** In order: each bar's id and what it says. */
  bars: { id: string; summary: BarSummary }[];
  selectedId: string;
  /** The key the whole progression reads in, or null if no bar has a chord. */
  keyName: string | null;
  /** One per bar: its job in that key, or null. */
  functions: (Interpretation | null)[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const dock = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = dock.current;
    // Only the bottom dock covers the page and needs room left for it.
    if (!el || placement !== 'bottom') return;
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
  }, [placement]);

  return (
    <nav
      className={placement === 'top' ? 'dock dock--top' : 'dock'}
      ref={dock}
      aria-label={keyName ? `Progression, reads in ${keyName}` : 'Progression'}
    >
      <ol className="dock__bars">
        {bars.map((bar, i) => {
          const on = bar.id === selectedId;
          const fn = functions[i];
          // A chord the key explains on its own (ii, V) is said quietly; a
          // VISITOR from outside it (V/V, iv borrowed from minor) is said in
          // ink, because that's the bar a student needs explained.
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
                <span className="dock__sym">{bar.summary.symbol ?? bar.summary.keyName}</span>
                {fn && (
                  <span className={visitor ? 'dock__fn dock__fn--visitor' : 'dock__fn'}>
                    {fn.label}
                  </span>
                )}
                {/* A whole-key bar already says its key in big type. */}
                {bar.summary.symbol && <span className="dock__key">{bar.summary.keyName}</span>}
              </button>
              {/* Only the selected bar can be removed, and never the last one —
                  a progression with no bars has no panel to show. */}
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
    </nav>
  );
}
