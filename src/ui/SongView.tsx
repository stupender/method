// ============================================================================
// ui/SongView.tsx — the Song area: a multi-chord lead sheet + the GPS reveal
// ----------------------------------------------------------------------------
// Lay out a song as a row of chord "bars". Select a bar to edit its chord
// (root + quality) or to reveal what you can play over it. The reveal shows
// every key that chord could live in — and as you add more chords, the keys
// that fit the WHOLE progression stay lit while the rest dim, so the harmonic
// possibility space narrows visibly as you commit.
//
// A "song" can be one chord (a drone), a few bars, or (later) a whole songbook.
// Rhythm/timing, import and voice-leading build on top of this (see BACKLOG.md).
// ============================================================================

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Note, PlacedNote } from '../theory/types';
import { CHORDS } from '../data/chords';
import { SCALES } from '../data/scales';
import { ROOT_CHOICES } from '../data/roots';
import { STRUCTURES } from '../data/voicings';
import { GUITAR } from '../data/instruments';
import { GUITAR_STANDARD } from '../data/tunings';
import {
  keysContaining,
  keysContainingAll,
  type KeyMatch,
} from '../theory/keys';
import { diatonicChords } from '../theory/harmony';
import {
  placeVoicingAll,
  structuresForChord,
  structureName,
  inversionCount,
  inversionName,
} from '../theory/chord';
import { voiceLeadProgression } from '../theory/voiceLeading';
import { noteName, pitchClassOf, spellNoteFromInterval, midiOf } from '../theory/notes';
import { playProgression } from '../audio/player';

const CHORD_LIST = Object.values(CHORDS);
const SCALE_ORDER = Object.values(SCALES);

// Time signatures we offer (top number = beats per bar, quarter-note beats).
const TIME_SIGS = [
  { label: '4/4', beatsPerBar: 4 },
  { label: '3/4', beatsPerBar: 3 },
  { label: '2/4', beatsPerBar: 2 },
  { label: '5/4', beatsPerBar: 5 },
];
// A friendly beat count, e.g. 2.5 -> "2½ beats", 1 -> "1 beat".
function formatBeats(b: number): string {
  const whole = Math.floor(b);
  const frac = ({ 0.25: '¼', 0.5: '½', 0.75: '¾' } as Record<number, string>)[
    Math.round((b - whole) * 100) / 100
  ] ?? '';
  const num = whole === 0 ? frac : `${whole}${frac}`;
  return `${num} ${b === 1 ? 'beat' : 'beats'}`;
}
const BPM = 100; // playback tempo
const PX_PER_BEAT = 46; // timeline scale
const SNAP = 0.25; // drag snaps to a sixteenth note
const MIN_DUR = 0.25; // a chord must last at least this
const CHORD_LANE_H = 40; // height of the chord-symbol lane (top of a system)
const STRING_GAP = 15; // vertical gap between TAB staff string lines

// Resize a chord by dragging one of its edges by `delta` beats. An edge sits on
// the boundary with a neighbour, so dragging it TRADES time between the two
// chords (one grows, the other shrinks). The exception is the very last chord's
// right edge, which has no neighbour, so it just extends the song. Pure: takes
// the durations at drag-start and returns the new durations.
function resizeAtEdge(
  origDurs: number[],
  index: number,
  edge: 'left' | 'right',
  delta: number,
): number[] {
  const durs = origDurs.slice();
  // The two chords sharing this edge's boundary.
  const a = edge === 'right' ? index : index - 1; // chord ending at the boundary
  const b = a + 1; // chord starting at the boundary (may not exist)

  if (b >= durs.length) {
    durs[a] = Math.max(MIN_DUR, durs[a] + delta); // last edge: extend the song
    return durs;
  }
  let newA = durs[a] + delta;
  let newB = durs[b] - delta;
  if (newA < MIN_DUR) {
    newB -= MIN_DUR - newA;
    newA = MIN_DUR;
  }
  if (newB < MIN_DUR) {
    newA -= MIN_DUR - newB;
    newB = MIN_DUR;
  }
  durs[a] = newA;
  durs[b] = newB;
  return durs;
}

// One chord in the chart — stored as indices so it's easy to edit, plus how long
// it lasts (in beats). Chords lay end to end; bar lines come from the time sig.
interface ChartChord {
  rootIndex: number;
  chordId: string;
  durationBeats: number;
}

// The MIDI notes of a chord (close root position) — for playback.
function chordMidis(c: ChartChord): number[] {
  const root = ROOT_CHOICES[c.rootIndex];
  return CHORDS[c.chordId].intervals.map((iv) => midiOf(spellNoteFromInterval(root, iv)));
}

