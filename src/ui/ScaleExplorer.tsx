// ============================================================================
// ui/ScaleExplorer.tsx — explore a scale's position boxes on the neck
// ----------------------------------------------------------------------------
// The scale twin of ChordExplorer. Given a root + scale it shows the scale's
// playable position boxes (the 7 modal fingerings) as constellations: by
// default the whole scale is lit across the neck (the union of all boxes), and
// hovering a box (or its TAB) lights that one and dims the rest. Clicking a box
// plays that position ascending. Reuses the same Fretboard + TAB machinery as
// chords — the only difference is where the shapes come from.
// ============================================================================

import { useState } from 'react';
import type { Note, ScaleDefinition } from '../theory/types';
import { GUITAR } from '../data/instruments';
import { GUITAR_STANDARD } from '../data/tunings';
import { scalePositions } from '../theory/scalePositions';
import { midiOf } from '../theory/notes';
import { playSequence } from '../audio/player';
import { Fretboard } from '../render/Fretboard';
import { TabView } from '../render/TabView';

export function ScaleExplorer({ root, scale }: { root: Note; scale: ScaleDefinition }) {
  const [labelMode, setLabelMode] = useState<'note' | 'degree'>('degree');
  const [activeShape, setActiveShape] = useState<number | null>(null);

  const positions = scalePositions(GUITAR, GUITAR_STANDARD, root, scale);
  const shapes = positions.map((p) => p.notes);

  // Play a position ascending (lowest pitch to highest).
  const playPosition = (shape: (typeof shapes)[number]) => {
    const midis = [...shape]
      .sort((a, b) => midiOf(a.note) - midiOf(b.note))
      .map((p) => midiOf(p.note));
    playSequence(midis, 0.18);
  };

  return (
    <>
      <div className="view-controls">
        <div className="controls-row">
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
          <button
            className="pill pill--play"
            onClick={() => playPosition(shapes[0] ?? [])}
          >
            ▶ Play position
          </button>
        </div>
      </div>

      <Fretboard
        instrument={GUITAR}
        tuning={GUITAR_STANDARD}
        shapes={shapes}
        activeShapeIndex={activeShape}
        onShapeHover={setActiveShape}
        onShapeTap={playPosition}
        labelMode={labelMode}
      />

      {/* One TAB per position (the modal fingerings), low -> high. Hovering a
          TAB lights that position's constellation on the neck above. */}
      <div className="tab-shelf">
        {positions.map((pos, i) => (
          <div
            key={i}
            className={i === activeShape ? 'tab-card tab-card--on' : 'tab-card'}
            onMouseEnter={() => setActiveShape(i)}
            onMouseLeave={() => setActiveShape(null)}
          >
            <TabView
              instrument={GUITAR}
              tuning={GUITAR_STANDARD}
              placed={pos.notes}
              caption={pos.name}
            />
          </div>
        ))}
      </div>
    </>
  );
}
