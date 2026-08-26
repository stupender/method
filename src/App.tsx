// ============================================================================
// App.tsx — the top of the React component tree
// ----------------------------------------------------------------------------
// Two top-level AREAS, switched by the nav under the title:
//   - Study: explore the materials — Scales (and Harmony) on the neck.
//   - Song:  lay out a song / lead sheet and reveal what to play over each chord.
// They're separate but connected: Study is for learning the materials, Song is
// for using them. Within Study, a Mode picks Scales vs Harmony.
// ============================================================================

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { Note, ScaleDefinition, PlacedNote } from './theory/types';
import { SCALES } from './data/scales';
import { CHORDS } from './data/chords';
import { ROOT_CHOICES } from './data/roots';
import { realizeScale } from './theory/scale';
import { modeAt } from './theory/mode';
import { diatonicChords } from './theory/harmony';
import { noteName, pitchClassOf } from './theory/notes';
import { ChordExplorer } from './ui/ChordExplorer';
import { ChordScaleLadder } from './ui/ChordScaleLadder';
import { InversionLadder } from './ui/InversionLadder';
import { ControlPanel, ControlRow } from './ui/ControlPanel';
import { DegreeLegend } from './ui/DegreeLegend';
import { PatternExplorer } from './ui/PatternExplorer';
import { ScaleExplorer } from './ui/ScaleExplorer';
import { Segmented } from './ui/Segmented';
import { SongView, type ChartChord } from './ui/SongView';
import { PracticeCards, type PracticeCard } from './ui/PracticeCards';
import { EarTrainingView } from './ui/EarTrainingView';
import './App.css';

const SCALE_LIST = Object.values(SCALES);
const CHORD_LIST = Object.values(CHORDS);

type Area = 'study' | 'song' | 'ear';
type Mode = 'scale' | 'pattern' | 'chord' | 'harmony';

// WHAT'S READY FOR THE LIVE SITE.
// Play, Ear Training and Patterns all work, but aren't finished enough to put
// in front of a student yet. They're hidden by a flag rather than commented
// out, so the code keeps compiling and keeps being type-checked — commented-out
// features rot, flagged ones don't. Flip one to true to bring it back.
// "All" for the Gravity row — the whole key, not one degree of it.
export const ALL_DEGREES = -1;

const READY = {
  play: false,
  earTraining: false,
  patterns: false,
} as const;

const AREAS: Area[] = [
  'study',
  ...(READY.play ? (['song'] as Area[]) : []),
  ...(READY.earTraining ? (['ear'] as Area[]) : []),
];

// The label each top-level area shows in the nav.
const AREA_LABELS: Record<Area, string> = {
  study: 'Possibility',
  song: 'Play',
  ear: 'Ear Training',
};

// A song in the songbook: a name, its chord chart, and its own meter + tempo.
interface Song {
  id: string;
  name: string;
  chords: ChartChord[];
  bpm: number; // tempo (quarter-note BPM)
  beatsPerBar: number; // time-signature numerator
  denominator: number; // time-signature bottom number (2/4/8/16)
}

// A unique id for a new song. A monotonic counter is plenty — no need for UUIDs.
let songCounter = 0;
const nextSongId = () => `song-${++songCounter}`;

// A fresh, never-empty song (the chart needs at least one chord), in common time.
const newSong = (name: string): Song => ({
  id: nextSongId(),
  name,
  chords: [{ rootIndex: 0, chordId: 'major-triad', durationBeats: 4 }], // C, one bar
  bpm: 100,
  beatsPerBar: 4,
  denominator: 4,
});

// --- Saving the songbook to the browser, so it survives a reload -----------
const STORAGE_KEY = 'method.songbook.v1';

// Fill in any missing fields, so older/partial saved data still loads cleanly.
function normalizeSong(raw: Partial<Song> & { id: string }): Song {
  return {
    id: raw.id,
    name: raw.name ?? 'Untitled',
    chords:
      Array.isArray(raw.chords) && raw.chords.length
        ? raw.chords
        : [{ rootIndex: 0, chordId: 'major-triad', durationBeats: 4 }],
    bpm: raw.bpm ?? 100,
    beatsPerBar: raw.beatsPerBar ?? 4,
    denominator: raw.denominator ?? 4,
  };
}

