// ============================================================================
// ui/PageMarks.tsx — the margin's table of contents
// ----------------------------------------------------------------------------
// A LIVING TEXTBOOK SHOULD READ LIKE ONE. Once you've set a key and a
// fingering, the page below the neck is pages of engraved music: seven modal
// positions, or three or four string sets each holding a key's worth of
// chords. That's a document, and a long document wants the thing every
// note-taking app grew — Notion, Dropbox Paper, Linear — a rail of small marks
// in the right margin, one per section, with the one you're in naming itself.
//
// It's the same idea those apps use for headings, applied to what this app's
// headings actually are: which MODE you're in, or which STRING SET.
//
// WHAT MAKES IT CHEAP is that the app already knew. `useScrollFocus` has been
// deciding which section is under the neck since the neck started floating —
// it's what lights the shape you've scrolled to. The rail draws that same
// answer in the margin, so the mark and the neck can never disagree: they're
// one piece of state seen twice.
//
// AND IT READS BOTH WAYS. Scrolling names the section; pressing a mark goes
// there. A table of contents that only reports would be half a control.
// ============================================================================

export function PageMarks({
  items,
  active,
  onGo,
  label = 'Sections',
}: {
  /** One title per section, in page order — a mode, or a string set. */
  items: string[];
  /** Which one you're in, from the same measurement that lights the neck. */
  active: number | null;
  onGo: (index: number) => void;
  /** What the rail is, for a screen reader. */
  label?: string;
}) {
  // One mark is not a table of contents, it's a dot next to a page.
  if (items.length < 2) return null;

  return (
    <nav className="pagemarks" aria-label={label}>
      {items.map((title, i) => (
        <button
          key={i}
          className={
            i === active ? 'pagemarks__mark pagemarks__mark--on' : 'pagemarks__mark'
          }
          onClick={() => onGo(i)}
          aria-current={i === active ? 'true' : undefined}
          title={title}
        >
          {/* THE LABEL IS ALWAYS IN THE MARKUP, and only sometimes visible.
              Fading it rather than adding and removing it keeps the rail one
              fixed width, so the marks don't shuffle sideways the moment you
              scroll from a section called "Ionian" to one called
              "Mixolydian" — which is exactly the sort of movement that makes
              a margin feel unreliable. */}
          <span className="pagemarks__label">{title}</span>
          <span className="pagemarks__tick" aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}
