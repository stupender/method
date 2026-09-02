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
import type {
  Instrument,
  Note,
  Tuning,
  ScaleDefinition,
  PlacedNote,
  VoicingStructure,
} from '../theory/types';
import { diatonicChords } from '../theory/harmony';
import { placeScale, relabelByScale } from '../theory/scale';
import {
  candidateStringSets,
  placeVoicingOnSet,
  placeVoicingOnKeys,
  isStretch,
} from '../theory/chord';
import { midiOf, noteName } from '../theory/notes';
import { checkRowsAgree } from '../theory/agree';
import { playChord } from '../audio/player';
import { Board } from '../render/Board';
import { NeckPanel } from './NeckPanel';
import { SHOW_PLAY_BUTTONS } from './flags';
import { DegreeLegend } from './DegreeLegend';
import { useScrollFocus } from './useScrollFocus';
import { PageMarks } from './PageMarks';
import { LazySystem as System } from '../render/LazySystem';
import { useStepper } from './ShapeStepper';

// A stable key for a shape's string set, e.g. "0-1-2-3".
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

/** The lowest sounding note of a shape, named with its octave — "C3". */
function bassNoteOf(shape: PlacedNote[]): string {
  if (shape.length === 0) return '';
  const low = shape.reduce((a, b) => (midiOf(a.note) <= midiOf(b.note) ? a : b));
  return `${noteName(low.note)}${low.note.octave ?? ''}`;
}

// How long between chords when a set plays through.
const STEP_MS = 520;

// The widest a single grip may be, in frets. Matches REACH_SPAN in
// theory/chord.ts: what a hand can genuinely do, as opposed to what's
// comfortable. A chord scale is allowed its stretches — it isn't allowed
// sprawls.
const HAND_REACH = 6;

