// ============================================================================
// ui/ChordExplorer.tsx — explore one chord's voicings on the neck
// ----------------------------------------------------------------------------
// Given a root + a chord quality, this owns the shared chord UI: the Structure
// and Inversion pickers, the note/degree label toggle, the fretboard shape, the
// TAB, and the play button. Both the Chords view (absolute chord) and the
// Harmony view (a chord from a key) hand it a root + chord and reuse all of it.
//
// It keeps Structure/Inversion/label as its own LOCAL state — they're UI choices
// about how to view whatever chord it's given. When the chord changes, the same
// derive-and-clamp logic keeps the choice valid.
// ============================================================================

import { useState } from 'react';
import type { Note, ChordDefinition } from '../theory/types';
import { GUITAR } from '../data/instruments';
import { GUITAR_STANDARD } from '../data/tunings';
import { STRUCTURES } from '../data/voicings';
import {
  placeVoicing,
  structuresForChord,
  structureName,
  inversionCount,
  inversionName,
} from '../theory/chord';
import { midiOf } from '../theory/notes';
import { playNote, playChord } from '../audio/player';
import { Fretboard } from '../render/Fretboard';
import { TabView } from '../render/TabView';

export function ChordExplorer({ root, chord }: { root: Note; chord: ChordDefinition }) {
  const [structureId, setStructureId] = useState('close');
  const [inversionIndex, setInversionIndex] = useState(0);
  const [labelMode, setLabelMode] = useState<'note' | 'degree'>('degree');

  const voiceCount = inversionCount(chord);
  const structures = structuresForChord(chord, STRUCTURES);
  const structure = structures.find((s) => s.id === structureId) ?? structures[0];
  const inversion = Math.min(inversionIndex, voiceCount - 1);

  const placed = placeVoicing(
    GUITAR,
    GUITAR_STANDARD,
    root,
    chord,
    structure,
    inversion,
  );

  const strum = () => playChord(placed.map((p) => midiOf(p.note)));

  return (
    <>
      <div className="view-controls">
        <div className="controls-row">
          <div className="control-group" role="group" aria-label="Structure">
            {structures.map((s) => (
              <button
                key={s.id}
                className={s.id === structure.id ? 'pill pill--on' : 'pill'}
                onClick={() => setStructureId(s.id)}
              >
                {structureName(s, voiceCount)}
              </button>
            ))}
          </div>
          <button className="pill pill--play" onClick={strum}>
            ▶ Play chord
          </button>
        </div>

        <div className="controls-row">
          <div className="control-group" role="group" aria-label="Inversion">
            {Array.from({ length: voiceCount }, (_, i) => (
              <button
                key={i}
                className={i === inversion ? 'pill pill--on' : 'pill'}
                onClick={() => setInversionIndex(i)}
              >
                {inversionName(i)}
              </button>
            ))}
          </div>
          <div className="control-group" role="group" aria-label="Labels">
            <button
              className={labelMode === 'degree' ? 'pill pill--on' : 'pill'}
              onClick={() => setLabelMode('degree')}
            >
              Degrees
            </button>
            <button
              className={labelMode === 'note' ? 'pill pill--on' : 'pill'}
              onClick={() => setLabelMode('note')}
            >
              Notes
            </button>
          </div>
        </div>
      </div>

      <div className="chord-stage">
        <Fretboard
          instrument={GUITAR}
          tuning={GUITAR_STANDARD}
          highlights={placed}
          labelMode={labelMode}
          onNoteTap={(p) => playNote(midiOf(p.note))}
        />
        <TabView instrument={GUITAR} tuning={GUITAR_STANDARD} placed={placed} />
      </div>
    </>
  );
}
