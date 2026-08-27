// ============================================================================
// ui/Segmented.tsx — the either/or control (a connected segmented toggle)
// ----------------------------------------------------------------------------
// The app's control grammar (see DESIGN.md):
//   - this component = choose exactly ONE of these
//   - MultiSelect    = choose any number
//   - accent pill    = an action (▶ Play)
//
// INSIDE THE CONTROLS PANEL (the `fill` variant) the mark is a DOT before the
// word — the same mark MultiSelect uses. That's a deliberate merge: the panel
// now reads as one instrument with one kind of switch, rather than two visual
// languages stacked in the same box. The dot is also just the older convention
// — a radio button IS a filled dot, and always has been.
//
// It does mean the MARK no longer tells you whether a row takes one answer or
// several; the ROW does, because a pick-one row never has two dots filled. If
// that ever proves too subtle, the fix is a rounded square for MultiSelect
// (checkbox) against this round dot (radio), which is the convention people
// already read without being taught.
//
// The dot is on EVERY segmented control, not just the panel's. A page where
// the CONTROLS box marks its choices one way and the row of fingerings just
// below marks them another is the same two-languages problem, only spread over
// more of the page. (The theme switch used to be the exception that justified
// keeping the rule around; it's a sun/moon icon now, so there's no exception
// left to keep it for.)
// ============================================================================

import type { ReactNode } from 'react';

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  fill = false,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string; // what this choice IS, e.g. "Key" or "Fingering"
  className?: string;
  // FILL divides the full measure into equal cells (one grid column per
  // option) instead of sizing each cell to its text. Used inside the controls
  // panel, where every row has to share one measure so the page keeps a left
  // and right edge — see ControlPanel.
  fill?: boolean;
}) {
  const cls = ['seg', fill ? 'seg--fill' : '', className].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      role="radiogroup"
      aria-label={ariaLabel}
      style={fill ? { gridTemplateColumns: `repeat(${options.length}, 1fr)` } : undefined}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'seg__btn seg__btn--on' : 'seg__btn'}
          onClick={() => onChange(o.value)}
        >
          {/* The label is wrapped so the mark travels with the TEXT rather
              than sitting at the edge of its (equal-width) grid cell. */}
          <span className="seg__label">
            <span className="seg__tick" aria-hidden="true" />
            {/* The text truncates, not the label — the label holds the dot, and
                clipping it clips the dot's glow. */}
            <span className="seg__text">{o.label}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
