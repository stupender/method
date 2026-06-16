// ============================================================================
// App.tsx — the top of the React component tree
// ----------------------------------------------------------------------------
// Session 1 landing page. Its job right now is to prove the data-driven engine
// works end to end: it imports the DATA files and lists what they contain. If
// you add a scale or chord to src/data/, it shows up here with no other change —
// that's the whole architecture in miniature. Real features (fretboard, audio,
// notation) replace this screen from Session 2 onward.
// ============================================================================

import { INSTRUMENTS } from './data/instruments';
import { TUNINGS } from './data/tunings';
import { SCALES } from './data/scales';
import { CHORDS } from './data/chords';
import './App.css';

function App() {
  // Object.values turns each { id: definition } lookup into a plain array we
  // can map over for display. (These come straight from the data files.)
  const instruments = Object.values(INSTRUMENTS);
  const tunings = Object.values(TUNINGS);
  const scales = Object.values(SCALES);
  const chords = Object.values(CHORDS);

  return (
    <main className="page">
      <header className="masthead">
        <h1 className="title">Method</h1>
        <p className="tagline">
          Theory and technique exist to free expression.
        </p>
      </header>

      {/* A temporary "what the engine loaded" panel — sanity check for the
          data-driven design. Each list is generated from a data file. */}
      <section className="loaded">
        <DataList label="Instruments" items={instruments.map((i) => i.name)} />
        <DataList label="Tunings" items={tunings.map((t) => t.name)} />
        <DataList label="Scales" items={scales.map((s) => s.name)} />
        <DataList label="Chords" items={chords.map((c) => c.name)} />
      </section>

      <footer className="footnote">
        Session 1 — schema &amp; foundations. The fretboard arrives next.
      </footer>
    </main>
  );
}

// A tiny presentational component: a labelled list of strings. Defined here
// because it's only used on this temporary screen.
function DataList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="data-list">
      <h2 className="data-list__label">{label}</h2>
      <ul>
        {items.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
