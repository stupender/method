// ============================================================================
// ui/ChordExplorer.tsx — explore one chord's voicings on the neck
// ----------------------------------------------------------------------------
// Given a root + a chord quality, this owns the shared chord UI: the Inversion
// and Structure pickers, the note/degree label toggle, the play button, the
// fretboard, and the TAB. Both the Chords view (absolute chord) and the Harmony
// view (a chord from a key) hand it a root + chord and reuse all of it.
//
// It shows the chosen voicing in ALL its playable positions and string sets: the
// neck lights up every shape (their union), and below it we draw one TAB per
// shape, ordered low -> high up the neck.
//
// Control order follows the agreed priority: Inversion, then Structure. (The
// higher-priority Roman-numeral / triad-vs-7th choices live in the view above.)
// ============================================================================

import { useState } from 'react';
import type { Note, ChordDefinition } from '../theory/types';
import { GUITAR } from '../data/instruments';
import { GUITAR_STANDARD } from '../data/tunings';
import { STRUCTURES } from '../data/voicings';
import {
  placeVoicingAll,
  structuresForChord,
  structureName,
  inversionCount,
  inversionName,
} from '../theory/chord';
import { midiOf } from '../theory/notes';
import { playChord } from '../audio/player';
import { Fretboard } from '../render/Fretboard';
import { TabView } from '../render/TabView';

export function ChordExplorer({ root, chord }: { root: Note; chord: ChordDefinition }) {
  const [structureId, setStructureId] = useState('close');
  const [inversionIndex, setInversionIndex] = useState(0);
  const [labelMode, setLabelMode] = useState<'note' | 'degree'>('degree');
  // Two kinds of selection: a PINNED shape (set by clicking, stays lit) and a
  // HOVERED shape (a temporary preview). Hover wins while the pointer is over a
  // shape; otherwise the pinned one shows. Click the empty neck to unpin.
  const [pinnedShape, setPinnedShape] = useState<number | null>(null);
  const [hoveredShape, setHoveredShape] = useState<number | null>(null);
  const activeShape = hoveredShape ?? pinnedShape;

  const voiceCount = inversionCount(chord);
  const structures = structuresForChord(chord, STRUCTURES);
  const structure = structures.find((s) => s.id === structureId) ?? structures[0];
  const inversion = Math.min(inversionIndex, voiceCount - 1);

  // Every playable shape of this voicing across the neck.
  const shapes = placeVoicingAll(
    GUITAR,
    GUITAR_STANDARD,
    root,
    chord,
    structure,
    inversion,
  );

  // Play a chord shape (its notes, strummed).
  const playShape = (shape: (typeof shapes)[number]) =>
    playChord(shape.map((p) => midiOf(p.note)));

  // Clicking a shape (neck or TAB) plays it AND pins it as the selection.
  const selectShape = (i: number) => {
    setPinnedShape(i);
    playShape(shapes[i] ?? []);
  };

  return (
    <>
      <div className="view-controls">
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
          <button className="pill pill--play" onClick={() => playShape(shapes[0] ?? [])}>
            ▶ Play chord
          </button>
        </div>

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

      <Fretboard
        instrument={GUITAR}
        tuning={GUITAR_STANDARD}
        shapes={shapes}
        activeShapeIndex={activeShape}
        onShapeHover={setHoveredShape}
        onShapeTap={selectShape}
        onBackgroundClick={() => setPinnedShape(null)}
        labelMode={labelMode}
      />

      {/* One TAB per shape (sorted by string set, low -> high). Hovering a TAB
          previews that shape; clicking it pins the selection. */}
      <div className="tab-shelf">
        {shapes.map((shape, i) => (
          <div
            key={i}
            className={i === activeShape ? 'tab-card tab-card--on' : 'tab-card'}
            onMouseEnter={() => setHoveredShape(i)}
            onMouseLeave={() => setHoveredShape(null)}
            onClick={() => selectShape(i)}
          >
            <TabView
              instrument={GUITAR}
              tuning={GUITAR_STANDARD}
              placed={shape}
              caption={`fr. ${Math.min(...shape.map((p) => p.position.fret))}`}
            />
          </div>
        ))}
      </div>
    </>
  );
}
