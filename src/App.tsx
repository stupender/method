// ============================================================================
// App.tsx — the top of the React component tree
// ----------------------------------------------------------------------------
// Session 4 adds chords. A mode switch flips between two views that share the
// same root chooser, fretboard and audio:
//   - Scales: the major scale across the neck (Session 3).
//   - Chords: a chord + voicing realised as a playable shape, with TAB.
// As always, App only wires state -> data -> theory -> render/audio. The voicing
// list is filtered by chord size purely from the data (3-tone vs 4-tone).
// ============================================================================

import { useState } from 'react';
import type { Note } from './theory/types';
import { GUITAR } from './data/instruments';
import { GUITAR_STANDARD } from './data/tunings';
import { SCALES } from './data/scales';
import { CHORDS } from './data/chords';
import { STRUCTURES } from './data/voicings';
import { ROOT_CHOICES } from './data/roots';
import { placeScale, realizeScale } from './theory/scale';
import {
  placeVoicing,
  structuresForChord,
  structureName,
  inversionCount,
  inversionName,
} from './theory/chord';
import { midiOf, noteName } from './theory/notes';
import { playNote, playSequence, playChord } from './audio/player';
import { Fretboard } from './render/Fretboard';
import { TabView } from './render/TabView';
import './App.css';

const SCALE_LIST = Object.values(SCALES);
const CHORD_LIST = Object.values(CHORDS);

type Mode = 'scale' | 'chord';

function App() {
  const [mode, setMode] = useState<Mode>('scale');
  const [rootIndex, setRootIndex] = useState(0); // C
  const [scaleId, setScaleId] = useState(SCALE_LIST[0].id);
  const [chordId, setChordId] = useState(CHORD_LIST[0].id);
  const [structureId, setStructureId] = useState('close');
  const [inversionIndex, setInversionIndex] = useState(0);
  const [labelMode, setLabelMode] = useState<'note' | 'degree'>('degree');

  const root = ROOT_CHOICES[rootIndex];

  return (
    <main className="page page--wide">
      <header className="masthead masthead--compact">
        <h1 className="title title--sm">Method</h1>
      </header>

      {/* Mode switch + shared root chooser. */}
      <div className="controls">
        <div className="control-group" role="group" aria-label="Mode">
          <button
            className={mode === 'scale' ? 'pill pill--on' : 'pill'}
            onClick={() => setMode('scale')}
          >
            Scales
          </button>
          <button
            className={mode === 'chord' ? 'pill pill--on' : 'pill'}
            onClick={() => setMode('chord')}
          >
            Chords
          </button>
        </div>

        <div className="control-group" role="group" aria-label="Root">
          {ROOT_CHOICES.map((note, i) => (
            <button
              key={`${note.letter}${note.accidental}`}
              className={i === rootIndex ? 'pill pill--on' : 'pill'}
              onClick={() => setRootIndex(i)}
            >
              {noteName(note)}
            </button>
          ))}
        </div>
      </div>

      {mode === 'scale' ? (
        <ScaleView
          root={root}
          scaleId={scaleId}
          setScaleId={setScaleId}
          labelMode={labelMode}
          setLabelMode={setLabelMode}
        />
      ) : (
        <ChordView
          root={root}
          chordId={chordId}
          setChordId={setChordId}
          structureId={structureId}
          setStructureId={setStructureId}
          inversionIndex={inversionIndex}
          setInversionIndex={setInversionIndex}
          labelMode={labelMode}
          setLabelMode={setLabelMode}
        />
      )}
    </main>
  );
}

// --- Shared little control: the note/degree label toggle -------------------
function LabelToggle({
  labelMode,
  setLabelMode,
}: {
  labelMode: 'note' | 'degree';
  setLabelMode: (m: 'note' | 'degree') => void;
}) {
  return (
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
  );
}

