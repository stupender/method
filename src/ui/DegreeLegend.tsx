// ============================================================================
// ui/DegreeLegend.tsx — what the colours mean, and what you're in
// ----------------------------------------------------------------------------
// The dots on the neck print NOTE NAMES and carry the scale degree in their
// colour — two facts at once, with no toggle to lose track of. This is the key
// to that: the seven degrees in order, each in its own ink, with the note it
// currently lands on.
//
// It used to hide in a drawer behind a button in the site bar. It lives on the
// neck now, above the fretboard and floating with it, because of what it's
// actually for: you look up mid-phrase having forgotten which key you're in.
// A reference you have to go and open is a reference you don't consult.
//
// It also no longer says "Gravity" over itself. Sitting under the scale's name
// on the fretboard, the row plainly IS the key — and "Gravity" was competing
// with the CONTROLS row of the same name, which is a different thing (which
// degree is framed) wearing the same word.
//
// A reference, not a control — nothing here is clickable.
// ============================================================================

import type { Note, ScaleDefinition } from '../theory/types';
import { realizeScale } from '../theory/scale';
import { noteName } from '../theory/notes';

export function DegreeLegend({ root, scale }: { root: Note; scale: ScaleDefinition }) {
  const tones = realizeScale(root, scale);
  return (
    <ol className="legend" aria-label="What each dot colour means">
      {tones.map((tone, i) => (
        <li className="legend__item" key={i}>
          <span className={`legend__dot legend__dot--deg${i + 1}`}>{i + 1}</span>
          <span className="legend__note">{noteName(tone.note)}</span>
        </li>
      ))}
    </ol>
  );
}
