// ============================================================================
// ui/ChordScaleLadder.tsx — the diatonic chords of a key as a "chord scale"
// ----------------------------------------------------------------------------
// The whole key harmonised: I ii iii IV V vi vii°, in one voicing, climbing the
// neck like a scale. Sibling to InversionLadder (one chord, every inversion),
// and built the same way now — STRING SETS are the structure of the page.
//
// It used to make you choose a string set from a selector and showed you that
// one. Now every set that can hold the whole key gets its own block, so you can
// see the same progression sitting in three or four places on the neck at once
// — which is the thing a guitarist actually wants to compare.
//
// Each chord is named above its TAB by BOTH names it has: what it is (Cmaj7)
// and what it's doing (I). Those are different facts and you want them
// together — the whole point of a chord scale is that the second one is what
// makes the first one make sense.
//
// It reuses the voicing engine wholesale: `diatonicChords` gives the seven
// chords, `placeVoicingAll` places each. No new placement code.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import type { Note, ScaleDefinition, PlacedNote } from '../theory/types';
import { GUITAR } from '../data/instruments';
import { GUITAR_STANDARD } from '../data/tunings';
import { STRUCTURES } from '../data/voicings';
import { diatonicChords } from '../theory/harmony';
import { relabelByScale } from '../theory/scale';
import {
  placeVoicingAll,
  structuresForChord,
  structureName,
  inversionCount,
  voicingName,
} from '../theory/chord';
import { midiOf, noteName } from '../theory/notes';
import { playChord } from '../audio/player';
import { Fretboard } from '../render/Fretboard';
import { TabView } from '../render/TabView';
import { Segmented } from './Segmented';
import { useStepper } from './ShapeStepper';

// A stable key for a shape's string set, e.g. "0-1-2-3".
const stringSetKey = (shape: PlacedNote[]) =>
  shape.map((p) => p.position.stringIndex).sort((a, b) => a - b).join('-');
const loFret = (shape: PlacedNote[]) =>
  shape.length ? Math.min(...shape.map((p) => p.position.fret)) : 0;
const hiFret = (shape: PlacedNote[]) =>
  shape.length ? Math.max(...shape.map((p) => p.position.fret)) : 0;
const octaveUp = (shape: PlacedNote[]): PlacedNote[] =>
  shape.map((p) => ({
    ...p,
    position: { ...p.position, fret: p.position.fret + 12 },
    note: { ...p.note, octave: (p.note.octave ?? 4) + 1 },
  }));

