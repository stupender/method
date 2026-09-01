// ============================================================================
// ui/NeckPanel.tsx — the fretboard, floating, with its bearings attached
// ----------------------------------------------------------------------------
// The neck used to scroll away the moment you started reading the positions or
// voicings underneath it, which is the wrong way round: the list is the index
// and the neck is the thing you're actually looking at. So it's a panel now, in
// the same printed-block language as CONTROLS, and it STICKS under the site bar
// while everything else scrolls past. Its bottom corners are square and it has
// no bottom border, so the block that follows joins onto it.
//
// It also carries WHERE YOU ARE. The scale's name and the colour key used to
// live in two other places — a title in the gap between the controls and the
// neck, and a drawer behind a button in the bar — and both had the same
// problem: they weren't there when you needed them. What you forget mid-phrase
// is exactly which key you're in and which colour the 6th is, and by then
// you've scrolled the title away and you're not going to go hunting for a
// drawer. Pinned to the neck, they're simply always true and always visible.
//
// So the header reads: what you're in, then what's lit on the neck right now,
// then the seven colours and the notes they've landed on.
// ============================================================================

import type { ReactNode } from 'react';

export function NeckPanel({
  name,
  legend,
  aside,
  onPickAll,
  allShowing,
  children,
}: {
  // What you're in — "C Major", "D Dorian", "Dm7".
  name?: ReactNode;
  // The colour key for that same centre.
  legend?: ReactNode;
  // What's lit right now, from whatever you've scrolled to.
  aside?: ReactNode;
  /**
   * THE NAME IS THE WAY BACK TO THE WHOLE SCALE. There used to be an "All
   * notes" card above the positions doing this job, which meant the list of
   * positions began with something that wasn't a position. The scale's name is
   * already sitting at the top of the neck saying what the whole thing is, so
   * pressing it to SEE the whole thing needs no new control and no explaining.
   * Omit the handler and the name is plain text, as it is in Harmony.
   */
  onPickAll?: () => void;
  /** True while the whole scale is showing, so the name can read as chosen. */
  allShowing?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="neckpanel" aria-label="Fretboard">
      {/* One line where there's room — the name at the left, the colour key
          filling the width beside it — and two when there isn't. The header is
          a flex row that wraps, so the break happens when the key stops fitting
          rather than at a width someone guessed. */}
      <header className="neckpanel__head">
        <div className="neckpanel__titles">
          {name &&
            (onPickAll ? (
              <button
                className={
                  allShowing
                    ? 'neckpanel__name neckpanel__name--all'
                    : 'neckpanel__name'
                }
                onClick={onPickAll}
                aria-pressed={allShowing}
                title="Show the whole scale across the neck"
              >
                {name}
              </button>
            ) : (
              <span className="neckpanel__name">{name}</span>
            ))}
          {aside && <span className="neckpanel__aside">{aside}</span>}
        </div>
        {legend && <div className="neckpanel__legend">{legend}</div>}
      </header>
      {/* The board gets its own box so that on a phone it can SCROLL SIDEWAYS
          inside the panel — the neck is drawn at a readable size there and you
          swipe along it, rather than seventeen frets being squeezed into a
          phone's width and becoming unreadable. On a desktop this box does
          nothing at all. See the note in App.css. */}
      <div className="neckpanel__board">{children}</div>
    </section>
  );
}
