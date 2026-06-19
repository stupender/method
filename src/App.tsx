// ============================================================================
// App.tsx — the top of the React component tree
// ----------------------------------------------------------------------------
// Two top-level AREAS, switched by the nav under the title:
//   - Study: explore the materials — Scales (and Harmony) on the neck.
//   - Song:  lay out a song / lead sheet and reveal what to play over each chord.
// They're separate but connected: Study is for learning the materials, Song is
// for using them. Within Study, a Mode picks Scales vs Harmony.
// ============================================================================

import { useState } from 'react';
import type { Note, ScaleDefinition } from './theory/types';
import { SCALES } from './data/scales';
import { CHORDS } from './data/chords';
import { ROOT_CHOICES } from './data/roots';
import { realizeScale } from './theory/scale';
import { diatonicChords } from './theory/harmony';
import { noteName, pitchClassOf } from './theory/notes';
import { ChordExplorer } from './ui/ChordExplorer';
import { ScaleExplorer } from './ui/ScaleExplorer';
import { SongView, type ChartChord } from './ui/SongView';
import './App.css';

const SCALE_LIST = Object.values(SCALES);
const CHORD_LIST = Object.values(CHORDS);

type Area = 'study' | 'song';
type Mode = 'scale' | 'chord' | 'harmony';

function App() {
  const [area, setArea] = useState<Area>('study');

  // The SONG (the chord list) lives here, above both areas, so it survives
  // switching to Possibility and back, and so the "Add to Play" button in
  // Possibility can append to it. Tempo / time-sig / selection stay inside Play.
  const [songChords, setSongChords] = useState<ChartChord[]>([
    { rootIndex: 5, chordId: 'minor-triad', durationBeats: 4 }, // Fm, one bar
  ]);
  // Add a chord (root + quality) to the end of the song, one bar long by default.
  const addToSong = (rootIndex: number, chordId: string) =>
    setSongChords((cs) => [...cs, { rootIndex, chordId, durationBeats: 4 }]);

  return (
    <main className="page page--wide">
      <header className="masthead masthead--compact">
        <h1 className="title title--sm">Method</h1>
        {/* Top-level areas: a higher separation than the modes within Study. */}
        <nav className="topnav" role="group" aria-label="Area">
          {(['study', 'song'] as Area[]).map((a) => (
            <button
              key={a}
              className={area === a ? 'topnav-item topnav-item--on' : 'topnav-item'}
              onClick={() => setArea(a)}
            >
              {a === 'study' ? 'Possibility' : 'Play'}
            </button>
          ))}
        </nav>
      </header>

      {/* Both areas stay mounted (just hidden) so each keeps its own state when
          you switch — the song, and Possibility's key/scale/mode choices. */}
      <div hidden={area !== 'study'}>
        <StudyArea onAddChord={addToSong} songLength={songChords.length} />
      </div>
      <div hidden={area !== 'song'}>
        <SongView chords={songChords} setChords={setSongChords} />
      </div>
    </main>
  );
}

// --- Study: explore Scales / Harmony on the neck ---------------------------
function StudyArea({
  onAddChord,
  songLength,
}: {
  onAddChord: (rootIndex: number, chordId: string) => void;
  songLength: number;
}) {
  const [mode, setMode] = useState<Mode>('scale');
  const [rootIndex, setRootIndex] = useState(0); // the Key
  const [scaleId, setScaleId] = useState(SCALE_LIST[0].id); // the Scale type

  const root = ROOT_CHOICES[rootIndex];
  const scale = SCALES[scaleId];

  return (
    <>
      {/* Controls in priority order: Key → Scale type → Mode. */}
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
      {mode === 'harmony' && (
        <HarmonyView
          root={root}
          scale={scale}
          onAddChord={onAddChord}
          songLength={songLength}
        />
      )}
    </>
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
function HarmonyView({
  root,
  scale,
  onAddChord,
  songLength,
}: {
  root: Note;
  scale: ScaleDefinition;
  onAddChord: (rootIndex: number, chordId: string) => void;
  songLength: number;
}) {
  const [seventh, setSeventh] = useState(false);
  const [degree, setDegree] = useState(0);

  // The diatonic chords of this key + scale — derived, not stored. Switching the
  // global scale type (major, harmonic minor, ...) changes the whole harmony set.
  const chords = diatonicChords(root, scale, seventh);
  const selected = chords[degree] ?? chords[0];

  // To add this chord to the Play song we need its root as an index into the
  // shared root list (Play stores roots that way). Match by pitch class, so the
  // diatonic spelling (e.g. Bb vs A#) doesn't matter.
  const selectedRootIndex = ROOT_CHOICES.findIndex(
    (n) => pitchClassOf(n) === pitchClassOf(selected.chordRoot),
  );
  const addThisChord = () => {
    if (selectedRootIndex >= 0) onAddChord(selectedRootIndex, selected.chord.id);
  };

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

        {/* Send this chord over to the Play song (it persists across areas). */}
        <div className="controls-row">
          <button className="chart-add" onClick={addThisChord}>
            + Add {noteName(selected.chordRoot)}
            {selected.chord.symbol} to Play
          </button>
          <span className="control-label">
            {songLength} chord{songLength === 1 ? '' : 's'} in Play
          </span>
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
