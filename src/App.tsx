// ============================================================================
// App.tsx — the top of the React component tree
// ----------------------------------------------------------------------------
// Session 3: scales + intervals + audio. Pick a root and a scale (data), and the
// theory layer realises that scale across the neck with correct spelling and
// degree labels; tapping a note plays it; a button plays the whole scale.
//
// New idea here: React STATE. `useState` gives a component a value it remembers
// between renders plus a setter; calling the setter re-runs the component with
// the new value, so the screen always reflects the current choice. App still
// does no theory or drawing itself — it wires state -> data -> theory -> render
// -> audio.
// ============================================================================

import { useState } from 'react';
import { GUITAR } from './data/instruments';
import { GUITAR_STANDARD } from './data/tunings';
import { SCALES } from './data/scales';
import { ROOT_CHOICES } from './data/roots';
import { placeScale, realizeScale } from './theory/scale';
import { midiOf, noteName } from './theory/notes';
import { playNote, playSequence } from './audio/player';
import { Fretboard } from './render/Fretboard';
import './App.css';

const SCALE_LIST = Object.values(SCALES); // data-driven: every scale we ship

function App() {
  // --- State: the three choices that drive everything below ---------------
  const [rootIndex, setRootIndex] = useState(0); // index into ROOT_CHOICES (C)
  const [scaleId, setScaleId] = useState(SCALE_LIST[0].id);
  const [labelMode, setLabelMode] = useState<'note' | 'degree'>('degree');

  // --- Derive everything from that state (no extra state needed) ----------
  const root = ROOT_CHOICES[rootIndex];
  const scale = SCALES[scaleId];
  const tones = realizeScale(root, scale); // the spelled scale notes, in order
  const highlights = placeScale(GUITAR, GUITAR_STANDARD, root, scale);

  // Tapping a lit note plays its pitch.
  const handleNoteTap = (midi: number) => playNote(midi);

  // The "play scale" button: each tone ascending, then the root an octave up.
  const playScale = () => {
    const midis = tones.map((t) => midiOf(t.note));
    midis.push(midiOf(root) + 12);
    playSequence(midis);
  };

  return (
    <main className="page page--wide">
      <header className="masthead masthead--compact">
        <h1 className="title title--sm">Method</h1>
        <p className="tagline">
          {noteName(root)} {scale.name} — {tones.map((t) => noteName(t.note)).join('  ')}
        </p>
      </header>

      <div className="controls">
        {/* Root chooser: one button per pitch class. */}
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

        <div className="controls-row">
          {/* Scale chooser (data-driven — grows as we add scales). */}
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

          {/* Label toggle: note names vs scale degrees (the "interval" view). */}
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
        onNoteTap={(placed) => handleNoteTap(midiOf(placed.note))}
      />

      <footer className="footnote">
        Session 3 — scales, intervals &amp; audio. Tap any note to hear it; root
        in coral.
      </footer>
    </main>
  );
}

export default App;
