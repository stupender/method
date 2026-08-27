// ============================================================================
// ui/Bookmarks.tsx — keep the place you found
// ----------------------------------------------------------------------------
// You set the panel to something worth coming back to — a key, a degree, a
// voicing, the block you'd scrolled to — and then you change one control and
// it's gone. This saves that whole setting under a name and puts it back.
//
// It's deliberately the smallest useful version. No folders, no tags, no
// syncing: a list in this browser, a name you can edit, and a click to return.
//
// WHAT IT SAVES IS THE POINT. A bookmark holds a ModuleState — the complete
// set of choices a CONTROLS panel makes — not a bag of fields chosen to suit
// bookmarking. That's because of where this is heading: a panel, its neck and
// its systems as one MODULE, two of them side by side to practise moving from
// one shape to another. When that arrives, a preset already IS a module, and
// every bookmark saved before it still fits. See moduleState.ts.
//
// The control lives in the CONTROLS panel's own header rather than in the site
// bar, for the same reason: it belongs to the panel. Two panels, two save
// buttons, no rework.
// ============================================================================

import { useState } from 'react';
import type { Bookmark, ModuleState } from './moduleState';
import { loadBookmarks, saveBookmarks } from './moduleState';

export function Bookmarks({
  current,
  label,
  onRestore,
}: {
  /** What the panel is set to right now. */
  current: () => ModuleState;
  /** A default name for a new bookmark, describing that setting. */
  label: string;
  onRestore: (state: ModuleState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Bookmark[]>(() => loadBookmarks());

  const write = (next: Bookmark[]) => {
    setList(next);
    saveBookmarks(next);
  };

  const add = () => {
    const state = current();
    write([
      ...list,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: label,
        state,
        savedAt: Date.now(),
      },
    ]);
    setOpen(true);
  };

  const remove = (id: string) => write(list.filter((b) => b.id !== id));

  const rename = (id: string, name: string) =>
    write(list.map((b) => (b.id === id ? { ...b, name } : b)));

  const restore = (b: Bookmark) => {
    onRestore(b.state);
    // Put the page back where it was, once the new state has actually laid
    // out. A saved place is a place on a page that doesn't exist yet at the
    // moment of restoring — so this waits a beat rather than scrolling into
    // the old layout.
    if (typeof b.state.scrollY === 'number') {
      const y = b.state.scrollY;
      setTimeout(() => window.scrollTo({ top: y, behavior: 'smooth' }), 80);
    }
    setOpen(false);
  };

  return (
    <div className="bookmarks">
      <button
        className="bookmarks__save"
        onClick={add}
        aria-label="Save this setting"
        title="Save this setting"
      >
        <BookmarkIcon filled />
      </button>
      <button
        className={open ? 'bookmarks__open bookmarks__open--on' : 'bookmarks__open'}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Saved settings (${list.length})`}
        title="Saved settings"
      >
        <BookmarkIcon />
        {list.length > 0 && <span className="bookmarks__count">{list.length}</span>}
      </button>

      {open && (
        <div className="bookmarks__list">
          {list.length === 0 ? (
            <p className="bookmarks__empty">
              Nothing saved yet. The filled bookmark keeps whatever the panel is
              set to.
            </p>
          ) : (
            <ul>
              {[...list].reverse().map((b) => (
                <li key={b.id} className="bookmarks__item">
                  {/* The arrow goes there; the name is an editable field, so
                      renaming needs no separate mode. */}
                  <button
                    className="bookmarks__go"
                    onClick={() => restore(b)}
                    aria-label={`Go to ${b.name}`}
                    title="Go to this setting"
                  >
                    ↩
                  </button>
                  <input
                    className="bookmarks__rename"
                    value={b.name}
                    aria-label="Rename"
                    onChange={(e) => rename(b.id, e.target.value)}
                  />
                  <button
                    className="bookmarks__remove"
                    onClick={() => remove(b.id)}
                    aria-label={`Remove ${b.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// A bookmark: the ribbon with a notch cut out of the bottom.
function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 3h12a1 1 0 0 1 1 1v17l-7-5-7 5V4a1 1 0 0 1 1-1z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
