// ============================================================================
// ui/Settings.tsx — the app's own settings, behind one mark
// ----------------------------------------------------------------------------
// There is exactly one of these today — how big the notation is drawn — and it
// first shipped as a − / stave / + cluster sitting in the site bar. That was
// three marks for one setting, and three marks that didn't look like anything
// else in the app: the bar's other marks are single, quiet, and open something.
//
// So it opens something. The menu is the app's own small panel (see Menu.tsx),
// and the sizes are named rather than stepped — a row of pick-one choices with
// the same lit dot every other choice in this app wears. Named sizes also say
// what a +/- never did: that this is a SETTING with a resting value, not a dial
// you nudge until it looks right.
//
// It's a room setting, like the light beside it: how this reads to you, kept in
// this browser and nowhere else.
// ============================================================================

import { Menu } from './Menu';

const STORAGE_KEY = 'method.notation.v1';

/**
 * HOW BIG THE NOTATION IS DRAWN, in screen pixels between two staff lines.
 * See STAFF_PX in render/System.tsx for what the number does.
 *
 * It's a real trade, which is why it's a setting and not a better default.
 * SMALL fits more notes on a line, so a two-octave run wraps onto fewer
 * systems and a whole string set's worth of chords lands in one window. LARGE
 * is easier to read across a room — which is what this app is for half the
 * time, with a student on the other side of it.
 */
export const NOTATION_SIZES = [
  { id: 'small', name: 'Small', staffPx: 8 },
  { id: 'medium', name: 'Medium', staffPx: 10 },
  { id: 'large', name: 'Large', staffPx: 13 },
] as const;

export const DEFAULT_STAFF_PX = 10;

/** The nearest named size to a number — so a stored value always lights a row. */
function nearest(px: number): number {
  return NOTATION_SIZES.reduce((best, s) =>
    Math.abs(s.staffPx - px) < Math.abs(best.staffPx - px) ? s : best,
  ).staffPx;
}

/** Never throws: a broken or absent store reads as the default. */
export function loadStaffPx(): number {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(raw) && raw > 0 ? nearest(raw) : DEFAULT_STAFF_PX;
  } catch {
    return DEFAULT_STAFF_PX;
  }
}

export function saveStaffPx(value: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // A full or disabled store shouldn't take the page down with it.
  }
}

export function SettingsMenu({
  staffPx,
  onStaffPx,
}: {
  staffPx: number;
  onStaffPx: (next: number) => void;
}) {
  return (
    <Menu
      title="Settings"
      label="Settings"
      icon={
        /* SLIDERS, not a cog. A cog says "configuration" — a word for a
           preferences window with tabs in it — and this is two or three
           choices about how the page reads. Sliders say "adjust", which is
           what you're doing. Distinct from the saved list's three plain lines
           by the knobs sitting on them. */
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 8h10M18 8h2M4 16h3M11 16h9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          <circle cx="16" cy="8" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="9" cy="16" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      }
    >
      {(close) => (
        <>
          <p className="menu__group menu__group--first">Notation size</p>
          <ul className="menu__list">
            {NOTATION_SIZES.map((s) => (
              <li key={s.id}>
                <button
                  className={
                    s.staffPx === staffPx ? 'menu__item menu__item--on' : 'menu__item'
                  }
                  onClick={() => {
                    onStaffPx(s.staffPx);
                    close();
                  }}
                >
                  <span className="seg__tick" aria-hidden="true" />
                  <span className="menu__name">{s.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Menu>
  );
}
