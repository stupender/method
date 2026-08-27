// ============================================================================
// ui/useScrollFocus.ts — let scrolling be the selection
// ----------------------------------------------------------------------------
// The neck floats at the top of the page while a long list of positions or
// voicings scrolls underneath it. This is what connects the two: whichever card
// is currently sitting under the neck becomes the shape the neck is showing.
//
// It replaces hovering, which was the old way of previewing a shape and had two
// problems — it did nothing at all on a phone, and it made the neck flicker as
// the pointer crossed the page on the way to somewhere else. Scrolling is a
// deliberate act, it works everywhere, and it means simply reading down the
// page is enough to watch each shape light up in turn.
//
// The FOCUS LINE is just below the floating neck: the card nearest to it wins.
// We measure the neck's own box rather than hard-coding a height, so the line
// stays right when the bar grows (the colour key opening under it, say) or the
// layout reflows on a narrow screen — and we find OUR neck by walking up from
// a card, since there can be more than one module on the page.
//
// It measures straight off the scroll event rather than deferring to
// requestAnimationFrame. rAF looks like the careful choice and is the wrong one
// here: browsers already coalesce scroll events to about one per frame, so it
// buys no batching, and rAF is throttled to a standstill whenever the page
// isn't visible — which turns a missed frame into a neck that stops following
// the page. Measuring only reads geometry (no writes), so it can't force a
// second layout pass either way.
// ============================================================================

import { useEffect, useRef } from 'react';

export function useScrollFocus(
  count: number,
  onFocus: (index: number | null) => void,
) {
  const items = useRef<(HTMLElement | null)[]>([]);
  // Keep the latest callback without making it a dependency, so a parent that
  // re-creates the function every render doesn't tear the listener down and put
  // it back on each pass.
  const cb = useRef(onFocus);
  cb.current = onFocus;

  // Hand this to each card: ref={register(i)}.
  const register = (index: number) => (el: HTMLElement | null) => {
    items.current[index] = el;
  };

  useEffect(() => {
    let last: number | null = -1;

    const measure = () => {
      // THE NECK THIS LIST BELONGS TO, not the first one on the page. With two
      // modules side by side there are two floating necks, and a global lookup
      // would measure the left one's while scrolling the right one's list —
      // so the focus line would be in the wrong place for half the page.
      // Walking up from a card finds the right one however many there are.
      const anchor = items.current.find(Boolean);
      const neck =
        anchor?.closest('.module')?.querySelector('.neckpanel') ??
        document.querySelector('.neckpanel');
      // A little below the neck, not right against it — the card you're
      // *reading* sits a bit down the page from where it first appears.
      const line = (neck ? neck.getBoundingClientRect().bottom : 0) + 90;

      let best: number | null = null;
      let bestDistance = Infinity;
      items.current.forEach((el, i) => {
        if (!el) return;
        const box = el.getBoundingClientRect();
        if (box.bottom < 0 || box.top > window.innerHeight) return; // off screen
        // Distance from the focus line to the nearest part of the card, so a
        // tall card straddling the line wins outright rather than losing to a
        // short one whose centre happens to be closer.
        const distance =
          box.top > line ? box.top - line : box.bottom < line ? line - box.bottom : 0;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });

      if (best !== last) {
        last = best;
        cb.current(best);
      }
    };

    measure();
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
    // `count` re-runs it when the list changes length (a new key, scale or
    // voicing), which is exactly when the old measurements stop meaning
    // anything.
  }, [count]);

  return register;
}
