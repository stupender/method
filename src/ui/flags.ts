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
