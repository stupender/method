// ============================================================================
// render/LazySystem.tsx — the notation, fetched only once it's needed
// ----------------------------------------------------------------------------
// VexFlow is about three quarters of this app's download. Everything else —
// the whole theory engine, the fretboard, the audio, React itself — is the
// remaining quarter.
//
// The thing that makes deferring it worthwhile isn't that some screens skip
// notation (they don't; Scales and Harmony both engrave). It's WHERE the
// notation is: below the fold, every time. The fretboard is what someone opens
// this for and it needs none of VexFlow, so the app can paint the neck and let
// the engraving library arrive afterwards.
//
// That matters here more than the numbers suggest, because the audience this
// release is written for taps a link inside WhatsApp on a phone — a cold
// webview, over mobile data, with no cache. Waiting for a notation library
// before drawing a fretboard is the wrong order in that situation.
//
// The placeholder holds the height a system would take, so the page doesn't
// jump when the real one lands.
// ============================================================================

import { Suspense, lazy } from 'react';
import type { PlacedNote } from '../theory/types';

// `lazy` wants a module with a default export and System is a named one, so
// the import is unwrapped here rather than changing how System exports itself
// — the eager import still works everywhere it's used directly.
const System = lazy(() =>
  import('./System').then((m) => ({ default: m.System })),
);

export function LazySystem(props: {
  events: PlacedNote[][];
  strings?: number;
  width?: number;
  /** Passed straight through — see the `keyboard` prop on System. */
  keyboard?: boolean;
}) {
  return (
    <Suspense fallback={<div className="system system--loading" aria-hidden="true" />}>
      <System {...props} />
    </Suspense>
  );
}
