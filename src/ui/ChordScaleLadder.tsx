// ============================================================================
// ui/ChordScaleLadder.tsx — the diatonic chords of a key as a "chord scale"
// ----------------------------------------------------------------------------
// One of the two harmony teaching axes (the other is ChordExplorer = one chord,
// every placement). Here we hold the VOICING fixed (structure + bass + string
// set) and sweep the seven diatonic chords (I ii iii IV V vi vii°), laying them
// out as a ladder ascending the neck on one string set — a "chord scale" you can
// play straight through, then re-voice or move to another string set.
//
// It reuses the voicing engine wholesale: `diatonicChords` gives the seven
// chords, `placeVoicingAll` places each, and we just keep the one shape that
// sits on the chosen string set for every chord. No new placement code.
// ============================================================================

import { useRef, useState } from 'react';
import type { Note, ScaleDefinition, PlacedNote } from '../theory/types';
import { GUITAR } from '../data/instruments';
import { GUITAR_STANDARD } from '../data/tunings';
import { STRUCTURES } from '../data/voicings';
import { diatonicChords } from '../theory/harmony';
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
import { Segmented } from './Segmented';
import { ShapeStepper, useStepper } from './ShapeStepper';

// A stable key for a shape's string set, e.g. "0-1-2-3".
const stringSetKey = (shape: PlacedNote[]) =>
  shape.map((p) => p.position.stringIndex).sort((a, b) => a - b).join('-');

