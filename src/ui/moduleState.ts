// ============================================================================
// ui/moduleState.ts — everything one CONTROLS panel is set to
// ----------------------------------------------------------------------------
// WHY THIS TYPE EXISTS, given nothing yet needs it as one object.
//
// The idea it's built for: a CONTROLS panel, its fretboard and its systems are
// one MODULE, and you could have two of them side by side — a set of triads on
// the left, the set you're moving to on the right, so the thing you're
// practising (getting from here to there) is on screen as one picture. Today
// there's exactly one module and its settings live as a dozen separate pieces
// of state, which is fine while there's one.
//
// A PRESET IS A MODULE'S STATE. That's the whole reason to write this down
// now: if bookmarks save some ad-hoc bag of fields, then side-by-side modules
// later means inventing the real shape and migrating everything that was
// saved. If bookmarks save a ModuleState, then two modules is "render two of
// these", and every preset ever saved already fits.
//
// So this is deliberately the FULL set of choices a panel makes, including the
// ones only one mode uses. It's a description of a panel, not of a bookmark.
// ============================================================================

export interface ModuleState {
  /** Which instrument the neck is drawn as, and how it's strung. Guitar,
   *  baritone ukulele, tenor ukulele — see data/instruments.ts. Part of a
   *  module's state rather than an app-wide setting on purpose: with two
   *  panels open you can put a guitar beside a ukulele and see the same
   *  harmony land on both, which is most of the reason a teacher would want
   *  two panels at all. */
  instrumentId: string;
  tuningId: string;

  /** Fretboard or Ear. */
  studyMode: 'fretboard' | 'ear';
  /** Scales or Harmony — the fretboard's two views. */
  view: 'scale' | 'harmony';

  /** Scales' own choice: which fingering system the position boxes are cut by.
   *  It lives here rather than inside the scale view because it's a SETTING —
   *  as much a part of "what this panel is showing" as the key is — and a
   *  preset that didn't remember it came back in the wrong fingering. */
  fingering: '3nps' | '4nps' | '5nps' | 'caged';

  /** Index into ROOT_CHOICES. */
  rootIndex: number;
  scaleId: string;
  /** 0-based scale degree, or ALL_DEGREES (-1) for the whole key. */
  degree: number;

  // Harmony's three.
  seventh: boolean;
  /** null means "whatever suits this chord type" — close for triads, drop 2
   *  for sevenths. Stored as null rather than resolved, so a preset made with
   *  triads still does the sensible thing when you switch it to sevenths. */
  structureId: string | null;
  inversionIndex: number;

  // Ear's pools. Sets don't survive JSON, so they're stored as arrays and
  // rebuilt on the way back in (see toStored / fromStored).
  earRoots: number[];
  earScaleIds: string[];
  /** Which chord qualities the listening drill may play, by chord id. This
   *  replaced a degree picker, a Scale/Harmony switch and a triads-or-sevenths
   *  toggle — see the note on EarSelection in theory/earMaterial.ts. */
  earQualities: string[];
  /** Which drill. Only 'quality' is offered today; the other two are built and
   *  reachable in code, so this stays rather than being deleted. */
  quiz: 'quality' | 'inversion' | 'function';

  /** Roughly where you were on the page. See the note in Bookmarks.tsx. */
  scrollY?: number;
}

/**
 * What a fresh panel is set to: C major, the whole key, on the fretboard.
 * `scaleId` and the ear pools are passed in rather than hard-coded here,
 * because this file is the SHAPE of a module and shouldn't also be the place
 * that knows which scales exist.
 */
export function defaultModuleState(scaleId: string): ModuleState {
  return {
    instrumentId: 'guitar',
    tuningId: 'guitar-standard',
    studyMode: 'fretboard',
    view: 'scale',
    fingering: '3nps',
    rootIndex: 0,
    scaleId,
    degree: -1, // ALL_DEGREES
    seventh: false,
    structureId: null,
    inversionIndex: 0,
    earRoots: [0],
    earScaleIds: [scaleId],
    earQualities: ['major-triad', 'minor-triad', 'diminished-triad'],
    quiz: 'quality',
  };
}

