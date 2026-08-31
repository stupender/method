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
  /** Fretboard or Ear. */
  studyMode: 'fretboard' | 'ear';
  /** Scales or Harmony — the fretboard's two views. */
  view: 'scale' | 'harmony';

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
  earDegrees: number[];
  earViews: ('scale' | 'harmony')[];
  seventhsInEar: boolean;
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
    studyMode: 'fretboard',
    view: 'scale',
    rootIndex: 0,
    scaleId,
    degree: -1, // ALL_DEGREES
    seventh: false,
    structureId: null,
    inversionIndex: 0,
    earRoots: [0],
    earScaleIds: [scaleId],
    earDegrees: [0, 1, 2, 3, 4, 5, 6],
    earViews: ['harmony'],
    seventhsInEar: false,
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
    return Array.isArray(parsed) ? (parsed as Bookmark[]) : [];
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
