// ============================================================================
// ui/Segmented.tsx — the either/or control (a connected segmented toggle)
// ----------------------------------------------------------------------------
// The app's control grammar (see DESIGN.md):
//   - SEGMENTED TRACK  = choose exactly ONE of these  (this component)
//   - pill             = an independent on/off toggle, or a multi-select pool
//   - accent pill      = an action (▶ Play)
//
// Visually: a gently recessed track holds the options as one connected unit;
// the chosen segment sits raised on it like a paper chip. That makes "these are
// alternatives" legible at a glance, where a row of separate pills doesn't.
// ============================================================================

import type { ReactNode } from 'react';

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string; // what this choice IS, e.g. "Key" or "Fingering"
  className?: string;
}) {
  return (
    <div className={className ? `seg ${className}` : 'seg'} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'seg__btn seg__btn--on' : 'seg__btn'}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
