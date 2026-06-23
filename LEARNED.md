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
- **Two fingering systems** — scales toggle between 3-notes-per-string (even, ~6
  frets, 3 on every string) and the in-position "box" (all scale tones in a
  ~4-fret hand window, mostly 2 per string). Both yield 7 boxes (the 7 modes);
  same constellation/TAB machinery, different generator. The box caps the low E
  to 2 notes so it "starts with two on the low E", as a guitarist expects.
- **One grip per string set** — a voicing is shown once on each string set it
  fits: a triad on its 4 contiguous 3-string sets, a 7th on its 3 contiguous
  4-string sets, each at its lowest playable position (span is octave-independent
  for a fixed string set, so we just slide it down). Open triads and drop-3
  can't sit on adjacent strings, so when NO contiguous set fits we fall back to
  the skip string sets — those are the exceptions. (`MAX_SPAN = 4` routes the
  wide voicings to the skip sets automatically.)

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

## Session 4g — pin-to-select; parking a feature

- **Pinned vs hovered selection** — two bits of state: a *pinned* shape (set by a
  click, stays lit) and a *hovered* shape (a temporary preview). The shown shape
  is `hovered ?? pinned`, so hover previews and falls back to the pin on leave.
- **Background click to clear** — the SVG's `onClick` clears the pin; each shape's
  `onClick` calls `stopPropagation()` so a shape click pins without the
  background handler also firing.
- **Parking a feature without deleting it** — the key-less "Chords" view is kept
  (component + render branch intact, still referenced) but dropped from the Mode
  buttons, so it's one line away from returning for a future Ear Training section.

## Session 5 — the GPS reveal (signature interaction)

- **Reverse lookup** — `keysContaining(chord)` runs `diatonicChords` in reverse:
  sweep all keys (4 scale systems × 12 roots) and keep the ones where the chord is
  diatonic, recording the Roman numeral it plays there. One chord → many keys.
- **Possibility space** — the Songwriter view shows that list grouped by system;
  clicking a key drills into its diatonic chords (where to go next), with the
  entered chord's slot lit. Committing more chords later will INTERSECT the keys
  and narrow the space — the core "search engine / GPS" idea.
- **Reusing the engine both ways** — Harmony goes key→chords, Songwriter goes
  chord→keys, both off the one `diatonicChords` function. Build the rule once.
- **Mode-specific global controls** — Scale type is hidden in Songwriter (you're
  there to DISCOVER the scale, not pick it); the shared root pill is the chord's
  root there instead of a key.

## Session 5b — Study / Song as top-level areas

- **A higher separation** — the app now has two top-level AREAS (Study vs Song),
  switched by a nav under the title, above the Scales/Harmony "mode" level. Study
  is for learning the materials; Song is for using them (lead sheets + the GPS
  reveal). Each area owns its own state; App just picks which to render.
- **Self-contained Song** — `SongView` holds its own chord root + quality + the
  reveal, rather than borrowing the Study page's global Key. The single-chord
  reveal is the one-bar "drone" case of the coming lead-sheet workbench.

## Session 5c — multi-chord chart + narrowing

- **Intersection = narrowing** — `keysContainingAll(chords)` keeps only keys where
  EVERY chord is diatonic. Adding a chord can only shrink the set; that shrinking
  IS the GPS idea ("fewer commitments = more freedom"). Handles mixed triads/7ths
  by matching each chord against the key's chords of its own size.
- **Narrowing shown in place** — clicking a chord shows ITS keys; the ones that
  also fit the whole progression stay lit, the rest dim (`key-chip--faded`). So a
  ii–V–I collapses to one key (Fm 9 → +Bb7 3 → +Ebmaj7 1 = Eb Major), visibly.
- **A tiny editable chart** — chords stored as `{rootIndex, chordId}[]`; the
  selected bar is edited live by the root/quality pills; add copies the current
  chord, remove drops it. Derive everything (reveals, counts) from that array.

## Session 5d — rhythm (the lead-sheet timeline)

- **Chords have a duration in beats** — chords lay end to end; each chord's start
  is the running sum of durations before it. Bar lines come from the time
  signature (beats per bar), so a chord whose span doesn't align to a bar simply
  **crosses the bar line** — exact rhythm, not iReal's bar-filling.
