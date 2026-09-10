// ============================================================================
// ui/NotationSize.tsx — bigger or smaller notation, your call
// ----------------------------------------------------------------------------
// The engraving is drawn to one number: how many screen pixels one staff line
// sits from the next (see STAFF_PX in render/System.tsx). Ten suits most
// eyes on most screens, and it is emphatically not everyone's ten.
//
// It's a real trade, not a preference about prettiness, which is why it earns
// a control rather than a better default. SMALLER fits more notes on a line,
// so a two-octave run wraps onto fewer systems and a whole string set's worth
// of chords lands in one window. BIGGER is easier to read across a room —
// which is what this app is for, half the time, with a student on the other
// side of it.
//
// IT'S A ROOM SETTING, so it lives in the site bar beside the light. Both
// answer "how does this read to me", neither is about the music, and both are
// remembered in this browser and nowhere else.
// ============================================================================

const STORAGE_KEY = 'method.notation.v1';

/** The range the control walks, in pixels between staff lines. */
export const SMALLEST = 7;
export const LARGEST = 14;
export const DEFAULT_STAFF_PX = 10;
const STEP = 1;

/** Never throws: a broken or absent store reads as the default. */
export function loadStaffPx(): number {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    if (!Number.isFinite(raw) || raw < SMALLEST || raw > LARGEST) {
      return DEFAULT_STAFF_PX;
    }
    return raw;
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

/** Keep a size inside the range, wherever it came from. */
export function clampStaffPx(value: number): number {
  return Math.min(LARGEST, Math.max(SMALLEST, value));
}

export function NotationSize({
  value,
  onStep,
}: {
  value: number;
  /**
   * A STEP, NOT A VALUE. The control could work out the next size itself and
   * hand it over — and then two quick presses would both be computed from the
   * same `value`, because React hasn't re-rendered in between, and the second
   * would do nothing. Reporting the DIRECTION lets the state update from
   * whatever it actually holds. (Found by clicking six times in one tick and
   * moving one step.)
   */
  onStep: (delta: number) => void;
}) {

  return (
    /* TWO MARKS, NOT A SLIDER OR A MENU. There's one axis and no wrong
       answer on it, so the whole control is "a bit more" and "a bit less" —
       and you judge the result by looking at the page rather than at a
       readout. A menu would make you open something to change your mind. */
    <div className="notationsize" role="group" aria-label="Notation size">
      <button
        className="sitebar__act notationsize__step"
        onClick={() => onStep(-STEP)}
        disabled={value <= SMALLEST}
        aria-label="Smaller notation"
        title="Smaller notation — fits more on a line"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {/* The mark between them says what's being sized. A stave, cut down to
          the three lines that still read at 18px — the app's own smallest
          drawing of the thing this control changes. */}
      <span className="notationsize__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            d="M4 8h16M4 12h16M4 16h16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <circle cx="9" cy="14" r="2.6" fill="currentColor" />
          <path d="M11.6 14V6" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </span>
      <button
        className="sitebar__act notationsize__step"
        onClick={() => onStep(STEP)}
        disabled={value >= LARGEST}
        aria-label="Larger notation"
        title="Larger notation — easier to read across a room"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
