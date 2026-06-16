// ============================================================================
// render/TabView.tsx — a small TAB diagram for one chord voicing
// ----------------------------------------------------------------------------
// RENDER layer. Given the placed notes of a chord (PlacedNote[]) it draws
// guitar TAB: one line per string, the fret number on the strings that are
// played, and "x" on the strings that are muted. Standard TAB reads with the
// HIGHEST string on top, so we display string indices from high down to low.
// Like the Fretboard, it holds no music theory — it just prints fret numbers.
// ============================================================================

import type { Instrument, Tuning, PlacedNote } from '../theory/types';
import { noteName } from '../theory/notes';
import './TabView.css';

interface TabViewProps {
  instrument: Instrument;
  tuning: Tuning;
  placed: PlacedNote[];
}

export function TabView({ instrument, tuning, placed }: TabViewProps) {
  // Quick lookup: string index -> the fret played on it (if any).
  const fretByString = new Map<number, number>();
  for (const p of placed) {
    fretByString.set(p.position.stringIndex, p.position.fret);
  }

  // String indices high -> low, the order TAB is written in.
  const rows: number[] = [];
  for (let s = instrument.stringCount - 1; s >= 0; s--) rows.push(s);

  return (
    <div className="tab" role="img" aria-label="Chord tablature">
      {rows.map((stringIndex) => {
        const fret = fretByString.get(stringIndex);
        const isPlayed = fret !== undefined;
        return (
          <div className="tab-row" key={stringIndex}>
            <span className="tab-open">{noteName(tuning.openNotes[stringIndex])}</span>
            <span className="tab-line">
              <span className={isPlayed ? 'tab-mark' : 'tab-mark tab-mark--mute'}>
                {isPlayed ? fret : '×'}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
