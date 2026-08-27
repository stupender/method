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
// ============================================================================

import type { ReactNode } from 'react';

// The outlined block. `title` is the eyebrow printed at its top left.
export function ControlPanel({
  title = 'Controls',
  action,
  children,
}: {
  title?: string;
  // Anything belonging to the panel AS A WHOLE, printed at the right of its
  // title strip. Today that's the bookmark; the reason it lives here rather
  // than in the site bar is that a panel is a MODULE, and the plan is for
  // there to be more than one of them side by side. A module's own controls
  // travel with it.
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel" aria-label={title}>
      <div className="panel__head">
        <p className="panel__title">{title}</p>
        {action}
      </div>
      <div className="panel__rows">{children}</div>
    </section>
  );
}

// One row: its name in the margin, its control filling the measure.
export function ControlRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="panel__row">
      <span className="panel__label">{label}</span>
      <div className="panel__control">{children}</div>
    </div>
  );
}