export function ChordScaleLadder({
  instrument,
  tuning,
  root,
  scale,
  seventh,
  structure,
  inversion,
  labelMode = 'degree',
}: {
  /** WHICH NECK. Handed in rather than imported — this view draws whatever
   *  it's given and knows nothing about guitars. */
  instrument: Instrument;
  tuning: Tuning;
  root: Note;
  scale: ScaleDefinition;
  seventh: boolean;
  // Voicing and bass note both come from the CONTROLS panel — one measure, one
  // place, and the two ladders can't drift apart.
  structure: VoicingStructure;
  inversion: number;
  // What the dots say — a global display setting, owned by the view above.
  labelMode?: 'note' | 'degree';
}) {
  const [pinned, setPinned] = useState<number | null>(null);
  const [playingSet, setPlayingSet] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const degrees = diatonicChords(root, scale, seventh);

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
  // EVERY CHORD ON THE SAME STRINGS. A chord scale is one shape climbing the
  // key, so the string set is chosen FIRST and every chord is asked to sit on
  // it — rather than each chord picking its own best home and the ladder
  // keeping whatever they happened to agree on.
  //
  // That agreement was the bug. Open triads with the 5th in the bass sit on
  // E-D-G as majors and E-A-G as minors, so nothing was common to all seven
  // and the page came up empty — even though all seven fit E-D-G perfectly
  // well, at spans of three and four frets. Asked directly, they place.
  //
  // Stretches are accepted here on purpose. Holding the shape is worth more
  // than every grip being comfortable, and a stretched one is marked as such.
  //
  // ...and RELABELLED against the key. A chord scale frames the whole key, so
  // every note's colour should be its degree of the SCALE — in C major the Dm
  // chord is orange-green-indigo (2, 4, 6), not red-yellow-blue. Left as the
  // engine produces them, all seven chords would come out identically coloured
  // and the harmony's movement through the key would be invisible.
  const voiceCount = degrees[0]
    ? (seventh ? 4 : 3)
    : 3;

  // A KEYBOARD HAS ONE STRING SET, and it isn't a choice. Everything below
  // this — which run of strings, how wide a span, where the skip falls — is a
  // guitarist's question about where on six strings to put four notes. On a
  // keyboard each pitch is one key, so the chord scale is simply the seven
  // chords, each voiced where it sounds. One block, seven rows.
  const keys = instrument.layout === 'keys';
  const keySet = keys
    ? [
        {
          key: 'keys',
          shapes: degrees.map((d) =>
            placeVoicingOnKeys(
              instrument,
              tuning,
              d.chordRoot,
              d.chord,
              structure,
              inversion,
            ),
          ),
        },
      ].filter((s) => s.shapes.every((sh) => sh !== null))
        .map((s) => ({
          key: s.key,
          shapes: s.shapes.map((sh) => relabelByScale(root, scale, sh as PlacedNote[])),
        }))
    : [];

  const sets = keys ? keySet : candidateStringSets(voiceCount, instrument.stringCount)
    .map((strings) => ({
      key: strings.join('-'),
      strings,
      shapes: degrees.map((d) =>
        placeVoicingOnSet(
          instrument,
          tuning,
          d.chordRoot,
          d.chord,
          structure,
          inversion,
          strings,
        ),
      ),
    }))
    // Only sets that hold the WHOLE key — which is what the fix above buys.
    .filter((s) => s.shapes.every((sh) => sh !== null))
    // ...AND THAT A HAND CAN ACTUALLY HOLD. Asking for a set by name means no
    // span check happens on the way in, so an open triad would also "fit" the
    // adjacent E-A-D — as a seven-fret reach. Stretches are allowed here and
    // wanted; sprawls aren't. Six frets is the limit used everywhere else in
    // the voicing engine for what a hand can genuinely do, and it's measured
    // against the WORST chord in the set, since all seven have to be playable
    // for the set to be worth offering.
    .filter((s) => {
      const worst = Math.max(
        ...s.shapes.map((sh) => {
          const frets = (sh as PlacedNote[]).map((p) => p.position.fret);
          return Math.max(...frets) - Math.min(...frets);
        }),
      );
      return worst <= HAND_REACH;
    })
    .map((s) => ({
      key: s.key,
      shapes: s.shapes.map((sh) => relabelByScale(root, scale, sh as PlacedNote[])),
    }))
    .sort((a, b) => Number(a.key.split('-')[0]) - Number(b.key.split('-')[0]));

  // ONE SET PER BASS STRING. With a skipped string there's more than one way to
  // lay a voicing out from the same bass — an open triad on the low E can put
  // the gap after the bass (E-D-G) or after the middle voice (E-A-G) — and
  // showing both makes a page of near-duplicates where the useful question is
  // just "where's the bass". So the sets are grouped by their lowest string and
  // the most comfortable one wins, which is Stu's "E string bass, A string
  // bass, D string bass" exactly.
  //
  // It also picks the RIGHT gap by itself rather than by a rule that would have
  // to be wrong somewhere. The skip belongs on the voicing's widest interval,
  // and that's simply the layout that ends up narrowest: root in bass takes
  // E-A-G at a 2-fret span, 3rd in bass takes E-D-G at 2, and 5th in bass —
  // where both intervals are sixths and neither layout is comfortable — ties at
  // 4 and breaks toward the earlier skip, which is the bass-skip-3rd-root shape
  // Stu described.
  const spanOf = (set: (typeof sets)[number]) =>
    Math.max(
      ...set.shapes.map((sh) => {
        const frets = sh.map((p) => p.position.fret);
        return Math.max(...frets) - Math.min(...frets);
      }),
    );
  // WHICH LAYOUT WINS, in order:
  //   1. adjacent strings, when the voicing sits on them COMFORTABLY — that's
  //      a close grip, and a close voicing shouldn't be sprawled over a skipped
  //      string. "Comfortably" is the point: merely REACHABLE isn't enough,
  //      because an open triad will technically reach three adjacent strings at
  //      a six-fret span, and preferring that put a sprawl ahead of a two-fret
  //      skip grip;
  //   2. otherwise the gap goes RIGHT AFTER THE BASS — bass, skip, then the
  //      rest. Stu's rule, and the reason it beats "whichever is narrowest" is
  //      that it holds across all three bass strings and all three bass notes,
  //      so the shape you learn on the low E is the shape you play on the A.
  //      Ranking by comfort instead picked a different gap for the 5th in the
  //      bass than for the 3rd, and the set moved under you as you changed
  //      inversion;
  //   3. and only then the narrowest, to settle anything still tied.
  const gapAfter = (key: string) => {
    const strings = key.split('-').map(Number);
    for (let i = 1; i < strings.length; i++) {
      if (strings[i] - strings[i - 1] > 1) return i - 1;
    }
    return Infinity; // adjacent all the way — no gap at all
  };
  const COMFORTABLE = 4; // frets under one hand without reaching
  const rank = (set: (typeof sets)[number]): [number, number, number] => {
    const gap = gapAfter(set.key);
    const span = spanOf(set);
    const adjacentAndEasy = gap === Infinity && span <= COMFORTABLE;
    return [adjacentAndEasy ? 0 : 1, adjacentAndEasy ? 0 : gap, span];
  };
  const better = (a: (typeof sets)[number], b: (typeof sets)[number]) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i];
    return false;
  };
  const byBass = new Map<number, (typeof sets)[number]>();
  for (const set of sets) {
    const bass = Number(set.key.split('-')[0]);
    const held = byBass.get(bass);
    if (!held || better(set, held)) byBass.set(bass, set);
  }
  const chosen = [...byBass.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, set]) => set);

  // One block per string set. Within a block the key CLIMBS: start from the
  // lowest chord on the neck and octave-shift each following chord up when it
  // would otherwise fall below the one before it.
  //
  // Starting from the lowest matters. Always starting on I stranded everything
  // below it — in C major on the top set that meant beginning at fret 5 and
  // running off the neck while V, vi and vii° sat unseen down at frets 0–3.
  let counter = 0;
  const groups = chosen.map(({ key, shapes: base }) => {
    const startAt = base.reduce(
      (best, s, i) => (s.length && (!base[best].length || loFret(s) < loFret(base[best])) ? i : best),
      0,
    );
    let prevLo = -1;
    const rows = Array.from({ length: degrees.length }, (_, k) => {
      const i = (startAt + k) % degrees.length;
      let s = base[i];
      while (s.length && loFret(s) < prevLo && hiFret(s) + 12 <= instrument.fretCount) {
        s = octaveUp(s);
      }
      if (s.length) prevLo = loFret(s);
      return { degree: degrees[i], shape: s, index: counter++ };
    });
    return { key, rows };
  });


  // EVERY NOTE OF THE FRAME, ALL THE WAY UP THE NECK — faded, behind the
  // voicings. A set of chord shapes occupies about an octave, so without this
  // the neck went dark above and below them and the instrument looked like it
  // stopped there. Scales mode has always drawn the whole constellation and lit
  // a path through it; this is Harmony doing the same thing.
  //
  // The faded set is the SCALE the colour key is already showing, not just the
  // chord's own three or four tones, so every colour on the neck means what the
  // legend above it says it means — and the voicing reads as a path chosen
  // through the key rather than as the only notes there are.
  const wholeNeck = placeScale(instrument, tuning, root, scale);

  const flat = groups.flatMap((g) => g.rows);
  const shapes = flat.map((r) => r.shape);
  // These rows are numbered in the order they're built and never re-sorted, so
  // they agree by construction — but the inversion grid also looked like it
  // agreed by construction, right up until it didn't.
  checkRowsAgree('ChordScaleLadder', flat, shapes);

  // SCROLLING IS THE SELECTION. The unit here is the string-set BLOCK, not the
  // single card: the cards sit side by side in a row, so scrolling past them
  // would pick between neighbours at the same height more or less at random.
  // A block is a real thing to arrive at, and lighting the whole set at once is
  // the more useful picture anyway — you see where that set puts the chord all
  // the way up the neck.
  const [focusedSet, setFocusedSet] = useState<number | null>(null);
  const { register: focusRef, goTo } = useScrollFocus(groups.length, setFocusedSet);
  const litShapes =
    focusedSet !== null && groups[focusedSet]
      ? groups[focusedSet].rows.map((r) => r.index)
      : null;

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
  // On a keyboard there are no strings to name, so the one block says what it
  // actually is: the whole key, voiced.
  const setLabel = (key: string) =>
    keys
      ? 'The key'
      : key.split('-').map((i) => noteName(tuning.openNotes[+i])).join(' ');
  // "strings" after that name is a guitar word. On a keyboard the block is
  // "The key · harmonised", which says the same thing about the same thing.
  const setNote = keys ? 'harmonised' : 'strings';

  return (
    <>
      {/* No controls of its own any more: Type, Voicing and Inversion are all
          in the CONTROLS panel above. The empty div that used to sit here — a
          holder for the ← → keys' ref — is gone: it had no content but it did
          have a margin, so it was silently pushing the neck 28px further down
          than in Scales. The ref moved onto the workbench, which is the
          element that IS this view. */}
      {groups.length === 0 ? (
        <p className="control-hint control-hint--warn">
          {/* It used to say "these close-voiced seventh chords" whatever you
              were actually looking at. */}
          {structure.name} {seventh ? 'seventh chords' : 'triads'} with this bass
          note don't lay out on the neck in this key — try another bass note, or
          a different voicing.
        </p>
      ) : (
        <>
          {/* One mark per string set — see ui/PageMarks.tsx. */}
          <PageMarks
            items={groups.map((g) => setLabel(g.key))}
            active={pinned === null ? focusedSet : null}
            onGo={(i) => {
              stopAll();
              setPinned(null);
              setFocusedSet(i);
              goTo(i);
            }}
            label="String sets"
          />
          <div className="workbench" ref={viewRef}>
            <NeckPanel
              name={`${noteName(root)} ${scale.name}`}
              legend={<DegreeLegend root={root} scale={scale} />}
              /* The chord you've picked, spelled out in full, or the set
                 you've scrolled to. */
              aside={
                pinned !== null && flat[pinned]
                  ? `${noteName(flat[pinned].degree.chordRoot)} ${flat[pinned].degree.chord.name} · ${flat[pinned].degree.roman}`
                  : focusedSet !== null && groups[focusedSet]
                    ? `${setLabel(groups[focusedSet].key)} ${setNote}`
                    : undefined
              }
            >
            <Board
              instrument={instrument}
              tuning={tuning}
              highlights={wholeNeck}
              shapes={shapes}
              activeShapeIndex={pinned}
              activeShapeIndices={pinned === null ? litShapes : null}
              onBackgroundClick={() => setPinned(null)}
              labelMode={labelMode}
            />
          </NeckPanel>

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
                      aria-label={`${playingSet === g.key ? 'Stop' : 'Play'} the chord scale on ${setLabel(g.key)} ${setNote}`}
                      onClick={(e) => {
                        e.stopPropagation(); // selecting the set is the header's job
                        toggleSet(g);
                      }}
                    >
                      {playingSet === g.key ? '❙❙' : '▶'}
                    </button>
                  )}
                  <span className="voicing-set__name">{setLabel(g.key)}</span>
                  <span className="voicing-set__note">{setNote}</span>
                </header>

                <div className="tab-shelf">
                  {g.rows.map((r) => (
                    <div
                      key={r.index}
                      className={
                        'tab-card' + (r.index === pinned ? ' tab-card--on' : '')
                      }
                    >
                      {/* Both of the chord's names: what it IS, then what it's
                          DOING in the key. */}
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
                            aria-label={`Play ${r.degree.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              playRow(r.index);
                            }}
                          >
                            ▶
                          </button>
                        )}
                        <span className="tab-row-title tab-row-title--chord">
                          {noteName(r.degree.chordRoot)}
                          {r.degree.chord.symbol}
                        </span>
                        <span className="tab-row-roman">{r.degree.roman}</span>
                      </div>
                      {/* Notation over tablature, joined down the left —
                          one system, the way guitar music is set. */}
                      <System
                        events={[r.shape]}
                        strings={instrument.stringCount}
                        keyboard={keys}
                        width={210}
                      />
                      {/* Where on the neck, and whether it's a reach. The TAB
                          shows the frets; this says which end of the neck they
                          are, which the numbers alone don't. */}
                      {/* Where on the neck, and whether it's a reach. On a
                          keyboard neither is a fact about anything: there are
                          no frets, and every triad "spans" seven semitones
                          without being a stretch at all. So the caption says
                          the register instead — which is the useful thing
                          there, and the same question ("where is this?")
                          answered in the instrument's own terms. */}
                      <span className="tab-card__caption">
                        {keys
                          ? bassNoteOf(r.shape)
                          : isStretch(r.shape)
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
            {keys
              ? `The whole key harmonised, climbing from its lowest chord — so the
                 cycle starts where the key actually sits lowest rather than
                 always on I.`
              : `The whole key harmonised, on every string set that holds all seven
                 chords — the same progression in three or four places on the neck.
                 Each block climbs from its lowest chord, so the cycle starts
                 wherever the key actually sits lowest rather than always on I.`}
          </footer>
        </>
      )}
    </>
  );
}
