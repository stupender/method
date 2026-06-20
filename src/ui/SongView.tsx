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

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type Dispatch,
  type SetStateAction,
} from 'react';
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
import { parseChordSymbol, parseProgression } from '../theory/chordParser';
import { noteName, pitchClassOf, spellNoteFromInterval, midiOf } from '../theory/notes';
import { startPlayback, getAudioContext, type Playback } from '../audio/player';

const CHORD_LIST = Object.values(CHORDS);
const SCALE_ORDER = Object.values(SCALES);

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
const STAFF_GAP = 16; // breathing room between the chord lane and the TAB staff
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
// Exported because the SONG itself (the chord list) lives up in App, so it
// persists when you switch areas and so Possibility can append to it.
export interface ChartChord {
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

// The song's chord list (`chords`) is owned by App and handed in, so it persists
// across area switches and Possibility can add to it. Everything else here —
// tempo, time signature, which chord is selected, voice-leading — is view state
// local to this screen.
export function SongView({
  songId,
  chords,
  setChords,
}: {
  songId: string;
  chords: ChartChord[];
  setChords: Dispatch<SetStateAction<ChartChord[]>>;
}) {
  const [beatsPerBar, setBeatsPerBar] = useState(4); // time-sig numerator
  const [denominator, setDenominator] = useState(4); // time-sig bottom number
  const [bpm, setBpm] = useState(BPM);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openKey, setOpenKey] = useState<KeyMatch | null>(null);
  // Transport state: whether the song is playing, plus the metronome and chord-
  // mute toggles, and where the playhead is (in beats; null when stopped).
  const [isPlaying, setIsPlaying] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [muteChords, setMuteChords] = useState(false);
  const [countIn, setCountIn] = useState(false);
  // The playhead doubles as a CURSOR: while stopped it marks where Play will start
  // from (click the score to move it); while playing it sweeps. null = the top.
  const [playheadBeat, setPlayheadBeat] = useState<number | null>(null);
  // Text entry: type one chord by name, or paste a whole progression.
  const [chordText, setChordText] = useState('');
  const [chordTextError, setChordTextError] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState(false);
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

  // --- Transport: Play / Pause, the playhead, metronome, chord mute ---------
  // The running playback handle, and the animation-frame id driving the playhead.
  const playback = useRef<Playback | null>(null);
  const raf = useRef<number | null>(null);

  // Cut the audio and stop the animation, without touching the playhead.
  const stopAudio = () => {
    playback.current?.stop();
    playback.current = null;
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };
  // Pause: stop, but LEAVE the playhead where it is so Play resumes from there.
  const pause = () => {
    stopAudio();
    setIsPlaying(false);
  };
  // Reset: stop and rewind the cursor to the top (used when the song ends).
  const reset = () => {
    stopAudio();
    setIsPlaying(false);
    setPlayheadBeat(null);
  };

