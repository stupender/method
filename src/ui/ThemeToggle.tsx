// ============================================================================
// ui/ThemeToggle.tsx — paper or night, as one icon
// ----------------------------------------------------------------------------
// This was a two-word segmented track reading "Paper | Night". Two words and a
// selection mark for a setting with two states, sitting in a bar whose whole
// job is to stay out of the way — the control was bigger than the decision.
//
// One button now, and it shows WHERE IT TAKES YOU rather than where you are: a
// moon while you're on paper, a sun while you're in the dark. That's the
// convention everywhere else, and it's the more useful of the two readings —
// you can already see which theme you're in by looking at the page.
//
// Drawn inline rather than pulled from an icon set: two shapes at this size
// aren't worth a dependency, and these inherit `currentColor` so they follow
// the bar's own ink in both worlds.
// ============================================================================

export function ThemeToggle({
  theme,
  onChange,
}: {
  theme: 'paper' | 'night';
  onChange: (theme: 'paper' | 'night') => void;
}) {
  const next = theme === 'paper' ? 'night' : 'paper';
  return (
    <button
      className="themetoggle"
      onClick={() => onChange(next)}
      aria-label={next === 'night' ? 'Switch to night' : 'Switch to paper'}
      title={next === 'night' ? 'Night' : 'Paper'}
    >
      {theme === 'paper' ? (
        // A moon: one disc with another bitten out of it.
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
            fill="currentColor"
          />
        </svg>
      ) : (
        // A sun: a disc and eight rays.
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.6" fill="currentColor" />
          <g
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            fill="none"
          >
            <line x1="12" y1="1.6" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22.4" />
            <line x1="1.6" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22.4" y2="12" />
            <line x1="4.7" y1="4.7" x2="6.4" y2="6.4" />
            <line x1="17.6" y1="17.6" x2="19.3" y2="19.3" />
            <line x1="19.3" y1="4.7" x2="17.6" y2="6.4" />
            <line x1="6.4" y1="17.6" x2="4.7" y2="19.3" />
          </g>
        </svg>
      )}
    </button>
  );
}
