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

/**
 * COUNTING IN THIRDS — BUILT, AND NOT SWITCHED ON.
 *
 * Nothing passes `stacked` today. Stu's call: the row stays 1-7 everywhere
 * until the app actually deals in 9ths, 11ths and 13ths, because numbering
 * degrees as extensions before you can play any is a promise the rest of the
 * app doesn't keep yet. When the chord data grows extensions, pass `stacked`
 * from the two Harmony ladders and it's done.
 *
 * Kept rather than deleted for the reason CLAUDE.md gives: a flagged feature
 * stays compiled and type-checked, a commented-out one rots.
 *
 * HARMONY COUNTS IN THIRDS, so the legend does too when it's sitting over
 * chords. Stacked from the root a third at a time you get 1 3 5 7 9 11 13 —
 * the 9th, 11th and 13th being the 2nd, 4th and 6th an octave up. They aren't
 * different notes; they're the same seven degrees named the way you'd name
 * them while building a chord out of them, which is what Harmony is for.
 *
 * The row is REORDERED into that stack rather than relabelled in place. Kept
 * in scale order the numbers read 1, 9, 3, 11, 5, 13, 7, which looks scrambled
 * and hides the thing worth seeing: in the stack, the first four dots are the
 * seventh chord and the last three are its extensions, in the order you'd add
 * them.
 */
const TERTIAN = [
  { degree: 0, label: '1' },
  { degree: 2, label: '3' },
  { degree: 4, label: '5' },
  { degree: 6, label: '7' },
  { degree: 1, label: '9' },
  { degree: 3, label: '11' },
  { degree: 5, label: '13' },
];

export function DegreeLegend({
  root,
  scale,
  stacked = false,
}: {
  root: Note;
  scale: ScaleDefinition;
  /** Count in thirds — 1 3 5 7 9 11 13 — rather than up the scale. */
  stacked?: boolean;
}) {
  const tones = realizeScale(root, scale);

  // Only for seven-note scales: the stack is a statement about thirds, and a
  // scale with a different number of degrees doesn't make it.
  if (stacked && tones.length === TERTIAN.length) {
    return (
      <ol className="legend" aria-label="What each dot colour means">
        {TERTIAN.map(({ degree, label }) => (
          <li className="legend__item" key={degree}>
            <span className="legend__degree">{label}</span>
            {/* The COLOUR still says which degree of the scale it is — that
                never changes, whatever the number in front of it reads. */}
            <span className={`legend__dot legend__dot--deg${degree + 1}`}>
              {noteName(tones[degree].note)}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="legend" aria-label="What each dot colour means">
      {tones.map((tone, i) => (
        <li className="legend__item" key={i}>
          {/* The dot holds the NOTE, exactly as it does on the neck below, and
              the degree is the small numeral in front of it. It used to be the
              other way round — number in the dot, note trailing after it —
              which made the key's dots a different object from the fretboard's
              and left you translating between them. Now the row is literally a
              sample of the neck, with the degree annotating it. */}
          <span className="legend__degree">{i + 1}</span>
          <span className={`legend__dot legend__dot--deg${i + 1}`}>
            {noteName(tone.note)}
          </span>
        </li>
      ))}
    </ol>
  );
}
