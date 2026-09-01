// ============================================================================
// render/Board.tsx — draw whatever instrument you were handed
// ----------------------------------------------------------------------------
// One line of real code, and it's the seam that keeps the instrument model
// honest. Every view above asks for "the board" and passes an Instrument; this
// picks the drawing that instrument calls for. A view never asks "is this a
// guitar?", which is the whole point — the day a dulcimer arrives, it arrives
// here and nowhere else.
//
// The two drawings take the same props on purpose, so this is a swap and not a
// translation. See Fretboard.tsx and Keyboard.tsx.
// ============================================================================

import { Fretboard, type FretboardProps } from './Fretboard';
import { Keyboard } from './Keyboard';

export function Board(props: FretboardProps) {
  return props.instrument.layout === 'keys' ? (
    <Keyboard {...props} />
  ) : (
    <Fretboard {...props} />
  );
}