// Read the saved songbook (or null if none / unreadable). Also advances the id
// counter past any saved ids so new songs don't collide.
function loadSongbook(): { songs: Song[]; currentId: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { songs?: unknown; currentId?: string };
    if (!Array.isArray(parsed.songs) || parsed.songs.length === 0) return null;
    const songs = (parsed.songs as (Partial<Song> & { id: string })[]).map(normalizeSong);
    for (const s of songs) {
      const n = Number(String(s.id).replace('song-', ''));
      if (Number.isFinite(n)) songCounter = Math.max(songCounter, n);
    }
    const currentId = songs.some((s) => s.id === parsed.currentId)
      ? (parsed.currentId as string)
      : songs[0].id;
    return { songs, currentId };
  } catch {
    return null; // corrupt or unavailable storage — start fresh
  }
}

// The starting songbook: the saved one, or a single new song.
const initialSongbook = loadSongbook() ?? (() => {
  const first = newSong('Untitled');
  first.chords = [{ rootIndex: 5, chordId: 'minor-triad', durationBeats: 4 }]; // Fm
  return { songs: [first], currentId: first.id };
})();

// --- Theme: the two worlds of the design direction (DESIGN.md) --------------
// 'paper' = riso ink on warm stock; 'night' = an indigo field with one warm
// light. The choice is written to <html data-theme>, which is all the CSS
// needs — every colour in the app is a token defined once per world.
type Theme = 'paper' | 'night';
const THEME_KEY = 'method.theme.v1';

// The saved choice, or the room's own preference the first time.
function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'paper' || saved === 'night') return saved;
  } catch {
    /* storage blocked — fall through to the OS preference */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'paper';
}

// --- Practice cards: the take-home step, saved next to the songbook ---------
const CARDS_KEY = 'method.cards.v1';
let cardCounter = 0;
const nextCardId = () => `card-${++cardCounter}`;

