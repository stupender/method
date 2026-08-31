// ============================================================================
// App.tsx — the top of the React component tree
// ----------------------------------------------------------------------------
// Two top-level AREAS, switched by the nav under the title:
//   - Study: explore the materials — Scales (and Harmony) on the neck.
//   - Song:  lay out a song / lead sheet and reveal what to play over each chord.
// They're separate but connected: Study is for learning the materials, Song is
// for using them. Within Study, a Mode picks Scales vs Harmony.
// ============================================================================

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  Note,
  ScaleDefinition,
  PlacedNote,
  VoicingStructure,
} from './theory/types';
import { SCALES } from './data/scales';
import { CHORDS } from './data/chords';
import { ROOT_CHOICES } from './data/roots';
import { realizeScale } from './theory/scale';
import { modeAt } from './theory/mode';
import { diatonicChords } from './theory/harmony';
import {
  structuresForChord,
  structureName,
  inversionCount,
  voicingName,
  bassDegree,
} from './theory/chord';
import { STRUCTURES } from './data/voicings';
import { noteName, pitchClassOf } from './theory/notes';
import { ChordExplorer } from './ui/ChordExplorer';
import { ChordScaleLadder } from './ui/ChordScaleLadder';
import { InversionLadder } from './ui/InversionLadder';
import { ControlPanel, ControlRow } from './ui/ControlPanel';
import { BookmarksMenu, SaveBookmark } from './ui/Bookmarks';
import {
  defaultModuleState,
  describe,
  loadBookmarks,
  saveBookmarks,
  sameSetting,
  type Bookmark,
  type ModuleState,
} from './ui/moduleState';
import { MultiSelect } from './ui/MultiSelect';
import { PatternExplorer } from './ui/PatternExplorer';
import { ScaleExplorer } from './ui/ScaleExplorer';
import { Segmented } from './ui/Segmented';
import { SHOW_ADD_TO_PLAY } from './ui/flags';
import { ThemeToggle } from './ui/ThemeToggle';
import { SongView, type ChartChord } from './ui/SongView';
import { PracticeCards, type PracticeCard } from './ui/PracticeCards';
import { EarTrainingView } from './ui/EarTrainingView';
import { Mark } from './ui/Mark';
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
  earTraining: true, // reached from the CONTROLS panel's Mode row, not the nav
  patterns: false,
} as const;

