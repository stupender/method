// ============================================================================
// ui/InversionLadder.tsx — one chord, every inversion, on every string set
// ----------------------------------------------------------------------------
// This used to make you pick a string set from a selector and then showed that
// one set's inversions climbing the neck. Two problems with that: the thing you
// most want to compare — the same inversion on different string sets — was the
// one thing you could never see at once, and a control that hides three
// quarters of the answer is a control that shouldn't exist.
//
// So the string-set selector is gone and the sets are the STRUCTURE of the
// page. Each set gets its own block, named by the strings it uses (E A D, A D
// G, ...), holding that set's inversions in order up the neck. A triad gives 4
// sets x 3 inversions; a seventh chord gives 3 x 4. Twelve rows either way, and
// the whole grid is on screen at once.
//
// Every row is a track: its own play button, its own name, the TAB underneath.
// Each block's header plays its set straight through, so you can hear one set
// climb, then hear the next.
//
// One placement per inversion per set — the LOWEST one. The octave repeats
// above it are the same grip twelve frets up; listing them would double the
// page to say nothing new.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import type { Note, ChordDefinition, PlacedNote } from '../theory/types';
import { GUITAR } from '../data/instruments';
import { GUITAR_STANDARD } from '../data/tunings';
import { STRUCTURES } from '../data/voicings';
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
import { NeckPanel } from './NeckPanel';
import { useScrollFocus } from './useScrollFocus';
import { TabView } from '../render/TabView';
import { Segmented } from './Segmented';
import { useStepper } from './ShapeStepper';

const stringSetKey = (shape: PlacedNote[]) =>
  shape.map((p) => p.position.stringIndex).sort((a, b) => a - b).join('-');
const loFret = (shape: PlacedNote[]) =>
  shape.length ? Math.min(...shape.map((p) => p.position.fret)) : 0;

// How long between chords when a whole set plays through.
const STEP_MS = 620;