// Load saved cards (or [] if none / unreadable), advancing the id counter so new
// cards don't collide. A card needs at least one chord to be worth restoring.
function loadCards(): PracticeCard[] {
  try {
    const raw = localStorage.getItem(CARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const cards = (parsed as PracticeCard[]).filter(
      (c) => c && typeof c.id === 'string' && Array.isArray(c.chords) && c.chords.length > 0,
    );
    for (const c of cards) {
      const n = Number(String(c.id).replace('card-', ''));
      if (Number.isFinite(n)) cardCounter = Math.max(cardCounter, n);
    }
    return cards;
  } catch {
    return []; // corrupt or unavailable storage — start with none
  }
}
const initialCards = loadCards();

function App() {
  const [area, setArea] = useState<Area>('study');

  // The SONGBOOK lives here, above both areas, so it survives switching to
  // Possibility and back, and so the "Add to Play" button in Possibility can
  // append to whichever song is open. Tempo / time-sig / selection stay in Play.
  const [songs, setSongs] = useState<Song[]>(initialSongbook.songs);
  const [currentId, setCurrentId] = useState(initialSongbook.currentId);
  const current = songs.find((s) => s.id === currentId) ?? songs[0];

  // Save the songbook whenever it changes, so it's there on the next visit.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ songs, currentId }));
    } catch {
      /* storage full or blocked — not worth interrupting the user */
    }
  }, [songs, currentId]);

  // Merge a patch into the OPEN song. Accepts an updater fn too, so relative
  // changes (tempo +/-) read the latest value even if clicks batch together.
  const updateCurrent = (update: Partial<Song> | ((s: Song) => Partial<Song>)) =>
    setSongs((ss) =>
      ss.map((s) =>
        s.id === currentId
          ? { ...s, ...(typeof update === 'function' ? update(s) : update) }
          : s,
      ),
    );

  // Update the OPEN song's chords. Shaped like a useState setter so SongView can
  // stay a plain controlled component (it doesn't know songs exist).
  const setCurrentChords: Dispatch<SetStateAction<ChartChord[]>> = (update) =>
    setSongs((ss) =>
      ss.map((s) =>
        s.id === currentId
          ? { ...s, chords: typeof update === 'function' ? update(s.chords) : update }
          : s,
      ),
    );

  // Add a chord (root + quality) to the end of the open song, one bar by default.
  const addToSong = (rootIndex: number, chordId: string) =>
    setCurrentChords((cs) => [...cs, { rootIndex, chordId, durationBeats: 4 }]);

  // --- Songbook actions ---------------------------------------------------
  const addSong = () => {
    const song = newSong(`Untitled ${songs.length + 1}`);
    setSongs((ss) => [...ss, song]);
    setCurrentId(song.id);
  };
  const renameCurrent = (name: string) =>
    setSongs((ss) => ss.map((s) => (s.id === currentId ? { ...s, name } : s)));
  const deleteCurrent = () => {
    if (songs.length === 1) return; // always keep at least one song
    const remaining = songs.filter((s) => s.id !== currentId);
    setSongs(remaining);
    setCurrentId(remaining[0].id);
  };

  // --- Theme --------------------------------------------------------------
  const [theme, setTheme] = useState<Theme>(loadTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage blocked — the theme still applies for this visit */
    }
  }, [theme]);

  // --- Practice cards -----------------------------------------------------
  const [cards, setCards] = useState<PracticeCard[]>(initialCards);

  // Save the cards whenever they change (their own key, next to the songbook).
  useEffect(() => {
    try {
      localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
    } catch {
      /* storage full or blocked — not worth interrupting the user */
    }
  }, [cards]);

  // Freeze the open song's content into a new card (newest first).
  const saveCard = (instruction: string) => {
    const card: PracticeCard = {
      id: nextCardId(),
      instruction,
      chords: current.chords,
      bpm: current.bpm,
      beatsPerBar: current.beatsPerBar,
      denominator: current.denominator,
      createdAt: Date.now(),
    };
    setCards((cs) => [card, ...cs]);
  };
  // Open a card: load its frozen chart back into the OPEN song.
  const openCard = (card: PracticeCard) =>
    updateCurrent({
      chords: card.chords,
      bpm: card.bpm,
      beatsPerBar: card.beatsPerBar,
      denominator: card.denominator,
    });
  const removeCard = (id: string) => setCards((cs) => cs.filter((c) => c.id !== id));

  return (
    <main className="page page--wide">
      {/* Paper or Night — the two worlds of the design direction (DESIGN.md).
          Tucked in the corner: it's a room setting, not a music choice. */}
      <div className="theme-switch">
        <Segmented
          ariaLabel="Theme"
          options={[
            { value: 'paper' as Theme, label: 'Paper' },
            { value: 'night' as Theme, label: 'Night' },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </div>

      <header className="masthead masthead--compact">
        {/* The mark: a riso ink blot on paper, the moon at night (App.css). */}
        <div className="mark" aria-hidden="true" />
        <h1 className="title title--sm">Fretboard Constellations</h1>
        <p className="masthead-lede">
          See the shape, hear the sound, find out what it's doing.
        </p>
        {/* Top-level areas: a higher separation than the modes within Study. */}
        <nav className="topnav" role="group" aria-label="Area">
          {AREAS.map((a) => (
            <button
              key={a}
              className={area === a ? 'topnav-item topnav-item--on' : 'topnav-item'}
              onClick={() => setArea(a)}
            >
              {AREA_LABELS[a]}
            </button>
          ))}
        </nav>
      </header>

      {/* Both areas stay mounted (just hidden) so each keeps its own state when
          you switch — the songbook, and Possibility's key/scale/mode choices. */}
      <div hidden={area !== 'study'}>
        <StudyArea onAddChord={addToSong} songLength={current.chords.length} />
      </div>
      {READY.play && (
      <div hidden={area !== 'song'}>
        <SongBook
          songs={songs}
          currentId={currentId}
          onSelect={setCurrentId}
          onAdd={addSong}
          onRename={renameCurrent}
          onDelete={deleteCurrent}
        />
        <SongView
          songId={current.id}
          chords={current.chords}
          setChords={setCurrentChords}
          bpm={current.bpm}
          beatsPerBar={current.beatsPerBar}
          denominator={current.denominator}
          onMeter={updateCurrent}
        />
        <PracticeCards
          cards={cards}
          onSave={saveCard}
          onOpen={openCard}
          onRemove={removeCard}
        />
      </div>
      )}
      {READY.earTraining && (
        <div hidden={area !== 'ear'}>
          <EarTrainingView />
        </div>
      )}
    </main>
  );
}

// --- Songbook: switch between songs, add / rename / delete ------------------
function SongBook({
  songs,
  currentId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
}: {
  songs: Song[];
  currentId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const current = songs.find((s) => s.id === currentId) ?? songs[0];
  return (
    <div className="songbook">
      {/* Tabs: one per song, plus a way to start a new one. */}
      <div className="songbook-tabs" role="group" aria-label="Songs">
        {songs.map((s) => (
          <button
            key={s.id}
            className={s.id === currentId ? 'pill pill--on' : 'pill'}
            onClick={() => onSelect(s.id)}
          >
            {s.name || 'Untitled'}
          </button>
        ))}
        <button className="chart-add" onClick={onAdd}>
          + New song
        </button>
      </div>

      {/* Rename / delete the open song. */}
      <div className="songbook-meta">
        <input
          className="songbook-name"
          value={current.name}
          aria-label="Song name"
          onChange={(e) => onRename(e.target.value)}
        />
        {songs.length > 1 && (
          <button className="pill" onClick={onDelete}>
            Delete song
          </button>
        )}
      </div>
    </div>
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
  // The scale degree the view is framed by, 0-based — or ALL (-1), meaning the
  // whole key rather than one slice of it: in Scales that's the parent scale
  // itself instead of a mode, and in Harmony the chord scale instead of one
  // degree's voicings.
  const [degree, setDegree] = useState(ALL_DEGREES);
  // The dots always print NOTE NAMES now. The degree is carried by colour (see
  // --deg-1..7 and the legend under the neck), so the two facts arrive at once
  // and there's no toggle to lose track of.
  // The fret of the last note clicked on the neck, so the re-rooted mode can land
  // in that position. `seq` bumps each click so re-clicking the same fret re-pins.
  const [focus, setFocus] = useState<{ fret: number; seq: number } | null>(null);

  const root = ROOT_CHOICES[rootIndex];
  const scale = SCALES[scaleId];

  // Click a note on the neck: select its degree AND remember the fret to focus.
  const pickNote = (d: number, fret: number) => {
    setDegree(d);
    setFocus((f) => ({ fret, seq: (f?.seq ?? 0) + 1 }));
  };

  // The seven Roman numerals of this key — the degree selector's labels. They sit
  // ABOVE Scales/Harmony and PERSIST across them: in Scales a degree picks the
  // mode built on it; in Harmony it picks that degree's chord.
  const romanLabels = diatonicChords(root, scale, false).map((c) => c.roman);
  const deg = degree === ALL_DEGREES ? ALL_DEGREES : Math.min(degree, romanLabels.length - 1);

  return (
    <>
      {/* Every choice in ONE measure — a labelled block whose rows share a left
          edge and divide the same width (see ui/ControlPanel.tsx). Order is
          priority order: Key → Scale → Degree → View → Labels.
          ('chord', the absolute key-less chord explorer, is intentionally NOT
          offered in the View list — it isn't useful on this key-oriented page
          yet. The view + ChordExplorer are kept below for a future, less
          key-centric section; re-add 'chord' to the list to show it.) */}
      <ControlPanel title="Controls">
        <ControlRow label="Key">
          <Segmented
            fill
            ariaLabel="Key"
            options={ROOT_CHOICES.map((note, i) => ({ value: i, label: noteName(note) }))}
            value={rootIndex}
            onChange={setRootIndex}
          />
        </ControlRow>
        <ControlRow label="Scale">
          <Segmented
            fill
            ariaLabel="Scale type"
            options={SCALE_LIST.map((s) => ({ value: s.id, label: s.name }))}
            value={scaleId}
            onChange={setScaleId}
          />
        </ControlRow>
        {/* Degree persists across views: in Scales it picks the MODE, in
            Harmony the chord degree. */}
        <ControlRow label="Gravity">
          <Segmented
            fill
            ariaLabel="Gravity"
            options={[
              { value: ALL_DEGREES, label: 'All' },
              ...romanLabels.map((roman, i) => ({ value: i, label: roman })),
            ]}
            value={deg}
            onChange={setDegree}
          />
        </ControlRow>
        <ControlRow label="View">
          <Segmented
            fill
            ariaLabel="Mode"
            options={[
              { value: 'scale' as Mode, label: 'Scales' },
              ...(READY.patterns ? [{ value: 'pattern' as Mode, label: 'Patterns' }] : []),
              { value: 'harmony' as Mode, label: 'Harmony' },
            ]}
            value={mode}
            onChange={setMode}
          />
        </ControlRow>
      </ControlPanel>

      {mode === 'scale' && (
        <ScaleView
          root={root}
          scale={scale}
          degree={deg}
          focus={focus}
          onPickNote={pickNote}
        />
      )}
      {READY.patterns && mode === 'pattern' && (
        <PatternView root={root} scale={scale} degree={deg} />
      )}
      {mode === 'chord' && <ChordView root={root} />}
      {mode === 'harmony' && (
        <HarmonyView
          root={root}
          scale={scale}
          degree={deg}
          onAddChord={onAddChord}
          songLength={songLength}
        />
      )}
    </>
  );
}

// --- Scale view: the MODE on the chosen degree, and its position boxes -------
// Degree 0 is the scale itself; degree 4 of a major key is Mixolydian, etc. The
// neck then shows that mode rooted on its own degree, in every position.
function ScaleView({
  root,
  scale,
  degree,
  focus,
  onPickNote,
}: {
  root: Note;
  scale: ScaleDefinition;
  degree: number;
  focus: { fret: number; seq: number } | null;
  onPickNote: (degree: number, fret: number) => void;
}) {
  // ALL means the key itself — the parent scale, not one of its modes.
  const isAll = degree === ALL_DEGREES;
  const { modeRoot, modeScale } = isAll
    ? { modeRoot: root, modeScale: scale }
    : modeAt(root, scale, degree);
  const tones = realizeScale(modeRoot, modeScale);

  // Click a note on the neck -> make it the new tonic. Map the note's pitch class
  // back to which degree of the PARENT scale it is, select that degree, and pass
  // the clicked fret so the mode lands in the position you clicked.
  const parentTones = realizeScale(root, scale);
  const pickRoot = (placed: PlacedNote) => {
    const pc = pitchClassOf(placed.note);
    const d = parentTones.findIndex((t) => pitchClassOf(t.note) === pc);
    if (d >= 0) onPickNote(d, placed.position.fret);
  };

  return (
    <>
      <p className="view-title">
        <span className="view-title__name">
          {noteName(modeRoot)} {modeScale.name}
        </span>
        <span className="view-title__tones">
          {tones.map((t) => noteName(t.note)).join(' · ')}
        </span>
      </p>

      <DegreeLegend root={modeRoot} scale={modeScale} />

      <ScaleExplorer
        root={modeRoot}
        scale={modeScale}
        onPickRoot={pickRoot}
        focus={focus ?? undefined}
        labelMode="note"
      />

      <footer className="footnote">
        Each box is a position (a fingering). Click any note to make it the new
        tonic — the mode shifts to start there, in that position.
      </footer>
    </>
  );
}

// --- Pattern view: drill the chosen MODE in interval pairs -----------------
// Same degree plumbing as ScaleView: the Roman-numeral selector picks the mode,
// and the drill runs through that mode's notes.
function PatternView({
  root,
  scale,
  degree,
}: {
  root: Note;
  scale: ScaleDefinition;
  degree: number;
}) {
  const { modeRoot, modeScale } =
    degree === ALL_DEGREES
      ? { modeRoot: root, modeScale: scale }
      : modeAt(root, scale, degree);
  const tones = realizeScale(modeRoot, modeScale);

  return (
    <>
      <p className="view-title">
        <span className="view-title__name">
          {noteName(modeRoot)} {modeScale.name}
        </span>
        <span className="view-title__tones">
          {tones.map((t) => noteName(t.note)).join(' · ')}
        </span>
      </p>

      <PatternExplorer root={modeRoot} scale={modeScale} labelMode="note" />
    </>
  );
}

// --- Chord view (Session 4): any chord quality, on any root ----------------
function ChordView({ root }: { root: Note }) {
  const [chordId, setChordId] = useState(CHORD_LIST[0].id);
  const chord = CHORDS[chordId];

  return (
    <>
      <p className="view-title">
        <span className="view-title__name">
          {noteName(root)}
          {chord.symbol}
        </span>
        <span className="view-title__tones">{chord.name}</span>
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
// The degree comes from the shared selector above, so it stays put when you flip
// between Scales and Harmony. This view just adds the triad/seventh choice.
function HarmonyView({
  root,
  scale,
  degree,
  onAddChord,
  songLength,
}: {
  root: Note;
  scale: ScaleDefinition;
  degree: number;
  onAddChord: (rootIndex: number, chordId: string) => void;
  songLength: number;
}) {
  const [seventh, setSeventh] = useState(false);
  // Three ways to explore the harmony: ONE chord in every voicing; the whole CHORD
  // SCALE (all seven diatonic chords) in one voicing; or one chord's INVERSIONS,
  // both laid up the neck.
  const [explore, setExplore] = useState<'chord' | 'scale' | 'inversions'>('chord');

  // The diatonic chords of this key + scale — derived, not stored. Switching the
  // global scale type (major, harmonic minor, ...) changes the whole harmony set.
  const chords = diatonicChords(root, scale, seventh);
  // ALL frames the whole key, so it shows the CHORD SCALE (every diatonic
  // chord) rather than one degree's voicings; a specific degree keeps whatever
  // way of exploring you last chose.
  const isAll = degree === ALL_DEGREES;
  const shownExplore = isAll ? 'scale' : explore;
  const selected = chords[isAll ? 0 : degree] ?? chords[0];

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
        {shownExplore === 'chord' && (
          <>
            Key of {noteName(root)} {scale.name} — {selected.roman}: {selected.name}
          </>
        )}
        {shownExplore === 'scale' && (
          <>
            Chord scale of {noteName(root)} {scale.name} — every chord in the key, in
            one voicing
          </>
        )}
        {shownExplore === 'inversions' && (
          <>
            {selected.name} — every inversion up the neck ({selected.roman} of{' '}
            {noteName(root)} {scale.name})
          </>
        )}
      </p>

      <div className="view-controls">
        <div className="controls-row">
          {/* What we're laddering: this one chord, or the whole chord scale. */}
          <Segmented
            ariaLabel="Explore"
            options={[
              { value: 'chord' as const, label: 'This chord' },
              { value: 'scale' as const, label: 'Chord scale' },
              { value: 'inversions' as const, label: 'Inversions' },
            ]}
            value={explore}
            onChange={setExplore}
          />

          {/* Triads vs seventh chords (the degree is chosen by the shared selector
              above). */}
          <Segmented
            ariaLabel="Chord size"
            options={[
              { value: 'triads', label: 'Triads' },
              { value: 'sevenths', label: 'Sevenths' },
            ]}
            value={seventh ? 'sevenths' : 'triads'}
            onChange={(v) => setSeventh(v === 'sevenths')}
          />
        </div>

        {/* Send the selected chord over to the Play song (chord mode only). */}
        {shownExplore === 'chord' && (
          <div className="controls-row">
            <button className="chart-add" onClick={addThisChord}>
              + Add {noteName(selected.chordRoot)}
              {selected.chord.symbol} to Play
            </button>
            <span className="control-label">
              {songLength} chord{songLength === 1 ? '' : 's'} in Play
            </span>
          </div>
        )}
      </div>

      {shownExplore === 'chord' && (
        <>
          {/* The chosen diatonic chord, explored with the shared voicing UI. */}
          <ChordExplorer root={selected.chordRoot} chord={selected.chord} labelMode="note" />
          <footer className="footnote">
            Each chord's quality comes from where it's built in the key.
          </footer>
        </>
      )}
      {shownExplore === 'scale' && (
        <ChordScaleLadder root={root} scale={scale} seventh={seventh} labelMode="note" />
      )}
      {shownExplore === 'inversions' && (
        <InversionLadder root={selected.chordRoot} chord={selected.chord} labelMode="note" />
      )}
    </>
  );
}

export default App;
