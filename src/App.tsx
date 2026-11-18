// ============================================================================
// App.tsx — the top of the React component tree
// ----------------------------------------------------------------------------
// Two top-level AREAS, switched by the nav under the title:
//   - Study: explore the materials — Scales (and Harmony) on the neck.
//   - Song:  lay out a song / lead sheet and reveal what to play over each chord.
// They're separate but connected: Study is for learning the materials, Song is
// for using them. Within Study, a Mode picks Scales vs Harmony.
// ============================================================================

import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type {
  Instrument,
  Note,
  ScaleDefinition,
  PlacedNote,
  Tuning,
  VoicingStructure,
} from './theory/types';
import { SCALES } from './data/scales';
import { CHORDS } from './data/chords';
import { ROOT_CHOICES } from './data/roots';
import { INSTRUMENTS, INSTRUMENT_LIST, GUITAR } from './data/instruments';
import { TUNINGS, GUITAR_STANDARD, tuningsFor } from './data/tunings';
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
import { Subscribe } from './ui/Subscribe';
import {
  AUTHOR,
  BEING_SOUND,
  FEEDBACK_EMAIL,
  FEEDBACK_SUBJECT,
  LESSONS,
  SUBSTACK,
} from './ui/links';
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
import { stateFromUrl } from './ui/shareCode';
import { SettingsMenu, loadStaffPx, saveStaffPx } from './ui/Settings';
import { MultiSelect } from './ui/MultiSelect';
import { PatternExplorer } from './ui/PatternExplorer';
import { ScaleExplorer } from './ui/ScaleExplorer';
import { Segmented } from './ui/Segmented';
import { BARS_ON_TOP, SHOW_ADD_TO_PLAY, SHOW_KEYBOARD } from './ui/flags';
import { ThemeToggle } from './ui/ThemeToggle';
import { SongView, type ChartChord } from './ui/SongView';
import { PracticeCards, type PracticeCard } from './ui/PracticeCards';
import { EarTrainingView } from './ui/EarTrainingView';
import { qualitiesFor } from './theory/earMaterial';
import { Mark } from './ui/Mark';
import { Dock } from './ui/Dock';
import {
  loadProgression,
  makeBar,
  readProgression,
  saveProgression,
  summarize,
  type Progression,
} from './ui/bars';
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
  earTraining: true,
  patterns: false,
} as const;

// EAR TRAINING IS AN AREA, not a row inside the panel.
//
// It was a row for a while — a "Mode" switch at the top of CONTROLS — and that
// was the wrong level twice over. A control that decides WHICH ROWS EXIST
// beneath it, and silently changes two of the survivors from pick-one to
// pick-many, is a level above them; it can't sit inside the box it rewrites.
// And in an app that teaches modes, a row labelled "Mode" that has nothing to
// do with modes is a collision you can't explain away — Gravity is the mode
// picker here.
//
// So the nav says what you're DOING and the panel says what you're doing it
// TO. Which is also what makes room for the instrument to come down into the
// panel, where it means something. See DESIGN.md.
const AREAS: Area[] = [
  'study',
  ...(READY.earTraining ? (['ear'] as Area[]) : []),
  ...(READY.play ? (['song'] as Area[]) : []),
];

// The label each top-level area shows in the nav.
/** How each fingering system is written on a folded panel's one line. */
const FINGERING_LABELS: Record<ModuleState['fingering'], string> = {
  caged: 'CAGED',
  '3nps': '3NPS',
  '4nps': '4NPS',
  '5nps': '5NPS',
};

