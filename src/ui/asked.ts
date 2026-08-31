// ============================================================================
// ui/asked.ts — remembering that we already asked
// ----------------------------------------------------------------------------
// The invitation to join the mailing list appears ONCE. This is the whole of
// the memory that makes that true: two marks in this browser, one for "joined"
// and one for "said no". Either means don't ask again.
//
// Its own file for the same reason the bookmark store is (see moduleState.ts):
// the component draws a form, this remembers a fact, and they change for
// different reasons. Storage that never throws, so a private window or a
// browser with site data switched off just means being asked another day —
// never a page that fails to render.
// ============================================================================

const SUBSCRIBED_KEY = 'method.subscribed.v1';
const DISMISSED_KEY = 'method.invited.v1';

function mark(key: string): void {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* private window, or storage switched off */
  }
}

function has(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/** Have they already joined, or already said no? Then don't ask again. */
export function alreadyAsked(): boolean {
  return has(SUBSCRIBED_KEY) || has(DISMISSED_KEY);
}

export function markSubscribed(): void {
  mark(SUBSCRIBED_KEY);
}

export function markDismissed(): void {
  mark(DISMISSED_KEY);
}
