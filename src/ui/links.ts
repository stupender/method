// ============================================================================
// ui/links.ts — where this app points at the rest of Stu's world
// ----------------------------------------------------------------------------
// One place for the outward links, so changing where the Substack lives is a
// one-line edit rather than a hunt through components.
//
// EMPTY MEANS HIDDEN. Anything left as an empty string simply isn't rendered —
// so a link that hasn't been decided yet can sit here without shipping a dead
// button or a "coming soon" that nobody asked for.
// ============================================================================

/** Stu's site — the teaching this app is a doorway into. */
export const BEING_SOUND = 'https://beingsound.studio';

/**
 * The Substack. FILL THIS IN and the footer's invitation appears; leave it
 * empty and there's simply no invitation, which is the right failure — better
 * a quiet footer than a link that goes nowhere in front of the masterclass
 * group.
 */
export const SUBSTACK = '';

/** Shown beside the copyright. */
export const AUTHOR = 'Stu Pender';
