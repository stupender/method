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

## Backlog — added later as DATA, not new code (leave clean seams)

See [BACKLOG.md](BACKLOG.md) for the triaged, sequenced plan. In short:

- **Soon (v1.x):** interval+direction melodic sequences / paltas (scale = all
  2nds, arpeggio = all 3rds as special cases); interval-pairing chord voicings
  (Vic Juris, e.g. 4th-2nd-6th through the scale); a few tasteful instrument
  sounds; shuffle/randomise for practice; switchable colour palettes (art-book
  aesthetic, paired with Session 6 polish).
- **Later (v2):** the progression/song workbench (build from chosen
  chords+voicings; three-layer chord model — neutral / open Roman numeral vs key
  center / voicing; bar+beat timing across bar lines; drag editing; **MIDI
  export+import**; **iReal Pro import**; the `Progression`/`Section`/`Bar`/
  `ChordRef` model is shaped for these). Also: identify/reverse-lookup a custom
  voicing via the fingerprint filter; ear training; negative harmony (axis swap);
  search→practice; comments/tags on units.
- **Personalization (v2+):** user accounts; fingering/note-position preferences;
  saved tags. **Integrations/cultures (v3+):** Ableton Live JS Extensions bridge;
  Raga Sangeet & SARGAM, Barry Harris bebop, other cultures.
- **Data only:** slash chords; more scales/modes (diminished, augmented/whole-
  tone, bebop — harmonic & melodic minor and harmonic major are done); extra
  chord qualities (6ths, extensions); alternate tunings; ukulele.

## Working notes

- Maintain [LEARNED.md](LEARNED.md) (one line per new concept) as you build.
- Maintain [MAINTENANCE.md](MAINTENANCE.md) when run/build/deploy steps change.
- Reusable audio approach comes from Stu's earlier apps (Archive, Soundscape) —
  ask him for that code before writing fresh playback.
