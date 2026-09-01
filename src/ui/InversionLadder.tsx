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
import type {
  Instrument,
  Note,
  Tuning,
  ScaleDefinition,
  ChordDefinition,
  PlacedNote,
  VoicingStructure,
} from '../theory/types';
import {
  placeVoicingByStringSet,
  isStretch,
  inversionCount,
  voicingName,
} from '../theory/chord';
import { midiOf, noteName } from '../theory/notes';
import { checkRowsAgree } from '../theory/agree';
import { playChord } from '../audio/player';
import { Fretboard } from '../render/Fretboard';
import { NeckPanel } from './NeckPanel';
import { SHOW_PLAY_BUTTONS } from './flags';
import { placeScale } from '../theory/scale';
import { DegreeLegend } from './DegreeLegend';
import { useScrollFocus } from './useScrollFocus';
import { LazySystem as System } from '../render/LazySystem';
import { useStepper } from './ShapeStepper';

const loFret = (shape: PlacedNote[]) =>
  shape.length ? Math.min(...shape.map((p) => p.position.fret)) : 0;

// How long between chords when a whole set plays through.
const STEP_MS = 620;

export function InversionLadder({
  instrument,
  tuning,
  root,
  chord,
  structure,
  gravity,
  labelMode = 'degree',
}: {
  /** WHICH NECK. Handed in rather than imported — this view draws whatever
   *  it's given and knows nothing about guitars. */
  instrument: Instrument;
  tuning: Tuning;
  root: Note;
  chord: ChordDefinition;
  // From the CONTROLS panel — see the note in ChordScaleLadder.
  structure: VoicingStructure;
  // Where gravity is held, for the neck's colour key: the mode this chord is
  // built on, so its 1, 3 and 5 are the chord's own root, 3rd and 5th.
  gravity: { root: Note; scale: ScaleDefinition };
  // What the dots say — a global display setting, owned by the view above.
  labelMode?: 'note' | 'degree';
}) {
  // The selected row, as an index into the flat list of every row on the page.
  // No hover state: a row stays selected until you pick another, so the neck
  // never shifts under you while you're reading it.
  const [pinned, setPinned] = useState<number | null>(null);
  // Which string set is currently sounding, if any.
  const [playingSet, setPlayingSet] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const voiceCount = inversionCount(chord);

  // GROUP BY REGISTER, NOT BY EXACT STRING SET.
  //
  // A "register" is the lowest string the grip starts on — from the low E, from
  // the A, from the D. For close and drop-2 voicings that's the same thing as
  // the string set, because those sit on adjacent strings and a register has
  // only one of those. For OPEN triads and drop 3 it isn't: which string the
  // skip falls on depends on the inversion, so root position might want E D G
  // while the 2nd inversion wants E A G.
  //
  // Grouping by exact set turned that into seven blocks, several holding a
  // single chord — the same voicing shattered across the page by an accident
  // of which string it skipped. Grouped by register there are three or four
  // blocks, each holding every inversion that can be played from that string,
  // which is what a guitarist means by "the same shape further up".
  const perInversion = Array.from({ length: voiceCount }, (_, inv) =>
    placeVoicingByStringSet(instrument, tuning, root, chord, structure, inv),
  );
  const registerOf = (shape: PlacedNote[]) =>
    Math.min(...shape.map((p) => p.position.stringIndex));
  const registers = [
    ...new Set(perInversion.flatMap((shapes) => shapes.map(registerOf))),
  ].sort((a, b) => a - b);

  // Build the blocks. NUMBERING COMES LAST, and that matters: the rows are
  // sorted by fret after they're built, and numbering them before that sort
  // meant a card's index pointed at whatever shape used to be in that slot.
  // On the D G B E strings you'd click "7th in bass" and the neck would light
  // root position. The index is now literally the row's position in the array
  // that becomes `shapes`, so the two cannot disagree.
  const groups = registers.map((register) => {
    const rows: { inv: number; shape: PlacedNote[] }[] = [];
    for (let inv = 0; inv < voiceCount; inv++) {
      const candidates = perInversion[inv].filter((s) => registerOf(s) === register);
      if (candidates.length === 0) continue;
      // placeVoicingByStringSet already kept only the best grip per register,
      // so there's at most one here; take the lowest if that ever changes.
      const shape = candidates.reduce((a, b) => (loFret(a) <= loFret(b) ? a : b));
      rows.push({ inv, shape });
    }
    rows.sort((a, b) => loFret(a.shape) - loFret(b.shape));
    return { key: String(register), rows };
  });

  // EVERY NOTE OF THE FRAME, ALL THE WAY UP THE NECK — faded, behind the
  // voicings. See the same note in ChordScaleLadder. The frame here is
  // GRAVITY's mode, which is exactly what the colour key beside the neck is
  // already showing, so the faded constellation and the legend agree.
  const wholeNeck = placeScale(instrument, tuning, gravity.root, gravity.scale);

  const flat = groups.flatMap((g) => g.rows);
  const shapes = flat.map((r) => r.shape);
  // One source of truth for "which shape is this row": its own position in the
  // list the fretboard is handed.
  const indexOf = new Map(flat.map((row, i) => [row, i]));
  checkRowsAgree(
    'InversionLadder',
    flat.map((row) => ({ shape: row.shape, index: indexOf.get(row)! })),
    shapes,
  );

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
      ? groups[focusedSet].rows.map((r) => indexOf.get(r)!)
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
          setPinned(indexOf.get(r)!);
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

  const stringNames = (shape: PlacedNote[]) =>
    shape
      .map((p) => p.position.stringIndex)
      .sort((a, b) => a - b)
      .map((i) => noteName(tuning.openNotes[i]))
      .join(' ');
  // Name a block by its strings when every inversion in it uses the same ones —
  // which is the usual case. When they differ (an open voicing skipping a
  // different string per inversion) naming one set would be a lie, so it's
  // named by where it starts instead.
  const groupLabel = (g: { key: string; rows: { shape: PlacedNote[] }[] }) => {
    const names = new Set(g.rows.map((r) => stringNames(r.shape)));
    if (names.size === 1) return [...names][0];
    return `from ${noteName(tuning.openNotes[Number(g.key)])}`;
  };

  return (
    <>
      {/* No controls of its own: Type and Voicing live in the CONTROLS panel.
          (There's no Inversion control here on purpose — this page already
          shows every inversion, so there'd be nothing to choose.) The empty
          ref-holder div that used to sit here is gone — see the note in
          ChordScaleLadder; between them the two were adding 56px of space
          Scales didn't have. */}
      {groups.length === 0 ? (
        <p className="control-hint control-hint--warn">
          This voicing doesn't fit anywhere on the neck — try Close, or a drop
          voicing.
        </p>
      ) : (
        <>
          <div className="workbench" ref={viewRef}>
            <NeckPanel
              /* The FULL name here — "D Diminished Triad", not "D°". This is
                 the one place on the page with room to say what a thing is,
                 and the abbreviations elsewhere are labels on cards. */
              name={`${noteName(root)} ${chord.name}`}
              legend={<DegreeLegend root={gravity.root} scale={gravity.scale} stacked />}
              /* What's lit RIGHT NOW: the one voicing if you've picked one,
                 otherwise the set you've scrolled to. It follows the selection
                 rather than always naming the block, because when a single
                 chord is showing, "E D G strings" describes the block it came
                 from and not the thing on the neck. */
              aside={
                pinned !== null && flat[pinned]
                  ? `${voicingName(chord, structure, flat[pinned].inv)} · ${stringNames(flat[pinned].shape)}`
                  : focusedSet !== null && groups[focusedSet]
                    ? `${groupLabel(groups[focusedSet])} strings`
                    : undefined
              }
            >
            <Fretboard
              instrument={instrument}
              tuning={tuning}
              highlights={wholeNeck}
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
                {/* TWO LEVELS OF SELECTION. Click the header and the WHOLE set
                    lights on the neck — every chord it holds, all the way up.
                    Click a chord and just that one lights. Clicking the header
                    is therefore also how you get back out of a single chord,
                    which is why it clears the pin. It sets the focused block
                    too, so it works on a set you can see but haven't scrolled
                    to; the next scroll takes over again, as it should. */}
                <header
                  className={
                    'voicing-set__head' +
                    (pinned === null && focusedSet === gi ? ' voicing-set__head--on' : '')
                  }
                  onClick={() => {
                    stopAll();
                    setPinned(null);
                    setFocusedSet(gi);
                  }}
                >
                  <span className="tab-row-mark" aria-hidden="true" />
                  {SHOW_PLAY_BUTTONS && (
                    <button
                      className="tab-play"
                      aria-label={`${playingSet === g.key ? 'Stop' : 'Play'} the ${groupLabel(g)} strings`}
                      onClick={(e) => {
                        e.stopPropagation(); // selecting the set is the header's job
                        toggleSet(g);
                      }}
                    >
                      {playingSet === g.key ? '❙❙' : '▶'}
                    </button>
                  )}
                  <span className="voicing-set__name">{groupLabel(g)}</span>
                  <span className="voicing-set__note">
                    {g.rows.length === voiceCount
                      ? 'strings'
                      : `strings — ${g.rows.length} of ${voiceCount}`}
                  </span>
                </header>

                <div className="tab-shelf">
                  {g.rows.map((r) => (
                    <div
                      key={indexOf.get(r)}
                      className={
                        'tab-card' +
                        (indexOf.get(r) === pinned ? ' tab-card--on' : '')
                      }
                      onClick={() => selectRow(indexOf.get(r)!)}
                    >
                      <div className="tab-row-head">
                        {/* The selected mark is a lit dot in front of the
                            name, the same lamp the controls use. A bar in the
                            left margin was the old mark, and it works for rows
                            stacked one per line — but in a grid the bar lands
                            in the gutter BETWEEN two cards, touching the one
                            before the one it means. */}
                        <span className="tab-row-mark" aria-hidden="true" />
                        {SHOW_PLAY_BUTTONS && (
                          <button
                            className="tab-play"
                            aria-label={`Play ${voicingName(chord, structure, r.inv)}`}
                            onClick={(e) => {
                              e.stopPropagation(); // selecting is the row's own job
                              playRow(indexOf.get(r)!);
                            }}
                          >
                            ▶
                          </button>
                        )}
                        <span className="tab-row-title">
                          {voicingName(chord, structure, r.inv)}
                        </span>
                      </div>
                      {/* Notation over tablature, joined down the left —
                          one system, the way guitar music is set. */}
                      <System events={[r.shape]} strings={instrument.stringCount} width={210} />
                      {/* Where on the neck, and whether it's a reach. The TAB
                          shows the frets; this says which end of the neck they
                          are, which the numbers alone don't. */}
                      <span className="tab-card__caption">
                        {isStretch(r.shape)
                          ? `fr. ${loFret(r.shape)} · a stretch`
                          : `fr. ${loFret(r.shape)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
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
