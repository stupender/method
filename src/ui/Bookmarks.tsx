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
//   BookmarksMenu — in the SAME title strip, beside it. The list is the whole
//                   app's, but going back to a saved setting has to happen
//                   somewhere, and in the site bar it couldn't say WHERE: with
//                   two panels open, "which side does this load into?" had no
//                   answer. A list in each panel's own strip makes the
//                   question disappear rather than answering it — the panel
//                   you asked from is the panel that changes.
//                   Minimal on purpose: three lines, no count. It's a way
//                   back, not a readout.
// ============================================================================

import { useState } from 'react';
import type { Bookmark, ModuleState } from './moduleState';
import { Menu } from './Menu';

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

/**
 * In a panel's header: save what this panel is set to — and unsave it.
 *
 * A TOGGLE, not an "add". It used to only ever add, so pressing it twice on
 * the same setting saved that setting twice, and there was no way to undo a
 * save from the place you made it. Since the mark already tells you whether
 * this exact setting is saved, the button that draws the mark is the obvious
 * place to change it.
 */
export function SaveBookmark({
  saved,
  onToggle,
}: {
  /** True when this exact setting is already in the list. */
  saved: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={saved ? 'panel__act panel__act--on' : 'panel__act'}
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={saved ? 'Saved — remove from saved settings' : 'Save this setting'}
      title={saved ? 'Saved — click to remove' : 'Save this setting'}
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
  // Which row is being renamed, if any. Renaming is a mode now rather than the
  // row's permanent state — see the note on the name button below.
  const [editing, setEditing] = useState<string | null>(null);

  const restore = (b: Bookmark, close: () => void) => {
    // The panel does the rest — setting itself, and putting the page back
    // where it was. See restoreSetting in App.tsx.
    onRestore(b.state);
    setEditing(null);
    close();
  };

  return (
    <Menu
      title="Saved settings"
      variant="panel"
      label="Saved settings"
      icon={
        /* Just a list. The earlier icon was a bookmark WITH lines beside it,
           trying to say "the list of bookmarks" in one drawing — which read as
           a busy version of the save button rather than as something else.
           Three lines is what every list has looked like for forty years, and
           the button next to it is already the bookmark. */
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 7h16M4 12h16M4 17h10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      }
    >
      {(close) =>
        list.length === 0 ? (
          <p className="menu__empty">
            Nothing saved yet. The bookmark in a panel's corner keeps whatever
            it's set to.
          </p>
        ) : (
          <ul className="menu__list">
            {[...list].reverse().map((b) => (
              <li key={b.id} className="menu__row">
                {/* THE NAME IS THE BUTTON. It used to be an editable field
                    with a ↩ beside it, which got the priorities backwards
                    twice over: clicking the obvious target — the name —
                    dropped a text caret into it instead of taking you there,
                    and the thing that DID take you there was an arrow that
                    reads as "back". Going to a saved setting is what you want
                    ninety-nine times in a hundred, so it's the whole row.
                    Renaming is the rare one, so it's a double-click. */}
                {editing === b.id ? (
                  <input
                    className="menu__rename"
                    value={b.name}
                    aria-label={`Rename ${b.name}`}
                    autoFocus
                    onChange={(e) => onRename(b.id, e.target.value)}
                    onBlur={() => setEditing(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        // Don't let Escape reach the menu and close it — here
                        // it means "stop renaming", which is the smaller of
                        // the two things it could mean and the nearer one.
                        e.stopPropagation();
                        setEditing(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    className="menu__item"
                    onClick={() => restore(b, close)}
                    onDoubleClick={() => setEditing(b.id)}
                    title={`Go to ${b.name} — double-click to rename`}
                  >
                    {/* THE SAVE BUTTON'S OWN MARK, quietly, at the head of
                        every row — so the list is visibly the thing that
                        button fills. A lit dot would be wrong here: a dot in
                        this app means "this is the one you're on", and a menu
                        of saved places has no current one. */}
                    <span className="menu__mark" aria-hidden="true">
                      <BookmarkIcon />
                    </span>
                    <span className="menu__name">{b.name}</span>
                  </button>
                )}
                <button
                  className="menu__remove"
                  onClick={() => onRemove(b.id)}
                  aria-label={`Remove ${b.name}`}
                  title="Remove"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )
      }
    </Menu>
  );
}
