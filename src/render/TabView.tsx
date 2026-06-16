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
  caption?: string; // optional label, e.g. the fret the shape sits at
}

export function TabView({ instrument, tuning, placed, caption }: TabViewProps) {
  // Lookup: string index -> the frets played on it, low to high. A chord has one
  // per string; a scale position (3 notes per string) has several.
  const fretsByString = new Map<number, number[]>();
  for (const p of placed) {
    const list = fretsByString.get(p.position.stringIndex) ?? [];
    list.push(p.position.fret);
    fretsByString.set(p.position.stringIndex, list);
  }

  // String indices high -> low, the order TAB is written in.
  const rows: number[] = [];
  for (let s = instrument.stringCount - 1; s >= 0; s--) rows.push(s);

  return (
    <div className="tab" role="img" aria-label="Tablature">
      {rows.map((stringIndex) => {
        const frets = (fretsByString.get(stringIndex) ?? []).sort((a, b) => a - b);
        return (
          <div className="tab-row" key={stringIndex}>
            <span className="tab-open">{noteName(tuning.openNotes[stringIndex])}</span>
            <span className="tab-line">
              {frets.length === 0 ? (
                <span className="tab-mark tab-mark--mute">×</span>
              ) : (
                frets.map((fret, i) => (
                  <span className="tab-mark" key={i}>
                    {fret}
                  </span>
                ))
              )}
            </span>
          </div>
        );
      })}
      {caption && <div className="tab-caption">{caption}</div>}
    </div>
  );
}
