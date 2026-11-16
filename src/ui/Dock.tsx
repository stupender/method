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

// THE × AND THE +, DRAWN rather than typed. A font sets "×" and "+" a little
// below the middle of its line, so as text they never quite centre on the
// tab beside the chord; two crossed strokes centre exactly. They take the
// button's text colour (currentColor), so hover still darkens them.
function Cross() {
  return (
    <svg className="dock__glyph" width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
      <path d="M1 1 L8 8 M8 1 L1 8" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
function Plus() {
  return (
    <svg className="dock__glyph" width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
      <path d="M6.5 0 V13 M0 6.5 H13" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function Dock({
  placement = 'bottom',
  bars,
  selectedId,
  keyName,
  functions,
  onSelect,
  onRemove,
  onAdd,
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
  /** If given, a + after the last bar adds one (a copy of the open bar). */
  onAdd?: () => void;
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
                {/* THE PANEL'S OWN MARK: a pick-one row, so a dot before the
                    word, lit like a lamp on the bar you're in. */}
                <span className="seg__tick" aria-hidden="true" />
                <span className="dock__sym">{bar.summary.symbol ?? bar.summary.keyName}</span>
                {fn && (
                  <span className={visitor ? 'dock__fn dock__fn--visitor' : 'dock__fn'}>
                    {fn.label}
                  </span>
                )}
                {/* A whole-key bar already says its key in big type. */}
                {bar.summary.symbol && <span className="dock__key">{bar.summary.keyName}</span>}
              </button>
              {/* Every bar has a ×, like a browser tab: always shown on the open
                  bar, the others only while the pointer (or keyboard) is on
                  them. × on the only one left puts the progression away — the
                  panel stays as it was. */}
              <button
                className="dock__remove"
                onClick={() => onRemove(bar.id)}
                aria-label={bars.length > 1 ? `Remove bar ${i + 1}` : 'Clear the progression'}
                title={bars.length > 1 ? 'Remove this bar' : 'Clear the progression'}
              >
                <Cross />
              </button>
            </li>
          );
        })}
      </ol>
      {/* THE NEW-TAB BUTTON: a faint + right after the last bar, as in a
          browser. It adds a copy of the open bar at the end and opens it. */}
      {onAdd && (
        <button
          className="dock__add"
          onClick={onAdd}
          aria-label="Add a bar — a copy of this one"
          title="Add a bar"
        >
          <Plus />
        </button>
      )}
    </nav>
  );
}
