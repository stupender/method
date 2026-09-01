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
    /**
   * `short` is the same name at its shortest, shown when the panel is too
   * narrow for the full one. Both are rendered and CSS picks — see
   * `.seg__short` in App.css — so the swap costs no measuring and no state.
   */
  options: { value: T; label: ReactNode; short?: ReactNode }[];
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
      /* NO INLINE COLUMN COUNT. It used to force `repeat(N, 1fr)` — every
         option on ONE line however little room there was — so a long label had
         nowhere to go but inside its own button, and "Half-Diminished (m7♭5)"
         either broke across two lines mid-name or lost its end. The row wraps
         as WHOLE BUTTONS now, laid out by CSS with `auto-fit` and a floor
         width (see `.seg--fill` in App.css). Cells stay equal, which is the
         panel's whole rhythm; there are just as many rows of them as the width
         needs. */
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
              <span className="seg__text">{o.label}</span>
              {o.short !== undefined && (
                <span className="seg__short">{o.short}</span>
              )}
            {o.short !== undefined && (
              <span className="seg__short">{o.short}</span>
            )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
