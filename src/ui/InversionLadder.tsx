// ============================================================================
// ui/InversionLadder.tsx — one chord, all its inversions up the neck
// ----------------------------------------------------------------------------
// The other harmony teaching axis (sibling to ChordScaleLadder). Here we hold the
// CHORD fixed and sweep its inversions, tiling them up the neck on one string set
// — root in bass, then 3rd, 5th, (7th), then the cycle again an octave higher, and
// so on. Play it straight through, or click a rung.
//
// Same reuse as the chord-scale ladder: `placeVoicingAll` places each inversion;
// we keep the shapes on the chosen string set and octave-copy them up the neck.
// ============================================================================

import { useState } from 'react';
import type { Note, ChordDefinition, PlacedNote } from '../theory/types';
import { GUITAR } from '../data/instruments';
import { GUITAR_STANDARD } from '../data/tunings';
import { STRUCTURES } from '../data/voicings';
import {
  placeVoicingAll,
  structuresForChord,
  structureName,
  inversionCount,
  bassDegree,
  bassNoteName,
} from '../theory/chord';
import { midiOf, noteName } from '../theory/notes';
import { playChord } from '../audio/player';
import { Fretboard } from '../render/Fretboard';
import { TabView } from '../render/TabView';

// (These small layout helpers are shared in spirit with ChordScaleLadder; kept
// local so each ladder file stays self-contained.)
const stringSetKey = (shape: PlacedNote[]) =>
  shape.map((p) => p.position.stringIndex).sort((a, b) => a - b).join('-');
const octaveUp = (shape: PlacedNote[]): PlacedNote[] =>
  shape.map((p) => ({
    ...p,
    position: { ...p.position, fret: p.position.fret + 12 },
    note: { ...p.note, octave: (p.note.octave ?? 4) + 1 },
  }));
const loFret = (shape: PlacedNote[]) =>
  shape.length ? Math.min(...shape.map((p) => p.position.fret)) : 0;
const hiFret = (shape: PlacedNote[]) =>
  shape.length ? Math.max(...shape.map((p) => p.position.fret)) : 0;

export function InversionLadder({ root, chord }: { root: Note; chord: ChordDefinition }) {
  const [structureId, setStructureId] = useState('close');
  const [stringSet, setStringSet] = useState<string | null>(null);
  const [labelMode, setLabelMode] = useState<'note' | 'degree'>('degree');
  const [hovered, setHovered] = useState<number | null>(null);

  const voiceCount = inversionCount(chord);
  const structures = structuresForChord(chord, STRUCTURES);
  const structure = structures.find((s) => s.id === structureId) ?? structures[0];

  // Each inversion's placements; offer only string sets where EVERY inversion fits.
  const perInversion = Array.from({ length: voiceCount }, (_, inv) =>
    placeVoicingAll(GUITAR, GUITAR_STANDARD, root, chord, structure, inv),
  );
  const setsPerInv = perInversion.map((shapes) => new Set(shapes.map(stringSetKey)));
  const commonSets = [...setsPerInv[0]].filter((k) => setsPerInv.every((s) => s.has(k)));
  const chosenSet = stringSet && commonSets.includes(stringSet) ? stringSet : commonSets[0];

  // The chord tiled up the neck: each inversion at its base plus octave copies,
  // then everything sorted low -> high so it climbs.
  const rungs: { shape: PlacedNote[]; inv: number }[] = [];
  if (chosenSet) {
    for (let inv = 0; inv < voiceCount; inv++) {
      const base = perInversion[inv].find((s) => stringSetKey(s) === chosenSet);
      if (!base) continue;
      let s = base;
      for (;;) {
        rungs.push({ shape: s, inv });
        if (hiFret(s) + 12 > GUITAR.fretCount) break;
        s = octaveUp(s);
      }
    }
    rungs.sort((a, b) => loFret(a.shape) - loFret(b.shape));
  }

  const shapes = rungs.map((r) => r.shape);
  const playAll = () =>
    shapes.forEach((shape, i) =>
      setTimeout(() => playChord(shape.map((p) => midiOf(p.note))), i * 470),
    );
  const playRung = (i: number) =>
    shapes[i]?.length && playChord(shapes[i].map((p) => midiOf(p.note)));
  const setLabel = (key: string) =>
    key.split('-').map((i) => noteName(GUITAR_STANDARD.openNotes[+i])).join(' ');

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
          <button className="pill pill--play" onClick={playAll}>
            ▶ Play inversions
          </button>
        </div>

        <div className="controls-row">
          <div className="control-group" role="group" aria-label="String set">
            {commonSets.map((key) => (
              <button
                key={key}
                className={key === chosenSet ? 'pill pill--on' : 'pill'}
                onClick={() => setStringSet(key)}
              >
                {setLabel(key)}
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

      {chosenSet ? (
        <>
          <Fretboard
            instrument={GUITAR}
            tuning={GUITAR_STANDARD}
            shapes={shapes}
            activeShapeIndex={hovered}
            onShapeHover={setHovered}
            onShapeTap={playRung}
            labelMode={labelMode}
          />

          {/* One TAB per rung, ascending, labelled by the note in the bass. */}
          <div className="tab-shelf">
            {rungs.map((r, i) => (
              <div
                key={i}
                className={i === hovered ? 'tab-card tab-card--on' : 'tab-card'}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => playRung(i)}
              >
                <TabView
                  instrument={GUITAR}
                  tuning={GUITAR_STANDARD}
                  placed={r.shape}
                  caption={bassNoteName(bassDegree(chord, structure, r.inv))}
                />
              </div>
            ))}
          </div>

          <footer className="footnote">
            {noteName(root)}
            {chord.symbol} in every inversion up the {setLabel(chosenSet)} strings —
            each chord tone taking the bass in turn, climbing the neck.
          </footer>
        </>
      ) : (
        <p className="control-hint control-hint--warn">
          This close voicing doesn't lay out on one string set — try a Drop 2 or
          Drop 3 voicing.
        </p>
      )}
    </>
  );
}
