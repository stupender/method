// ============================================================================
// render/TabSequence.tsx — TAB for a SCALE run (one note after another)
// ----------------------------------------------------------------------------
// RENDER layer. A chord's TAB stacks notes in one column (TabView). A scale is
// different: it's a line you play one note at a time, so its TAB should read
// left-to-right like real tablature — each note in its own time-slot, stepping
// up the strings. Given a scale position's notes we sort them by pitch and lay
// them out as columns: ascending pitch flows rightward, string = which line.
// No music theory here — it just prints fret numbers in order.
// ============================================================================

import type { Instrument, Tuning, PlacedNote } from '../theory/types';
import { noteName, midiOf } from '../theory/notes';
import './TabSequence.css';

interface TabSequenceProps {
  instrument: Instrument;
  tuning: Tuning;
  placed: PlacedNote[];
  descending?: boolean; // read high -> low instead of low -> high
  // Keep the GIVEN order instead of sorting by pitch — for pattern runs,
  // where the zig-zag order IS the music (sorting would flatten it back
  // into a plain scale).
  ordered?: boolean;
  caption?: string; // optional label, e.g. the position name
}

export function TabSequence({
  instrument,
  tuning,
  placed,
  descending = false,
  ordered = false,
  caption,
}: TabSequenceProps) {
  // The notes left-to-right: in pitch order so a position reads as a scale run
  // (reversed when descending) — or exactly as given, for pattern runs.
  const notes = ordered
    ? placed
    : [...placed].sort((a, b) => midiOf(a.note) - midiOf(b.note));
  if (!ordered && descending) notes.reverse();

  // String rows, highest string on top (TAB convention).
  const rows: number[] = [];
  for (let s = instrument.stringCount - 1; s >= 0; s--) rows.push(s);

  return (
    <div className="tabseq" role="img" aria-label="Tablature">
      <div className="tabseq-grid">
        {/* Left column: the open-string names (e B G D A E). */}
        <div className="tabseq-col tabseq-col--labels">
          {rows.map((s) => (
            <span className="tabseq-cell tabseq-open" key={s}>
              {noteName(tuning.openNotes[s])}
            </span>
          ))}
        </div>

        {/* One column per note, in pitch order: the fret sits on its string row. */}
        {notes.map((p, i) => (
          <div className="tabseq-col" key={i}>
            {rows.map((s) => (
              <span className="tabseq-cell" key={s}>
                {s === p.position.stringIndex && (
                  <span className="tabseq-num">{p.position.fret}</span>
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
      {caption && <div className="tabseq-caption">{caption}</div>}
    </div>
  );
}
