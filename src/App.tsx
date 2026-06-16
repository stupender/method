// ============================================================================
// App.tsx — the top of the React component tree
// ----------------------------------------------------------------------------
// Three modes share one root chooser:
//   - Scales:  a scale across the neck, playable (Session 3).
//   - Chords:  any chord quality, explored as voicings (Session 4).
//   - Harmony: the chords OF a key — diatonic harmony with Roman numerals.
// Chords and Harmony both hand a (root, chord) to <ChordExplorer>, which owns
// the shared voicing/inversion/TAB/play UI. App just wires data -> theory ->
// the views.
// ============================================================================

import { useState } from 'react';
import type { Note } from './theory/types';
import { GUITAR } from './data/instruments';
import { GUITAR_STANDARD } from './data/tunings';
import { SCALES, MAJOR_SCALE } from './data/scales';
import { CHORDS } from './data/chords';
import { ROOT_CHOICES } from './data/roots';
import { placeScale, realizeScale } from './theory/scale';
import { diatonicChords } from './theory/harmony';
import { midiOf, noteName } from './theory/notes';
import { playNote, playSequence } from './audio/player';
import { Fretboard } from './render/Fretboard';
import { ChordExplorer } from './ui/ChordExplorer';
import './App.css';

const SCALE_LIST = Object.values(SCALES);
const CHORD_LIST = Object.values(CHORDS);

type Mode = 'scale' | 'chord' | 'harmony';

function App() {
  const [mode, setMode] = useState<Mode>('scale');
  const [rootIndex, setRootIndex] = useState(0); // shared: scale root / chord root / key

  const root = ROOT_CHOICES[rootIndex];

  return (
    <main className="page page--wide">
      <header className="masthead masthead--compact">
        <h1 className="title title--sm">Method</h1>
      </header>

      <div className="controls">
        <div className="control-group" role="group" aria-label="Mode">
          {(['scale', 'chord', 'harmony'] as Mode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? 'pill pill--on' : 'pill'}
              onClick={() => setMode(m)}
            >
              {m === 'scale' ? 'Scales' : m === 'chord' ? 'Chords' : 'Harmony'}
            </button>
          ))}
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

      {mode === 'scale' && <ScaleView root={root} />}
      {mode === 'chord' && <ChordView root={root} />}
      {mode === 'harmony' && <HarmonyView root={root} />}
    </main>
  );
}

// --- Scale view (Session 3) ------------------------------------------------
function ScaleView({ root }: { root: Note }) {
  const [scaleId, setScaleId] = useState(SCALE_LIST[0].id);
  const [labelMode, setLabelMode] = useState<'note' | 'degree'>('degree');

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

      <footer className="footnote">Tap any note to hear it; root in coral.</footer>
    </>
  );
}

// --- Chord view (Session 4): any chord quality, on any root ----------------
function ChordView({ root }: { root: Note }) {
  const [chordId, setChordId] = useState(CHORD_LIST[0].id);
  const chord = CHORDS[chordId];

  return (
    <>
      <p className="tagline">
        {noteName(root)}
        {chord.symbol} — {chord.name}
      </p>

      <div className="control-group control-group--wrap" role="group" aria-label="Chord">
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

      <ChordExplorer root={root} chord={chord} />

      <footer className="footnote">
        Structure × inversion are independent — the same tones, rearranged.
      </footer>
    </>
  );
}

// --- Harmony view: the chords OF a key (diatonic harmony) ------------------
function HarmonyView({ root }: { root: Note }) {
  const [seventh, setSeventh] = useState(false);
  const [degree, setDegree] = useState(0);

  // The diatonic chords of this major key — derived, not stored.
  const chords = diatonicChords(root, MAJOR_SCALE, seventh);
  const selected = chords[degree] ?? chords[0];

  return (
    <>
      <p className="tagline">
        Key of {noteName(root)} major — {selected.roman}: {selected.name}
      </p>

      <div className="view-controls">
        {/* Triads vs seventh chords. */}
        <div className="control-group" role="group" aria-label="Chord size">
          <button
            className={!seventh ? 'pill pill--on' : 'pill'}
            onClick={() => setSeventh(false)}
          >
            Triads
          </button>
          <button
            className={seventh ? 'pill pill--on' : 'pill'}
            onClick={() => setSeventh(true)}
          >
            Sevenths
          </button>
        </div>

        {/* One pill per scale degree, labelled with its Roman numeral. */}
        <div className="control-group" role="group" aria-label="Scale degree">
          {chords.map((c, i) => (
            <button
              key={i}
              className={i === degree ? 'pill pill--on' : 'pill'}
              onClick={() => setDegree(i)}
            >
              {c.roman}
            </button>
          ))}
        </div>
      </div>

      {/* The chosen diatonic chord, explored with the shared voicing UI. */}
      <ChordExplorer root={selected.chordRoot} chord={selected.chord} />

      <footer className="footnote">
        Each chord's quality comes from where it's built in the key.
      </footer>
    </>
  );
}

export default App;
