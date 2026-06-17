// ============================================================================
// ui/SongView.tsx — the Song area (a top-level part of the app)
// ----------------------------------------------------------------------------
// Song is its own area, separate from the Scales/Harmony study page. Here you
// lay out a song — eventually a full lead sheet (chords in bars, with rhythm) —
// and CLICK any chord to reveal everything you could play or practise over it,
// and where you could go next. A "song" can be a single chord to drone over, a
// few bars, or a whole repertoire songbook.
//
// This first version is the single-chord case (the one-bar "drone"): choose a
// chord and see every key it could belong to, then drill into a key for its
// chords. The multi-bar lead sheet grows from here (see BACKLOG.md).
// ============================================================================

import { useState } from 'react';
import { CHORDS } from '../data/chords';
import { SCALES } from '../data/scales';
import { ROOT_CHOICES } from '../data/roots';
import { keysContaining, type KeyMatch } from '../theory/keys';
import { diatonicChords } from '../theory/harmony';
import { noteName } from '../theory/notes';

const CHORD_LIST = Object.values(CHORDS);
const SCALE_ORDER = Object.values(SCALES); // groups in a stable order

export function SongView() {
  const [rootIndex, setRootIndex] = useState(5); // F, a nice default (Fm)
  const [chordId, setChordId] = useState('minor-triad');
  // The candidate key the user has drilled into (to see its chords), or null.
  const [openKey, setOpenKey] = useState<KeyMatch | null>(null);

  const root = ROOT_CHOICES[rootIndex];
  const chord = CHORDS[chordId];
  const matches = keysContaining(root, chord);
  const chordLabel = `${noteName(root)}${chord.symbol}`;

  return (
    <>
      <p className="tagline">
        {chordLabel} could live in <strong>{matches.length}</strong> keys.
      </p>

      {/* Build the chord: its root, then its quality. (A multi-chord lead sheet
          replaces this single-chord entry later.) */}
      <div className="control-group" role="group" aria-label="Chord root">
        {ROOT_CHOICES.map((note, i) => (
          <button
            key={`${note.letter}${note.accidental}`}
            className={i === rootIndex ? 'pill pill--on' : 'pill'}
            onClick={() => {
              setRootIndex(i);
              setOpenKey(null);
            }}
          >
            {noteName(note)}
          </button>
        ))}
      </div>

      <div className="control-group control-group--wrap" role="group" aria-label="Chord quality">
        {CHORD_LIST.map((c) => (
          <button
            key={c.id}
            className={c.id === chordId ? 'pill pill--on' : 'pill'}
            onClick={() => {
              setChordId(c.id);
              setOpenKey(null);
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* The possibility space: candidate keys grouped by scale system. */}
      <div className="reveal">
        {SCALE_ORDER.map((scale) => {
          const inSystem = matches.filter((m) => m.scale.id === scale.id);
          if (inSystem.length === 0) return null;
          return (
            <div className="reveal-group" key={scale.id}>
              <h3 className="reveal-label">{scale.name}</h3>
              <div className="reveal-items">
                {inSystem
                  .slice()
                  .sort((a, b) => a.degree - b.degree)
                  .map((m) => {
                    const isOpen =
                      openKey?.scale.id === m.scale.id &&
                      noteName(openKey.tonic) === noteName(m.tonic) &&
                      openKey.degree === m.degree;
                    return (
                      <button
                        key={`${noteName(m.tonic)}-${m.degree}`}
                        className={isOpen ? 'key-chip key-chip--on' : 'key-chip'}
                        onClick={() => setOpenKey(isOpen ? null : m)}
                      >
                        <span className="key-chip__roman">{m.roman}</span>
                        <span className="key-chip__key">
                          {noteName(m.tonic)} {m.scale.name}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drill-down: the chosen key's diatonic chords — where to go next. */}
      {openKey && <KeyDetail match={openKey} />}
    </>
  );
}

// Shows every diatonic chord of a chosen key, with the entered chord's slot lit.
function KeyDetail({ match }: { match: KeyMatch }) {
  const chords = diatonicChords(match.tonic, match.scale, false);

  return (
    <div className="key-detail">
      <p className="key-detail__title">
        In <strong>{noteName(match.tonic)} {match.scale.name}</strong>, it's the{' '}
        <strong>{match.roman}</strong>. The chords here:
      </p>
      <div className="reveal-items">
        {chords.map((c) => (
          <div
            key={c.degree}
            className={c.degree === match.degree ? 'key-chip key-chip--here' : 'key-chip'}
          >
            <span className="key-chip__roman">{c.roman}</span>
            <span className="key-chip__key">{c.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
