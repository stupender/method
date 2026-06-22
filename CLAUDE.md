# CLAUDE.md — context & rules for AI assistants working on Method

This file orients any AI (Claude, or a local model like Qwen2.5-Coder /
DeepSeek-Coder / Codestral via Ollama) before it edits Method. Read it first.

## Who this is for

Stu — a guitarist/composer and **novice coder**. The music-theory expertise is
his. Two goals for the codebase:

1. He must understand it well enough to **explain it in an interview** and keep
   building it.
2. It must be **maintainable later by a small local AI model**.

So: **boring, conventional, heavily commented, small files, no clever
abstractions, no exotic dependencies.** Explain new concepts in plain English.
When in doubt, choose the obvious solution over the clever one.

## What Method is

An interactive music-theory / guitar-learning tool. A living textbook: see the
fretboard, hear the sound, play with it. See [README.md](README.md).

## The one architectural rule: data-driven

Method is an **engine that renders theory data**. Theory content is DATA, not
code. Adding content = adding a data file that matches a type in
`src/theory/types.ts`. The engine never changes to add a scale/chord/tuning.

### Layering (keep this separation strict)

```
data  →  theory logic  →  rendering  →  audio  →  UI / state
```

- **`src/data/`** — theory content: scales, chords, intervals, instruments,
  tunings. Plain data objects. This is what Stu authors.
- **`src/theory/`** — `types.ts` (the schema) and **pure functions** that turn
  data into notes/positions (e.g. root + scale + tuning → fretboard positions).
  Pure = same input always gives same output, no side effects. Easy to test and
  to reason about. New logic goes here.
- **`src/render/`** — drawing the fretboard, TAB, and (later) VexFlow notation.
  Renderers deal in `Position`/`PlacedNote`, never in music theory.
- **`src/audio/`** — Web Audio playback (plain Web Audio, no Tone.js).
- **`src/ui/`** — React components and app state.

## Hard constraints (do not break)

- **Instrument and tuning are DATA, parameterised from day one.** The fretboard
  is handed an `Instrument` + `Tuning` and draws whatever it's given. Never
  hard-code "6 strings" or "guitar". This makes ukulele / alternate tunings pure
  data later.
- **Notes carry both sound and spelling.** A `Note` has letter + accidental
  (+ octave). Pitch class (0–11) is derived. This keeps enharmonic spelling
  correct (F major has B-flat, never A-sharp). Intervals store *both*
  `diatonicSteps` (letters) and `semitones` (pitch) for this reason.
- **Voicings are rearrangements of chord tones, not new chord types.**
  Inversions, drop-2, drop-3, spread = reorder + octave-shift the same tones.
- **Voicing placement = least stretch per register.** Show a voicing once per
  register (the lowest string it starts on); within a register pick the
  least-stretch fingering. A skipped string must line up with the voicing's big
  interval gap (so a drop-3 from the low E voices its next note on the D string,
  not stretched up the A). See `leastStretchPerRegister` in `theory/chord.ts`.
- **Tuning convention:** `openNotes` is ordered LOW pitch → HIGH pitch (index 0
  = lowest string). The renderer reverses for display.

## Tech stack

TypeScript + React + Vite + Web Audio. VexFlow for notation (added later). Plain
CSS with a small palette of CSS variables in `src/index.css`. Deploy: GitHub
Pages via `npm run deploy` (the `gh-pages` package). `vite.config.ts` `base`
must match the repo name (`/method/`).

## Build plan (stop at each checkpoint for Stu to run & ask questions)

1. **Skeleton + deploy + data schema** ← done.
2. **Fretboard engine — render from tuning data, light up arbitrary notes.** ← done.
3. **Scales + intervals + Web Audio playback.** ← done.
4. **Chords (triads + 7ths) with voicings + TAB.** ← done.
5. **The "Search Engine / GPS" reveal** — chord → all keys it could live in →
   their chords. The signature interaction. ← MVP done. It lives in the **Song**
   area, a top-level part of the app (peer to **Study** = Scales/Harmony). Song
   grows into a lead-sheet workbench (chords in bars, with rhythm; click a chord
   to reveal where to go). Next: multi-chord charts that intersect/narrow the
   candidate keys, then rhythm/timing, import (iReal/MIDI), voice-leading.
6. VexFlow notation + polish + case study.
7. Study guide (teaching pass, after ship).

Note: the app now has two top-level AREAS — **Study** (Scales/Harmony) and
**Song** (lead-sheet score). Stu may rename them **Possibility** & **Play**.

## Backlog — see [BACKLOG.md](BACKLOG.md) for the full triaged plan. In short:

- **Quick wins:** rename areas to Possibility/Play?; "Fm exists in 9 keys" copy;
  never render a blank voicing (show the most-playable with a "very difficult"
  note instead); flexible time-signature input; unify the Study/Song TAB look.
- **Study restructure:** lift the Roman numeral above Scale/Harmony so it persists
  (in Scale it picks the MODE, the TAB then explores its positions; in Harmony the
  chord degree); click a note to generate the scale/mode from that degree in
  position; string-set as a first-class voicing choice; horizontal scale/pattern
  TAB (ascending/descending, octave/position shift); barre/open/6-string voicings.
- **Song build:** Add+ from Study + persistent state + multiple songs/songbooks;
  per-bar UNIT type (scale/arpeggio/interval-pattern/harmony, so songs can be
  exercises); text chord entry + paste-a-progression import; Play/Pause + playhead
  + metronome + chord-mute; rests/pickups/tuplets; sections; voice-leading that
  favours same string-set/position; a harmonic heat map.
- **v1.x generators:** paltas (interval+direction sequences); interval-pairing
  voicings (Vic Juris); tasteful sounds; shuffle/randomise.
- **Import/DAW:** iReal Pro import; MIDI export+import; Ableton JS Extensions bridge.
- **v2:** identify/reverse-lookup a voicing; ear training (parameterised);
  negative harmony; search→practice; annotations incl. mood/emotional tagging.
- **AI (v3, mostly local):** weakness detection from quiz results; mood-tag
  assistance; audio-to-chord (and live input) detection.
- **Personalization (v2+):** accounts; fingering/note-position prefs; saved tags.
- **Content/UX:** soundscapes/guided practices; Archive bridge; an onboarding /
  course-style **progressive disclosure** so it isn't overwhelming.
- **Aesthetic:** craft-paper/analog look; constellations + bioluminescence; art-
  book palettes. **Cultures (v3+):** Raga/SARGAM, Barry Harris bebop.
- **Data only:** slash chords; more scales (diminished/whole-tone/bebop); extra
  chord qualities (6ths, extensions); alternate tunings; ukulele.
- **Business:** protect IP before launch; distribution strategy.

## Working notes

- Maintain [LEARNED.md](LEARNED.md) (one line per new concept) as you build.
- Maintain [MAINTENANCE.md](MAINTENANCE.md) when run/build/deploy steps change.
- Reusable audio approach comes from Stu's earlier apps (Archive, Soundscape) —
  ask him for that code before writing fresh playback.
