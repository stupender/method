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
import type { Note, ScaleDefinition } from './theory/types';
import { SCALES } from './data/scales';
import { CHORDS } from './data/chords';
import { ROOT_CHOICES } from './data/roots';
import { realizeScale } from './theory/scale';
import { diatonicChords } from './theory/harmony';
import { noteName } from './theory/notes';
import { ChordExplorer } from './ui/ChordExplorer';
import { ScaleExplorer } from './ui/ScaleExplorer';
import './App.css';

const SCALE_LIST = Object.values(SCALES);
const CHORD_LIST = Object.values(CHORDS);

type Mode = 'scale' | 'chord' | 'harmony';

function App() {
  const [mode, setMode] = useState<Mode>('scale');
  const [rootIndex, setRootIndex] = useState(0); // the Key
  const [scaleId, setScaleId] = useState(SCALE_LIST[0].id); // the Scale type

  const root = ROOT_CHOICES[rootIndex];
  const scale = SCALES[scaleId];

  return (
    <main className="page page--wide">
      <header className="masthead masthead--compact">
        <h1 className="title title--sm">Method</h1>
      </header>

      {/* Global controls, in priority order: Key → Scale type → Mode.
          (Scale type drives the Scales and Harmony views; Chords is absolute.) */}
      <div className="controls">
        <div className="control-group" role="group" aria-label="Key">
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

        <div className="control-group control-group--wrap" role="group" aria-label="Scale type">
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

        {/* 'chord' (the absolute, key-less chord explorer) is intentionally NOT
            offered here — it isn't useful on this key-oriented page yet. The
            view + ChordExplorer are kept below for a future, less key-centric
            section (e.g. Ear Training); re-add 'chord' to this list to show it. */}
        <div className="control-group" role="group" aria-label="Mode">
          {(['scale', 'harmony'] as Mode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? 'pill pill--on' : 'pill'}
              onClick={() => setMode(m)}
            >
              {m === 'scale' ? 'Scales' : 'Harmony'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'scale' && <ScaleView root={root} scale={scale} />}
      {mode === 'chord' && <ChordView root={root} />}
      {mode === 'harmony' && <HarmonyView root={root} scale={scale} />}
    </main>
  );
}

// --- Scale view: the scale's position boxes (its 7 modal fingerings) -------
function ScaleView({ root, scale }: { root: Note; scale: ScaleDefinition }) {
  const tones = realizeScale(root, scale);

  return (
    <>
      <p className="tagline">
        {noteName(root)} {scale.name} —{' '}
        {tones.map((t) => noteName(t.note)).join('  ')}
      </p>

      <ScaleExplorer root={root} scale={scale} />

      <footer className="footnote">
        Each box is a position (a mode's fingering). Hover to light it; click to
        hear it.
      </footer>
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
function HarmonyView({ root, scale }: { root: Note; scale: ScaleDefinition }) {
  const [seventh, setSeventh] = useState(false);
  const [degree, setDegree] = useState(0);

  // The diatonic chords of this key + scale — derived, not stored. Switching the
  // global scale type (major, harmonic minor, ...) changes the whole harmony set.
  const chords = diatonicChords(root, scale, seventh);
  const selected = chords[degree] ?? chords[0];

  return (
    <>
      <p className="tagline">
        Key of {noteName(root)} {scale.name} — {selected.roman}: {selected.name}
      </p>

      <div className="view-controls">
        {/* Highest priority: which degree (Roman numeral) in the key. */}
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

        {/* Then: triads vs seventh chords. */}
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