const AREA_LABELS: Record<Area, string> = {
  // FRETBOARD, not "Possibility". Possibility is what the app is ABOUT — it's
  // in the footer, and it's the idea the whole thing rests on — but a nav item
  // has one job, which is to say what you'll find behind it. "Fretboard" says
  // it, matches the name over the door, and is the word this switch already
  // used when it was a row inside the panel.
  study: 'Fretboard',
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
  // A SHARED LINK OPENS INTO ITS SETTING — including the area it was made in,
  // since a setting full of ear-training pools means nothing on the fretboard.
  // Read once, at startup, and the hash is cleared as it's read (see
  // stateFromUrl) so a reload doesn't drag you back after you've moved on.
  const shared = useRef(stateFromUrl()).current;
  // HOW BIG THE NOTATION IS DRAWN — a reading preference, kept in this browser
  // the way the light is. See STAFF_PX in render/System.tsx for what the
  // number means, and ui/Settings.tsx for the control.
  const [staffPx, setStaffPx] = useState(loadStaffPx);
  useEffect(() => saveStaffPx(staffPx), [staffPx]);

  // ==========================================================================
  // HOW TALL THE SITE BAR IS, published to the stylesheet as `--bar-h`
  // --------------------------------------------------------------------------
  // Everything that floats comes to rest on the bar: the controls panel sits
  // on it, and the neck sits on the folded panel. CSS has to be told where
  // that is, as a `top`, and the bar's height isn't a constant — on a phone it
  // wraps to two lines and grows from 55 to 95. A hard-coded 55 meant the
  // panel pinned itself BEHIND the bar on exactly the screen where saving
  // space matters most.
  //
  // So it's measured. One observer, one custom property, and every sticky
  // offset in App.css is written in terms of it — see `.panel` there.
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const publish = () =>
      document.documentElement.style.setProperty(
        '--bar-h',
        `${Math.round(el.getBoundingClientRect().height)}px`,
      );
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [area, setArea] = useState<Area>(
    shared?.studyMode === 'ear' ? 'ear' : 'study',
  );

  // The SONGBOOK lives here, above both areas, so it survives switching to
  // the Fretboard area and back, and so its "Add to Play" button can
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
  // ==========================================================================
  // THE PROGRESSION — the bars in the dock, each one a whole panel setting
  // --------------------------------------------------------------------------
  // The Fretboard area shows ONE panel at a time: the selected bar's. The
  // progression is the list of bars, kept in this browser (see ui/bars.ts).
  // This replaced the second, side-by-side panel: "+ Bar" is the same gesture
  // — copy this setting and change one thing — laid out in time instead of
  // across the page.
  //
  // A SHARED LINK ADDS A BAR rather than replacing what's there, so opening a
  // link someone sent you never throws away a progression you'd built. With
  // no progression there's nothing to keep, so the link just becomes the panel.
  const [progression, setProgression] = useState<Progression>(() => {
    const p = loadProgression();
    if (shared && shared.studyMode !== 'ear') {
      const bar = makeBar({ ...shared, studyMode: 'fretboard' });
      if (!p.started) return { bars: [bar], selected: bar.id, started: false };
      return { bars: [...p.bars, bar], selected: bar.id, started: true };
    }
    return p;
  });
  useEffect(() => saveProgression(progression), [progression]);
  const selectedBar =
    progression.bars.find((b) => b.id === progression.selected) ?? progression.bars[0];

  // EAR TRAINING HAS ITS OWN PANEL. It used to share the Fretboard's (one panel
  // switching modes), which stopped making sense once the Fretboard became a
  // progression: the listening drill would have changed every time you picked
  // a different bar. `rev` restarts it from a restored setting.
  const [ear, setEar] = useState<{ rev: number; state?: ModuleState }>(() => ({
    rev: 0,
    state: shared?.studyMode === 'ear' ? shared : undefined,
  }));

  // What each bar says on the dock, and its job in the song.
  const summaries = useMemo(
    () => progression.bars.map((b) => summarize(b.state)),
    [progression.bars],
  );
  const reading = useMemo(() => readProgression(summaries), [summaries]);

  // The selected bar's panel reports every change, so the bar keeps it.
  const updateSelectedBar = (state: ModuleState) =>
    setProgression((p) => ({
      ...p,
      bars: p.bars.map((b) => (b.id === p.selected ? { ...b, state } : b)),
    }));
  // + BAR: a copy of the selected bar, added at the END and opened — like a
  // browser's new-tab button, which is where this + sits (at the end of the
  // tabs). With no progression yet, + starts one: the panel as it stands is
  // bar 1.
  const addBar = () =>
    setProgression((p) => {
      if (!p.started) return { ...p, started: true };
      const source = p.bars.find((b) => b.id === p.selected) ?? p.bars[0];
      // A copy is folded or open like the bar it copies.
      const bar = { ...makeBar(source.state), panelOpen: source.panelOpen };
      return { bars: [...p.bars, bar], selected: bar.id, started: true };
    });
  // + ON A CHORD'S TAB CARD: that chord, as a new bar at the END of the
  // progression — and the selection stays where it is. You're browsing the
  // chord scale; clicking + on I, then IV, then V builds the progression in
  // order without yanking the page to each new bar.
  const addChordBar = (degree: number) =>
    setProgression((p) => {
      const source = p.bars.find((b) => b.id === p.selected) ?? p.bars[0];
      // With no progression yet, the panel as it stands becomes bar 1 and the
      // chord comes after it — the same as adding to a progression of one.
      const bar = { ...makeBar({ ...source.state, degree }), panelOpen: source.panelOpen };
      return { ...p, bars: [...p.bars, bar], started: true };
    });
  // The open bar's panel was opened or folded: remember it on that bar.
  const rememberPanelOpen = (open: boolean) =>
    setProgression((p) => ({
      ...p,
      bars: p.bars.map((b) => (b.id === p.selected ? { ...b, panelOpen: open } : b)),
    }));
  // Remove a bar; its neighbour takes the selection. × on the ONLY bar puts
  // the progression away: the strip goes, the panel stays exactly as it was.
  const removeBar = (id: string) =>
    setProgression((p) => {
      if (p.bars.length <= 1) return { ...p, started: false };
      const at = p.bars.findIndex((b) => b.id === id);
      const bars = p.bars.filter((b) => b.id !== id);
      const selected =
        p.selected === id ? bars[Math.min(at, bars.length - 1)].id : p.selected;
      return { bars, selected, started: true };
    });
  // RESTORING A SAVED SETTING goes where the setting belongs: a fretboard
  // setting replaces the selected bar, an ear setting goes to Ear Training's
  // panel. Each is restarted (`rev`) so the panel opens on what was restored.
  const restoreSetting = (saved: ModuleState) => {
    if (saved.studyMode === 'ear') {
      setEar((e) => ({ rev: e.rev + 1, state: saved }));
      setArea('ear');
    } else {
      setProgression((p) => ({
        ...p,
        bars: p.bars.map((b) =>
          b.id === p.selected ? { ...b, state: saved, rev: b.rev + 1 } : b,
        ),
      }));
      setArea('study');
    }
    // Put the page back where it was, once the setting has laid out. Instant,
    // not smooth — see goTo in useScrollFocus.ts for why.
    if (typeof saved.scrollY === 'number') {
      const y = saved.scrollY;
      setTimeout(() => window.scrollTo({ top: y, behavior: 'auto' }), 90);
    }
  };
  // THE SAVED SETTINGS live here rather than in a panel, because the list is
  // the app's and a panel is only one of the things that can be in it.
  // (WHICH INSTRUMENT used to live here, as one setting for the whole app,
  // reached from a menu in the site bar. It's a row in each panel now — see
  // the Instrument row in Module. Two reasons: it does nothing at all in Ear
  // Training, so in the bar it was a control on screen changing nothing you
  // could see or hear; and a guitar beside a ukulele in the same key is the
  // most useful thing two panels have ever been for, which one app-wide
  // instrument made impossible.)

  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks());
  // PUT ONE IN THE LIST. Separate from the save button's toggle on purpose:
  // pressing the bookmark twice on one setting should unsave it, but pasting a
  // setting you already have must not silently delete it.
  const addBookmark = (state: ModuleState, label: string) => {
    writeBookmarks([
      ...bookmarks,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: label,
        state,
        savedAt: Date.now(),
      },
    ]);
  };
  const writeBookmarks = (next: Bookmark[]) => {
    setBookmarks(next);
    saveBookmarks(next);
  };
  // (The plumbing that used to push a restored setting DOWN into a panel is
  // gone. The saved list is in each panel's own title strip now, so a panel
  // restores itself and nothing has to be threaded through the app.)
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

  // What both panels — the selected bar's and Ear Training's — are handed.
  const moduleShared = {
    onAddChord: addToSong,
    songLength: current.chords.length,
    bookmarks,
    staffPx,
    // SAVE, OR UNSAVE. The mark in a panel's corner reports whether this exact
    // setting is in the list, so the button that draws it has to be able to
    // take it out again — otherwise pressing it twice saved the same setting
    // twice and the only way back was the menu.
    onToggleBookmark: (state: ModuleState, label: string) => {
      const existing = bookmarks.filter((b) => sameSetting(b.state, state));
      if (existing.length > 0) {
        writeBookmarks(bookmarks.filter((b) => !existing.includes(b)));
        return;
      }
      addBookmark(state, label);
    },
    onAddBookmark: addBookmark,
    onRestore: restoreSetting,
    onRemoveBookmark: (id: string) => writeBookmarks(bookmarks.filter((b) => b.id !== id)),
    onRenameBookmark: (id: string, name: string) =>
      writeBookmarks(bookmarks.map((b) => (b.id === id ? { ...b, name } : b))),
  };

  // THE PROGRESSION'S BARS, ready to put wherever BARS_ON_TOP says: fixed to
  // the bottom of the screen, or as the first row of the control panel.
  const barsStrip = (placement: 'bottom' | 'top') => (
    <Dock
      placement={placement}
      bars={progression.bars.map((b, i) => ({ id: b.id, summary: summaries[i] }))}
      selectedId={selectedBar.id}
      keyName={reading.keyName}
      functions={reading.functions}
      onSelect={(id) => setProgression((p) => ({ ...p, selected: id }))}
      onRemove={removeBar}
      // On top, the + sits at the end of the tabs, like a browser's.
      onAdd={placement === 'top' ? addBar : undefined}
    />
  );

  return (
    <main
      className={
        area === 'study' && !BARS_ON_TOP && progression.started
          ? 'page page--wide page--docked'
          : 'page page--wide'
      }
    >
      {/* THE SITE BAR. This used to be a full-height centred masthead — a big
          moon, a 44px title, a lede — which looked handsome on a landing page
          and wasted a third of a phone screen on a tool you open to look at a
          fretboard. Now it's a nameplate: mark, name, motto, and the room
          setting on the right, over a hairline. Everything below it is work. */}
      <header className="sitebar" ref={bar}>
        <Mark className="sitebar__mark" variant="triad" press />
        <h1 className="sitebar__name">Fretboard Constellations</h1>
        {/* BETA — a LABEL, not a control. It was a mailto and it grew a
            pointer under the cursor, which promised something a one-word note
            shouldn't: you don't click a status. It says the true and useful
            thing (this is unfinished, things will move) and the way to write
            in lives in the footer, where a link belongs. */}
        <span className="sitebar__beta">Beta</span>
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
        {/* ONE THING TRUE OF THE ROOM, and it turns out there's only one: the
            light. This cluster held four marks at its widest — instrument,
            saved settings, one-panel-or-two, theme — and three of them were
            about a PANEL rather than about the app. They've each gone down to
            the panel they belong to: the instrument as a row, the saved list
            as a mark in the title strip, and one-panel-or-two as the + that
            adds the next one. What's left is the only setting that really is
            the room's. */}
        <div className="sitebar__controls">
          <SettingsMenu staffPx={staffPx} onStaffPx={setStaffPx} />
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
      </header>

      {/* THE FRETBOARD AND EAR TRAINING, each with its own panel.
          A listening drill is a CONTROLS panel too, asking the same kind of
          questions about the same material — what differs is which rows it has
          and what sits under it, which the panel already knows how to do.
          They used to be ONE panel switching modes; now the Fretboard's panel
          is the selected bar's, so Ear Training keeps a panel of its own and
          the drill doesn't change every time you pick a different bar. */}
      <div hidden={area !== 'study' && area !== 'ear'}>
        <div className="modules">
          {area === 'ear' ? (
            <Module
              key={`ear-${ear.rev}`}
              initial={ear.state}
              studyMode="ear"
              onChange={(state) => setEar((e) => ({ ...e, state }))}
              {...moduleShared}
            />
          ) : (
            // KEYED BY THE BAR, so picking another bar opens a fresh panel on
            // that bar's setting rather than editing the one on screen.
            <Module
              key={`${selectedBar.id}-${selectedBar.rev}`}
              initial={selectedBar.state}
              studyMode="fretboard"
              onChange={updateSelectedBar}
              // ONE + AT A TIME. While the tabs are showing, the + is at the
              // end of them; with no progression (or the bars at the bottom)
              // it's in the panel's title strip instead.
              onAddBar={BARS_ON_TOP && progression.started ? undefined : addBar}
              // EACH TAB REMEMBERS ITS PANEL, open or folded.
              panelOpen={selectedBar.panelOpen}
              onPanelOpenChange={rememberPanelOpen}
              onAddChordBar={addChordBar}
              above={BARS_ON_TOP && progression.started ? barsStrip('top') : undefined}
              {...moduleShared}
            />
          )}
        </div>
      </div>
      {/* The bars at the bottom of the screen — unless they sit on top of the
          control panel instead (BARS_ON_TOP, ui/flags.ts). */}
      {area === 'study' && !BARS_ON_TOP && progression.started && barsStrip('bottom')}
      {READY.play && (
      <div className="area" hidden={area !== 'song'}>
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

      {/* THE FOOTER, laid out exactly like Soundscape's (2026-11-18): one band
          between two rules, holding a sentence about who made this and the
          email line; then one small capitals line underneath. The Being Sound
          site asks for an email before it links here, so the app says very
          little. Each link drops out if its URL is unset (ui/links.ts). */}
      <footer className="sitefoot">
        <div className="sitefoot__doors">
          <p className="sitefoot__line">
            Fretboard Constellations is made by {AUTHOR} at{' '}
            <a href={BEING_SOUND} target="_blank" rel="noreferrer">
              Being Sound
            </a>
            .
            {LESSONS && (
              <>
                {' '}For guidance with your own playing, book{' '}
                <a href={LESSONS} target="_blank" rel="noreferrer">
                  1:1 music lessons
                </a>
              </>
            )}
            {SUBSTACK && (
              <>
                {LESSONS ? ', and read' : ' Read'} about my work at Being Sound
                on{' '}
                <a href={SUBSTACK} target="_blank" rel="noreferrer">
                  Substack
                </a>
              </>
            )}
            {(LESSONS || SUBSTACK) && '.'}
          </p>
          {/* THE ONLY PLACE THIS APP ASKS FOR ANYTHING. Nothing pops up. */}
          <Subscribe variant="footer" />
        </div>
        {/* The beta line: a plain mailto, so it reaches Stu's inbox and
            people can attach a screenshot. */}
        <div className="sitefoot__base">
          {FEEDBACK_EMAIL ? (
            <span>
              In beta. Something confusing or broken?{' '}
              <a
                href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}`}
              >
                Tell Stu
              </a>
            </span>
          ) : (
            <span>In beta.</span>
          )}
          <a href={BEING_SOUND} target="_blank" rel="noreferrer">
            beingsound.studio
          </a>
        </div>
      </footer>
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
  onChange,
  onAddBar,
  onAddChordBar,
  above,
  panelOpen,
  onPanelOpenChange,
  bookmarks,
  onToggleBookmark,
  onRestore,
  staffPx,
  onAddBookmark,
  onRemoveBookmark,
  onRenameBookmark,
  studyMode,
}: {
  onAddChord: (rootIndex: number, chordId: string) => void;
  songLength: number;
  /** What this module opens set to. A second module starts as a copy of the
   *  first, because the useful move is "set one up, then change one thing". */
  initial?: ModuleState;
  /**
   * Told every time this panel's setting changes, so whoever owns it — the
   * bar in the dock, or Ear Training — keeps it. The panel still owns the
   * setting while it's on screen; this is how it's remembered when it isn't.
   */
  onChange?: (state: ModuleState) => void;
  /** Add a bar after this one — a copy of this panel. Only for a bar's panel. */
  onAddBar?: () => void;
  /** Add the chord on this degree as a bar at the end of the progression. */
  onAddChordBar?: (degree: number) => void;
  /** Anything to show inside the control panel's box, above its title strip —
   *  the progression's bars, when they sit on top (BARS_ON_TOP). */
  above?: ReactNode;
  /** This bar's panel: open or folded when it appears (absent = the default). */
  panelOpen?: boolean;
  /** Told when this panel is opened or folded, so the bar remembers. */
  onPanelOpenChange?: (open: boolean) => void;
  /**
   * WHICH AREA THIS PANEL IS IN — the fretboard, or the listening drill.
   *
   * It arrives as a prop because it's chosen in the NAV, above every panel:
   * it's the thing that decides which rows this panel has and what two of
   * them mean, which puts it a level above anything the panel itself sets.
   * It's still part of a module's STATE, though — a preset full of ear pools
   * means nothing on the fretboard — so `moduleState()` folds it back in, the
   * way the instrument used to be folded in from the other direction.
   */
  studyMode: 'fretboard' | 'ear';
  /** How big to engrave the notation — see ui/Settings.tsx. */
  staffPx: number;
  /** Everything saved, so this panel can tell whether IT is one of them. */
  bookmarks: Bookmark[];
  /** Save this setting, or — if it's already saved — remove it. */
  onToggleBookmark: (state: ModuleState, label: string) => void;
  /**
   * Restore a saved setting. The APP decides where it lands — a fretboard
   * setting replaces the selected bar, an ear setting goes to Ear Training's
   * panel — because only the app knows about both.
   */
  onRestore: (saved: ModuleState) => void;
  /** Put a setting in the list. Never removes — see the note at the call. */
  onAddBookmark: (state: ModuleState, label: string) => void;
  /** The list belongs to the app, so tending it does too. */
  onRemoveBookmark: (id: string) => void;
  onRenameBookmark: (id: string, name: string) => void;
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
  // TELL WHOEVER KEEPS THIS PANEL. With the area folded in, since that
  // arrives as a prop rather than living in `state`.
  useEffect(() => {
    onChange?.({ ...state, studyMode });
    // onChange is a fresh function each render; the state is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, studyMode]);

  const { rootIndex, scaleId, degree, seventh, structureId } = state;
  const { inversionIndex, quiz, fingering, earDifficulty } = state;
  const mode: Mode = state.view;

  // WHICH NECK THIS MODULE DRAWS. Resolved from ids rather than held as
  // objects, because a bookmark has to survive being written to storage and a
  // whole Instrument doesn't round-trip usefully. Falling back to the guitar
  // means a preset naming an instrument that no longer exists still opens.
  const instrument = INSTRUMENTS[state.instrumentId] ?? GUITAR;
  const tuning = TUNINGS[state.tuningId] ?? GUITAR_STANDARD;
  // Picking an instrument picks its tuning too: the two have to move together
  // or the neck would be drawn with six strings' worth of notes on four.
  const pickInstrument = (id: string) => {
    const next = INSTRUMENTS[id] ?? GUITAR;
    setState((s) => ({ ...s, instrumentId: next.id, tuningId: next.defaultTuningId }));
  };
  const setTuningId = (id: string) => set('tuningId', id);
  const instrumentChoices = SHOW_KEYBOARD
    ? INSTRUMENT_LIST
    : INSTRUMENT_LIST.filter((i) => i.layout !== 'keys');
  const tuningChoices = tuningsFor(instrument.id);
  const setMode = (v: Mode) => set('view', v === 'harmony' ? 'harmony' : 'scale');
  const setRootIndex = (v: number) => set('rootIndex', v);
  const setScaleId = (v: string) => set('scaleId', v);
  const setDegree = (v: number) => set('degree', v);
  const setSeventh = (v: boolean) => set('seventh', v);
  const setStructureId = (v: string | null) => set('structureId', v);
  const setInversionIndex = (v: number) => set('inversionIndex', v);
  // No setter: the row that chose between the three drills is gone, since only
  // Quality is offered. `quiz` still travels in a module's state so the other
  // two stay compiled and one row brings them back.
  const setFingering = (v: ModuleState['fingering']) => set('fingering', v);
  const setEarDifficulty = (v: ModuleState['earDifficulty']) =>
    set('earDifficulty', v);

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
  const earQualities: ReadonlySet<string> = new Set(state.earQualities);
  const setEarRoots = (s: ReadonlySet<number>) => set('earRoots', [...s]);
  const setEarScaleIds = (s: ReadonlySet<string>) => set('earScaleIds', [...s]);
  const setEarQualities = (s: ReadonlySet<string>) => set('earQualities', [...s]);
  // What the chosen scales can actually produce, split into the two families.
  const earChoices = qualitiesFor(earScaleIds);
  // Toggling never empties the pool — the last quality standing stays on,
  // across BOTH rows, since either alone is a perfectly good drill.
  const toggleQuality = (id: string) => {
    const next = new Set(earQualities);
    if (next.has(id)) {
      if (next.size === 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    setEarQualities(next);
  };

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

  // EVERY KEY AT ONCE — the widest the pool goes, in one press.
  //
  // Twelve keys is a lot of clicking to say "any of them", which is a
  // perfectly ordinary thing to want: drilling a sound in every key is the
  // whole point of drilling it. So the row leads with All.
  //
  // A REAL TOGGLE, not a one-way shortcut. Pressing All widens to twelve and
  // remembers what was there; pressing it again puts that back. The
  // alternative — All collapsing to some arbitrary single key — makes the
  // second press a thing you'd learn to avoid, and a control you avoid
  // pressing twice isn't a toggle. What it remembers is deliberately NOT part
  // of the module's state: it's the last thing you did, not what the panel is
  // set to, and a preset that restored it would be restoring a gesture.
  const ALL_KEYS = -1;
  const narrowKeys = useRef<number[] | null>(null);
  const everyKey = earRoots.size === ROOT_CHOICES.length;
  const toggleEarRoot = (i: number) => {
    if (i !== ALL_KEYS) {
      toggleIn(earRoots, setEarRoots)(i);
      return;
    }
    if (everyKey) {
      const back = narrowKeys.current;
      setEarRoots(new Set(back && back.length ? back : [0]));
    } else {
      narrowKeys.current = [...earRoots];
      setEarRoots(new Set(ROOT_CHOICES.map((_, n) => n)));
    }
  };

  // A NAME FOR ANY SETTING, not just the one this panel is showing — a
  // pasted one has to be saved under something, and it should read exactly
  // like a setting you'd saved yourself. Everything `describe` needs is
  // resolved from the state it's handed rather than from the panel's own.
  const nameFor = (s: ModuleState): string => {
    const r = ROOT_CHOICES[s.rootIndex] ?? ROOT_CHOICES[0];
    const sc = SCALES[s.scaleId] ?? SCALES[SCALE_LIST[0].id];
    let romans: string[] = [];
    try {
      romans = diatonicChords(r, sc, false).map((c) => c.roman);
    } catch {
      romans = [];
    }
    const pool = new Set(s.earQualities ?? []);
    const families = {
      triads: [...pool].some((id) => CHORDS[id]?.intervals.length === 3),
      sevenths: [...pool].some((id) => CHORDS[id]?.intervals.length >= 4),
    };
    return describe(s, {
      root: noteName(r),
      scale: sc.name,
      roman: s.degree === ALL_DEGREES ? null : (romans[s.degree] ?? null),
      fretboard: {
        // Named only when it isn't the guitar — see the note in describe().
        instrument:
          s.instrumentId && s.instrumentId !== 'guitar'
            ? (INSTRUMENTS[s.instrumentId]?.name ?? undefined)
            : undefined,
        fingering: FINGERING_LABELS[s.fingering] ?? '',
        voicing: structureName(
          STRUCTURES.find((v) => v.id === s.structureId) ?? STRUCTURES[0],
          s.seventh ? 4 : 3,
        ),
      },
      ear: {
        keys:
          s.earRoots.length === ROOT_CHOICES.length
            ? 'All keys'
            : s.earRoots.length === 1
              ? noteName(ROOT_CHOICES[s.earRoots[0]] ?? r)
              : `${s.earRoots.length} keys`,
        scales:
          s.earScaleIds.length === 1
            ? (SCALES[s.earScaleIds[0]]?.name ?? sc.name)
            : `${s.earScaleIds.length} scales`,
        qualities:
          pool.size === 1
            ? (CHORDS[[...pool][0]]?.short ?? '')
            : families.triads && families.sevenths
              ? 'Triads & Sevenths'
              : families.sevenths
                ? 'Sevenths'
                : 'Triads',
      },
    });
  };

  // GOING BACK TO A SAVED SETTING. The panel sets itself, and tells the app
  // which area that setting belongs to — a preset full of ear-training pools
  // means nothing on the fretboard, so it takes you there.
  // Restoring is the app's job now (see `onRestore` above): it knows whether
  // the setting belongs to a bar or to Ear Training.
  const restoreSetting = onRestore;

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
  const moduleState = (): ModuleState => ({
    ...state,
    studyMode,
    scrollY: Math.round(window.scrollY),
  });

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
        above={above}
        initialOpen={panelOpen}
        onOpenChange={onPanelOpenChange}
        /* What a folded panel says on a phone — the same facts the rows carry,
           in the order they're read: key, then which degree is home, then what
           you're looking at. `describe` already writes exactly this line for a
           bookmark's default name, so the summary and the name you'd save
           agree by construction rather than by being kept in step. */
        /* The panel's state AS IT STANDS — which includes the area, since
           that arrives as a prop rather than living in `state`. Without it a
           folded panel in Ear Training described itself as a fretboard. */
        summary={nameFor({ ...state, studyMode })}
        action={
          <div className="panel__actions">
            {/* WHAT YOU'VE SAVED, on the panel that would load it. In the site
                bar this list sat above both panels and couldn't say which one
                a preset should open into; here the question doesn't arise.
                No count beside it, and nothing but three lines: it's a way
                back, not a readout. */}
            <BookmarksMenu
              list={bookmarks}
              onRestore={restoreSetting}
              onRemove={onRemoveBookmark}
              onRename={onRenameBookmark}
              // ADD-ONLY, NOT the save button's toggle. Pressing the bookmark
              // twice on one setting should unsave it; PASTING a setting you
              // already have must not silently delete it, which is what
              // reusing the toggle here did.
              onAddShared={(incoming) => onAddBookmark(incoming, nameFor(incoming))}
            />
            <SaveBookmark
              saved={bookmarks.some((b) => sameSetting(b.state, state))}
              onToggle={() => {
                const now = moduleState();
                onToggleBookmark(now, nameFor(now));
              }}
            />
            {/* + A BAR, beside the bookmark: a copy of this panel, added right
                after it and opened, so the move is "set one up, change one
                thing". It lives on the panel because a bar IS a panel. */}
            {onAddBar && (
              <button
                className="panel__act panel__act--add"
                onClick={onAddBar}
                aria-label="Add this setting as a bar"
                title="Add this as a bar"
              >
                +
              </button>
            )}
          </div>
        }
      >
        {/* WHAT'S IN YOUR HANDS, first — everything below it is drawn for
            whatever this says, which is what makes it the widest-scoped
            choice on the panel.

            IT'S A PANEL ROW, NOT A MENU IN THE BAR, for two reasons. It does
            nothing at all in Ear Training, so up there it was a control on
            screen changing nothing you could see or hear; and a guitar beside
            a ukulele in the same key is the most useful thing two panels have
            ever been for, which one app-wide instrument made impossible. */}
        {studyMode !== 'ear' && (
          <ControlRow label="Instrument">
            <Segmented
              fill
              ariaLabel="Instrument"
              options={instrumentChoices.map((i) => ({
                value: i.id,
                label: i.name,
                short: i.name.replace('Ukulele', 'Uke').replace('Baritone', 'Bari'),
              }))}
              value={instrument.id}
              onChange={pickInstrument}
            />
          </ControlRow>
        )}
        {/* Only when there's a choice — see NOT_OFFERED in data/tunings.ts.
            A row that can only say one thing isn't a control. */}
        {studyMode !== 'ear' && tuningChoices.length > 1 && (
          <ControlRow label="Tuning">
            <Segmented
              fill
              ariaLabel="Tuning"
              options={tuningChoices.map((t) => ({ value: t.id, label: t.name }))}
              value={tuning.id}
              onChange={setTuningId}
            />
          </ControlRow>
        )}
        <ControlRow label="Key" tight>
          {studyMode === 'ear' ? (
            <MultiSelect
              fill
              ariaLabel="Keys in play"
              /* All leads the row, the way it leads Gravity's — the widest
                 answer first, then the particular ones. It lights along with
                 the twelve rather than instead of them, because when every key
                 is in play that IS true of every key. */
              options={[
                { value: ALL_KEYS, label: 'All' },
                ...ROOT_CHOICES.map((note, i) => ({ value: i, label: noteName(note) })),
              ]}
              values={everyKey ? new Set([ALL_KEYS, ...earRoots]) : earRoots}
              onToggle={toggleEarRoot}
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
        {/* GRAVITY IS A FRETBOARD IDEA. It frames what you're LOOKING at, and
            a listening drill isn't looking at anything — the ear panel asks
            which sounds are in the pool instead. See the Triads and Seventh
            Chords rows below. */}
        {studyMode !== 'ear' && (
          <ControlRow label="Gravity" tight>
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
        )}
        {studyMode !== 'ear' && (
          <ControlRow label="View">
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
          </ControlRow>
        )}

        {/* WHAT THE DRILL MAY PLAY YOU, in the two families you'd name them
            in. The options are DERIVED from the scales chosen above — add
            harmonic minor and the augmented triad appears here, because
            harmonic minor has one.

            Two rows rather than a triads-or-sevenths switch, because a pool of
            "major, minor and dominant 7" is a real thing to drill and a switch
            can't say it. Emptying both is refused: with nothing in the pool
            there's no quiz. */}
        {studyMode === 'ear' && earChoices.triads.length > 0 && (
          <ControlRow label="Triads">
            <MultiSelect
              fill
              ariaLabel="Triad qualities in play"
              options={earChoices.triads.map((c) => ({
                value: c.id,
                label: c.name,
                short: c.short,
              }))}
              values={earQualities}
              onToggle={toggleQuality}
            />
          </ControlRow>
        )}
        {studyMode === 'ear' && earChoices.sevenths.length > 0 && (
          <ControlRow label="Sevenths">
            <MultiSelect
              fill
              ariaLabel="Seventh-chord qualities in play"
              options={earChoices.sevenths.map((c) => ({
                value: c.id,
                label: c.name,
                short: c.short,
              }))}
              values={earQualities}
              onToggle={toggleQuality}
            />
          </ControlRow>
        )}
        {/* HOW HARD, which is a different question from WHAT — the two rows
            above say which sounds you're being played, and this says what the
            chord is allowed to do to hide them. Last in the panel, because
            it's the setting you change least: you pick your pool, then you
            pick how much punishment you want. See theory/earMaterial.ts. */}
        {studyMode === 'ear' && (
          <ControlRow label="Difficulty">
            <Segmented
              fill
              ariaLabel="Difficulty"
              options={[
                /* Only Medium gets a short form, because only Medium has one
                   — the swap is per option (see `.seg__short` in App.css), so
                   Easy and Hard simply keep their names at every width. */
                { value: 'easy' as const, label: 'Easy' },
                { value: 'medium' as const, label: 'Medium', short: 'Med' },
                { value: 'hard' as const, label: 'Hard' },
              ]}
              value={earDifficulty}
              onChange={setEarDifficulty}
            />
          </ControlRow>
        )}

        {/* SCALES' ONE, in the same place Harmony's three sit: at the end of
            the panel, under the View row that summons it. It used to float in
            the gap between the panel and the neck, which made it read as a
            control belonging to neither — and it's the same kind of choice as
            Voicing, so it belongs in the same kind of row. */}
        {/* ...AND ONLY ON AN INSTRUMENT THAT HAS FINGERINGS TO CHOOSE. CAGED
            and the notes-per-string family are all answers to "which of the
            six places do I play this note in", and a keyboard has one place
            for every note. A row whose every option means the same thing is
            worse than no row. */}
        {studyMode === 'fretboard' && mode === 'scale' && instrument.layout !== 'keys' && (
          <ControlRow label="Fingering">
            <Segmented
              fill
              ariaLabel="Fingering"
              /* CAGED first — the five positions, the way scales are taught
                 and the way every method book prints them. Then the notes-per-
                 string family, which is one idea at three widths: three is the
                 familiar one, four and five are deliberately unusual stretches
                 that shake loose fingerings the standard shapes hide. */
              options={[
                { value: 'caged' as const, label: 'CAGED' },
                { value: '3nps' as const, label: '3NPS' },
                { value: '4nps' as const, label: '4NPS' },
                { value: '5nps' as const, label: '5NPS' },
              ]}
              value={fingering}
              onChange={setFingering}
            />
          </ControlRow>
        )}

        {/* The TYPE and QUIZ rows are gone. Type asked triads-or-sevenths, which
            the two quality rows above now answer better by letting you have
            both. Quiz picked between three drills when only one of them is
            offered — a control with one real answer isn't a control. Quality
            is hard-wired below; the other two drills are still built and one
            row brings them back. */}

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
          difficulty={earDifficulty}
          selection={{
            roots: earRoots,
            scaleIds: earScaleIds,
            qualities: earQualities,
          }}
        />
      )}

      {studyMode === 'fretboard' && mode === 'scale' && (
        <ScaleView
          staffPx={staffPx}
          instrument={instrument}
          tuning={tuning}
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
          staffPx={staffPx}
          instrument={instrument}
          tuning={tuning}
          root={root}
          scale={scale}
          degree={deg}
          gravity={{ root: gravityRoot, scale: gravityScale }}
          seventh={seventh}
          structure={harmonyStructure}
          inversion={harmonyInversion}
          onAddChord={onAddChord}
          songLength={songLength}
          onAddChordBar={onAddChordBar}
        />
      )}
    </section>
  );
}

// --- Scale view: the MODE on the chosen degree, and its position boxes -------
// Degree 0 is the scale itself; degree 4 of a major key is Mixolydian, etc. The
// neck then shows that mode rooted on its own degree, in every position.
function ScaleView({
  staffPx,
  instrument,
  tuning,
  root,
  scale,
  degree,
  fingering,
  focus,
  onPickNote,
}: {
  staffPx: number;
  /** The neck this module draws — passes straight through. */
  instrument: Instrument;
  tuning: Tuning;
  root: Note;
  scale: ScaleDefinition;
  degree: number;
  /** Chosen in the CONTROLS panel now, so it just passes through. */
  fingering: ModuleState['fingering'];
  focus: { fret: number; seq: number } | null;
  onPickNote: (degree: number, fret: number) => void;
}) {
  // ALL means the key itself — the parent scale, not one of its modes.
  const isAll = degree === ALL_DEGREES;
  const { modeRoot, modeScale } = isAll
    ? { modeRoot: root, modeScale: scale }
    : modeAt(root, scale, degree);
  // CLICKING A NOTE DOES ONE OF TWO THINGS, and which one depends on whether
  // GRAVITY is holding a degree.
  //
  // It used to always re-root: whatever you clicked became the new tonic. In
  // ALL — where you're looking at the whole key across every position — that
  // made moving up the neck impossible. You'd tap a dot higher up to go there,
  // and instead of travelling, the ground moved: gravity jumped to that
  // degree, the key re-framed around it, and you had to find your way back.
  // Two different intentions were sharing one gesture, and the wrong one won
  // in the mode you spend most of your time in.
  //
  // So: in ALL, a click is NAVIGATION — go to the position under this fret,
  // and leave the framing alone. With a degree already chosen you've said you
  // care about where home is, and a click still moves it, which is the
  // re-rooting this was built for.
  const parentTones = realizeScale(root, scale);
  const pickRoot = (placed: PlacedNote) => {
    if (isAll) {
      onPickNote(ALL_DEGREES, placed.position.fret);
      return;
    }
    const pc = pitchClassOf(placed.note);
    const d = parentTones.findIndex((t) => pitchClassOf(t.note) === pc);
    if (d >= 0) onPickNote(d, placed.position.fret);
  };

  return (
    <>
      {/* No title here any more: the scale's name and its notes ride on the
          fretboard itself, where they stay visible while you scroll. */}
      <ScaleExplorer
        staffPx={staffPx}
        instrument={instrument}
        tuning={tuning}
        root={modeRoot}
        scale={modeScale}
        fingering={fingering}
        onPickRoot={pickRoot}
        focus={focus ?? undefined}
        labelMode="note"
      />

      {/* The note says what a click actually does, which now depends on
          Gravity — so it says both, rather than describing only the half that
          applies when a degree is chosen. */}
      <footer className="footnote">
        {isAll ? (
          <>
            Each box is a position (a fingering). Click any note to move to the
            position it sits in. Choose a degree under Gravity and clicking will
            re-root the mode there instead.
          </>
        ) : (
          <>
            Each box is a position (a fingering). Click any note to make it the
            new tonic — the mode shifts to start there, in that position. Set
            Gravity back to All and clicking simply moves you up the neck.
          </>
        )}
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
  staffPx,
  instrument,
  tuning,
  root,
  scale,
  degree,
  gravity,
  seventh,
  structure,
  inversion,
  onAddChord,
  songLength,
  onAddChordBar,
}: {
  staffPx: number;
  /** The neck this module draws — passes straight through to both ladders. */
  instrument: Instrument;
  tuning: Tuning;
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
  /** Add a chord of this key, by degree, as a bar. */
  onAddChordBar?: (degree: number) => void;
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
      {/* Type / Voicing / Inversion all live in the CONTROLS panel now — one
          measure, one place, and both ladders read the same values. So the only
          thing left that could go here is the Add-to-Play row, and that's
          switched off.

          The wrapper is therefore CONDITIONAL rather than always-present: an
          empty `.view-controls` still spends its 28px margin, and three of them
          between them were pushing Harmony's neck 54px below where Scales put
          it. A control row's container should exist when there's a control. */}
      {SHOW_ADD_TO_PLAY && !isAll && (
        <div className="view-controls">
          {/* Send the selected chord over to the Play song. Only when a single
              degree is in play — "All" isn't one chord to add. */}
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
      )}

      {isAll ? (
        <ChordScaleLadder
          staffPx={staffPx}
          instrument={instrument}
          tuning={tuning}
          root={root}
          scale={scale}
          seventh={seventh}
          structure={structure}
          inversion={inversion}
          labelMode="note"
          onAddBar={onAddChordBar}
        />
      ) : (
        <InversionLadder
          staffPx={staffPx}
          instrument={instrument}
          tuning={tuning}
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