const chordLabel = (c: ChartChord) =>
  `${noteName(ROOT_CHOICES[c.rootIndex])}${CHORDS[c.chordId].symbol}`;

// A stable key for a (tonic, scale) pair, by pitch class so spelling doesn't matter.
const keyId = (tonic: Note, scaleId: string) => `${pitchClassOf(tonic)}:${scaleId}`;

export function SongView() {
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [bpm, setBpm] = useState(BPM);
  const [chords, setChords] = useState<ChartChord[]>([
    { rootIndex: 5, chordId: 'minor-triad', durationBeats: 4 }, // Fm, one bar
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openKey, setOpenKey] = useState<KeyMatch | null>(null);
  // Voice leading: when on, the SELECTED chord is the anchor; its voicing
  // (structure + inversion) seeds smooth voicings for the rest.
  const [voiceLead, setVoiceLead] = useState(false);
  const [anchorStructureId, setAnchorStructureId] = useState('close');
  const [anchorInversion, setAnchorInversion] = useState(0);

  const selected = chords[selectedIndex] ?? chords[0];
  const selRoot = ROOT_CHOICES[selected.rootIndex];
  const selChord = CHORDS[selected.chordId];

  // --- Voice-leading: pick the anchor's voicing, lead the rest around it ----
  const anchorStructures = structuresForChord(selChord, STRUCTURES);
  const anchorStructure = anchorStructures.find((s) => s.id === anchorStructureId) ?? anchorStructures[0];
  const anchorInv = Math.min(anchorInversion, inversionCount(selChord) - 1);
  let voicedShapes: PlacedNote[][] = [];
  if (voiceLead) {
    const anchorShape =
      placeVoicingAll(GUITAR, GUITAR_STANDARD, selRoot, selChord, anchorStructure, anchorInv)[0] ?? [];
    voicedShapes = voiceLeadProgression(
      GUITAR,
      GUITAR_STANDARD,
      chords.map((c) => ({ root: ROOT_CHOICES[c.rootIndex], chord: CHORDS[c.chordId] })),
      selectedIndex,
      anchorShape,
    );
  }

  // --- Timing: where each chord starts, and how many bars the song spans -----
  const starts: number[] = [];
  let acc = 0;
  for (const c of chords) {
    starts.push(acc);
    acc += c.durationBeats;
  }
  const totalBeats = acc;
  const barCount = Math.max(1, Math.ceil(totalBeats / beatsPerBar));
  // Wrap the chart into rows of bars, like a real lead sheet.
  const barsPerRow = 4;
  const rowBeats = barsPerRow * beatsPerBar;
  const rowCount = Math.ceil(barCount / barsPerRow);
  // A "system" (row) is the chord lane plus, when voiced, a TAB staff under it.
  const staffHeight = (GUITAR.stringCount - 1) * STRING_GAP;

  // The selected chord's keys, and the keys that fit the WHOLE progression.
  const selectedKeys = keysContaining(selRoot, selChord);
  const progressionKeys = keysContainingAll(
    chords.map((c) => ({ root: ROOT_CHOICES[c.rootIndex], chord: CHORDS[c.chordId] })),
  );
  const progressionKeyIds = new Set(
    progressionKeys.map((m) => keyId(m.tonic, m.scale.id)),
  );
  const fitCount = selectedKeys.filter((m) =>
    progressionKeyIds.has(keyId(m.tonic, m.scale.id)),
  ).length;

  // --- Editing the chart --------------------------------------------------
  const editSelected = (patch: Partial<ChartChord>) => {
    setChords((cs) => cs.map((c, i) => (i === selectedIndex ? { ...c, ...patch } : c)));
    setOpenKey(null);
  };
  const addChord = () => {
    // Copy the current chord, but default a new one to a full bar.
    setChords((cs) => [...cs, { ...selected, durationBeats: beatsPerBar }]);
    setSelectedIndex(chords.length);
    setOpenKey(null);
  };
  const removeChord = (i: number) => {
    if (chords.length === 1) return;
    setChords((cs) => cs.filter((_, j) => j !== i));
    setSelectedIndex((s) => (s >= i && s > 0 ? s - 1 : s));
    setOpenKey(null);
  };

  // --- Dragging a chord edge to resize it ---------------------------------
  const drag = useRef<{ index: number; edge: 'left' | 'right'; startX: number; origDurs: number[] } | null>(null);

  const onEdgeDown = (e: ReactPointerEvent, index: number, edge: 'left' | 'right') => {
    e.stopPropagation(); // don't also select the chord
    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    drag.current = {
      index,
      edge,
      startX: e.clientX,
      origDurs: chords.map((c) => c.durationBeats),
    };
  };
  const onEdgeMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const delta = Math.round((e.clientX - d.startX) / PX_PER_BEAT / SNAP) * SNAP;
    const newDurs = resizeAtEdge(d.origDurs, d.index, d.edge, delta);
    setChords((cs) => cs.map((c, j) => ({ ...c, durationBeats: newDurs[j] })));
  };
  const onEdgeUp = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    drag.current = null;
  };

  // Strum the progression in time at BPM (chords sustain for their duration).
  // When voice-leading is on, play the voice-led shapes; otherwise close root.
  const playSong = () => {
    const secPerBeat = 60 / bpm;
    playProgression(
      chords.map((c, i) => ({
        midis:
          voiceLead && voicedShapes[i]
            ? voicedShapes[i].map((p) => midiOf(p.note))
            : chordMidis(c),
        atSec: starts[i] * secPerBeat,
        durSec: c.durationBeats * secPerBeat,
      })),
    );
  };

  return (
    <>
      {/* Transport: time signature + play. */}
      <div className="controls-row">
        <div className="control-group" role="group" aria-label="Time signature">
          {TIME_SIGS.map((t) => (
            <button
              key={t.label}
              className={t.beatsPerBar === beatsPerBar ? 'pill pill--on' : 'pill'}
              onClick={() => setBeatsPerBar(t.beatsPerBar)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button className="pill pill--play" onClick={playSong}>
          ▶ Play
        </button>
        {/* Tempo. */}
        <div className="tempo" role="group" aria-label="Tempo">
          <button className="pill pill--tiny" onClick={() => setBpm((b) => Math.max(40, b - 5))}>
            –
          </button>
          <span className="tempo__value">♩ = {bpm}</span>
          <button className="pill pill--tiny" onClick={() => setBpm((b) => Math.min(280, b + 5))}>
            +
          </button>
        </div>
        <button className="chart-add" onClick={addChord}>
          + Add chord
        </button>
        <button
          className={voiceLead ? 'pill pill--on' : 'pill'}
          onClick={() => setVoiceLead((v) => !v)}
        >
          Voice-lead
        </button>
      </div>

      {/* The lead sheet as a SCORE: chord symbols on top, an aligned TAB staff
          below (when voiced), bar lines running through both — wrapped into rows
          (systems) of bars. The chord block IS where the chord name goes above a
          staff; the staff under it is the notation. */}
      <div className="score">
        {Array.from({ length: rowCount }, (_, r) => {
          const barsInRow = Math.min(barsPerRow, barCount - r * barsPerRow);
          const rowStart = r * rowBeats;
          const rowSpanBeats = barsInRow * beatsPerBar;
          const systemH = CHORD_LANE_H + (voiceLead ? staffHeight + 14 : 0);
          return (
            <div
              key={`row-${r}`}
              className="system"
              style={{ width: rowSpanBeats * PX_PER_BEAT, height: systemH }}
            >
              {/* Bar lines, full system height. */}
              {Array.from({ length: barsInRow + 1 }, (_, b) => (
                <div
                  key={`bar-${b}`}
                  className="system-bar"
                  style={{ left: b * beatsPerBar * PX_PER_BEAT }}
                />
              ))}

              {/* Chord-symbol lane: one block per chord segment in this row. */}
              {chords.map((c, i) => {
                const start = starts[i];
                const end = start + c.durationBeats;
                const segStart = Math.max(start, rowStart);
                const segEnd = Math.min(end, rowStart + rowSpanBeats);
                if (segEnd <= segStart) return null;
                const isStart = segStart === start;
                const isEnd = segEnd === end;
                return (
                  <div
                    key={i}
                    className={
                      'tl-chord' +
                      (i === selectedIndex ? ' tl-chord--on' : '') +
                      (isStart ? '' : ' tl-chord--cont')
                    }
                    style={{
                      left: (segStart - rowStart) * PX_PER_BEAT,
                      width: (segEnd - segStart) * PX_PER_BEAT,
                    }}
                    onClick={() => {
                      setSelectedIndex(i);
                      setOpenKey(null);
                    }}
                  >
                    {isStart && <span className="tl-chord__label">{chordLabel(c)}</span>}
                    {isStart && chords.length > 1 && (
                      <button
                        className="tl-chord__remove"
                        aria-label="Remove chord"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeChord(i);
                        }}
                      >
                        ×
                      </button>
                    )}
                    {isStart && i > 0 && (
                      <div
                        className="tl-handle tl-handle--left"
                        onPointerDown={(e) => onEdgeDown(e, i, 'left')}
                        onPointerMove={onEdgeMove}
                        onPointerUp={onEdgeUp}
                      />
                    )}
                    {isEnd && (
                      <div
                        className="tl-handle tl-handle--right"
                        onPointerDown={(e) => onEdgeDown(e, i, 'right')}
                        onPointerMove={onEdgeMove}
                        onPointerUp={onEdgeUp}
                      />
                    )}
                  </div>
                );
              })}

              {/* TAB staff: string lines + each chord's voiced frets, placed at
                  the chord's start, directly under its symbol. */}
              {voiceLead && (
                <div className="staff" style={{ top: CHORD_LANE_H, height: staffHeight }}>
                  {Array.from({ length: GUITAR.stringCount }, (_, line) => (
                    <div
                      key={`line-${line}`}
                      className="staff-line"
                      style={{ top: line * STRING_GAP }}
                    />
                  ))}
                  {chords.map((_c, i) => {
                    const start = starts[i];
                    // Draw the voicing only where the chord starts (in this row).
                    if (start < rowStart || start >= rowStart + rowSpanBeats) return null;
                    const x = (start - rowStart) * PX_PER_BEAT + 7;
                    return (voicedShapes[i] ?? []).map((p, k) => {
                      const tabRow = GUITAR.stringCount - 1 - p.position.stringIndex;
                      return (
                        <span
                          key={`${i}-${k}`}
                          className={
                            'staff-fret' + (i === selectedIndex ? ' staff-fret--on' : '')
                          }
                          style={{ left: x, top: tabRow * STRING_GAP }}
                        >
                          {p.position.fret}
                        </span>
                      );
                    });
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit the selected chord: its root, then its quality. */}
      <div className="control-group" role="group" aria-label="Chord root">
        {ROOT_CHOICES.map((note, i) => (
          <button
            key={`${note.letter}${note.accidental}`}
            className={i === selected.rootIndex ? 'pill pill--on' : 'pill'}
            onClick={() => editSelected({ rootIndex: i })}
          >
            {noteName(note)}
          </button>
        ))}
      </div>
      <div className="control-group control-group--wrap" role="group" aria-label="Chord quality">
        {CHORD_LIST.map((c) => (
          <button
            key={c.id}
            className={c.id === selected.chordId ? 'pill pill--on' : 'pill'}
            onClick={() => editSelected({ chordId: c.id })}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Duration is set by dragging the chord's edges on the timeline. */}
      <p className="control-hint">
        {chordLabel(selected)} lasts {formatBeats(selected.durationBeats)} — drag
        its edges on the timeline to resize.
      </p>

      {/* Auto voice-leading: the selected chord is the anchor; pick its voicing
          and the rest follow with the smoothest playable shapes. */}
      {voiceLead && (
        <div className="vl-panel">
          <p className="control-hint">
            Anchor: <strong>{chordLabel(selected)}</strong> — pick its voicing; the
            rest voice-lead to the nearest shapes.
          </p>
          <div className="control-group" role="group" aria-label="Anchor structure">
            {anchorStructures.map((s) => (
              <button
                key={s.id}
                className={s.id === anchorStructure.id ? 'pill pill--on' : 'pill'}
                onClick={() => setAnchorStructureId(s.id)}
              >
                {structureName(s, inversionCount(selChord))}
              </button>
            ))}
          </div>
          <div className="control-group" role="group" aria-label="Anchor inversion">
            {Array.from({ length: inversionCount(selChord) }, (_, i) => (
              <button
                key={i}
                className={i === anchorInv ? 'pill pill--on' : 'pill'}
                onClick={() => setAnchorInversion(i)}
              >
                {inversionName(i)}
              </button>
            ))}
          </div>
          {/* The voiced shapes appear on the TAB staff in the score above. */}
        </div>
      )}

      <p className="tagline">
        Over <strong>{chordLabel(selected)}</strong> — {selectedKeys.length} keys
        {chords.length > 1 && (
          <>
            , <strong>{fitCount}</strong> fit the whole progression
          </>
        )}
        .
      </p>

      {/* The possibility space for the selected chord. Keys that also fit the
          whole progression stay lit; the rest dim — the narrowing in place. */}
      <div className="reveal">
        {SCALE_ORDER.map((scale) => {
          const inSystem = selectedKeys.filter((m) => m.scale.id === scale.id);
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
                    const fits =
                      chords.length === 1 ||
                      progressionKeyIds.has(keyId(m.tonic, m.scale.id));
                    const cls =
                      'key-chip' +
                      (isOpen ? ' key-chip--on' : '') +
                      (fits ? '' : ' key-chip--faded');
                    return (
                      <button
                        key={`${noteName(m.tonic)}-${m.degree}`}
                        className={cls}
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

      {openKey && <KeyDetail match={openKey} />}
    </>
  );
}

// Shows every diatonic chord of a chosen key, with the selected chord's slot lit.
function KeyDetail({ match }: { match: KeyMatch }) {
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
