// ============================================================================
// ui/Bookmarks.tsx — keep the place you found
// ----------------------------------------------------------------------------
// You set a panel to something worth coming back to — a key, a degree, a
// voicing — and then change one control and it's gone. This saves that whole
// setting under a name and puts it back.
//
// It's deliberately the smallest useful version. No folders, no tags, no
// syncing: a list in this browser, a name you can edit, a click to return.
//
// WHAT IT SAVES IS THE POINT. A bookmark holds a ModuleState — the complete set
// of choices a CONTROLS panel makes — not a bag of fields chosen to suit
// bookmarking. A panel, its neck and its systems are one MODULE, and there can
// be two of them side by side; because a preset IS a module's state, every
// bookmark saved before that arrived still fits. See moduleState.ts.
//
// IT COMES IN TWO PIECES, and where each sits says what it belongs to:
//
//   SaveBookmark  — in a panel's own header, because it saves THAT panel. Two
//                   panels, two save buttons. Outline until this exact setting
//                   is already saved, then filled: the mark tells you where you
//                   stand rather than just what the button does.
//   BookmarksMenu — in the site bar, because the list is the whole app's, not
//                   any one panel's.
// ============================================================================

import { useState } from 'react';
import type { Bookmark, ModuleState } from './moduleState';

/** The mark itself: a ribbon with a notch cut from the bottom. */
export function BookmarkIcon({ filled = false }: { filled?: boolean }) {
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

/** In a panel's header: save what this panel is set to. */
export function SaveBookmark({
  saved,
  onSave,
}: {
  /** True when this exact setting is already in the list. */
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <button
      className={saved ? 'panel__act panel__act--on' : 'panel__act'}
      onClick={onSave}
      aria-pressed={saved}
      aria-label={saved ? 'This setting is saved' : 'Save this setting'}
      title={saved ? 'Saved' : 'Save this setting'}
    >
      <BookmarkIcon filled={saved} />
    </button>
  );
}

/** In the site bar: everything saved, and the way back to any of it. */
export function BookmarksMenu({
  list,
  onRestore,
  onRemove,
  onRename,
}: {
  list: Bookmark[];
  onRestore: (state: ModuleState) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const restore = (b: Bookmark) => {
    onRestore(b.state);
    // Put the page back where it was, once the new setting has actually laid
    // out. A saved place is a place on a page that doesn't exist yet at the
    // moment of restoring, so this waits a beat rather than scrolling into the
    // old layout.
    if (typeof b.state.scrollY === 'number') {
      const y = b.state.scrollY;
      setTimeout(() => window.scrollTo({ top: y, behavior: 'smooth' }), 90);
    }
    setOpen(false);
  };

  return (
    <div className="bookmarks">
      <button
        className={open ? 'sitebar__act sitebar__act--on' : 'sitebar__act'}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Saved settings (${list.length})`}
        title="Saved settings"
      >
        {/* A bookmark with lines beside it: the LIST of them, rather than the
            act of saving one. */}
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 3h8a1 1 0 0 1 1 1v15l-5-3.6L4 19V4a1 1 0 0 1 1-1z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M17.5 7h3M17.5 11h3M17.5 15h3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
        {list.length > 0 && <span className="bookmarks__count">{list.length}</span>}
      </button>

      {open && (
        <div className="bookmarks__list">
          {list.length === 0 ? (
            <p className="bookmarks__empty">
              Nothing saved yet. The bookmark in a panel's corner keeps whatever
              it's set to.
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
                    onChange={(e) => onRename(b.id, e.target.value)}
                  />
                  <button
                    className="bookmarks__remove"
                    onClick={() => onRemove(b.id)}
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
