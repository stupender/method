// ============================================================================
// ui/SongwriterView.tsx — the "GPS reveal" (Session 5)
// ----------------------------------------------------------------------------
// Enter a chord (its root is the global Key pill; pick a quality here). Click it
// and every key it could belong to appears, grouped by scale system, each
// showing the Roman numeral the chord plays there. Click a candidate key to see
// that key's full diatonic chords — "where to go next".
//
// This is the seed of the progression / playback view: today it's one chord;
// next it grows to a bar/progression whose candidate keys intersect and narrow.
// ============================================================================

import { useState } from 'react';
import type { Note } from '../theory/types';
import { CHORDS } from '../data/chords';
import { SCALES } from '../data/scales';
import { keysContaining, type KeyMatch } from '../theory/keys';
import { diatonicChords } from '../theory/harmony';
import { noteName } from '../theory/notes';

const CHORD_LIST = Object.values(CHORDS);
const SCALE_ORDER = Object.values(SCALES); // groups in a stable order

export function SongwriterView({ root }: { root: Note }) {
  const [chordId, setChordId] = useState('minor-triad');
  // The candidate key the user has drilled into (to see its chords), or null.
  const [openKey, setOpenKey] = useState<KeyMatch | null>(null);

  const chord = CHORDS[chordId];
  const matches = keysContaining(root, chord);

  const chordLabel = `${noteName(root)}${chord.symbol}`;

  return (
    <>
      <p className="tagline">
        {chordLabel} could live in <strong>{matches.length}</strong> keys.
      </p>

      {/* Pick the chord quality (root comes from the global Key pill). */}
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
  // Triads if the chord we came from was a triad; sevenths if a seventh. We
  // recover that from the Roman numeral length isn't reliable, so just show both
  // sizes by reading the degree's chord at triad size here (the "where to go"
  // vocabulary reads most clearly as triads).
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