- **A timeline, not a grid** — the chart is now absolutely-positioned blocks:
  `left = startBeat × pxPerBeat`, `width = durationBeats × pxPerBeat`, with bar
  lines behind. Durations can be fractional (½, 1½) for subdivisions.
- **Progression playback** — `playProgression` schedules each chord's strum on
  the audio clock at `startBeat × 60/bpm` seconds, lasting its own duration; the
  rhythm is audible, tightly timed.
- **Rhythm is representation, not harmony** — durations don't change which keys
  fit; the GPS reveal still derives from the chord sequence alone.
- **Drag-to-resize (pointer events + capture)** — a chord's edges are thin
  handles; `onPointerDown` calls `setPointerCapture` so move/up keep firing even
  off the element. Drag delta = `(clientX − startX) / pxPerBeat`, snapped to 0.25
  beat. Dragging an edge TRADES time at that boundary (grow one chord, shrink the
  neighbour); the last chord's right edge extends the song. Computed from the
  durations captured at drag-start, so it's not cumulative/jittery. Replaced the
  too-coarse 6-button picker; default stays one bar.

## Session 5e — line-wrapping + tempo

- **Wrapped rows (lead-sheet systems)** — the chart wraps into rows of N bars. A
  chord is drawn as one SEGMENT per row it touches: clamp its [start, end] to
  each row's beat range and render the overlap. The label, remove × and the real
  edge handles sit only on the chord's true start/end; carried-over segments are
  unlabelled with a dashed left edge (a tie/continuation).
- **Tempo** — a BPM value (–/+); playback uses `60/bpm` seconds per beat.

## Session 5f — auto voice-leading

- **Shape-based voice leading** — pick one anchor voicing (a real guitar shape),
  then for every other chord choose the playable shape that moves least from its
  neighbour. Working in actual shapes (from the voicing engine) keeps results
  TAB-able, not abstract note-stacks.
- **Distance metric** — `voiceLeadDistance` sums, for every note of each shape,
  the nearest note of the other (symmetric). Common tones cost ~0, big leaps cost
  a lot; the symmetry keeps the next chord in the same register.
- **Propagate from the anchor** — fix the anchor's shape, then walk outward in
  both directions, each step keeping the closest candidate to the already-chosen
  neighbour. The anchor is the selected chord; its structure/inversion seed it.
- **Reuse over reinvention** — candidates come straight from `placeVoicingAll`
  over every structure × inversion; VL is just a chooser on top.

## Session 5g — the score (timeline + TAB as one)

- **The chart IS a score** — Stu's insight: the timeline "bar" with the chord
  name is the chord symbol above a staff; the TAB is the staff. So each row is a
  SYSTEM: a chord-symbol lane on top, a TAB staff below, bar lines through both.
- **Aligned in time** — the voiced frets are absolutely positioned at each
  chord's start x (the same x as its symbol), on its string line — so notation
  lines up under the symbol. One coordinate system (beats × pxPerBeat) drives the
  symbol blocks, the bar lines, and the staff together.
- **Reused the voicing data** — the staff just renders `voicedShapes[i]`
  (PlacedNote string/fret) at the chord's x; no new theory. Heading toward a full
  score with rhythm notation later.

## Session 6a — quick wins

- **Never-blank voicings** — `placeVoicingAll` now has a last-resort pass: if a
  voicing fits no string set within MAX_SPAN, place it on every set ignoring the
  span and keep the least-stretch one. ChordExplorer flags it (span > 4) with a
  "wide stretch — try Drop 2/3" note instead of showing nothing.
- **Flexible time signature** — a typed numerator + denominator dropdown; a
  "beat" is the bottom note, so `secPerBeat = (60/bpm)·(4/denominator)`.
- **Consistent heading spacing** — `.tagline` now has margin BELOW as well as
  above, so headings don't butt against the controls under them.
- **Unified TAB look** — the Study TabView marks are now plain numbers on light
  string lines, matching the Song score's staff.
- Renamed the areas Study → **Possibility**, Song → **Play**; copy "Over Fm — N
  keys" → "Fm exists in N keys".

## Session 6b — "Add to Play" from Possibility

