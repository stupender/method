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

import { useState } from 'react';
import type { Note } from '../theory/types';
import { CHORDS } from '../data/chords';
import { SCALES } from '../data/scales';
import { ROOT_CHOICES } from '../data/roots';
import {
  keysContaining,
  keysContainingAll,
  type KeyMatch,
} from '../theory/keys';
import { diatonicChords } from '../theory/harmony';
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
// Chord durations in beats, with friendly labels (incl. dotted + the eighth).
const DURATIONS = [
  { label: '½', beats: 0.5 },
  { label: '1', beats: 1 },
  { label: '1½', beats: 1.5 },
  { label: '2', beats: 2 },
  { label: '3', beats: 3 },
  { label: '4', beats: 4 },
];
const BPM = 100; // playback tempo
const PX_PER_BEAT = 46; // timeline scale

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
  const [chords, setChords] = useState<ChartChord[]>([
    { rootIndex: 5, chordId: 'minor-triad', durationBeats: 4 }, // Fm, one bar
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openKey, setOpenKey] = useState<KeyMatch | null>(null);

  const selected = chords[selectedIndex] ?? chords[0];
  const selRoot = ROOT_CHOICES[selected.rootIndex];
  const selChord = CHORDS[selected.chordId];

  // --- Timing: where each chord starts, and how many bars the song spans -----
  const starts: number[] = [];
  let acc = 0;
  for (const c of chords) {
    starts.push(acc);
    acc += c.durationBeats;
  }
  const totalBeats = acc;
  const barCount = Math.max(1, Math.ceil(totalBeats / beatsPerBar));
  const timelineBeats = barCount * beatsPerBar; // round up to whole bars

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

  // Strum the progression in time at BPM (chords sustain for their duration).
  const playSong = () => {
    const secPerBeat = 60 / BPM;
    playProgression(
      chords.map((c, i) => ({
        midis: chordMidis(c),
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
        <button className="chart-add" onClick={addChord}>
          + Add chord
        </button>
      </div>

      {/* The lead sheet as a timeline: bar lines from the time signature, each
          chord a block as wide as its duration — so chords cross bar lines. */}
      <div className="timeline-scroll">
      <div className="timeline" style={{ width: timelineBeats * PX_PER_BEAT }}>
        {/* Bar lines (one per bar boundary, behind the chords). */}
        {Array.from({ length: barCount + 1 }, (_, b) => (
          <div
            key={`bar-${b}`}
            className="timeline-bar"
            style={{ left: b * beatsPerBar * PX_PER_BEAT }}
          />
        ))}
        {/* Chord blocks, positioned and sized by their start + duration. */}
        {chords.map((c, i) => (
          <div
            key={i}
            className={i === selectedIndex ? 'tl-chord tl-chord--on' : 'tl-chord'}
            style={{
              left: starts[i] * PX_PER_BEAT,
              width: c.durationBeats * PX_PER_BEAT,
            }}
            onClick={() => {
              setSelectedIndex(i);
              setOpenKey(null);
            }}
          >
            <span className="tl-chord__label">{chordLabel(c)}</span>
            {chords.length > 1 && (
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
          </div>
        ))}
      </div>
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

      {/* How long the selected chord lasts, in beats. */}
      <div className="control-group" role="group" aria-label="Duration">
        <span className="control-label">Beats</span>
        {DURATIONS.map((d) => (
          <button
            key={d.beats}
            className={d.beats === selected.durationBeats ? 'pill pill--on' : 'pill'}
            onClick={() => editSelected({ durationBeats: d.beats })}
          >
            {d.label}
          </button>
        ))}
      </div>

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
