// ============================================================================
// ui/PracticeCards.tsx — the take-home step of the teaching loop
// ----------------------------------------------------------------------------
// A lesson ends in something the student takes away. A PRACTICE CARD freezes the
// current song — its chords (with their per-bar units), meter and tempo — next
// to a one-line instruction you type ("loop this ii-V, arpeggios only, until 120
// feels easy"). Cards save locally (App owns them, like the songbook), so a
// student's practice is a list you can reopen next week. Open a card to load its
// snapshot back into the open song.
//
// Skeleton by design (DESIGN.md's Practice zone): the data model is the point.
// Loop/ramp intent and per-student "palettes" layer on later without reshaping
// the card. This view holds no music theory — it just captures and restores.
// ============================================================================

import { useState } from 'react';
import type { ChartChord } from './SongView';
import { chordLabel } from './SongView';

// One saved card: the frozen musical content + the human instruction.
export interface PracticeCard {
  id: string;
  instruction: string;
  chords: ChartChord[];
  bpm: number;
  beatsPerBar: number;
  denominator: number;
  createdAt: number;
}

// A compact one-line summary of a card's progression, e.g. "Dm7 · G7 · Cmaj7".
function summarise(chords: ChartChord[]): string {
  const labels = chords.map(chordLabel);
  const shown = labels.slice(0, 6).join(' · ');
  return labels.length > 6 ? `${shown} …` : shown;
}

export function PracticeCards({
  cards,
  onSave,
  onOpen,
  onRemove,
}: {
  cards: PracticeCard[];
  // onSave freezes the OPEN song (App holds it) into a card with this note.
  onSave: (instruction: string) => void;
  onOpen: (card: PracticeCard) => void;
  onRemove: (id: string) => void;
}) {
  const [instruction, setInstruction] = useState('');

  const save = () => {
    onSave(instruction.trim());
    setInstruction('');
  };

  return (
    <details className="practice-box">
      <summary>
        Practice cards{cards.length > 0 && <span className="practice-count"> · {cards.length}</span>}
      </summary>

      {/* Freeze the open song into a card with a one-line instruction. */}
      <form
        className="chord-input practice-new"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          type="text"
          value={instruction}
          placeholder="What to practise — e.g. loop, arpeggios only, until 120 feels easy"
          aria-label="Practice instruction"
          onChange={(e) => setInstruction(e.target.value)}
        />
        <button type="submit" className="pill">
          Save this chart
        </button>
      </form>
      <p className="control-hint">
        Freezes the current chart — chords, per-bar units, meter and tempo — with
        your note. Reopen it to load the chart back.
      </p>

      {cards.length > 0 && (
        <ul className="practice-list">
          {cards.map((card) => (
            <li key={card.id} className="practice-card">
              <div className="practice-card__body">
                {card.instruction && (
                  <p className="practice-card__note">{card.instruction}</p>
                )}
                <p className="practice-card__prog">
                  {summarise(card.chords)}
                  <span className="practice-card__meta">
                    {' '}· {card.beatsPerBar}/{card.denominator} · ♩={card.bpm}
                  </span>
                </p>
              </div>
              <div className="practice-card__actions">
                <button className="pill pill--tiny" onClick={() => onOpen(card)}>
                  Open
                </button>
                <button
                  className="pill pill--tiny"
                  aria-label="Remove card"
                  onClick={() => onRemove(card.id)}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