export function InversionLadder({
  root,
  chord,
  labelMode = 'degree',
}: {
  root: Note;
  chord: ChordDefinition;
  // What the dots say — a global display setting, owned by the view above.
  labelMode?: 'note' | 'degree';
}) {
  // null means "whatever suits this chord" — see defaultStructureId below. Held
  // as null rather than a concrete id so switching triads <-> sevenths re-picks
  // instead of stranding you on a voicing that barely fits.
  const [structureId, setStructureId] = useState<string | null>(null);
  // The selected row, as an index into the flat list of every row on the page.
  // No hover state: a row stays selected until you pick another, so the neck
  // never shifts under you while you're reading it.
  const [pinned, setPinned] = useState<number | null>(null);
  // Which string set is currently sounding, if any.
  const [playingSet, setPlayingSet] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const voiceCount = inversionCount(chord);
  const structures = structuresForChord(chord, STRUCTURES);
  // TRIADS want Close: all four string sets hold all three inversions, so you
  // get the complete 4 x 3 grid. SEVENTHS can't do that closed — a close-voiced
  // 7th only fits on the A D G B strings, which is precisely why guitarists
  // play them as DROP 2. Drop 2 gives the full 3 x 4: E A D G, A D G B,
  // D G B E, every inversion on each.
  const defaultStructureId = voiceCount === 4 ? 'drop2' : 'close';
  const structure =
    structures.find((s) => s.id === (structureId ?? defaultStructureId)) ?? structures[0];

  // Every inversion's placements, then every string set any of them lands on.
  // We deliberately DON'T hide the sets that can't hold all of them: a set that
  // takes only one inversion is still a real place to play the chord, and
  // hiding it would quietly delete part of the neck. The header says how many
  // it holds so a short block reads as a fact rather than a bug.
  const perInversion = Array.from({ length: voiceCount }, (_, inv) =>
    placeVoicingAll(GUITAR, GUITAR_STANDARD, root, chord, structure, inv),
  );
  const allSets = new Set<string>();
  for (const shapes of perInversion) for (const s of shapes) allSets.add(stringSetKey(s));
  const commonSets = [...allSets]
    // Low strings first, so the blocks read up the neck the way the guitar is
    // strung: E A D, then A D G, and so on.
    .sort((a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]));

  // Build the blocks, numbering every row as we go so the fretboard and the
  // keyboard stepper can address them all with one flat index.
  let counter = 0;
  const groups = commonSets.map((key) => {
    const rows = [];
    for (let inv = 0; inv < voiceCount; inv++) {
      // The lowest placement of this inversion on this set.
      const candidates = perInversion[inv].filter((s) => stringSetKey(s) === key);
      if (candidates.length === 0) continue;
      const shape = candidates.reduce((a, b) => (loFret(a) <= loFret(b) ? a : b));
      rows.push({ inv, shape, index: counter++ });
    }
    rows.sort((a, b) => loFret(a.shape) - loFret(b.shape));
    return { key, rows };
  });

  const flat = groups.flatMap((g) => g.rows);
  const shapes = flat.map((r) => r.shape);

  // SCROLLING IS THE SELECTION. The unit here is the string-set BLOCK, not the
  // single card: the cards sit side by side in a row, so scrolling past them
  // would pick between neighbours at the same height more or less at random.
  // A block is a real thing to arrive at, and lighting the whole set at once is
  // the more useful picture anyway — you see where that set puts the chord all
  // the way up the neck.
  const [focusedSet, setFocusedSet] = useState<number | null>(null);
  const focusRef = useScrollFocus(groups.length, setFocusedSet);
  const litShapes =
    focusedSet !== null && groups[focusedSet]
      ? groups[focusedSet].rows.map((r) => r.index)
      : null;

  const stopAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPlayingSet(null);
  };
  // Stop any run-through when the chord or voicing changes underneath us.
  useEffect(() => stopAll, [root, chord, structure.id]);

  const playShape = (shape: PlacedNote[]) =>
    shape.length && playChord(shape.map((p) => midiOf(p.note)));

  // Clicking a row SELECTS it — it doesn't play it. You want to look at these
  // far more often than you want to hear them, and a page that makes a noise
  // every time you point at something is a page you stop pointing at. Sound is
  // always deliberate here: press a ▶.
  const selectRow = (i: number) => {
    stopAll();
    setPinned(i);
  };
  const playRow = (i: number) => {
    stopAll();
    setPinned(i);
    playShape(shapes[i] ?? []);
  };

  // A whole set, climbing. Pressing it again stops it.
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

  // The ← → keys still walk the rows even though the stepper's buttons are
  // gone: every row is one click away now, so the arrows are a shortcut rather
  // than the only way through.
  const viewRef = useRef<HTMLDivElement>(null);
  useStepper(viewRef, flat.length, pinned, selectRow);

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
      </div>

      {groups.length === 0 ? (
        <p className="control-hint control-hint--warn">
          This voicing doesn't fit anywhere on the neck — try Close, or a drop
          voicing.
        </p>
      ) : (
        <>
          <NeckPanel
            aside={focusedSet !== null && groups[focusedSet] ? `${setLabel(groups[focusedSet].key)} strings` : undefined}
          >
            <Fretboard
              instrument={GUITAR}
              tuning={GUITAR_STANDARD}
              shapes={shapes}
              activeShapeIndex={pinned}
              activeShapeIndices={pinned === null ? litShapes : null}
              onShapeTap={selectRow}
              onBackgroundClick={() => setPinned(null)}
              labelMode={labelMode}
            />
          </NeckPanel>

          {/* One block per string set; one row per inversion inside it. */}
          <div className="voicing-sets">
            {groups.map((g, gi) => (
              <section className="voicing-set" key={g.key} ref={focusRef(gi)}>
                <header className="voicing-set__head">
                  <button
                    className="tab-play"
                    aria-label={`${playingSet === g.key ? 'Stop' : 'Play'} the ${setLabel(g.key)} strings`}
                    onClick={() => toggleSet(g)}
                  >
                    {playingSet === g.key ? '❙❙' : '▶'}
                  </button>
                  <span className="voicing-set__name">{setLabel(g.key)}</span>
                  <span className="voicing-set__note">
                    {g.rows.length === voiceCount
                      ? 'strings'
                      : `strings — ${g.rows.length} of ${voiceCount}`}
                  </span>
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
                      <div className="tab-row-head">
                        <button
                          className="tab-play"
                          aria-label={`Play ${voicingName(chord, structure, r.inv)}`}
                          onClick={(e) => {
                            e.stopPropagation(); // selecting is the row's own job
                            playRow(r.index);
                          }}
                        >
                          ▶
                        </button>
                        <span className="tab-row-title">
                          {voicingName(chord, structure, r.inv)}
                        </span>
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
            {noteName(root)}
            {chord.symbol} in every inversion, on every string set it reaches —
            each chord tone taking the bass in turn. The same inversion in two
            blocks is the same sound in a different place on the neck. Where a
            block is short, that voicing simply doesn't fit those strings:
            close-voiced sevenths only sit on A D G B, which is exactly why
            guitarists play them as Drop 2.
          </footer>
        </>
      )}
    </>
  );
}
