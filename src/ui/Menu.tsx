// ============================================================================
// ui/Menu.tsx — a menu is a small panel
// ----------------------------------------------------------------------------
// WHY THIS EXISTS. The two menus in the site bar — what's in your hands, and
// what you've saved — each grew their own box: a rounded card with a drop
// shadow, floating under an icon, with rows styled to taste. Nothing else in
// this app looks like that. Everything else is a flat outlined BLOCK on paper,
// with a title strip across the top and rows underneath: the CONTROLS panel,
// the neck, the voicing sets. Two floating cards in a room of printed blocks
// read as an afterthought, because that's what they were.
//
// So a menu is a small panel now, and this file is the one place that says so.
// Same hairline border, same square corners, same title strip in the same
// uppercase eyebrow, same ground. No shadow: nothing in this app casts one,
// and a hairline on solid stock is how a printed thing sits on a page.
//
// It also does the two things both menus were missing and neither should have
// had to implement twice: it CLOSES when you click away, and it closes on
// Escape with the focus put back on the button that opened it.
//
// `children` is a function so an item can close the menu after acting — the
// alternative was passing a setter down or reaching for context, and a menu
// that hands you its own close is the plainer of the three.
// ============================================================================

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Menu({
  title,
  icon,
  label,
  badge,
  children,
}: {
  /** The eyebrow across the menu's title strip — "Instrument". */
  title: string;
  /** The mark on the button that opens it. */
  icon: ReactNode;
  /** What the button is, for screen readers and the tooltip. */
  label: string;
  /** An optional small figure beside the icon, e.g. how many are saved. */
  badge?: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    // POINTERDOWN, NOT CLICK. A click fires after the mouse comes back up, so
    // pressing a control behind the menu would run that control AND close the
    // menu; on pointerdown the menu is gone before the press lands anywhere.
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      // Escape puts you back where you were, which is the button you opened it
      // with — otherwise focus is left on nothing and the next Tab starts from
      // the top of the page.
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <div className="menu" ref={wrap}>
      <button
        ref={trigger}
        className={open ? 'sitebar__act sitebar__act--on' : 'sitebar__act'}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        {icon}
        {badge}
      </button>

      {open && (
        <div className="menu__panel" role="dialog" aria-label={title}>
          <div className="menu__head">
            <span className="menu__title">{title}</span>
          </div>
          <div className="menu__body">{children(close)}</div>
        </div>
      )}
    </div>
  );
}

/**
 * A heading WITHIN a menu, for a menu that holds more than one list — the
 * instrument menu's "Tuning" under its instruments. Set smaller and quieter
 * than the strip above, because it's a subdivision of that strip rather than a
 * second one of it.
 */
export function MenuGroup({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <>
      {label && <p className="menu__group">{label}</p>}
      <ul className="menu__list">{children}</ul>
    </>
  );
}
