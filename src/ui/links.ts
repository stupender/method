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
 * The Substack. Empty would mean no invitation is rendered at all — better a
 * quiet footer than a link that goes nowhere.
 */
export const SUBSTACK = 'https://beingsound.substack.com';

/** Shown beside the copyright. */
export const AUTHOR = 'Stu Pender';

/**
 * Where feedback goes while this is in beta.
 *
 * DELIBERATELY BLANK. Putting an address in a public page publishes it — to
 * scrapers as much as to guitarists — so which one appears here is Stu's call,
 * not something to be filled in from whatever address happened to be to hand.
 * A role address (hello@beingsound.studio) is the usual answer; a personal one
 * is fine too, but it should be chosen.
 *
 * Empty renders no link at all, same as the Substack above.
 */
export const FEEDBACK_EMAIL = '';

/**
 * A subject line the message arrives with, so beta notes sort themselves out
 * of an inbox without anyone having to remember to label them.
 */
export const FEEDBACK_SUBJECT = 'Fretboard Constellations';
