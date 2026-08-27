// ============================================================================
// ui/NeckPanel.tsx — the fretboard, floating
// ----------------------------------------------------------------------------
// The neck used to scroll away the moment you started reading the positions or
// voicings underneath it, which is the wrong way round: the list is the index
// and the neck is the thing you're actually looking at.
//
// So it's a panel now, in the same printed-block language as CONTROLS — an
// eyebrow in the margin, one outlined box — and it STICKS under the site bar
// while everything else scrolls past. Its bottom corners are square and it
// carries no bottom border, so the block that follows joins onto it: the neck
// and the list it belongs to read as one object rather than two.
//
// What's lit on it comes from whatever you've scrolled to (see useScrollFocus).
// ============================================================================

import type { ReactNode } from 'react';

export function NeckPanel({
  title = 'Fretboard',
  aside,
  children,
}: {
  title?: string;
  // Optional right-hand note in the header — the name of whatever is currently
  // lit, so the neck says what it's showing.
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="neckpanel" aria-label={title}>
      <header className="neckpanel__head">
        <span className="neckpanel__title">{title}</span>
        {aside && <span className="neckpanel__aside">{aside}</span>}
      </header>
      {children}
    </section>
  );
}
