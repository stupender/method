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
import { keysContaining, type KeyMatch } from '../theory/keys';
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
import {
  chordsOverBass,
  keysContainingNotes,
  rankKeys,
  type BassSuggestion,
} from '../theory/suggest';
import { bassNoteName } from '../theory/chord';
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
const PX_PER_BEAT = 46; // timeline scale
const SNAP = 0.25; // drag snaps to a sixteenth note
const MIN_DUR = 0.25; // a chord must last at least this
const CHORD_LANE_H = 54; // chord-symbol lane height (symbol + its function label)
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
  // A bar that so far holds ONLY a bass note (the bass-first flow): the chord on
  // top is still an open question — the suggestion heat map answers it.
  bassOnly?: boolean;
  // A slash chord's bass ("C/E" -> E) — the note kept under the chord, whether it
  // came from typing a slash or from committing an inversion suggestion.
  bassIndex?: number;
}

// The MIDI notes of a chord (close root position) — for playback. A bass-only
// bar plays just its bass note, an octave down, so it sounds like a bass line;
// a slash chord gets its bass added underneath the same way.
function chordMidis(c: ChartChord): number[] {
  const root = ROOT_CHOICES[c.rootIndex];
  if (c.bassOnly) return [midiOf(root) - 12];
  const tones = CHORDS[c.chordId].intervals.map((iv) =>
    midiOf(spellNoteFromInterval(root, iv)),
  );
  if (c.bassIndex != null) tones.unshift(midiOf(ROOT_CHOICES[c.bassIndex]) - 12);
  return tones;
}

