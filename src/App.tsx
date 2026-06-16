// ============================================================================
// App.tsx — the top of the React component tree
// ----------------------------------------------------------------------------
// Session 2: render the fretboard engine. We pick an instrument + tuning (data),
// choose a set of notes to light up (data), ask the theory layer where those
// notes live on the neck, and hand the result to the Fretboard renderer. Notice
// App does no music theory and no drawing itself — it just wires data to the
// engine. That's the layering working as intended.
// ============================================================================

import { GUITAR } from './data/instruments';
import { GUITAR_STANDARD } from './data/tunings';
import { findPositions } from './theory/fretboard';
import { Fretboard } from './render/Fretboard';
import './App.css';

// The "arbitrary set of notes passed as data" the brief asks for. Pitch classes
// are 0..11 (C=0). Change this object and the neck relights — nothing else moves.
// (In later sessions this comes from a selected scale/chord instead of by hand.)
const DEMO_HIGHLIGHT = {
  name: 'C major triad',
  pitchClasses: [0, 4, 7], // C, E, G
  root: 0, // C — drawn in the accent colour
};

function App() {
  // Ask the theory layer: where on this neck do those notes appear?
  const highlights = findPositions(
    GUITAR,
    GUITAR_STANDARD,
    DEMO_HIGHLIGHT.pitchClasses,
    DEMO_HIGHLIGHT.root,
  );

  return (
    <main className="page page--wide">
      <header className="masthead masthead--compact">
        <h1 className="title">Method</h1>
        <p className="tagline">{DEMO_HIGHLIGHT.name} across the neck</p>
      </header>

      <Fretboard
        instrument={GUITAR}
        tuning={GUITAR_STANDARD}
        highlights={highlights}
      />

      <footer className="footnote">
        Session 2 — the fretboard engine. Notes are lit from data; root in coral.
      </footer>
    </main>
  );
}

export default App;
