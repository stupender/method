// ============================================================================
// ui/shareCode.ts — a setting you can send to someone
// ----------------------------------------------------------------------------
// A saved setting lives in one browser and nowhere else, which is the honest
// thing to say about it and also a real limit: the setting you've just found
// is often the thing you most want to hand to a student. So a ModuleState can
// be written as a short code, and a code can be read back into one.
//
// IT'S BASE64 OF THE JSON, and deliberately nothing cleverer. A hand-rolled
// packing would be a third the length and would break the first time a field
// is added; this one survives new fields for free, and the only cost is a
// long-ish link. A link is a thing you paste, not a thing you read.
//
// The code goes in the URL's HASH rather than a query string, because this
// ships on GitHub Pages: a hash never reaches a server, so a shared link works
// with no routing at all.
//
//     https://stupender.github.io/method/#s=1eyJpbnN0cnVtZW50SWQiOiJndWl0…
//
// THE LEADING "1" IS A VERSION. If the shape ever changes past what a merge
// over the defaults can absorb, a "2" can mean something else and old links
// can still be read (or refused honestly) rather than decoding into nonsense.
// ============================================================================

import { SCALES } from '../data/scales';
import { defaultModuleState, type ModuleState } from './moduleState';

const VERSION = '1';
const HASH_KEY = 's';

/** Base64 that survives being put in a URL: no +, no /, no padding. */
function toUrlSafe(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromUrlSafe(code: string): string {
  return code.replace(/-/g, '+').replace(/_/g, '/');
}

/** The code for a setting — what a Copy button puts on the clipboard. */
export function encodeState(state: ModuleState): string {
  // `scrollY` is where the page happened to be, not what the panel is set to.
  // It belongs in a bookmark (it's your place) and not in something you hand
  // to someone else, whose window is a different height anyway.
  const { scrollY: _dropped, ...setting } = state;
  const bytes = new TextEncoder().encode(JSON.stringify(setting));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return VERSION + toUrlSafe(btoa(binary));
}

/** The whole link, for a Copy button that's meant to be pasted anywhere. */
export function shareUrl(state: ModuleState): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${HASH_KEY}=${encodeState(state)}`;
}

/**
 * Read a setting back out of whatever was on the clipboard.
 *
 * TAKES A WHOLE URL OR A BARE CODE, because both are things a person will
 * actually paste: the link you were sent, or the code someone pulled out of
 * it. Anything unreadable returns null rather than throwing — a bad paste
 * should be a shrug, not a broken page.
 */
export function decodeState(text: string): ModuleState | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  // A URL carries the code after `#s=`; a bare code is the rest of the string.
  const fromUrl = /[#?&]s=([A-Za-z0-9\-_]+)/.exec(trimmed);
  const code = fromUrl ? fromUrl[1] : trimmed;
  if (code[0] !== VERSION) return null;

  try {
    const binary = atob(fromUrlSafe(code.slice(1)));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return settle(parsed as Partial<ModuleState>);
  } catch {
    return null;
  }
}

/** The setting a shared link is asking for, if this page was opened by one. */
export function stateFromUrl(): ModuleState | null {
  const found = decodeState(window.location.hash);
  if (!found) return null;
  // CLEAR THE HASH once it's been read. Otherwise the link is still in the
  // address bar describing a setting you may since have changed, and a reload
  // would drag you back to it.
  window.history.replaceState(null, '', window.location.pathname);
  return found;
}

/**
 * Make a decoded object safe to hand the app.
 *
 * A code can come from an older version of this app, or from someone editing
 * one by hand. Merging over the defaults guarantees every field exists; the
 * one field worth CHECKING rather than defaulting is the scale, because the
 * views look it up by id and an unknown one would leave them holding nothing.
 */
function settle(partial: Partial<ModuleState>): ModuleState {
  const fallbackScale = Object.keys(SCALES)[0];
  const merged = { ...defaultModuleState(fallbackScale), ...partial };
  if (!SCALES[merged.scaleId]) merged.scaleId = fallbackScale;
  merged.earScaleIds = (merged.earScaleIds ?? []).filter((id) => SCALES[id]);
  if (merged.earScaleIds.length === 0) merged.earScaleIds = [merged.scaleId];
  return merged;
}

/**
 * Put something on the clipboard, and say whether it worked.
 *
 * The old `execCommand` fallback is here on purpose: `navigator.clipboard` is
 * missing on a page served over plain http, which is exactly how this app is
 * read while it's being built.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the older way
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}

/* (There was a `readClipboard` here, for a one-press paste MARK. Safari and
   Firefox both refuse `navigator.clipboard.readText` in most circumstances —
   a reasonable thing for a browser to do about the clipboard — so the mark
   would have silently done nothing for most people. The menu has a field
   instead: no permission, every browser, and visible. See Bookmarks.tsx.) */