const chordLabel = (c: ChartChord) => {
  const root = noteName(ROOT_CHOICES[c.rootIndex]);
  if (c.bassOnly) return `${root} ?`;
  const slash = c.bassIndex != null ? `/${noteName(ROOT_CHOICES[c.bassIndex])}` : '';
  return `${root}${CHORDS[c.chordId].symbol}${slash}`;
};

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
  bpm,
  beatsPerBar,
  denominator,
  onMeter,
}: {
  songId: string;
  chords: ChartChord[];
  setChords: Dispatch<SetStateAction<ChartChord[]>>;
  // Meter + tempo belong to the open song (handed in), so each song keeps its own.
  bpm: number;
  beatsPerBar: number;
  denominator: number;
  // A patch, or an updater that reads the song's latest meter (for tempo +/-).
  onMeter: (
    update:
      | { bpm?: number; beatsPerBar?: number; denominator?: number }
      | ((m: { bpm: number; beatsPerBar: number; denominator: number }) => {
          bpm?: number;
          beatsPerBar?: number;
          denominator?: number;
        }),
  ) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openKey, setOpenKey] = useState<KeyMatch | null>(null);
  // Transport state: whether the song is playing, plus the metronome and chord-
  // mute toggles, and where the playhead is (in beats; null when stopped).
  const [isPlaying, setIsPlaying] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [muteChords, setMuteChords] = useState(false);
  const [countIn, setCountIn] = useState(false);
  // Loop: play the song round and round (the teaching vamp — set it going and
  // improvise over it). See startSong for how it stays gapless.
  const [loop, setLoop] = useState(false);
  // The playhead doubles as a CURSOR: while stopped it marks where Play will start
  // from (click the score to move it); while playing it sweeps. null = the top.
  const [playheadBeat, setPlayheadBeat] = useState<number | null>(null);
  // Text entry: type one chord by name, or paste a whole progression.
  const [chordText, setChordText] = useState('');
  const [chordTextError, setChordTextError] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState(false);
  // Bass-first entry: a bass line typed as plain notes, and the working key the
  // suggestions are read against (null = the first candidate).
  const [bassText, setBassText] = useState('');
  const [bassError, setBassError] = useState(false);
  const [workingKeyId, setWorkingKeyId] = useState<string | null>(null);
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

  // Every key the SELECTED chord is at home in (where it's a diatonic chord) —
  // the reveal below lists these, grouped by scale system. Which of them survive
  // once the WHOLE progression is considered is decided TOLERANTLY, from `ranked`
  // (computed just below), not by the old strict "contains every chord"
  // intersection — so the reveal speaks the same language as the Context strip.
  const selectedKeys = keysContaining(selRoot, selChord);

  // --- The Context strip: the search engine, visible ------------------------
  // Rank every key by how well it explains the COMMITTED bars (bass-only bars
  // are still open questions). Unlike the strict reveal intersection, an
  // out-of-key chord doesn't kill a key here — it reads as V7/x or borrowed.
  const committed = chords
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !c.bassOnly);
  const asTheory = (list: { c: ChartChord }[]) =>
    list.map(({ c }) => ({ root: ROOT_CHOICES[c.rootIndex], chord: CHORDS[c.chordId] }));
  const ranked = rankKeys(asTheory(committed));
  const ctxKey =
    ranked.find((k) => keyId(k.tonic, k.scale.id) === workingKeyId) ?? ranked[0];
  const explainedNow = ranked.filter((k) => k.allExplained).length;
  // The tolerant "does the whole song fit here?" set, SHARED with the reveal
  // below: keys that EXPLAIN every committed chord (each reads as diatonic,
  // secondary or borrowed — nothing left 'outside'). A reveal chip stays lit iff
  // its key is in here, so every lit chip is one of the strip's readings — the
  // two displays can no longer contradict each other.
  const explainedKeyIds = new Set(
    ranked.filter((k) => k.allExplained).map((k) => keyId(k.tonic, k.scale.id)),
  );
  // Of the selected chord's home keys, how many still explain the whole song.
  const fitCount = selectedKeys.filter((m) =>
    explainedKeyIds.has(keyId(m.tonic, m.scale.id)),
  ).length;
  // Each bar's function IN the working key, looked up by chart index — drawn on
  // the chord itself in the score (the numeral belongs with its chord, like a
  // lead-sheet analysis), so switching the hypothesis re-labels the score.
  const fnByIndex = new Map(
    ctxKey ? committed.map(({ i }, j) => [i, ctxKey.labels[j]] as const) : [],
  );
  // What the SELECTED bar does to the search: how many keys fully explained the
  // progression without it, vs with it. The narrowing, in numbers.
  const selCommittedPos = committed.findIndex(({ i }) => i === selectedIndex);
  const explainedWithout =
    selCommittedPos >= 0 && committed.length > 1
      ? rankKeys(asTheory(committed.filter((_, j) => j !== selCommittedPos))).filter(
          (k) => k.allExplained,
        ).length
      : null;
  // The selected chord's OWN reading in the working key (the same label drawn on
  // its bar). When none of the chord's home keys explain the song (fitCount 0),
  // this says WHY: it's a visitor here — a secondary dominant or a borrowed chord.
  const selReading =
    selCommittedPos >= 0 && ctxKey ? ctxKey.labels[selCommittedPos] : undefined;

  // --- Bass-first: suggestions for a bass-only bar --------------------------
  // Candidate keys come from the WHOLE bass line (every bar's bottom note) —
  // the bass line alone narrows the key space. Suggestions for the selected
  // bass are then read against the chosen working key.
  const bassKeys = selected.bassOnly
    ? keysContainingNotes(chords.map((c) => ROOT_CHOICES[c.rootIndex]))
    : [];
  const workingKey =
    bassKeys.find((k) => keyId(k.tonic, k.scale.id) === workingKeyId) ?? bassKeys[0];
  const suggestions: BassSuggestion[] =
    selected.bassOnly && workingKey
      ? chordsOverBass(selRoot, workingKey.tonic, workingKey.scale)
      : [];

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
  // `loopOn` is passed explicitly (defaulting to the toggle) so flipping Loop
  // mid-playback can restart with the NEW value, not the stale closure's.
  const startSong = (fromBeat: number, withCountIn: boolean, loopOn: boolean = loop) => {
    // A "beat" is the time-signature's bottom note; tempo (♩) is the quarter.
    const secPerBeat = (60 / bpm) * (4 / denominator);
    const countInBeats = withCountIn ? beatsPerBar : 0;
    const countInSec = countInBeats * secPerBeat;

    // Loop = schedule the whole song SEVERAL TIMES UP FRONT (capped at ~10
    // minutes), so there's no restart seam at the loop point — Web Audio plays
    // straight through and only the playhead wraps. Pass 1 runs from the cursor
    // to the end; every later pass is the full song, top to tail.
    const passSec = totalBeats * secPerBeat;
    const passes =
      loopOn && passSec > 0 ? Math.max(2, Math.min(200, Math.ceil(600 / passSec))) : 1;
    // Where pass p (1-based; p >= 1) begins, in seconds on the audio clock.
    const passStartSec = (p: number) =>
      countInSec + (totalBeats - fromBeat + (p - 1) * totalBeats) * secPerBeat;

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
    // The looped passes: every chord, full length, offset to its pass.
    if (!muteChords) {
      for (let p = 1; p < passes; p++) {
        chords.forEach((c, i) => {
          chordEvents.push({
            midis:
              voiceLead && voicedShapes[i]
                ? voicedShapes[i].map((pn) => midiOf(pn.note))
                : chordMidis(c),
            atSec: passStartSec(p) + starts[i] * secPerBeat,
            durSec: c.durationBeats * secPerBeat,
          });
        });
      }
    }

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
      for (let p = 1; p < passes; p++) {
        for (let gb = 0; gb < totalBeats; gb++) {
          clicks.push({
            atSec: passStartSec(p) + gb * secPerBeat,
            accent: gb % beatsPerBar === 0,
          });
        }
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
      if (beat >= totalBeats * passes) {
        reset(); // out of scheduled passes — rewind to the top
        return;
      }
      // Past the first pass, wrap the playhead back into the song each time
      // round (the audio is one continuous schedule; only the line wraps).
      const shown =
        beat < totalBeats ? Math.max(fromBeat, beat) : (beat - totalBeats) % totalBeats;
      setPlayheadBeat(shown); // (the max holds the line still during count-in)
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const togglePlay = () => {
    if (isPlaying) pause();
    else startSong(playheadBeat ?? 0, countIn);
  };

  // Flip Loop. If the song is rolling, restart it in place with the new value
  // (no count-in) so the toggle takes effect NOW, not at the next Play.
  const toggleLoop = () => {
    const next = !loop;
    setLoop(next);
    if (isPlaying) {
      stopAudio();
      startSong(playheadBeat ?? 0, false, next);
    }
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
  // Type a chord by name -> set the selected chord's root + quality (and, for a
  // slash like "C/E", its bass). A plain chord clears any previous slash.
  const applyChordText = () => {
    const parsed = parseChordSymbol(chordText);
    if (!parsed) {
      setChordTextError(true);
      return;
    }
    editSelected({
      rootIndex: parsed.rootIndex,
      chordId: parsed.chordId,
      bassIndex: parsed.bassIndex,
      bassOnly: false,
    });
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

  // Bass-first: read a bass line ("A F C G") into one bass-only bar per note.
  // Each token must be a bare note — the chords on top are decided afterwards,
  // bar by bar, from the suggestion heat map.
  const applyBassLine = () => {
    const tokens = bassText.trim().split(/\s+/).filter(Boolean);
    const bars: ChartChord[] = [];
    for (const t of tokens) {
      const parsed = /^[A-Ga-g][#♯b♭]*$/.test(t) ? parseChordSymbol(t) : null;
      if (!parsed) {
        setBassError(true);
        return;
      }
      bars.push({
        rootIndex: parsed.rootIndex,
        chordId: 'major-triad', // a placeholder — bassOnly bars ignore the quality
        durationBeats: beatsPerBar,
        bassOnly: true,
      });
    }
    if (bars.length === 0) {
      setBassError(true);
      return;
    }
    setBassError(false);
    setChords(bars);
    setSelectedIndex(0);
    setOpenKey(null);
  };

  // Commit a suggestion: the bass-only bar becomes that chord. If the bass was a
  // chord tone other than the root, keep it underneath as a slash (F/A).
  const applySuggestion = (s: BassSuggestion) => {
    const idx = ROOT_CHOICES.findIndex(
      (n) => pitchClassOf(n) === pitchClassOf(s.chordRoot),
    );
    if (idx < 0) return;
    editSelected({
      rootIndex: idx,
      chordId: s.chord.id,
      bassOnly: false,
      bassIndex: s.bassRole === '1' ? undefined : selected.rootIndex,
    });
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
    setWorkingKeyId(null); // each song reads against its own working key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  return (
    <>
      {/* Transport, grouped by job: playback | practice options | song actions.
          Everything stays visible (these are live teaching controls) — the quiet
          dividers just make the row read as three ideas instead of eight buttons. */}
      <div className="transport">
        <div className="cluster" role="group" aria-label="Playback">
          <div className="timesig" role="group" aria-label="Time signature">
            <input
              type="number"
              min={1}
              max={32}
              value={beatsPerBar}
              onChange={(e) =>
                onMeter({ beatsPerBar: Math.max(1, Math.min(32, Number(e.target.value) || 1)) })
              }
              aria-label="Beats per bar"
            />
            <span>/</span>
            <select
              value={denominator}
              onChange={(e) => onMeter({ denominator: Number(e.target.value) })}
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
          <div className="tempo" role="group" aria-label="Tempo">
            <button
              className="pill pill--tiny"
              onClick={() => onMeter((m) => ({ bpm: Math.max(40, m.bpm - 5) }))}
            >
              –
            </button>
            <span className="tempo__value">♩ = {bpm}</span>
            <button
              className="pill pill--tiny"
              onClick={() => onMeter((m) => ({ bpm: Math.min(280, m.bpm + 5) }))}
            >
              +
            </button>
          </div>
        </div>

        {/* A click track, and the option to hear it WITHOUT the chords. */}
        <div className="cluster" role="group" aria-label="Practice options">
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
          <button className={loop ? 'pill pill--on' : 'pill'} onClick={toggleLoop}>
            Loop
          </button>
        </div>

        <div className="cluster" role="group" aria-label="Song actions">
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
      </div>

      {/* The CONTEXT STRIP — the search engine, visible: the working-key
          hypotheses (click one to re-read everything) and what the selected bar
          just did to the search. The chord-by-chord FUNCTIONS are drawn on the
          bars themselves in the score below — the analysis lives with the
          chords, and switching the hypothesis re-labels the score. */}
      {committed.length > 0 && ctxKey && (
        <div className="context-strip">
          <span className="context-label">Context</span>
          <div className="control-group" role="group" aria-label="Key hypothesis">
            {ranked.slice(0, 3).map((k) => {
              const id = keyId(k.tonic, k.scale.id);
              const on = id === keyId(ctxKey.tonic, ctxKey.scale.id);
              return (
                <button
                  key={id}
                  className={on ? 'pill pill--on' : 'pill'}
                  onClick={() => setWorkingKeyId(id)}
                >
                  {noteName(k.tonic)} {k.scale.name}
                </button>
              );
            })}
            {ranked.length > 3 && (
              <span className="ctx-more">+{ranked.length - 3}</span>
            )}
          </div>
          {explainedWithout != null && (
            <span className="ctx-narrow">
              {chordLabel(selected)}{' '}
              {explainedWithout > explainedNow
                ? `narrows ${explainedWithout} → ${explainedNow}`
                : explainedWithout === explainedNow
                  ? `keeps all ${explainedNow}`
                  : `anchors ${explainedNow}`}{' '}
              readings
            </span>
          )}
        </div>
      )}

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
                      (isStart ? '' : ' tl-chord--cont') +
                      (c.bassOnly ? ' tl-chord--open' : '')
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
                    {/* The chord's function in the working key, written under
                        its symbol — the analysis lives WITH the chord. */}
                    {isStart && !c.bassOnly && fnByIndex.has(i) && (
                      <span
                        className={`tl-chord__fn tl-chord__fn--${fnByIndex.get(i)!.kind}`}
                      >
                        {fnByIndex.get(i)!.label}
                      </span>
                    )}
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
      {/* The root/quality pill grids duplicate the text input, so they live
          behind a disclosure — the text field leads (Stu's call). */}
      <details className="picker-box">
        <summary>Pick visually</summary>
        <div className="picker-grids">
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
          <div className="control-group" role="group" aria-label="Chord quality">
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
      </details>
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

      {/* Bass-first: type just the bass notes (songwriting / transcription),
          then answer each bar from the suggestion heat map below. */}
      <details className="paste-box">
        <summary>Start from a bass line</summary>
        <form
          className="chord-input"
          style={{ marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            applyBassLine();
          }}
        >
          <input
            type="text"
            value={bassText}
            placeholder="Just the bass notes — e.g.  A  F  C  G"
            aria-label="Bass line"
            onChange={(e) => {
              setBassText(e.target.value);
              setBassError(false);
            }}
          />
          <button type="submit" className="pill">
            Lay out bars
          </button>
          {bassError && (
            <span className="control-hint control-hint--warn">
              Bare notes only, e.g. A F C G.
            </span>
          )}
        </form>
        <p className="control-hint">
          Replaces the chart with one bar per bass note. Select a bar and pick
          what sits on top from the suggestions.
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

      {selected.bassOnly ? (
        /* --- Bass-first heat map: what could sit over this bass note? ------- */
        <>
          <p className="tagline">
            <strong>{noteName(selRoot)}</strong> in the bass — what could sit on
            top? ({bassKeys.length} keys hold this bass line)
          </p>

          {/* The working key the suggestions are read against. */}
          <div className="controls-row">
            <span className="control-label">Working key</span>
            <div className="control-group" role="group" aria-label="Working key">
              {bassKeys.slice(0, 8).map((k) => {
                const id = keyId(k.tonic, k.scale.id);
                const on = workingKey && id === keyId(workingKey.tonic, workingKey.scale.id);
                return (
                  <button
                    key={id}
                    className={on ? 'pill pill--on' : 'pill'}
                    onClick={() => setWorkingKeyId(id)}
                  >
                    {noteName(k.tonic)} {k.scale.name}
                  </button>
                );
              })}
              {bassKeys.length > 8 && (
                <span className="control-label">+{bassKeys.length - 8} more</span>
              )}
            </div>
          </div>

          {/* The suggestions, most obvious -> farthest out (the heat ramp). */}
          <div className="sugg-grid" role="group" aria-label="Chord suggestions">
            {suggestions.map((s, i) => {
              const slash =
                s.bassRole === '1' ? '' : `/${noteName(selRoot)}`;
              return (
                <button
                  key={i}
                  className={`sugg-chip heat-${s.tier}`}
                  onClick={() => applySuggestion(s)}
                >
                  <span className="sugg-chip__name">
                    {noteName(s.chordRoot)}
                    {s.chord.symbol}
                    {slash}
                  </span>
                  <span className="sugg-chip__fn">
                    {s.roman}
                    {s.borrowed && <> · borrowed</>}
                    {s.bassRole !== '1' && <> · {bassNoteName(s.bassRole)}</>}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="control-hint">
            Deeper colour = more obvious. Slashes put your bass inside the chord;
            V7/x chords reach outside the key. Click one to fill the bar.
          </p>
        </>
      ) : (
        <>
      <p className="tagline">
        <strong>{chordLabel(selected)}</strong> exists in {selectedKeys.length} keys
        {/* Multi-chord: how the whole progression narrows this chord's identity.
            If some of its home keys still explain the song, count them; if none
            do, the chord is a VISITOR here — name the role it plays instead. */}
        {chords.length > 1 && fitCount > 0 && (
          <>
            {' '}— of those, <strong>{fitCount}</strong> explain the whole progression
          </>
        )}
        {chords.length > 1 &&
          fitCount === 0 &&
          selReading &&
          selReading.kind !== 'outside' &&
          ctxKey && (
            <>
              {' '}— but here it's the <strong>{selReading.label}</strong> in{' '}
              {noteName(ctxKey.tonic)} {ctxKey.scale.name},{' '}
              {selReading.kind === 'secondary'
                ? 'a secondary dominant reaching outside the key'
                : selReading.kind === 'tritone'
                  ? 'a tritone substitute — a dominant a half-step above its target'
                  : 'borrowed from the parallel minor'}
            </>
          )}
        .
      </p>

      {/* The possibility space for the selected chord. Keys that also EXPLAIN the
          whole progression — tolerantly, the same set the Context strip ranks, so
          an out-of-key chord reads as V7/x or borrowed rather than eliminating the
          key — stay lit; the rest dim. The narrowing, in place. */}
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
                      explainedKeyIds.has(keyId(m.tonic, m.scale.id));
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
      )}
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
