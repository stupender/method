# LEARNED.md — concepts log

One line per new concept, in build order. This is the running record that
becomes `STUDY_GUIDE.md` in the final teaching session. Newest at the bottom.

## Session 1 — skeleton & schema

- **Vite** — the dev server + build tool; `npm run dev` runs a live-reloading
  local server, `npm run build` makes the static site in `dist/`.
- **React component** — a function that returns the UI (JSX). `App` is the top
  one; `main.tsx` mounts it into the page's `<div id="root">`.
- **TypeScript `type` / `interface`** — a contract describing the shape of data.
  If data doesn't match, the build complains before the app runs. Our whole
  schema (`src/theory/types.ts`) is types with no logic.
- **Data-driven architecture** — the engine renders DATA; theory content lives
  in `src/data/`. Add content by adding a data file, not by changing code.
- **Layering** — data → theory logic → rendering → audio → UI, kept separate so
  each part stays simple and the app scales by adding data.
- **Pure function** — same inputs always give the same output, no side effects.
  The theory logic will be pure functions, which are easy to test and reason
  about.
- **Modelling notes** — a note carries both how it SOUNDS (pitch class 0–11) and
  how it's SPELLED (letter + accidental), so enharmonics stay correct.
- **Interval as the unit of theory** — scales/chords are a root + a list of
  intervals; each interval stores letter-distance AND semitone-distance.
- **Parameterising the instrument** — the fretboard takes an `Instrument` +
  `Tuning` as data, so it never assumes "guitar"; ukulele is just other data.
- **CSS variables** — the colour palette is defined once in `:root` and reused,
  so the whole mood can be retuned in one place.
- **GitHub Pages deploy** — `vite.config.ts` `base` must equal the repo name;
  `npm run deploy` (the `gh-pages` package) publishes `dist/` to the live site.

## Session 2 — the fretboard engine

- **Pitch class** — every note reduces to a number 0–11 (C=0). "Same note" for
  lighting the neck = same pitch class. The modulo `((x % 12) + 12) % 12` wraps
  any number safely into 0–11 (the extra `+12` handles negatives like Cb).
- **MIDI number** — a pitch-height number where 60 = middle C; one fret = +1.
  We use it to track octaves up the neck and (next session) to play audio.
- **Pure theory layer** — `theory/notes.ts` and `theory/fretboard.ts` are plain
  functions, no React/SVG. `findPositions()` returns every neck spot whose note
  matches a target set — that's how we "light up notes passed as data".
- **SVG rendering** — the neck is drawn with `<line>`/`<circle>`/`<text>` placed
  by coordinates. A `viewBox` makes it scale to any width. Small helper functions
  (`fretX`, `stringY`, `noteX`) convert string/fret numbers into x/y pixels.
- **Display convention** — string index 0 (low E) is drawn at the BOTTOM, so
  higher pitch = higher on screen; frets increase left→right from the nut.
- **Data → render flow** — App picks instrument+tuning+notes (data), the theory
  layer finds positions, the Fretboard component draws them. App itself does no
  theory and no drawing — the layering in action.

## Session 3 — scales, intervals & audio

- **Correct spelling (the diatonic walk)** — to spell an interval, first pick the
  LETTER by stepping the alphabet `diatonicSteps` places, then pick the
  ACCIDENTAL so the pitch matches `semitones`. That's why F major reads Bb.
- **Octave from spelling** — a flat spelling can land in a different octave than
  a sharp one (Cb vs B), so we solve the MIDI formula backwards to keep audio
  pitch and written spelling in agreement.
- **Realizing a scale** — `realizeScale(root, scale)` turns root + data into the
  ordered, spelled scale tones; `placeScale(...)` puts them across the neck with
  degree labels. The renderer never learns what a "scale" is.
- **Web Audio basics** — build a node graph (oscillator → filter → gain →
  speakers) and schedule it on the audio clock. A gain ENVELOPE (quick attack,
  slow fade) turns a flat tone into a pluck. MIDI→Hz: 440·2^((m−69)/12).
- **One AudioContext, started on a gesture** — browsers block audio until the
  user interacts, so we create/resume the context on the first tap.
- **React state (`useState`)** — a value a component remembers between renders
  plus a setter; calling the setter re-renders with the new value. Root, scale
  and label-mode are state; everything else is DERIVED from them each render.
- **Lifting choices into state, deriving the rest** — we don't store the
  highlights; we recompute them from (root, scale) every render. Fewer things to
  keep in sync.

## Session 4 — chords, voicings & TAB

- **Voicing = rearrangement, not a new chord** — the SAME chord tones, moved
  around. It has two independent axes: INVERSION (which tone is in the bass) and
  STRUCTURE (how spread out — close / drop-2 / drop-3).
- **Inversions are computed, not data** — an N-note chord has N inversions; we
  ROTATE the stack (tones that wrap go up an octave). Inversions/drops are fixed
  theory operations, so they live as pure functions, not as authored content.
- **Drop voicings** — drop the 2nd (drop-2) or 3rd (drop-3) voice from the top
  by an octave, then re-sort. An "open"/"spread" triad is just a drop-2 triad.
  That's why close 7th chords are cramped on guitar and drop voicings exist.
- **Automatic placement** — `placeVoicing` tries candidate string sets
  (contiguous + one-skip, for drop-3) at each octave and keeps the most compact,
  lowest playable shape. Replaced the earlier hand-written string-set hints.
- **TAB rendering** — just fret numbers per string, written high string on top,
  with "×" for muted strings. No theory in the renderer.
- **Conditional rendering + sub-components** — App shows ScaleView OR ChordView
  by mode; shared bits (the label toggle) are pulled into small components.
- **Derive + clamp** — applicable structures are filtered from the chord's voice
  count; the inversion is clamped to the chord's range. State stays minimal; the
  view corrects out-of-range choices when you switch chords.
- **SVG placement detail** — note dots sit ON the fret wire (`fretX(fret)`);
  inlays sit in the middle of the fret space (`inlayX`), as on a real neck.