- **Lifting state to the common parent** — the SONG (the chord list) now lives in
  App, above both areas, because two screens need it: Play edits it, and
  Possibility's "Add to Play" appends to it. State belongs with the lowest
  component that contains everyone who uses it. SongView is now CONTROLLED: it
  takes `chords` + `setChords` as props instead of owning them.
- **Keeping both areas mounted** — App renders Possibility and Play together and
  just `hidden`s the inactive one, so each keeps its own view-state (tempo, time
  signature, selection; the key/scale/mode) when you switch back and forth.
  Unmounting would reset all of that.
- **Match by pitch class, not spelling** — to turn a diatonic chord's root into a
  root-list index, compare pitch classes, so an enharmonic spelling (Bb vs A#)
  still finds the right entry.

## Session 6c — Play transport (Play/Pause, playhead, metronome, mute)

- **A stoppable transport** — Web Audio notes, once scheduled, normally can't be
  un-scheduled. So `startPlayback` routes every chord + click through ONE master
  gain and keeps the oscillators in a list; Pause ramps that gain to silence and
  calls `stop()` on each oscillator. It returns a handle `{ startTime, stop }`.
- **Driving a playhead off the audio clock** — the line's position is computed
  every animation frame from `audioContext.currentTime - startTime`, NOT from a
  JS timer. The audio clock is the source of truth, so the line and the sound
  never drift apart. When the beat passes the song's end, we stop and rewind.
- **requestAnimationFrame loop in React** — a `useRef` holds the frame id so we
  can cancel it on Pause / unmount; each frame calls `setPlayheadBeat`, which is
  the one piece of state that re-renders during playback.
- **Metronome = scheduled clicks** — a click per beat (a short square-wave blip),
  accented on the downbeat (`i % beatsPerBar === 0`). **Mute chords** just sends
  an empty chord list to the transport, so the playhead + metronome still run.
- **Gotcha (both areas mounted):** the hidden area's buttons are still in the DOM,
  so `querySelector('.pill--play')` can grab the WRONG one. Scope DOM lookups to
  the visible area (the wrapper without the `hidden` attribute).

## Session 6d — scrub the playhead + count-in

- **The playhead doubles as a cursor** — one piece of state (`playheadBeat`) is
  both the line that sweeps while playing and the mark you set while stopped. Click
  the score to move it; Play starts from there; Pause leaves it put so Play
  resumes. End-of-song clears it. A quieter `--cursor` style distinguishes the two.
- **Click → beat** — read the click's x relative to the row
  (`e.clientX - rect.left`), divide by pixels-per-beat, add the row's start beat,
  then snap to the grid. The same coordinate math as drawing, run backwards.
- **Event bubbling decides what a click means** — a chord's click selects it AND
  bubbles to the row to scrub; the resize handles call `stopPropagation()` so
  finishing a drag doesn't also scrub.
- **Seeking while playing** — re-start the transport from the new beat (the audio
  can't be re-pointed once scheduled, so we stop and reschedule from there).
- **Count-in** — schedule one bar of clicks before the chords, offset everything
  by that bar, and hold the playhead at the start until the count-in elapses (the
  rAF subtracts the count-in seconds before converting clock time to a beat).

## Session 6e — text & paste chord entry

- **Parsing is the inverse of display** — we already turn a chord into text (root
  note + symbol); `parseChordSymbol` runs it backwards: peel off the root letter +
  accidentals, then match the remaining QUALITY against an alias table.
- **Case matters for chord quality** — "M7" is a major seventh, "m7" a minor one.
  So the alias table is case-SENSITIVE; normalization folds symbols (Δ→maj, °→o,
  ø→m7b5, ♭→b) and strips spaces/parens, but never changes the m/M case.
- **Enharmonic in, one spelling out** — the root is matched by PITCH CLASS, so
  "A#" and "Bb" both land on the same stored root (displayed Bb). Same trade-off
  as the root pills, which only offer one spelling per pitch class.
- **A forgiving progression grammar** — bars split on `|`, `,` or newlines; chords
  inside a bar share its beats; with NO separators, each chord is its own bar (the
  common case). Unknown tokens are skipped; an all-empty parse is rejected so a bad
  paste can't silently wipe the chart.
- **Progressive disclosure** — the paste box is a `<details>` so it stays out of
  the way until wanted, matching the backlog's "don't show everything at once".

## Session 6f — multiple songs (a songbook)

- **Lifting state ONE more level** — the chord list grew from "the song" to "one
  of many songs". App now holds `songs: Song[]` + a `currentId`; the open song's
  chords feed SongView. Same move as session 6b, one level up.
- **Keeping a child component dumb** — SongView still takes `chords` + `setChords`
  and knows nothing about songs. App passes a `setChords` that, under the hood,
  updates just the open song inside the array. The child stays a plain controlled
  component; the songbook logic lives entirely in the parent.
- **Resetting view state on a data switch** — switching songs swaps the whole
  chart, so a `useEffect` keyed on `songId` clears the per-chart view state
  (selection, playhead, playback, reveal). Tempo/time-sig intentionally carry over.
- **Always keep one** — delete is a no-op at one song, so the chart is never empty
  (mirrors the never-empty-chart rule for chords).

## Session 6g — Roman numeral as a persistent degree selector (Possibility)

- **A mode is the parent scale heard from another degree** — `modeAt(root, scale,
  degree)` rotates the scale's semitone pattern to start on that degree and
  re-measures each tone from the new root. Degree 0 is the scale itself; degree 4
  of a major key is Mixolydian. The note spellings stay correct because the new
  root is just the (already correctly-spelled) scale tone on that degree.
- **Own-degree labels** — each mode tone is labelled by comparing its pitch to a
  plain major scale at the same letter-step: "♭3", "♯4", "♭7". So Lydian shows a
  ♯4 on the neck, which is the whole point of seeing a mode in position.
- **Lifting a control to where it's shared** — the degree (Roman numeral) moved UP
  out of the Harmony view to StudyArea, so it PERSISTS across Scales and Harmony:
  in Scales it picks the mode, in Harmony the chord. The view-specific control
  (triads vs sevenths) stayed in Harmony. Put each control at the altitude of
  whoever shares it — same principle as lifting state.
- The degree labels come from `diatonicChords(root, scale, false)` (the triads),
  so they read I ii iii IV V vi vii° (or i ii III+ … for melodic minor) regardless
  of the Scales/Harmony view or the seventh toggle.

## Session 6h — click a note to re-root + horizontal scale TAB

- **Scale TAB reads left-to-right** — a chord stacks in one column, but a scale is
  a LINE: `TabSequence` sorts a position's notes by pitch and gives each its own
  column, so the run steps up the strings like real tablature. (Chords still use
  the stacked `TabView`.) The string lines are drawn as a 1px rule through every
  cell, so adjacent columns join into six continuous lines.
- **Click a note → re-root the mode** — the Fretboard already had `onNoteTap`; in
  shape mode the note's click now `stopPropagation()`s so it beats the position's
  play-click underneath. ScaleView maps the clicked note's PITCH CLASS back to its
  degree in the PARENT scale and selects that degree — so clicking any scale note
  makes it the new tonic and the mode shifts to start there.
- **The neck and the buttons drive the same state** — clicking a note and clicking
  a Roman numeral both call `setDegree`. Two views onto one piece of state; neither
  owns it. That's why lifting `degree` to StudyArea (6g) paid off here.

## Session 6i — click a note lands the mode in THAT position

- **Pin after the re-render, not during the click** — clicking a note re-roots the
  mode, which recomputes all the position boxes. So we can't pick the box in the
  click handler (the new boxes don't exist yet). Instead we pass the clicked fret
  down as `focus = { fret, seq }`; a `useEffect` keyed on `seq` runs AFTER the new
  positions render and pins the box covering that fret. `seq` bumps each click so
  clicking the same fret twice still re-fires the effect.
- **Scoring the best box** — prefer the box that CONTAINS the fret, and most of all
  the one whose ROOT sits exactly there; tie-break by nearest box centre. So a high
  click lands the upper position, a low click the lower one.
- **Clear stale pins on a real change** — a second effect keyed on a `modeKey`
  (scale id + root + fingering) clears the pinned index whenever the set of boxes
  changes, so switching degree by button or fingering doesn't leave a wrong box
  lit. Effects run top-to-bottom, so on a note-click (both keys change) the clear
  runs first, then the focus pin — final state is the right box.

## Session 6j — show-all boxes, descending runs, per-song meter + saved songbook

- **Show every box at once** — a `showAllShapes` flag on the Fretboard draws all
  positions' constellation lines together (quiet style), none dimmed, so you see
  how a mode tiles the whole neck. Clicking a note to focus a position exits it.
- **Direction** — ascending/descending just reverses the order: `TabSequence`
  reverses its note columns, and playback reverses the midi list. The data is the
  same; only the reading order flips.
- **Per-song meter** — bpm / beats-per-bar / denominator moved INTO the Song, so
  each song carries its own. SongView became fully controlled for these too.
- **Functional updater across a prop boundary** — tempo +/- must read the LATEST
  value, but the handler captured a stale `bpm`. Fix: `onMeter` accepts an updater
  `(m) => patch`, mirroring React's `setState(fn)`, so batched clicks compound.
- **localStorage persistence** — the songbook saves on every change (a `useEffect`
  on `[songs, currentId]`) and loads at startup, with a `normalizeSong` pass so
  partial/older saved data still opens. The id counter is advanced past saved ids
  so new songs don't collide. Wrapped in try/catch — storage can be blocked/full.

## Session 6k — voicing placement principle (least stretch per register)

- **The bug** — `placeOnStringSets` returned a shape for EVERY string set within
  the span limit. A drop-3 from the low E fit BOTH the idiomatic skip-the-A set
  (E-D-G-B, span 2) AND a skip-the-D set (E-A-G-B, span 3) that stretches the next
  note way up the A string. Both showed; the wide one even sorted first.
- **The principle** — show a voicing once per REGISTER (the lowest string it starts
  on), and within a register keep the LEAST-STRETCH fingering
  (`leastStretchPerRegister`). A skipped string exists to line up with the
  voicing's big interval gap, so the next note lands on the closer string (D, not
  high on the A). This is the general rule, not a drop-3 special case.
- **Why it's safe** — contiguous string sets each start on a different string, so
  the triad's four / the 7th's three close shapes are untouched. Only the skip-set
  voicings (drop-3, open triad) collapse to their one idiomatic shape per register.
- Verified: Cmaj7 drop-3 -> [E,D,G,B] + [A,G,B,e]; open triad -> skip-after-bass
  sets; close triads/7ths unchanged.

## Session 6l — positional scale fingerings (in-position, 2 on the low E)

- **What "positional" really is** — not a rigid fret window, but TWO OCTAVES of
  consecutive scale tones laid string-by-string while the hand STAYS put. You move
  to the next string the moment the next tone would climb past a ~4-fret window.
- **Why the low E gets two notes** — the major scale's 3rd tone on the low E lands
  a whole step past the window, so it spills onto the next string. The low E keeps
  just its 2nd & 3rd notes (Stu's phrase), e.g. F major position II = F–G on the
  low E, frets 0–3. 6 of the 7 positions come out with 2 on the low E this way; the
  open position keeps 3 because the window can't dip below fret 0 (can't drop the
  open E without skipping it).
- **The window dips one fret below the start** (`winLo = base - 1`) so open-side
  notes on the higher strings are caught — that's what puts the A string's fret-0
  note in the box.

## Session 6m — a third fingering: Hybrid (and naming the systems right)

- **There is no single "right" scale fingering** — there are codified systems and
  personal blends. Method now offers three, all built from the same idea (lay
  scale tones across strings) differing only in per-string counts:
  - **3 per string** (3nps) — 3 everywhere, even and wide.
  - **Positional** — the 7-position system / "position playing": hand stays in a
    ~4-fret box, 2–3 per string. NOT CAGED (that's a separate 5-shape system named
    after chord forms but also used for scales).
  - **Hybrid** — two octaves, 2 on the low E (start on its 2nd note) then 3 per
    string. A positional start with a 3nps body — a very common learned blend.
- **The Hybrid self-selects clean boxes** — a position only forms if the low E's
  3rd note can reach the next string; the open-E box can't, so every hybrid box has
  exactly 2 on the low E. Verified: F Mixolydian hybrid = E:1,3 A:0,1,3 D:0,1,3
  G:0,2,3 B:1,3,4 e:1 — Stu's example, exactly.

## Session 6n — Positional: keep the ♭7 on the B string (jazz fingering)

- **The bug it also fixed** — the in-position scan crossed to the next string
  whenever a tone passed the window top. For a ♭7 at the top of the scale that
  meant trying the high E at fret −1 (impossible), so the WHOLE position was
  dropped. Mixolydian/Dorian/minor were quietly losing positions.
- **The rule** — cross to the next string only if the tone still lands at/above
  the window's BOTTOM there; if crossing would reach BACKWARD below the position
  (exactly what a ♭7 does), keep it on the current string with a light shift up.
  Geometrically this triggers on the half-step 7th, so the ♭7 stays on the B
  string (3 notes, a light reach) — a preference Stu learned from jazz teachers.
- **Major is untouched** — its natural 7 is a whole step, lands at fret 0 on the
  high E (= window bottom), so it still crosses cleanly. Verified F major position
  II unchanged; F Mixolydian now forms all 7 boxes with E♭ on the B string.

## Session 6o — the real Positional vs Hybrid distinction (reverting 6n)

- **6n was wrong** — it made Positional keep the ♭7 up on the B string, but that's
  actually the HYBRID behavior. Reverted Positional to crossing DOWN.
- **The clean distinction (Stu's model):**
  - **3 per string** — 3 everywhere.
  - **Positional** — strict position: a minor 3rd / minor 7th crosses DOWN to the
    next string (a lower fret, "below the baseline"). Where that cross has no room
    (a ♭7 low on the neck → negative fret on the next string), the position simply
    doesn't form — you'd play it higher. So ♭7 scales get fewer boxes (F Mixo: 6).
  - **Hybrid** — positional through the lower strings, but past the G string it
    keeps the m7 UP on the B string (above the baseline, a light shift). All boxes
    form (F Mixo: 7), and the open box matches Stu's example exactly.
- **Verified with a throwaway `tsx` script** (the browser preview was flaky) —
  imported the real theory fns and printed both systems' boxes for F Mixolydian.

## Session 6p — Positional vs Hybrid, finally precise (one shared scan)

- **Both are the same in-position scan** (`positionScan`), differing by ONE rule:
  - **Positional** (shiftUp=false): every tone crosses DOWN to the next string when
    it passes the window top — even below the baseline. Boxes that can't cross don't
    form.
  - **Hybrid** (shiftUp=true): identical, EXCEPT a ♭7 that would have to drop BELOW
    the position to cross instead stays on its string and shifts UP a fret. Scoped
    to (a) the scale's 7th being MINOR (so major-7 scales finger exactly like
    Positional — Lydian/Ionian), and (b) the TOP TWO strings only (`s >= stringCount
    − 2` — "once we cross the G string"), so it doesn't pile a 4th note on a low
    string.
- The earlier rigid "2-on-low-E-then-3-per-string" hybrid was wrong: for a major-7
  scale it forced 2-fret-per-note stretches. The shared scan fixes that — Hybrid
  Lydian == Positional Lydian.
- Verified via `tsx` against Stu's two examples (F Lydian pos 2; F Mixolydian pos 1)
  — both exact — plus Dorian/Aeolian sanity (no 4-note strings).

## Session 7 — ear training MVP (chord-quality quiz)

- **Ear training started** — a new top-level area (Possibility / Play / Ear
  Training). The MVP is a chord-QUALITY quiz: it plays a chord on a RANDOM root
  (so absolute pitch can't be a crutch) and you name the quality; the pool of
  qualities is what you narrow/widen.
- **Why no root-by-name yet** — naming an absolute root with no reference is a
  perfect-pitch task. Quality (and later inversion) is what RELATIVE pitch hears.
  Root/bass identification belongs to the progression layer, relative to a tonic.
- **A thin UI over existing pieces** — `EarTrainingView` just uses the chord data
  + correct spelling (`spellNoteFromInterval`) + `midiOf` + `playChord`. No new
  engine. Snappy loop: answer reveals immediately (green correct / red wrong),
  score tallies, Next poses another.
- **Multi-area nav** — generalised the topnav from a 2-way ternary to an
  `AREA_LABELS` map so a third area drops in cleanly.