/**
 * Are these two panels set to the same thing? Ignores scrollY, which records
 * where you happened to be looking rather than what the panel is set TO — a
 * setting you've already saved is still that setting after you scroll.
 */
export function sameSetting(a: ModuleState, b: ModuleState): boolean {
  const strip = ({ scrollY: _ignored, ...rest }: ModuleState) => rest;
  const x = strip(a) as Record<string, unknown>;
  const y = strip(b) as Record<string, unknown>;
  return Object.keys(x).every((k) => {
    const l = x[k];
    const r = y[k];
    if (Array.isArray(l) && Array.isArray(r)) {
      return l.length === r.length && [...l].sort().join() === [...r].sort().join();
    }
    return l === r;
  });
}

export interface Bookmark {
  id: string;
  name: string;
  state: ModuleState;
  savedAt: number;
}

const STORAGE_KEY = 'method.bookmarks.v1';

/** Everything saved, oldest first. Never throws: a broken store reads as empty. */
export function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // FILL IN WHAT A NEWER FIELD ADDED. A bookmark saved before a setting
    // existed has no value for it, and `sameSetting` compares every field — so
    // without this an old bookmark could never match the panel it restored,
    // and its mark stayed hollow right after you'd used it. Any future field
    // gets a line here rather than a migration.
    //
    // What comes out of storage is typed loosely on purpose: it was written by
    // an OLDER version of this app, so it doesn't necessarily have every field
    // a ModuleState has today. Saying `Bookmark[]` here would be a promise the
    // data can't keep.
    type Stored = Omit<Bookmark, 'state'> & {
      state: Omit<Partial<ModuleState>, 'fingering'> & { fingering?: string };
    };
    return (parsed as Stored[]).map((b) => ({
      ...b,
      state: {
        instrumentId: 'guitar',
        tuningId: 'guitar-standard',
        // A bookmark saved before the ear panel was rebuilt has degrees and
        // views instead of qualities; the three major-scale triads are the
        // sensible landing place rather than an empty pool.
        earQualities: ['major-triad', 'minor-triad', 'diminished-triad'],
        ...b.state,
        // AND RETIRED VALUES BECOME THEIR SUCCESSOR. 'box' and 'hybrid' were
        // the old seven-box Positional and Hybrid, which turned out to be the
        // same thing as each other and the wrong count besides; both are the
        // five-shape system now. A bookmark saved under either opens in the
        // system that replaced it rather than falling back to 3nps, which
        // would silently change what you'd saved.
        // 'box' and 'hybrid' were the old seven-box Positional and Hybrid,
        // which turned out to be the same thing as each other and the wrong
        // count besides; 'shapes' was CAGED before it was called that. All
        // three land on CAGED so a bookmark opens in the system that replaced
        // what it was saved under.
        fingering: (
          {
            box: 'caged',
            hybrid: 'caged',
            shapes: 'caged',
          } as Record<string, ModuleState['fingering']>
        )[b.state?.fingering ?? ''] ??
          ((b.state?.fingering as ModuleState['fingering']) ?? '3nps'),
      } as ModuleState,
    }));
  } catch {
    return [];
  }
}

export function saveBookmarks(list: Bookmark[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // A full or disabled store shouldn't take the page down with it.
  }
}

/**
 * A short name for what a preset is set to, used as its default label — "C
 * Major · ii · Sevenths". You can rename it; this is just so a fresh bookmark
 * says something rather than "Bookmark 3".
 */
export function describe(
  state: ModuleState,
  parts: { root: string; scale: string; roman: string | null },
): string {
  const bits = [`${parts.root} ${parts.scale}`];
  if (state.studyMode === 'ear') {
    bits.push('Ear');
  } else {
    if (parts.roman) bits.push(parts.roman);
    if (state.view === 'harmony') bits.push(state.seventh ? 'Sevenths' : 'Triads');
  }
  return bits.join(' · ');
}