export function ChordScaleLadder({
  root,
  scale,
  seventh,
  labelMode = 'degree',
}: {
  root: Note;
  scale: ScaleDefinition;
  seventh: boolean;
  // What the dots say — a global display setting, owned by the view above.
  labelMode?: 'note' | 'degree';
}) {
  const [structureId, setStructureId] = useState('close');
  const [inversionIndex, setInversionIndex] = useState(0); // the bass note
  const [stringSet, setStringSet] = useState<string | null>(null);
  // Pinned (clicked/stepped, stays lit) vs hovered (temporary preview).
  const [pinned, setPinned] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? pinned;

  const degrees = diatonicChords(root, scale, seventh);
  // All seven share a voice count (all triads, or all sevenths), so the structure
  // and bass options can be read off the tonic.
  const sample = degrees[0].chord;
  const voiceCount = inversionCount(sample);
  const structures = structuresForChord(sample, STRUCTURES);
  const structure = structures.find((s) => s.id === structureId) ?? structures[0];
  const inversion = Math.min(inversionIndex, voiceCount - 1);

  // Bass options (root -> 7th), each picking the inversion that puts that tone in
  // the bass — same idea as ChordExplorer, applied to the whole scale.
  const bassOptions = sample.intervals
    .map((iv) => {
      const degree = String(iv.diatonicSteps + 1);
      const inv = Array.from({ length: voiceCount }, (_, i) => i).find(
        (i) => bassDegree(sample, structure, i) === degree,
      );
      return inv === undefined ? null : { degree, inv };
    })
    .filter((o): o is { degree: string; inv: number } => o != null);

  // Place every chord. Offer only string sets where EVERY chord in the scale has a
  // placement, so the ladder is never full of gaps. (Close seventh chords don't
  // lay out on adjacent strings, so they may leave NONE — itself a teaching point:
  // use a drop voicing for a chord scale.)
  const placedPerChord = degrees.map((d) =>
    placeVoicingAll(GUITAR, GUITAR_STANDARD, d.chordRoot, d.chord, structure, inversion),
  );
  const setsPerChord = placedPerChord.map((shapes) => new Set(shapes.map(stringSetKey)));
  const commonSets = [...setsPerChord[0]].filter((key) =>
    setsPerChord.every((s) => s.has(key)),
  );
  const chosenSet = stringSet && commonSets.includes(stringSet) ? stringSet : commonSets[0];

  // Each chord's shape on the chosen set, then made to CLIMB: octave-shift a chord
  // up the neck when it would otherwise sit below the previous one, so the whole
  // thing ascends like a scale (as far as the neck's range allows).
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
  let prevLo = -1;
  const ladder = placedPerChord.map((shapes) => {
    let s = shapes.find((x) => stringSetKey(x) === chosenSet) ?? [];
    while (s.length && loFret(s) < prevLo && hiFret(s) + 12 <= GUITAR.fretCount) {
      s = octaveUp(s);
    }
    if (s.length) prevLo = loFret(s);
    return s;
  });

  // Play the chords in turn, ascending — the "chord scale".
  const playScale = () => {
    ladder.forEach((shape, i) => {
      if (shape.length) setTimeout(() => playChord(shape.map((p) => midiOf(p.note))), i * 520);
    });
  };
  const playRung = (i: number) =>
    ladder[i].length && playChord(ladder[i].map((p) => midiOf(p.note)));
  // Clicking a rung (neck or TAB) plays it AND pins it as the selection.
  const selectRung = (i: number) => {
    setPinned(i);
    playRung(i);
  };

  // Walk the ladder: ‹ › buttons or the ← → arrow keys move to the next/previous
  // rung and play it (only while this view is visible).
  const viewRef = useRef<HTMLDivElement>(null);
  const stepRung = useStepper(viewRef, ladder.length, active, selectRung);

  // A string set named by its open-string notes, low -> high, e.g. "E A D G".
  const setLabel = (key: string) =>
    key.split('-').map((i) => noteName(GUITAR_STANDARD.openNotes[+i])).join(' ');

  return (
    <>
      <div className="view-controls" ref={viewRef}>
        <div className="controls-row">
          <Segmented
            ariaLabel="Structure"
            options={structures.map((s) => ({
              value: s.id,
              label: structureName(s, voiceCount),
            }))}
            value={structure.id}
            onChange={setStructureId}
          />
          <button className="pill pill--play" onClick={playScale}>
            ▶ Play chord scale
          </button>
          <ShapeStepper
            index={active}
            count={ladder.length}
            onStep={stepRung}
            label="chord"
          />
        </div>

        <div className="controls-row">
          <Segmented
            ariaLabel="Bass note"
            options={bassOptions.map((o) => ({ value: o.inv, label: bassNoteName(o.degree) }))}
            value={inversion}
            onChange={setInversionIndex}
          />
        </div>

        <div className="controls-row">
          {/* Which strings the ladder climbs on — labelled so it reads at a
              glance on a shared screen. */}
          <span className="control-label">Strings</span>
          <Segmented
            ariaLabel="String set"
            options={commonSets.map((key) => ({ value: key, label: setLabel(key) }))}
            value={chosenSet ?? ''}
            onChange={setStringSet}
          />
        </div>
      </div>

      {chosenSet ? (
        <>
          {/* The seven chords ascending on the chosen string set. */}
          <Fretboard
            instrument={GUITAR}
            tuning={GUITAR_STANDARD}
            shapes={ladder}
            activeShapeIndex={active}
            onShapeHover={setHovered}
            onShapeTap={selectRung}
            labelMode={labelMode}
          />

          {/* One TAB per diatonic chord, ascending, labelled by its Roman numeral. */}
          <div className="tab-shelf">
            {degrees.map((d, i) => (
              <div
                key={i}
                className={i === active ? 'tab-card tab-card--on' : 'tab-card'}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => selectRung(i)}
              >
                <TabView
                  instrument={GUITAR}
                  tuning={GUITAR_STANDARD}
                  placed={ladder[i]}
                  caption={d.roman}
                />
              </div>
            ))}
          </div>

          <footer className="footnote">
            The whole key harmonised in one voicing on the {setLabel(chosenSet)}{' '}
            strings — play it like a scale, then change the voicing, bass, or string set.
          </footer>
        </>
      ) : (
        <p className="control-hint control-hint--warn">
          These close-voiced seventh chords don't lay out as a chord scale on one
          string set — try a Drop 2 or Drop 3 voicing.
        </p>
      )}
    </>
  );
}