// --- Scale view (Session 3) ------------------------------------------------
function ScaleView({
  root,
  scaleId,
  setScaleId,
  labelMode,
  setLabelMode,
}: {
  root: Note;
  scaleId: string;
  setScaleId: (id: string) => void;
  labelMode: 'note' | 'degree';
  setLabelMode: (m: 'note' | 'degree') => void;
}) {
  const scale = SCALES[scaleId];
  const tones = realizeScale(root, scale);
  const highlights = placeScale(GUITAR, GUITAR_STANDARD, root, scale);

  const playScale = () => {
    const midis = tones.map((t) => midiOf(t.note));
    midis.push(midiOf(root) + 12);
    playSequence(midis);
  };

  return (
    <>
      <p className="tagline">
        {noteName(root)} {scale.name} —{' '}
        {tones.map((t) => noteName(t.note)).join('  ')}
      </p>

      <div className="view-controls">
        <div className="controls-row">
          <div className="control-group" role="group" aria-label="Scale">
            {SCALE_LIST.map((s) => (
              <button
                key={s.id}
                className={s.id === scaleId ? 'pill pill--on' : 'pill'}
                onClick={() => setScaleId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
          <LabelToggle labelMode={labelMode} setLabelMode={setLabelMode} />
          <button className="pill pill--play" onClick={playScale}>
            ▶ Play scale
          </button>
        </div>
      </div>

      <Fretboard
        instrument={GUITAR}
        tuning={GUITAR_STANDARD}
        highlights={highlights}
        labelMode={labelMode}
        onNoteTap={(placed) => playNote(midiOf(placed.note))}
      />

      <footer className="footnote">
        Tap any note to hear it; root in coral.
      </footer>
    </>
  );
}

// --- Chord view (Session 4) ------------------------------------------------
function ChordView({
  root,
  chordId,
  setChordId,
  structureId,
  setStructureId,
  inversionIndex,
  setInversionIndex,
  labelMode,
  setLabelMode,
}: {
  root: Note;
  chordId: string;
  setChordId: (id: string) => void;
  structureId: string;
  setStructureId: (id: string) => void;
  inversionIndex: number;
  setInversionIndex: (i: number) => void;
  labelMode: 'note' | 'degree';
  setLabelMode: (m: 'note' | 'degree') => void;
}) {
  const chord = CHORDS[chordId];
  const voiceCount = inversionCount(chord);

  // Which structures apply to this chord (Drop 3 needs 4 voices, etc.), and the
  // chosen one — falling back to the first if the current id doesn't apply.
  const structures = structuresForChord(chord, STRUCTURES);
  const structure = structures.find((s) => s.id === structureId) ?? structures[0];

  // Clamp the inversion to this chord's range (triad has 3, a 7th has 4).
  const inversion = Math.min(inversionIndex, voiceCount - 1);

  const placed = placeVoicing(
    GUITAR,
    GUITAR_STANDARD,
    root,
    chord,
    structure,
    inversion,
  );

  const strum = () => playChord(placed.map((p) => midiOf(p.note)));

  return (
    <>
      <p className="tagline">
        {noteName(root)}
        {chord.symbol} — {structureName(structure, voiceCount)},{' '}
        {inversionName(inversion)}
      </p>

      <div className="view-controls">
        <div className="controls-row">
          <div className="control-group" role="group" aria-label="Chord">
            {CHORD_LIST.map((c) => (
              <button
                key={c.id}
                className={c.id === chordId ? 'pill pill--on' : 'pill'}
                onClick={() => setChordId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <LabelToggle labelMode={labelMode} setLabelMode={setLabelMode} />
          <button className="pill pill--play" onClick={strum}>
            ▶ Play chord
          </button>
        </div>

        {/* Structure: how spread out the voices are. */}
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

        {/* Inversion: which chord tone is in the bass (one per chord tone). */}
        <div className="control-group" role="group" aria-label="Inversion">
          {Array.from({ length: voiceCount }, (_, i) => (
            <button
              key={i}
              className={i === inversion ? 'pill pill--on' : 'pill'}
              onClick={() => setInversionIndex(i)}
            >
              {inversionName(i)}
            </button>
          ))}
        </div>
      </div>

      <div className="chord-stage">
        <Fretboard
          instrument={GUITAR}
          tuning={GUITAR_STANDARD}
          highlights={placed}
          labelMode={labelMode}
          onNoteTap={(p) => playNote(midiOf(p.note))}
        />
        <TabView instrument={GUITAR} tuning={GUITAR_STANDARD} placed={placed} />
      </div>

      <footer className="footnote">
        Structure × inversion are independent — the same tones, rearranged. Tap a
        note or play the chord.
      </footer>
    </>
  );
}

export default App;
