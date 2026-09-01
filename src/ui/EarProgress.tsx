// ============================================================================
// ui/EarProgress.tsx — one number, and what's under it
// ----------------------------------------------------------------------------
// ONE HERO NUMBER PER SCREEN, and the detail only when asked for. The number is
// how much of what you've been played you've named right, all time; underneath
// it, when you open it, is the same question per chord quality — weakest first,
// because that's the order you'd act on.
//
// Weakest first is the whole design. Sorted best-first this would be a trophy
// cabinet; sorted worst-first it's a practice list. Same numbers, opposite use.
//
// It says nothing at all until you've answered something. An empty readout
// offering 0% to someone who hasn't started is a discouraging way to open.
// ============================================================================

import { useState } from 'react';
import { clearProgress, standing, type Progress } from './earStats';
import './EarProgress.css';

export function EarProgress({
  progress,
  quiz,
  /** Turn an item's stored id into something readable — "maj7", not "major-7". */
  nameOf,
  onCleared,
}: {
  progress: Progress;
  quiz: string;
  nameOf: (item: string) => string;
  onCleared: () => void;
}) {
  const [open, setOpen] = useState(false);
  const now = standing(progress, quiz);

  if (now.accuracy === null) return null;

  return (
    <section className="earprogress">
      <button
        className="earprogress__head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="earprogress__figure">{now.accuracy}%</span>
        <span className="earprogress__of">
          {now.correct} of {now.total} heard right
        </span>
        <span className="earprogress__more">{open ? 'Hide' : 'By quality'}</span>
      </button>

      {open && (
        <>
          <ol className="earprogress__list">
            {now.byItem.map((row) => (
              <li key={row.item} className="earprogress__row">
                <span className="earprogress__name">{nameOf(row.item)}</span>
                {/* The bar is the same fact as the number, read at a glance —
                    which is what you want when the list is long enough to
                    scan rather than read. */}
                <span className="earprogress__bar" aria-hidden="true">
                  <span style={{ width: `${row.accuracy}%` }} />
                </span>
                <span className="earprogress__pct">{row.accuracy}%</span>
                <span className="earprogress__count">
                  {row.correct}/{row.total}
                </span>
              </li>
            ))}
          </ol>
          <button
            className="earprogress__clear"
            onClick={() => {
              clearProgress();
              onCleared();
            }}
          >
            Start this over
          </button>
        </>
      )}
    </section>
  );
}
