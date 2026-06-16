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

## Session 4b — diatonic harmony (chords of a key)

- **Diatonic harmony** — build a chord on each scale degree using only scale
  notes (stack in thirds). The QUALITY falls out of the position: a major key
  always gives I ii iii IV V vi vii° (and Imaj7 ii7 iii7 IVmaj7 V7 vi7 viiø7).
- **Quality by fingerprint** — instead of hard-coding qualities per degree, we
  build the chord's tones, reduce them to semitone offsets from the root (a
  "signature" like [0,4,7]), and look up which chord definition matches. New
  scales get their harmony for free.
- **Roman numerals** — case shows major vs minor (IV vs ii), ° = diminished,
  ø = half-diminished; a small suffix carries the 7th type.
- **Shared component (`ChordExplorer`)** — the structure/inversion/TAB/play UI is
  one component reused by both the Chords view and the Harmony view; it owns its
  own view-state. Don't-repeat-yourself, and each view just supplies a chord.
- **Lifting state to the right level** — `ChordExplorer` keeps structure/inversion
  local because they're about *viewing* a chord; the chosen key/degree lives in
  the Harmony view. Each piece of state sits with whoever owns that decision.

## Session 4c — all positions, and control priority

- **All shapes, not one** — `placeVoicingAll` returns every playable instance of a
  voicing (each string set × octave that fits and isn't too wide a stretch),
  instead of picking one "best" shape. The neck shows their union; a TAB per
  shape lists them low → high.
- **Dedupe by position** — overlapping shapes share frets, so before drawing we
  collapse notes by string+fret (also avoids duplicate React keys).
- **Span filter** — a voicing on the "wrong" string set stretches too far to
  grab; we drop shapes wider than `MAX_SPAN` frets so only real shapes show.
- **Control priority = visual order** — controls are laid out most-important
  first: globally Key → (Scale type) → Mode; within a chord Roman numeral →
  triad/7th → Inversion → Structure. The UI order encodes the mental model.

## Session 4d — constellations (distinct shapes on hover)

- **Constellations** — with every shape lit at once the neck is busy, so hovering
  a shape (or its TAB) lights that one and dims the rest, with a line joining its
  notes — like picking out a constellation on a star map.
- **Lifted hover state** — the active shape lives in `ChordExplorer` and is passed
  to both the fretboard and the TABs, so hovering EITHER lights the same shape.
  (State belongs to the common parent of the things that must agree.)
- **Grouped vs flat rendering** — the fretboard draws either a flat `highlights`
  list (scales) or grouped `shapes` (chords); grouped mode adds the hover/dim and
  the connecting `<polyline>`.
- **React enter/leave + synthetic events** — `onMouseEnter` is synthesised by
  React from mouseover/out; dispatching events in a test must enter via a real
  child element, and state updates are async (read after a re-render).
- **Sort by string set** — shapes are ordered by their string indices low → high
  (then by fret), so the TABs read from the lowest strings upward.

## Session 4e — click-to-play + scale positions (modes)

- **Click a shape = play the chord** — the click handler lives on the shape group,
  so a click on any of its notes bubbles up and strums the whole chord (grouped
  mode). Per-note tapping stays for the flat scale view.
- **Scale positions (3-notes-per-string)** — `scalePositions` walks an ascending
  ladder of the scale's MIDI notes, putting 3 per string into compact boxes.
  There are 7, and each starts on a different scale degree — i.e. the 7 MODES
  (a box starting on the 2nd degree is the Dorian fingering).
- **Reusing the constellation machinery** — scale boxes are just `shapes` fed to
  the same Fretboard grouped mode and TABs; only the source differs (positions
  vs voicings). Clicking a box plays it ascending (`playSequence`).
- **One TAB, two jobs** — `TabView` now lists all frets per string (one for a
  chord, three for a scale box), so the same component serves both.
- **17 frets** — bumped the guitar's fret count so all 7 positions fit on-screen.
- **Least-stretch grip** — the same set of notes can be fingered on different
  string sets (same sound, different grip). `placeVoicingAll` groups placements
  by their pitch set and keeps only the easiest (least span, then lowest). Notes
  at different octaves are different pitch sets, so those positions all stay.

## Session 4f — harmonic/melodic minor + harmonic major

- **New scales are pure data** — melodic minor, harmonic minor and harmonic major
  are just interval lists in `data/scales.ts`. Adding them gave us their position
  boxes (Scales view) AND their full diatonic harmony (Harmony view) with no new
  engine code — the fingerprint matcher figures out each chord's quality.
- **New chord qualities the matcher needed** — augmented triad, m(maj7), maj7♯5
  (augmented-major 7), dim7, plus the m6/A5/d7 intervals to build them.
- **Mode names live on the scale** — each `ScaleDefinition` carries `modeNames`,
  one per degree, so the position boxes label themselves (Dorian, Lydian ♯2,
  Phrygian Dominant, …). Common names used; Vic Juris' variants noted in comments.
- **Scale type went global** — Key → Scale type → Mode. The one scale-type choice
  now drives both the Scales positions and the Harmony set.
- **Verified against the source** — all three new scales' diatonic 7ths match Vic
  Juris' Harmonic Syllabus exactly (e.g. harmonic minor: i(maj7) iiø7 IIImaj7♯5
  iv7 V7 VImaj7 vii°7).
