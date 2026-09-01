// ============================================================================
// ui/flags.ts — things that are built, and currently switched off
// ----------------------------------------------------------------------------
// Not configuration and not a settings screen: these are decisions we've made
// about what the app shows TODAY, kept as one-line switches so reversing one is
// a one-word edit rather than an archaeology exercise. Each says why it's off.
// ============================================================================

// PLAY BUTTONS ON THE FRETBOARD PAGES — the ▶ on each scale position, each
// chord voicing, and each string-set block.
//
// Off because they're distracting. Every row and every block wore one, which
// put a small bright control beside every piece of content on a page you're
// mostly there to LOOK at; the eye kept going to the buttons instead of the
// shapes. Sound isn't gone — it's just not the first thing on the page any
// more, and the Ear tests (which are entirely about listening) keep theirs.
//
// Set to true to bring them all back; nothing else changes.
export const SHOW_PLAY_BUTTONS = false;

// THE "+ ADD TO PLAY" BUTTON in Harmony.
//
// Off because Play itself is in question. What this app turned out to be good
// at — laying the whole neck out and letting you scroll through it — arrived
// after Play was designed, and Stu wants to USE this before deciding what a
// progression workbench should be. Sending chords to a view nobody has settled
// on is a promise the app can't keep yet.
//
// The songbook underneath it is untouched; this is only the doorway.
export const SHOW_ADD_TO_PLAY = false;

/**
 * SLIDE THE NECK'S DOTS AND LINES when what's on it changes.
 *
 * OFF, deliberately. The idea is a good one — a chord's voices moving from one
 * grip to the next shows you the voice leading, which is a thing worth
 * watching — but making it true in every case turned into a long chase.
 * Matching a note to "the same note a moment ago" has to survive key changes,
 * gravity changes, fingering-system changes and voicing changes, and each of
 * those wants a different answer about what counts as the same note. Several
 * rounds in it was still half right, and half-right motion is worse than none:
 * some dots slid while others blinked, which reads as a bug rather than as
 * movement.
 *
 * So it's off until it can be done properly in one pass, rather than being
 * patched case by case. Everything still lands exactly where it should — it
 * just doesn't travel there.
 *
 * The machinery is all still in render/Fretboard.tsx behind the `animate`
 * prop; flipping this to true turns it back on.
 */
export const NECK_ANIMATION = false;