// How long between chords when a set plays through.
const STEP_MS = 520;

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
  const [structureId, setStructureId] = useState<string | null>(null);
  const [inversionIndex, setInversionIndex] = useState(0); // the bass note
  const [pinned, setPinned] = useState<number | null>(null);
  const [playingSet, setPlayingSet] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const degrees = diatonicChords(root, scale, seventh);
  // All seven share a voice count (all triads, or all sevenths), so the structure
  // and bass options can be read off the tonic.
  const sample = degrees[0].chord;
  const voiceCount = inversionCount(sample);
  const structures = structuresForChord(sample, STRUCTURES);
  // Same reasoning as InversionLadder: close-voiced sevenths only fit on one
  // string set, so sevenths start on Drop 2, where the whole key lays out on
  // three of them.
  const defaultStructureId = voiceCount === 4 ? 'drop2' : 'close';
  const structure =
    structures.find((s) => s.id === (structureId ?? defaultStructureId)) ?? structures[0];
  const inversion = Math.min(inversionIndex, voiceCount - 1);

  // Place every chord, then find the string sets where EVERY chord of the key
  // has a placement. A set missing one chord isn't a chord scale, it's a chord
  // scale with a hole in it — so here, unlike the inversion grid, incomplete
  // sets really are dropped.
  //
  // ...and RELABELLED against the key. A chord scale frames the whole key, so
  // every note's colour should be its degree of the SCALE — in C major the Dm
  // chord is orange-green-indigo (2, 4, 6), not red-yellow-blue. Left as the
  // engine produces them, all seven chords would come out identically coloured
  // and the harmony's movement through the key would be invisible. (Frame one
  // chord instead — GRAVITY: ii — and the centre moves to it; that's
  // InversionLadder, where the chord's own labels are the right ones.)
  const placedPerChord = degrees.map((d) =>
    placeVoicingAll(GUITAR, GUITAR_STANDARD, d.chordRoot, d.chord, structure, inversion).map(
      (shape) => relabelByScale(root, scale, shape),
    ),
  );
  const setsPerChord = placedPerChord.map((shapes) => new Set(shapes.map(stringSetKey)));
  const sets = [...(setsPerChord[0] ?? [])]
    .filter((key) => setsPerChord.every((s) => s.has(key)))
    .sort((a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]));

  // One block per string set. Within a block the key CLIMBS: start from the
  // lowest chord on the neck and octave-shift each following chord up when it
  // would otherwise fall below the one before it.
  //
  // Starting from the lowest matters. Always starting on I stranded everything
  // below it — in C major on the top set that meant beginning at fret 5 and
  // running off the neck while V, vi and vii° sat unseen down at frets 0–3.
  let counter = 0;
  const groups = sets.map((key) => {
    const base = placedPerChord.map(
      (shapes) => shapes.find((x) => stringSetKey(x) === key) ?? [],
    );
    const startAt = base.reduce(
      (best, s, i) => (s.length && (!base[best].length || loFret(s) < loFret(base[best])) ? i : best),
      0,
    );
    let prevLo = -1;
    const rows = Array.from({ length: degrees.length }, (_, k) => {
      const i = (startAt + k) % degrees.length;
      let s = base[i];
      while (s.length && loFret(s) < prevLo && hiFret(s) + 12 <= GUITAR.fretCount) {
        s = octaveUp(s);
      }
      if (s.length) prevLo = loFret(s);
      return { degree: degrees[i], shape: s, index: counter++ };
    });
    return { key, rows };
  });

  const flat = groups.flatMap((g) => g.rows);
  const shapes = flat.map((r) => r.shape);

  const stopAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlayingSet(null);
  };
  useEffect(() => stopAll, [root, scale, seventh, structure.id, inversion]);

  const playShape = (shape: PlacedNote[]) =>
    shape.length && playChord(shape.map((p) => midiOf(p.note)));

  // Clicking a chord SELECTS it; it doesn't play. Sound is always deliberate
  // here — press a ▶. (See the note in InversionLadder.)
  const selectRow = (i: number) => {
    stopAll();
    setPinned(i);
  };
  const playRow = (i: number) => {
    stopAll();
    setPinned(i);
    playShape(shapes[i] ?? []);
  };

  // A whole set, played as a chord scale. Pressing it again stops it.
  const toggleSet = (g: (typeof groups)[number]) => {
    const wasPlaying = playingSet === g.key;
    stopAll();
    if (wasPlaying) return;
    setPlayingSet(g.key);
    g.rows.forEach((r, n) => {
      timers.current.push(
        window.setTimeout(() => {
          setPinned(r.index);
          playShape(r.shape);
          if (n === g.rows.length - 1) {
            timers.current.push(window.setTimeout(() => setPlayingSet(null), STEP_MS));
          }
        }, n * STEP_MS),
      );
    });
  };

  const viewRef = useRef<HTMLDivElement>(null);
  useStepper(viewRef, flat.length, pinned, selectRow);

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
        </div>

        <div className="controls-row">
          <Segmented
            ariaLabel="Voicing"
            options={Array.from({ length: voiceCount }, (_, i) => ({
              value: i,
              label: voicingName(sample, structure, i),
            }))}
            value={inversion}
            onChange={setInversionIndex}
          />
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="control-hint control-hint--warn">
          These close-voiced seventh chords don't lay out as a chord scale on any
          one string set — try Drop 2 or Drop 3.
        </p>
      ) : (
        <>
          <Fretboard
            instrument={GUITAR}
            tuning={GUITAR_STANDARD}
            shapes={shapes}
            activeShapeIndex={pinned}
            onShapeTap={selectRow}
            onBackgroundClick={() => setPinned(null)}
            labelMode={labelMode}
          />

          <div className="voicing-sets">
            {groups.map((g) => (
              <section className="voicing-set" key={g.key}>
                <header className="voicing-set__head">
                  <button
                    className="tab-play"
                    aria-label={`${playingSet === g.key ? 'Stop' : 'Play'} the chord scale on the ${setLabel(g.key)} strings`}
                    onClick={() => toggleSet(g)}
                  >
                    {playingSet === g.key ? '❙❙' : '▶'}
                  </button>
                  <span className="voicing-set__name">{setLabel(g.key)}</span>
                  <span className="voicing-set__note">strings</span>
                </header>

                <div className="tab-shelf">
                  {g.rows.map((r) => (
                    <div
                      key={r.index}
                      className={
                        'tab-card' + (r.index === pinned ? ' tab-card--on' : '')
                      }
                      onClick={() => selectRow(r.index)}
                    >
                      {/* Both of the chord's names: what it IS, then what it's
                          DOING in the key. */}
                      <div className="tab-row-head">
                        <button
                          className="tab-play"
                          aria-label={`Play ${r.degree.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            playRow(r.index);
                          }}
                        >
                          ▶
                        </button>
                        <span className="tab-row-title tab-row-title--chord">
                          {noteName(r.degree.chordRoot)}
                          {r.degree.chord.symbol}
                        </span>
                        <span className="tab-row-roman">{r.degree.roman}</span>
                      </div>
                      <TabView
                        instrument={GUITAR}
                        tuning={GUITAR_STANDARD}
                        placed={r.shape}
                        caption={`fr. ${loFret(r.shape)}`}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="footnote">
            The whole key harmonised, on every string set that holds all seven
            chords — the same progression in three or four places on the neck.
            Each block climbs from its lowest chord, so the cycle starts wherever
            the key actually sits lowest rather than always on I.
          </footer>
        </>
      )}
    </>
  );
}