  // Start playing from `fromBeat`, optionally with a one-bar count-in. Schedules
  // the audio, then animates the playhead off the audio clock so the line and the
  // sound stay locked together (the clock is the single source of truth).
  const startSong = (fromBeat: number, withCountIn: boolean) => {
    // A "beat" is the time-signature's bottom note; tempo (♩) is the quarter.
    const secPerBeat = (60 / bpm) * (4 / denominator);
    const countInBeats = withCountIn ? beatsPerBar : 0;
    const countInSec = countInBeats * secPerBeat;

    // Chords whose tail is still ahead of the cursor — clipped to start at the
    // cursor, and pushed back by the count-in.
    const chordEvents = muteChords
      ? []
      : chords.flatMap((c, i) => {
          const end = starts[i] + c.durationBeats;
          if (end <= fromBeat) return [];
          const from = Math.max(starts[i], fromBeat);
          return [
            {
              midis:
                voiceLead && voicedShapes[i]
                  ? voicedShapes[i].map((p) => midiOf(p.note))
                  : chordMidis(c),
              atSec: countInSec + (from - fromBeat) * secPerBeat,
              durSec: (end - from) * secPerBeat,
            },
          ];
        });

    // Clicks: the count-in bar (always audible when counting in), then — if the
    // metronome is on — a click on every remaining beat, accented on downbeats.
    const clicks: { atSec: number; accent: boolean }[] = [];
    for (let b = 0; b < countInBeats; b++) {
      clicks.push({ atSec: b * secPerBeat, accent: b % beatsPerBar === 0 });
    }
    if (metronome) {
      for (let gb = Math.ceil(fromBeat - 1e-6); gb < totalBeats; gb++) {
        clicks.push({
          atSec: countInSec + (gb - fromBeat) * secPerBeat,
          accent: gb % beatsPerBar === 0,
        });
      }
    }

    const pb = startPlayback({ chordEvents, clicks, leadInSec: 0.12 });
    playback.current = pb;
    setIsPlaying(true);

    const ctx = getAudioContext();
    const tick = () => {
      // Elapsed since the song proper began (after the count-in).
      const songElapsed = ctx.currentTime - pb.startTime - countInSec;
      const beat = fromBeat + songElapsed / secPerBeat;
      if (beat >= totalBeats) {
        reset(); // reached the end — rewind to the top
        return;
      }
      setPlayheadBeat(Math.max(fromBeat, beat)); // hold at the start during count-in
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const togglePlay = () => {
    if (isPlaying) pause();
    else startSong(playheadBeat ?? 0, countIn);
  };

  // Click the score to move the playhead (a scrub). While playing, this seeks:
  // restart from the new spot (no count-in on a seek). While stopped, it just
  // parks the cursor there, ready for Play.
  const scrubTo = (beat: number) => {
    const b = Math.max(0, Math.min(totalBeats, Math.round(beat / SNAP) * SNAP));
    if (isPlaying) {
      stopAudio();
      startSong(b, false);
    } else {
      setPlayheadBeat(b);
    }
  };

  // --- Text entry: type one chord, or paste a whole progression ------------
  // Type a chord by name -> set the selected chord's root + quality.
  const applyChordText = () => {
    const parsed = parseChordSymbol(chordText);
    if (!parsed) {
      setChordTextError(true);
      return;
    }
    editSelected({ rootIndex: parsed.rootIndex, chordId: parsed.chordId });
    setChordText('');
    setChordTextError(false);
  };

  // Paste a progression -> replace the whole chart, or append to it.
  const applyPaste = (mode: 'replace' | 'append') => {
    const parsed = parseProgression(pasteText, beatsPerBar);
    if (parsed.length === 0) {
      setPasteError(true);
      return;
    }
    setPasteError(false);
    if (mode === 'replace') {
      setChords(parsed);
      setSelectedIndex(0);
    } else {
      setSelectedIndex(chords.length); // select the first appended chord
      setChords((cs) => [...cs, ...parsed]);
    }
    setOpenKey(null);
  };

  // Clean up the transport if this view ever unmounts mid-playback.
  useEffect(() => {
    return () => {
      playback.current?.stop();
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, []);

  // When the open song changes, reset this chart's view state: stop playback and
  // clear the playhead, selection and reveal. (Tempo / time-sig carry over.)
  useEffect(() => {
    stopAudio();
    setIsPlaying(false);
    setPlayheadBeat(null);
    setSelectedIndex(0);
    setOpenKey(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  return (
    <>
      {/* Transport: time signature + play. */}
      <div className="controls-row">
        <div className="timesig" role="group" aria-label="Time signature">
          <input
            type="number"
            min={1}
            max={32}
            value={beatsPerBar}
            onChange={(e) =>
              setBeatsPerBar(Math.max(1, Math.min(32, Number(e.target.value) || 1)))
            }
            aria-label="Beats per bar"
          />
          <span>/</span>
          <select
            value={denominator}
            onChange={(e) => setDenominator(Number(e.target.value))}
            aria-label="Beat unit"
          >
            {[2, 4, 8, 16].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <button className="pill pill--play" onClick={togglePlay}>
          {isPlaying ? '⏸ Pause' : '▶ Play'}
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
        {/* A click track, and the option to hear it WITHOUT the chords. */}
        <button
          className={metronome ? 'pill pill--on' : 'pill'}
          onClick={() => setMetronome((m) => !m)}
        >
          Metronome
        </button>
        <button
          className={muteChords ? 'pill pill--on' : 'pill'}
          onClick={() => setMuteChords((m) => !m)}
        >
          Mute chords
        </button>
        <button
          className={countIn ? 'pill pill--on' : 'pill'}
          onClick={() => setCountIn((c) => !c)}
        >
          Count-in
        </button>
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
          const systemH = CHORD_LANE_H + (voiceLead ? STAFF_GAP + staffHeight + 14 : 0);
          return (
            <div
              key={`row-${r}`}
              className="system"
              style={{ width: rowSpanBeats * PX_PER_BEAT, height: systemH }}
              onClick={(e) => {
                // Click anywhere on the row to move the playhead there (scrub).
                const rect = e.currentTarget.getBoundingClientRect();
                scrubTo(rowStart + (e.clientX - rect.left) / PX_PER_BEAT);
              }}
            >
              {/* Bar lines, full system height. */}
              {Array.from({ length: barsInRow + 1 }, (_, b) => (
                <div
                  key={`bar-${b}`}
                  className="system-bar"
                  style={{ left: b * beatsPerBar * PX_PER_BEAT }}
                />
              ))}

              {/* The playhead — a line sweeping in time, only in the row it's in. */}
              {playheadBeat != null &&
                playheadBeat >= rowStart &&
                playheadBeat < rowStart + rowSpanBeats && (
                  <div
                    className={'playhead' + (isPlaying ? '' : ' playhead--cursor')}
                    style={{ left: (playheadBeat - rowStart) * PX_PER_BEAT }}
                  />
                )}

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
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    {isEnd && (
                      <div
                        className="tl-handle tl-handle--right"
                        onPointerDown={(e) => onEdgeDown(e, i, 'right')}
                        onPointerMove={onEdgeMove}
                        onPointerUp={onEdgeUp}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                );
              })}

              {/* TAB staff: string lines + each chord's voiced frets, placed at
                  the chord's start, directly under its symbol. */}
              {voiceLead && (
                <div className="staff" style={{ top: CHORD_LANE_H + STAFF_GAP, height: staffHeight }}>
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

      {/* Edit the selected chord: its root, then its quality. The two rows are
          stacked with a gap so the chord-quality names don't touch the roots. */}
      <div className="chord-editor">
      {/* Type a chord by name as a shortcut for the root + quality pills. */}
      <form
        className="chord-input"
        onSubmit={(e) => {
          e.preventDefault();
          applyChordText();
        }}
      >
        <input
          type="text"
          value={chordText}
          placeholder="Type a chord — e.g. F-7, Cmaj7, Bø"
          aria-label="Type a chord"
          onChange={(e) => {
            setChordText(e.target.value);
            setChordTextError(false);
          }}
        />
        <button type="submit" className="pill">
          Set
        </button>
        {chordTextError && (
          <span className="control-hint control-hint--warn">Didn't recognise that chord.</span>
        )}
      </form>
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
      </div>

      {/* Paste a whole progression as text — tucked away in a disclosure so it
          doesn't crowd the editor. Bars split on "|", "," or new lines. */}
      <details className="paste-box">
        <summary>Paste a progression</summary>
        <textarea
          value={pasteText}
          placeholder={'e.g.  Dm7 | G7 | Cmaj7\nor    Am7  D7  | Gmaj7'}
          aria-label="Paste a progression"
          rows={3}
          onChange={(e) => {
            setPasteText(e.target.value);
            setPasteError(false);
          }}
        />
        <div className="controls-row">
          <button className="pill" onClick={() => applyPaste('replace')}>
            Replace chart
          </button>
          <button className="pill" onClick={() => applyPaste('append')}>
            Append
          </button>
          {pasteError && (
            <span className="control-hint control-hint--warn">
              Couldn't read any chords from that.
            </span>
          )}
        </div>
        <p className="control-hint">
          Bars split on <strong>|</strong>, <strong>,</strong> or a new line. Chords
          in the same bar share it. With no bar lines, each chord is its own bar.
        </p>
      </details>

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
        <strong>{chordLabel(selected)}</strong> exists in {selectedKeys.length} keys
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
