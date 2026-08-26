// ============================================================================
// ui/MultiSelect.tsx — the pick-MANY control
// ----------------------------------------------------------------------------
// Same measure and same equal cells as Segmented, and deliberately so: a row
// of controls should keep its rhythm whether you're choosing one thing or
// several. What changes is the MARK, per the design system (DESIGN.md):
//
//   a rule under the word  = pick exactly one   (Segmented)
//   a filled dot before it = on / off, any number   (this)
//
// That distinction earns its keep in Ear Training, where every extra selection
// simply widens the pool of what might be played at you — picking three keys
// doesn't mean three questions, it means each question could come from any of
// them. On the fretboard the same rows stay pick-one, because a neck can only
// show one key at a time.
//
// Never lets you empty the set: with nothing selected there'd be nothing to
// quiz, so the last remaining choice refuses to switch off.
// ============================================================================

import type { ReactNode } from 'react';

export function MultiSelect<T extends string | number>({
  options,
  values,
  onToggle,
  ariaLabel,
  fill = false,
}: {
  options: { value: T; label: ReactNode }[];
  values: ReadonlySet<T>;
  onToggle: (value: T) => void;
  ariaLabel: string;
  fill?: boolean;
}) {
  return (
    <div
      className={fill ? 'seg seg--fill seg--multi' : 'seg seg--multi'}
      role="group"
      aria-label={ariaLabel}
      style={fill ? { gridTemplateColumns: `repeat(${options.length}, 1fr)` } : undefined}
    >
      {options.map((o) => {
        const on = values.has(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            role="checkbox"
            aria-checked={on}
            className={on ? 'seg__btn seg__btn--picked' : 'seg__btn'}
            onClick={() => onToggle(o.value)}
          >
            <span className="seg__label">
              <span className="seg__tick" aria-hidden="true" />
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
