// ============================================================================
// ui/ControlPanel.tsx — the controls, in one measure
// ----------------------------------------------------------------------------
// The structural fix from the "Marks & Measures" sheet (see DESIGN.md).
//
// The problem it solves: every selector used to be sized to its own text, so a
// 12-key track spanned the page, a 2-option track was a stub, and nothing lined
// up with anything. The page had no left edge and no rhythm — which is what
// read as clumsy, far more than the buttons themselves did.
//
// The answer is the shape that's on nearly every image of the Cosmos boards:
// EQUAL CELLS, EVENLY DIVIDED — the nine mark-tiles, the four moons, the
// triptych, the shelves of record spines — plus the Hilma painting's other
// half, a LABEL WRITTEN IN THE MARGIN. So: one outlined block, a fixed label
// column, and rows whose options divide the remaining measure evenly.
//
// ON A PHONE IT FOLDS. Six rows of controls is 580px, which on an 812px screen
// left the fretboard — the thing the app is FOR — as a 77px sliver below the
// fold. The audience for this release taps a link inside WhatsApp on a phone,
// so that's the first screen they get, and it has to open on the neck.
//
// So on a small screen the panel starts CLOSED, showing one line of what it's
// set to, and opens when you ask. It's the same panel either way — nothing is
// hidden from the desktop, and nothing is a different component. The desktop
// stylesheet simply ignores the closed state (see App.css), so there is no
// width at which this can get stuck shut.
// ============================================================================

import { useEffect, useState, type ReactNode } from 'react';

/** Below this the panel folds. Matches the breakpoint the rows already use. */
const NARROW = '(max-width: 640px)';

// The outlined block. `title` is the eyebrow printed at its top left.
export function ControlPanel({
  title = 'Controls',
  action,
  summary,
  children,
}: {
  title?: string;
  // Anything belonging to the panel AS A WHOLE, printed at the right of its
  // title strip. Today that's the bookmark; the reason it lives here rather
  // than in the site bar is that a panel is a MODULE, and the plan is for
  // there to be more than one of them side by side. A module's own controls
  // travel with it.
  action?: ReactNode;
  /**
   * One line saying what the panel is currently set to — "C Major · All ·
   * Scales". Shown in place of the rows while it's folded, so a closed panel
   * still answers the only question a closed panel raises. The panel doesn't
   * know any music, so the caller writes this.
   */
  summary?: ReactNode;
  children: ReactNode;
}) {
  // Starts closed on a phone, open everywhere else. Read once, then kept in
  // step with the viewport — turning a phone sideways past the breakpoint
  // should give you the desktop layout, not a folded version of it.
  const [open, setOpen] = useState(
    () => !window.matchMedia?.(NARROW).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW);
    if (!mq) return;
    const sync = () => setOpen(!mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <section
      className={open ? 'panel' : 'panel panel--folded'}
      aria-label={title}
    >
      <div className="panel__head">
        {/* The title strip IS the handle on a phone — the whole width of it,
            rather than a small chevron to aim at. On a desktop this button is
            still here but the stylesheet gives it nothing to do, because the
            rows are never hidden there. */}
        <button
          className="panel__fold"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`${title}-rows`}
        >
          {/* THE ARROW LEADS. It sits at the far left of the strip and stays
              exactly there whether the panel is open or shut — only its
              direction changes. A control that moves when you use it makes you
              find it again every time; anchored, you can open and close the
              panel without your thumb leaving the spot. */}
          <span className="panel__chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                d="M6 9.5 12 15.5 18 9.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="panel__title">{title}</span>
          {!open && summary && <span className="panel__summary">{summary}</span>}
        </button>
        {action}
      </div>
      <div className="panel__rows" id={`${title}-rows`}>
        {children}
      </div>
    </section>
  );
}

// One row: its name in the margin, its control filling the measure.
export function ControlRow({
  label,
  tight,
  children,
}: {
  label: string;
  /**
   * This row's options are SHORT — a key name, a Roman numeral. Only matters
   * on a phone, where rows wrap: without it twelve keys would wrap at the same
   * generous width as "Harmonic Major" and take four lines to say "C". With
   * it they pack tighter and land in three.
   */
  tight?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={tight ? 'panel__row panel__row--tight' : 'panel__row'}>
      <span className="panel__label">{label}</span>
      <div className="panel__control">{children}</div>
    </div>
  );
}