// Ear Training is a MODE inside the study area now (see the Mode row), so the
// top nav only carries genuinely separate areas. With one entry it's noise, so
// it hides itself.
const AREAS: Area[] = ['study', ...(READY.play ? (['song'] as Area[]) : [])];

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
  // The modules on the page. One to begin with; a second can be added beside
  // it. Held as a list rather than a boolean so that three, or a saved
  // arrangement of them, is a change of data rather than of shape.
  const [panels, setPanels] = useState<{ id: string; initial?: ModuleState }[]>([
    { id: 'panel-1' },
  ]);
  // THE SAVED SETTINGS live here rather than in a panel, because the list is
  // the app's and a panel is only one of the things that can be in it.
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks());
  const writeBookmarks = (next: Bookmark[]) => {
    setBookmarks(next);
    saveBookmarks(next);
  };
  // Restoring has to push a setting INTO a panel, which owns its own state. A
  // bumped counter rather than a plain value, so restoring the same bookmark
  // twice still counts as something happening.
  const [restore, setRestore] = useState<{ state: ModuleState; seq: number } | null>(
    null,
  );
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
    <main
      className={
        panels.length > 1 ? 'page page--wide page--split' : 'page page--wide'
      }
    >
      {/* THE SITE BAR. This used to be a full-height centred masthead — a big
          moon, a 44px title, a lede — which looked handsome on a landing page
          and wasted a third of a phone screen on a tool you open to look at a
          fretboard. Now it's a nameplate: mark, name, motto, and the room
          setting on the right, over a hairline. Everything below it is work. */}
      <header className="sitebar">
        <Mark className="sitebar__mark" variant="triad" press />
        <h1 className="sitebar__name">Fretboard Constellations</h1>
        {/* Top-level areas: a higher separation than the modes within Study. */}
        {AREAS.length > 1 && (
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
        )}
        {/* Paper or Night — the two worlds of the design direction (DESIGN.md).
            Parked at the far end: it's a room setting, not a music choice. */}
        {/* The app's own controls, in the order they're reached for: what
            you've saved, then whether you're working in one panel or two, then
            the light — which is a room setting and belongs at the end. */}
        <BookmarksMenu
          list={bookmarks}
          onRestore={(state) =>
            setRestore((r) => ({ state, seq: (r?.seq ?? 0) + 1 }))
          }
          onRemove={(id) => writeBookmarks(bookmarks.filter((b) => b.id !== id))}
          onRename={(id, name) =>
            writeBookmarks(bookmarks.map((b) => (b.id === id ? { ...b, name } : b)))
          }
        />
        {panels.length === 1 && (
          <button
            className="sitebar__act"
            onClick={() =>
              setPanels((list) => [
                ...list,
                { id: `panel-${Date.now()}`, initial: list[0]?.initial },
              ])
            }
            aria-label="Work in two panels"
            title="Two panels"
          >
            {/* Two overlapping circles — the app's own mark cut down to two.
                Overlapping SQUARES is the operating system's word for
                duplicating a window; circles that meet is this app's word for
                two things sharing something. */}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9.5" cy="12" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="14.5" cy="12" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        )}

        <div className="sitebar__theme">
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
      </header>

      {/* Both areas stay mounted (just hidden) so each keeps its own state when
          you switch — the songbook, and Possibility's key/scale/mode choices. */}
      <div hidden={area !== 'study'}>
        {/* ONE MODULE, OR TWO SIDE BY SIDE. Each owns its own settings and
            knows nothing about the other, so this is a list rather than a
            special case — the second one is not a "compare mode", it's another
            of the same thing. It opens as a COPY of the one that spawned it,
            because the move worth practising is "here, then there", and you
            get there by setting one up and changing one control. */}
        <div className={panels.length > 1 ? 'modules modules--two' : 'modules'}>
          {panels.map((panel, i) => (
            <Module
              key={panel.id}
              initial={panel.initial}
              onAddChord={addToSong}
              songLength={current.chords.length}
              bookmarks={bookmarks}
              onSaveBookmark={(state, label) =>
                writeBookmarks([
                  ...bookmarks,
                  {
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    name: label,
                    state,
                    savedAt: Date.now(),
                  },
                ])
              }
              // Only the FIRST panel takes a restore for now. Which side a
              // preset should open into is a real question and Stu flagged it
              // to answer after using two-up; guessing an answer here would
              // bake it in.
              restore={i === 0 ? restore : null}
              onClose={
                panels.length > 1
                  ? () => setPanels((list) => list.filter((_, n) => n !== i))
                  : undefined
              }
            />
          ))}
        </div>
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

// --- A MODULE: one CONTROLS panel, its neck, and its systems ----------------
// It owns its settings as a single ModuleState and knows nothing about the page
// around it, which is what makes putting a second one beside it a matter of
// rendering it twice rather than of untangling shared state. See BACKLOG's
// staging for the module idea.
function Module({
  onAddChord,
  songLength,
  initial,
  onClose,
  bookmarks,
  onSaveBookmark,
  restore,
}: {
  onAddChord: (rootIndex: number, chordId: string) => void;
  songLength: number;
  /** What this module opens set to. A second module starts as a copy of the
   *  first, because the useful move is "set one up, then change one thing". */
  initial?: ModuleState;
  /** Given when this module can be closed. */
  onClose?: () => void;
  /** Everything saved, so this panel can tell whether IT is one of them. */
  bookmarks: Bookmark[];
  onSaveBookmark: (state: ModuleState, label: string) => void;
  /** A setting pushed in from the bookmarks menu; the counter is what makes
   *  restoring the same one twice count as an event. */
  restore?: { state: ModuleState; seq: number } | null;
}) {
  // ONE OBJECT, NOT A DOZEN. Everything this panel is set to lives in a single
  // ModuleState (see ui/moduleState.ts), which is what makes a module a thing
  // that can be copied, saved, and eventually put on the page twice.
  //
  // Below, the individual names are read back out of it and the setters put
  // values back in. That looks like ceremony and is the point: every control in
  // this file goes on calling `setDegree(3)` exactly as it did, while the state
  // underneath became one value. A refactor nobody has to notice is a refactor
  // that can't break the thing it's refactoring.
  const [state, setState] = useState<ModuleState>(
    () => initial ?? defaultModuleState(SCALE_LIST[0].id),
  );
  const set = <K extends keyof ModuleState>(key: K, value: ModuleState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const { studyMode, rootIndex, scaleId, degree, seventh, structureId } = state;
  const { inversionIndex, seventhsInEar, quiz, fingering } = state;
  const mode: Mode = state.view;

  const setStudyMode = (v: 'fretboard' | 'ear') => set('studyMode', v);
  const setMode = (v: Mode) => set('view', v === 'harmony' ? 'harmony' : 'scale');
  const setRootIndex = (v: number) => set('rootIndex', v);
  const setScaleId = (v: string) => set('scaleId', v);
  const setDegree = (v: number) => set('degree', v);
  const setSeventh = (v: boolean) => set('seventh', v);
  const setStructureId = (v: string | null) => set('structureId', v);
  const setInversionIndex = (v: number) => set('inversionIndex', v);
  const setSeventhsInEar = (v: boolean) => set('seventhsInEar', v);
  const setQuiz = (v: 'quality' | 'inversion' | 'function') => set('quiz', v);
  const setFingering = (v: '3nps' | 'box' | 'hybrid') => set('fingering', v);

  // EAR MODE'S SELECTIONS ARE SETS, not single values. On the neck a control
  // answers "what am I looking at", so exactly one; in Ear Training the same
  // control answers "what might I be played", so any number — each extra choice
  // widens the pool rather than replacing it. They're kept separately from the
  // fretboard's choices so switching modes doesn't destroy either.
  //
  // Stored as ARRAYS because a Set doesn't survive being written to storage,
  // and a saved preset has to survive. Sets are rebuilt here for the controls,
  // which want set semantics.
  const earRoots: ReadonlySet<number> = new Set(state.earRoots);
  const earScaleIds: ReadonlySet<string> = new Set(state.earScaleIds);
  const earDegrees: ReadonlySet<number> = new Set(state.earDegrees);
  const earViews: ReadonlySet<'scale' | 'harmony'> = new Set(state.earViews);
  const setEarRoots = (s: ReadonlySet<number>) => set('earRoots', [...s]);
  const setEarScaleIds = (s: ReadonlySet<string>) => set('earScaleIds', [...s]);
  const setEarDegrees = (s: ReadonlySet<number>) => set('earDegrees', [...s]);
  const setEarViews = (s: ReadonlySet<'scale' | 'harmony'>) =>
    set('earViews', [...s] as ('scale' | 'harmony')[]);

  // Toggling never empties a set — with nothing chosen there'd be nothing to
  // quiz, so the last one standing refuses to switch off.
  const toggleIn = <T,>(
    set_: ReadonlySet<T>,
    setter: (s: ReadonlySet<T>) => void,
  ) => (value: T) => {
    const next = new Set(set_);
    if (next.has(value)) {
      if (next.size === 1) return;
      next.delete(value);
    } else {
      next.add(value);
    }
    setter(next);
  };

  // A setting arriving from the bookmarks menu.
  const lastRestore = useRef(0);
  useEffect(() => {
    if (restore && restore.seq !== lastRestore.current) {
      lastRestore.current = restore.seq;
      setState(restore.state);
    }
  }, [restore]);

  // NOT part of the module's state: which fret you last clicked is about this
  // moment, not about what the panel is set to. A preset that restored a
  // half-finished gesture would be restoring the wrong thing.
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
  // Saving is now the whole of it: the panel's state IS the thing a bookmark
  // holds, so there's nothing to gather. (This was fifteen lines when the
  // settings lived apart.)
  const moduleState = (): ModuleState => ({ ...state, scrollY: Math.round(window.scrollY) });

  const romanLabels = diatonicChords(root, scale, false).map((c) => c.roman);

  // HARMONY'S OWN THREE CHOICES. They used to live inside the ladders, under
  // their own headings, which meant the page had two places that looked like
  // controls: the CONTROLS panel, and then some more controls further down. One
  // measure, one place. They're lifted here so both ladders read the same
  // values and neither can drift from the other.
  // Which ear drill. Up here with the rest, so Ear's panel reads the same way
  // the fretboard's does rather than keeping one of its choices downstairs.
  // null = "whatever suits this chord type" (see harmonyStructure below), held
  // as null rather than an id so switching Triads <-> Sevenths re-picks instead
  // of stranding you on a voicing that barely fits.


  // The voicings available for the chord type in play. All seven diatonic
  // chords share a voice count, so the tonic's chord answers for all of them.
  const harmonySample = diatonicChords(root, scale, seventh)[0].chord;
  const harmonyVoices = inversionCount(harmonySample);
  const harmonyStructures = structuresForChord(harmonySample, STRUCTURES);
  // Triads want Close (all four string sets hold all three inversions);
  // sevenths want DROP 2, because a close-voiced seventh only fits on A D G B.
  const harmonyStructure =
    harmonyStructures.find(
      (s) => s.id === (structureId ?? (harmonyVoices === 4 ? 'drop2' : 'close')),
    ) ?? harmonyStructures[0];
  const harmonyInversion = Math.min(inversionIndex, harmonyVoices - 1);
  // The inversion cells, ordered by the note in the BASS — root, 3rd, 5th, 7th.
  // Ordering them by inversion NUMBER instead is fine for close voicings, where
  // the two agree, but a drop 2 lists them as 5th, 7th, root, 3rd, which reads
  // like a bug. Same cells either way; this is just the order a musician
  // expects to find them in.
  const harmonyInversions = harmonySample.intervals
    .map((iv) => {
      const degree = String(iv.diatonicSteps + 1);
      const inv = Array.from({ length: harmonyVoices }, (_, i) => i).find(
        (i) => bassDegree(harmonySample, harmonyStructure, i) === degree,
      );
      return inv === undefined
        ? null
        : { value: inv, label: voicingName(harmonySample, harmonyStructure, inv) };
    })
    .filter((o): o is { value: number; label: string } => o != null);
  const deg = degree === ALL_DEGREES ? ALL_DEGREES : Math.min(degree, romanLabels.length - 1);

  // WHERE GRAVITY IS HELD, as a root + scale. The neck's colour key reads from
  // it, so the key can't contradict the dots: with GRAVITY on ii the dots are
  // relative to the ii and the key has to be too. In Harmony it still lines up,
  // because a chord's root, 3rd and 5th are its mode's 1, 3 and 5.
  const { modeRoot: gravityRoot, modeScale: gravityScale } =
    deg === ALL_DEGREES ? { modeRoot: root, modeScale: scale } : modeAt(root, scale, deg);

  return (
    // A real element, not a fragment: a module has to be findable from inside
    // itself. The scroll-focus hook walks up from a card to `.module` to find
    // WHICH floating neck it belongs to, which only works if there's something
    // to walk up to.
    <section className="module">
      {/* Every choice in ONE measure — a labelled block whose rows share a left
          edge and divide the same width (see ui/ControlPanel.tsx). Order is
          priority order: Key → Scale → Degree → View → Labels.
          ('chord', the absolute key-less chord explorer, is intentionally NOT
          offered in the View list — it isn't useful on this key-oriented page
          yet. The view + ChordExplorer are kept below for a future, less
          key-centric section; re-add 'chord' to the list to show it.) */}
      <ControlPanel
        title="Controls"
        action={
          <div className="panel__actions">
            <SaveBookmark
              saved={bookmarks.some((b) => sameSetting(b.state, state))}
              onSave={() =>
                onSaveBookmark(
                  moduleState(),
                  describe(moduleState(), {
                    root: noteName(root),
                    scale: scale.name,
                    roman: deg === ALL_DEGREES ? null : romanLabels[deg],
                  }),
                )
              }
            />
            {onClose && (
              <button
                className="panel__act"
                onClick={onClose}
                aria-label="Close this panel"
                title="Close this panel"
              >
                ×
              </button>
            )}
          </div>
        }
      >
        {READY.earTraining && (
          <ControlRow label="Mode">
            <Segmented
              fill
              ariaLabel="Mode"
              options={[
                { value: 'fretboard' as const, label: 'Fretboard' },
                { value: 'ear' as const, label: 'Ear' },
              ]}
              value={studyMode}
              onChange={setStudyMode}
            />
          </ControlRow>
        )}
        <ControlRow label="Key">
          {studyMode === 'ear' ? (
            <MultiSelect
              fill
              ariaLabel="Keys in play"
              options={ROOT_CHOICES.map((note, i) => ({ value: i, label: noteName(note) }))}
              values={earRoots}
              onToggle={toggleIn(earRoots, setEarRoots)}
            />
          ) : (
            <Segmented
              fill
              ariaLabel="Key"
              options={ROOT_CHOICES.map((note, i) => ({ value: i, label: noteName(note) }))}
              value={rootIndex}
              onChange={setRootIndex}
            />
          )}
        </ControlRow>
        <ControlRow label="Scale">
          {studyMode === 'ear' ? (
            <MultiSelect
              fill
              ariaLabel="Scales in play"
              options={SCALE_LIST.map((s) => ({ value: s.id, label: s.name }))}
              values={earScaleIds}
              onToggle={toggleIn(earScaleIds, setEarScaleIds)}
            />
          ) : (
            <Segmented
              fill
              ariaLabel="Scale type"
              options={SCALE_LIST.map((s) => ({ value: s.id, label: s.name }))}
              value={scaleId}
              onChange={setScaleId}
            />
          )}
        </ControlRow>
        {/* Degree persists across views: in Scales it picks the MODE, in
            Harmony the chord degree. */}
        <ControlRow label="Gravity">
          {studyMode === 'ear' ? (
            /* No "All" cell here — selecting every degree IS all of them, and
               a separate All would be a second way to say the same thing. */
            <MultiSelect
              fill
              ariaLabel="Degrees in play"
              options={romanLabels.map((roman, i) => ({ value: i, label: roman }))}
              values={earDegrees}
              onToggle={toggleIn(earDegrees, setEarDegrees)}
            />
          ) : (
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
          )}
        </ControlRow>
        <ControlRow label="View">
          {studyMode === 'ear' ? (
            <MultiSelect
              fill
              ariaLabel="Material in play"
              options={[
                { value: 'scale' as const, label: 'Scales' },
                { value: 'harmony' as const, label: 'Harmony' },
              ]}
              values={earViews}
              onToggle={toggleIn(earViews, setEarViews)}
            />
          ) : (
            <Segmented
              fill
              ariaLabel="View"
              options={[
                { value: 'scale' as Mode, label: 'Scales' },
                ...(READY.patterns ? [{ value: 'pattern' as Mode, label: 'Patterns' }] : []),
                { value: 'harmony' as Mode, label: 'Harmony' },
              ]}
              value={mode}
              onChange={setMode}
            />
          )}
        </ControlRow>
        {/* SCALES' ONE, in the same place Harmony's three sit: at the end of
            the panel, under the View row that summons it. It used to float in
            the gap between the panel and the neck, which made it read as a
            control belonging to neither — and it's the same kind of choice as
            Voicing, so it belongs in the same kind of row. */}
        {studyMode === 'fretboard' && mode === 'scale' && (
          <ControlRow label="Fingering">
            <Segmented
              fill
              ariaLabel="Fingering"
              options={[
                { value: '3nps' as const, label: '3 per string' },
                { value: 'box' as const, label: 'Positional' },
                { value: 'hybrid' as const, label: 'Hybrid' },
              ]}
              value={fingering}
              onChange={setFingering}
            />
          </ControlRow>
        )}

        {/* TYPE, in the same place and under the same name as the fretboard's
            — Ear is the same instrument listened to rather than looked at, so
            its panel should read down in the same order. It was called Chords
            and sat above View, which made the two modes look like two apps. */}
        {studyMode === 'ear' && (
          <ControlRow label="Type">
            <Segmented
              fill
              ariaLabel="Chord type"
              options={[
                { value: 'triads', label: 'Triads' },
                { value: 'sevenths', label: 'Sevenths' },
              ]}
              value={seventhsInEar ? 'sevenths' : 'triads'}
              onChange={(v) => setSeventhsInEar(v === 'sevenths')}
            />
          </ControlRow>
        )}
        {studyMode === 'ear' && (
          <ControlRow label="Quiz">
            <Segmented
              fill
              ariaLabel="Which drill"
              options={[
                { value: 'quality' as const, label: 'Quality' },
                { value: 'inversion' as const, label: 'Inversion' },
                { value: 'function' as const, label: 'Function' },
              ]}
              value={quiz}
              onChange={setQuiz}
            />
          </ControlRow>
        )}

        {/* HARMONY'S THREE, at the end of the panel: what the chords are, how
            they're voiced, and which note is in the bass. They only appear in
            Harmony, because that's the only place they mean anything.

            INVERSION is the exception to "always show every control": in the
            chord scale it picks one voicing for all seven chords, but with
            GRAVITY on a single degree the page already lays out EVERY
            inversion of that chord, so there'd be nothing left to choose. */}
        {studyMode === 'fretboard' && mode === 'harmony' && (
          <>
            <ControlRow label="Type">
              <Segmented
                fill
                ariaLabel="Chord type"
                options={[
                  { value: 'triads', label: 'Triads' },
                  { value: 'sevenths', label: 'Sevenths' },
                ]}
                value={seventh ? 'sevenths' : 'triads'}
                onChange={(v) => setSeventh(v === 'sevenths')}
              />
            </ControlRow>
            <ControlRow label="Voicing">
              <Segmented
                fill
                ariaLabel="Voicing"
                options={harmonyStructures.map((s) => ({
                  value: s.id,
                  label: structureName(s, harmonyVoices),
                }))}
                value={harmonyStructure.id}
                onChange={setStructureId}
              />
            </ControlRow>
            {deg === ALL_DEGREES && (
              <ControlRow label="Inversion">
                <Segmented
                  fill
                  ariaLabel="Inversion"
                  options={harmonyInversions}
                  value={harmonyInversion}
                  onChange={setInversionIndex}
                />
              </ControlRow>
            )}
          </>
        )}
      </ControlPanel>

      {studyMode === 'ear' && (
        <EarTrainingView
          quiz={quiz}
          selection={{
            roots: earRoots,
            scaleIds: earScaleIds,
            degrees: earDegrees,
            views: earViews,
            sevenths: seventhsInEar,
          }}
        />
      )}

      {studyMode === 'fretboard' && mode === 'scale' && (
        <ScaleView
          root={root}
          scale={scale}
          degree={deg}
          fingering={fingering}
          focus={focus}
          onPickNote={pickNote}
        />
      )}
      {/* Patterns and the key-less chord explorer are both built and both
          switched off. A module's view is 'scale' or 'harmony' — those two are
          reachable from the VIEW row — so these render nothing today; the
          widened check is what keeps the code compiling next to a narrower
          type, and marks the seam where they'd come back. */}
      {studyMode === 'fretboard' && READY.patterns && (mode as Mode) === 'pattern' && (
        <PatternView root={root} scale={scale} degree={deg} />
      )}
      {studyMode === 'fretboard' && (mode as Mode) === 'chord' && (
        <ChordView root={root} />
      )}
      {studyMode === 'fretboard' && mode === 'harmony' && (
        <HarmonyView
          root={root}
          scale={scale}
          degree={deg}
          gravity={{ root: gravityRoot, scale: gravityScale }}
          seventh={seventh}
          structure={harmonyStructure}
          inversion={harmonyInversion}
          onAddChord={onAddChord}
          songLength={songLength}
        />
      )}
    </section>
  );
}

// --- Scale view: the MODE on the chosen degree, and its position boxes -------
// Degree 0 is the scale itself; degree 4 of a major key is Mixolydian, etc. The
// neck then shows that mode rooted on its own degree, in every position.
function ScaleView({
  root,
  scale,
  degree,
  fingering,
  focus,
  onPickNote,
}: {
  root: Note;
  scale: ScaleDefinition;
  degree: number;
  /** Chosen in the CONTROLS panel now, so it just passes through. */
  fingering: '3nps' | 'box' | 'hybrid';
  focus: { fret: number; seq: number } | null;
  onPickNote: (degree: number, fret: number) => void;
}) {
  // ALL means the key itself — the parent scale, not one of its modes.
  const isAll = degree === ALL_DEGREES;
  const { modeRoot, modeScale } = isAll
    ? { modeRoot: root, modeScale: scale }
    : modeAt(root, scale, degree);
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
      {/* No title here any more: the scale's name and its notes ride on the
          fretboard itself, where they stay visible while you scroll. */}
      <ScaleExplorer
        root={modeRoot}
        scale={modeScale}
        fingering={fingering}
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
  gravity,
  seventh,
  structure,
  inversion,
  onAddChord,
  songLength,
}: {
  root: Note;
  scale: ScaleDefinition;
  degree: number;
  // Root + scale of whatever GRAVITY is framing, for the neck's colour key.
  gravity: { root: Note; scale: ScaleDefinition };
  seventh: boolean;
  structure: VoicingStructure;
  inversion: number;
  onAddChord: (rootIndex: number, chordId: string) => void;
  songLength: number;
}) {
  // The diatonic chords of this key + scale — derived, not stored. Switching the
  // global scale type (major, harmonic minor, ...) changes the whole harmony set.
  const chords = diatonicChords(root, scale, seventh);
  // WHAT WE SHOW IS DECIDED UPSTAIRS. GRAVITY already asked the question: "All"
  // frames the whole key, so it shows the CHORD SCALE (every diatonic chord); a
  // single degree means one chord, so it shows that chord's INVERSIONS across
  // the neck. There used to be a Chord scale / Inversions toggle here as well —
  // the same question asked twice, with the two answers free to disagree.
  const isAll = degree === ALL_DEGREES;
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
      <div className="view-controls">
        {/* Type / Voicing / Inversion all live in the CONTROLS panel now — one
            measure, one place, and both ladders read the same values. */}

        {/* Send the selected chord over to the Play song. Only when a single
            degree is in play — "All" isn't one chord to add. */}
        {SHOW_ADD_TO_PLAY && !isAll && (
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

      {isAll ? (
        <ChordScaleLadder
          root={root}
          scale={scale}
          seventh={seventh}
          structure={structure}
          inversion={inversion}
          labelMode="note"
        />
      ) : (
        <InversionLadder
          root={selected.chordRoot}
          chord={selected.chord}
          structure={structure}
          gravity={gravity}
          labelMode="note"
        />
      )}
    </>
  );
}

export default App;
