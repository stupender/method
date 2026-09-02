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
        {/* SHOW / HIDE — what the button DOES, not what's behind it.
            "By quality" was a description of the list, printed on the control
            that opens it, and a description isn't an instruction: it left you
            to work out that the words were pressable and that pressing them
            would reveal something. The word "quality" still earns its place —
            it's the one thing being quizzed and worth saying out loud — but it
            belongs over the list it names, which is where it is now.
            Four letters either way, so the row doesn't twitch as it toggles. */}
        <span className="earprogress__more">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <>
          {/* WHAT THE LIST IS CUT BY. Today there's only one answer — quality
              is the whole quiz — and saying it anyway is what makes room for
              the others: when inversion and function arrive, this line is
              already the place that says which one you're reading. */}
          <p className="earprogress__by">By quality</p>
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
