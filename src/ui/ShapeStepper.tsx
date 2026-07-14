// ============================================================================
// ui/ShapeStepper.tsx — step through the TAB shapes one at a time
// ----------------------------------------------------------------------------
// In Possibility the TAB shows a row of shapes you play one after another —
// scale positions up the neck, the rungs of a chord scale, a chord's voicings.
// This lets you WALK that row: the ‹ › buttons, or the ← → arrow keys, move the
// selection to the next/previous shape (and play it, since that's how you'd
// actually use it). Wraps at the ends so you can loop up the neck.
//
// Two parts, kept together because they're always used together: a `useStepper`
// hook (owns the arrow keys) and the `ShapeStepper` button control.
// ============================================================================

import { useEffect, type RefObject } from 'react';

// Bind ← / → to stepping, and hand back a `step(delta)` for the buttons. The
// keys only act when THIS view is actually on screen (the app keeps the other
// areas mounted-but-hidden, so we check the container's visibility) and never
// while the user is typing in a field. `current` is the selected index (or null
// = nothing selected yet — the first step then lands on the first/last shape).
export function useStepper(
  containerRef: RefObject<HTMLElement | null>,
  count: number,
  current: number | null,
  onSelect: (i: number) => void,
): (delta: 1 | -1) => void {
  const step = (delta: 1 | -1) => {
    if (count <= 0) return;
    const next =
      current == null ? (delta === 1 ? 0 : count - 1) : (current + delta + count) % count;
    onSelect(next);
  };

  useEffect(() => {
    if (count <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const el = containerRef.current;
      if (!el || el.offsetParent === null) return; // this view is hidden — ignore
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        return; // don't hijack arrow keys inside text fields
      }
      e.preventDefault();
      step(e.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Re-bind when `current` changes so the closure always steps from the latest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, count, current, onSelect]);

  return step;
}

// The ‹ 3 / 7 › control. Hidden when there's nothing to step through (0–1
// shapes). `label` names the thing being stepped, for the screen-reader labels.
export function ShapeStepper({
  index,
  count,
  onStep,
  label = 'shape',
}: {
  index: number | null;
  count: number;
  onStep: (delta: 1 | -1) => void;
  label?: string;
}) {
  if (count <= 1) return null;
  return (
    <div className="stepper" role="group" aria-label={`Step ${label}`}>
      <button
        className="pill pill--tiny"
        aria-label={`Previous ${label}`}
        onClick={() => onStep(-1)}
      >
        ‹
      </button>
      <span className="stepper__count" aria-live="polite">
        {index == null ? '—' : index + 1} / {count}
      </span>
      <button
        className="pill pill--tiny"
        aria-label={`Next ${label}`}
        onClick={() => onStep(1)}
      >
        ›
      </button>
    </div>
  );
}
