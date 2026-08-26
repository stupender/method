// ============================================================================
// ui/DegreeLegend.tsx — what the colours mean
// ----------------------------------------------------------------------------
// The dots print NOTE NAMES, and their colour carries the scale degree — two
// facts at once, with no toggle to lose track of. That only works if the
// colour code is legible, so this is the key to it: the seven degrees in
// order, each in its own ink, with the note it currently lands on.
//
// It's a reference, not a control — nothing here is clickable.
// ============================================================================

import type { Note, ScaleDefinition } from '../theory/types';
import { realizeScale } from '../theory/scale';
import { noteName } from '../theory/notes';

export function DegreeLegend({ root, scale }: { root: Note; scale: ScaleDefinition }) {
  const tones = realizeScale(root, scale);
  return (
    <div className="legend" role="img" aria-label="What each dot colour means">
      <span className="legend__title">Gravity</span>
      <ol className="legend__items">
        {tones.map((tone, i) => (
          <li className="legend__item" key={i}>
            <span className={`legend__dot legend__dot--deg${i + 1}`}>{i + 1}</span>
            <span className="legend__note">{noteName(tone.note)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
