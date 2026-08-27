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

## Session 7b — Lesson / Studio mode (the first design-reframe move)

- **Lesson vs Studio** — a global mode (default Lesson) that hides advanced
  controls so the screen stays calm for live teaching; Studio reveals everything.
- **Mechanism: a class + CSS, not prop-threading.** App puts `page--lesson` on the
  root; `.page--lesson .advanced { display: none }` hides anything tagged
  `advanced`. So classifying a control as advanced is just adding a class — no view
  has to know the mode. Easy to re-tune what counts as advanced.
- **First-pass classification** — Play hides the root/quality pill grids (lead with
  the text input), plus Metronome / Mute / Count-in / Voice-lead. Possibility hides
  All-positions and the Ascending/Descending toggle. The essentials (selectors,
  transport play/tempo, the neck, the reveal) stay.
- This is the cheapest real step of the design reframe: it forces the "what's
  essential per view" decision, which is half the IA work.

## Session 7c — revert Lesson/Studio; label inversions by the bass note

- **Lesson/Studio removed** — it was abstract chrome that didn't earn its keep
  (Stu's call). Reverted the mode, the CSS, and the `advanced` tags.
- **Inversions labelled by the BASS note** — "Root in bass / 3rd / 5th / 7th in
  bass" instead of "Root Position / 1st …". For close voicings these agree, but
  for DROP-2 / DROP-3 the inversion number lies: a "drop-2 root position" actually
  has the 5th in the bass (drop the 2nd-from-top voice and it falls below the
  root). `bassDegree(chord, structure, inversion)` reads the lowest voice's degree
  off the built stack; the buttons are ordered root→7th and each picks the
  inversion that truly puts that tone in the bass, so the player chooses the bass
  directly regardless of structure.

## Session 7d — the chord scale ladder (harmony axis: one voicing, all seven chords)

- **Two harmony axes** — Harmony now toggles between "This chord" (ChordExplorer:
  one chord, every placement) and "Chord scale" (ChordScaleLadder: the seven
  diatonic chords in ONE voicing, ascending the neck on one string set).
- **Reuses the voicing engine wholesale** — `diatonicChords` gives the seven
  chords, `placeVoicingAll` places each; we keep the shape on the chosen string
  set. No new placement code.
- **Only offer string sets where ALL SEVEN fit** — intersect each chord's
  available string sets. Close 7ths don't lay out on the lowest set (too cramped),
  so it's simply not offered; if none work, a hint points to a drop voicing.
- **Make it climb** — octave-shift a chord up the neck when it would sit below the
  previous one, so the scale ascends. Drop-2/3 ladders climb cleanly; on the very
  lowest triad set the last chord can wrap when it hits the 17-fret ceiling.

## Session 7e — the inversions ladder (harmony axis: one chord, up the neck)

- **The second harmony axis** — Harmony now has three explore modes: This chord /
  Chord scale / Inversions. `InversionLadder` holds ONE chord fixed and tiles its
  inversions up the neck on a chosen string set: root/3rd/5th/(7th) in the bass in
  turn, then the cycle again an octave higher.
- **Tiling up the neck** — for each inversion take its shape on the chosen set, then
  octave-copy it upward while it fits; sort every rung by lowest fret so the whole
  thing climbs. Each rung is captioned by its bass note (`bassDegree`/`bassNoteName`).
- Same "offer only string sets where all inversions fit" intersection as the chord
  scale ladder; close 7ths that lay out nowhere get the drop-voicing hint.
- **Duplication note** — InversionLadder and ChordScaleLadder share their controls,
  render, and the tiny layout helpers (stringSetKey/octaveUp/loFret). Kept separate
  + self-contained for now; a shared ladder could dedup them later if it's worth it.

## Session 8 — the design-audit pass (Fable 5)

- **Audit-then-implement** — walked every view against DESIGN.md's principles and
  Stu's notes, then fixed in one pass rather than piecemeal:
- **Display settings belong to the app, not the view** — Labels (Degrees/Notes)
  lived as separate state in FOUR components, so it reset whenever you switched
  views. Lifted to StudyArea as one global toggle passed down (optional prop with a
  default, so parked views still compile). Symptom worth remembering: duplicated
  buttons usually mean state at the wrong altitude.
- **Group by job, not by arrival order** — the Play transport's eight controls
  became three clusters (playback | practice options | song actions) divided by
  quiet rules; ScaleExplorer's five clusters became two rows (primary choice + play,
  then reading options). Nothing hidden — the Lesson/Studio lesson — just grouped.
- **The disclosure pattern for duplicated input paths** — the 23 root/quality pills
  duplicate the text input, so they tuck behind "Pick visually", same as the paste
  box. The text field leads (Stu's call).
- **Verification gotcha** — a closed `<details>` in newer Chrome keeps layout boxes
  (content-visibility), so `offsetParent !== null` lies about visibility; use
  `el.checkVisibility()` instead.
- **Flow bug found by the audit** — ▶ Play position/chord always played shapes[0]
  even with another pinned; now plays the active shape.

## Session 8b — Arc 1 begins: the function engine + the bass-first heat map

- **The roadmap** — the backlog now leads with five arcs; Arc 1 is the function
  engine (interpretation + ranking), which is the shared substrate for the heat
  maps, the Context strip, and ear training's function layer.
- **`theory/suggest.ts`** — the engine's first face. `chordsOverBass(bass, key)`
  ranks every chord that could sit over a bass note: tier 0 = diatonic with the
  bass as ROOT; tier 1 = diatonic with the bass as 3rd/5th/7th (a slash /
  inversion); tier 2 = a secondary dominant (V7/x) containing the bass — the
  reveal read inward. `keysContainingNotes` = the note-level `keysContainingAll`:
  the bass line ALONE narrows the key space.
- **Bass-first flow in Play** — "Start from a bass line": type bare notes
  ("A F C G") → one dashed bass-only bar each (they play as a bass line, an
  octave down). Selecting one shows candidate working keys + the suggestion HEAT
  MAP; clicking a chip commits the chord and the bar resolves. `ChartChord` gained
  an optional `bassOnly` flag (older saved songs unaffected).
- **The heat ramp is a palette token, not throwaway styling** — `--heat-0..3` in
  index.css, tints of the one accent fading into the paper: the first deliberate
  token of the art-book palette (per the "aesthetic foundation lands in Arc 1"
  decision).
- Verified against real theory: A over C major gives Am/Am7 → F/A, Dm7/A, Bm7♭5/A
  → A7 (V7/ii), D7/A (V7/V) — exactly the space a teacher would sketch.

## Session 8c — borrowed chords + real slash chords

- **The borrowed tier (tier 3)** — chords from the PARALLEL minor of a major
  working key. Natural minor is deliberately NOT in the SCALES data (it would
  double every relative major in the reveal), so it's DERIVED: aeolian on the
  tonic = the 6th mode of the major scale a minor 3rd up (C aeolian = E♭ major's
  notes from C), via `modeAt`. Numerals are re-labelled against the MAJOR key —
  the minor's 3rd/6th/7th degrees get a ♭ (III of the minor = ♭III of the key) —
  so chips read iv, ♭VI, ♭VII7, the way players write them.
- **Slash chords are now stored, not just suggested** — `ChartChord.bassIndex`
  keeps the note under the chord. Committing an inversion suggestion keeps your
  bass (F/A); typing "C/E" parses the slash (parser refactored with one
  `parseNoteAt` used for root and bass; "C/C" drops the redundant bass); labels
  show it; playback puts it underneath an octave down; localStorage carries it.
- Still open in the heat map: TRUE slash chords (bass as a NON-chord tone),
  richer qualities, re-narrowing working keys as bars commit.

## Session 8d — the Context strip (the search engine, visible)

- **`interpretInKey`** completes the function engine: given a chord and a key,
  name what it IS there — diatonic numeral, secondary dominant (V7/x, V/x),
  borrowed (♭-labelled vs the major), or outside. Checked nearest-first.
- **`rankKeys`** replaces strict intersection for the strip: an out-of-key chord
  doesn't ELIMINATE a key (real songs tonicize/borrow) — it reads as V7/x or
  borrowed. Keys rank by fewest unexplained chords, then most diatonic; keys with
  no diatonic anchor aren't hypotheses at all.
- **The strip** (Play, above the score): the working-key hypotheses (click to
  re-read), the progression AS FUNCTIONS in that key (numerals are buttons that
  select their bar; secondary/borrowed wear the accent, unexplained go quiet),
  and what the selected bar does to the search.
- **Narrowing isn't the only direction** — a bar can also ANCHOR readings (give a
  key its first diatonic foothold) or KEEP them all (every hypothesis explains a
  V7/x — exactly why secondary dominants are safe spice). The readout says which:
  "C anchors 6", "A7 keeps all 6", "G7 narrows 8 → 6". Caught because the naive
  "X → Y keys" arrow read wrongly when Y > X.
- **Open tension, on purpose** — the old reveal still uses the STRICT intersection
  ("0 fit the whole progression" when an A7 is present) while the strip tolerates.
  Different measures, both true; unifying the reveal onto readings is a next step.

## Session 8e — the function quiz (ear training meets the function engine)

- **Ear Training is now a two-skill area** — a Quality/Function toggle at the top.
  Quality = "what did I hear?" (key-agnostic); Function = "what is it DOING in the
  key?" — the reverse-engineering skill proper.
- **The anchor-first design** — every round picks a RANDOM major key and plays
  four chords, the first always the I. Function is relative; the I is the ear's
  reference point. Random keys mean you learn the RELATIONSHIP, not pitches.
- **Secondary dominants are quizzable** — the pool has two groups: "In key" (the
  seven diatonic sevenths) and "Reaching out" (V7/ii … V7/vi). Defaults include
  V7/IV and V7/V — real songs reach outside, so the drill does too (Stu's note).
- **Snapshot the pool into the question** — narrowing the pool mid-round must not
  strand the correct answer, so each question carries its own pool copy; changes
  apply from the next round.
- **Answer slots, one at a time** — chords 2–4 asked in sequence ("Next chord →"),
  then "Next progression →"; same green/red + running-score rhythm as the quality
  quiz, so the two drills feel like one tool.

## Session 8f — the control grammar: segmented tracks for either/or choices

- **Stu's call: "MANY buttons" whose either/or-ness was invisible.** Every control
  was a pill, so exclusive choices, on/off toggles and actions all looked alike.
- **The grammar** — three visually distinct roles (now in DESIGN.md): a SEGMENTED
  TRACK for pick-exactly-one (recessed track, chosen segment raised like a paper
  chip); PILLS for independent toggles and multi-select pools; the ACCENT pill for
  actions. A control's meaning is legible before you read its label.
- **One tiny component** (`ui/Segmented.tsx`, ~40 lines) replaced ~14 hand-rolled
  button groups across six files. Generic over the value type; `role="radiogroup"`
  + `aria-checked` for free accessibility.
- **Two CSS gotchas** — a flex COLUMN stretches children, so the track needed
  `width: fit-content` to hug its segments; and long tracks (the 12 keys) get
  `flex-wrap: wrap` so they fold instead of overflowing the page.

## Session 8g — the analysis lives WITH the chord (Stu's call)

- **Numerals moved from the Context strip onto the bars** — each chord block in
  the score now shows its function in the working key right under its symbol
  (C over "I", A7 over an accented "V7/ii"), like a marked-up lead sheet. THAT's
  where the connection lands; a separate numerals row in the strip kept the
  analysis at arm's length from the music.
- **Switching the hypothesis re-labels the score itself** — the strip keeps the
  search-engine jobs (key hypotheses + the narrowing readout); the functions ride
  the chords. One state (`ctxKey`), two surfaces.
- Chord lane grew 40 → 54px for the stacked label; bass-only bars show no
  function (they're open questions); kind colours carried over (secondary/
  borrowed = accent, outside = quiet).

## Session 8h — one engine: the reveal now speaks the strip's tolerant language

- **Two engines, one screen, opposite answers — resolved.** Play showed the SAME
  progression two ways: the Context strip (new, tolerant `rankKeys`) said "6
  readings" and labelled the bars; the older reveal below (strict
  `keysContainingAll`) said "0 fit the whole progression" and greyed every chip.
  One chromatic chord (an A7 that's really V7/ii) killed every key in the strict
  view. "Explain, don't eliminate" won: the reveal now reads against the SAME
  `ranked` list the strip computes, so a lit chip is always one of the strip's
  readings — they can't disagree.
- **Strict intersection retired** — `keysContainingAll` is no longer called
  (`keysContaining`, "this chord's home keys," stays for the reveal's grouping).
- **The "0" became a teaching moment.** For a chord whose home keys don't explain
  the song, the tagline no longer says a bald "0 fit" — it names the role the chord
  plays instead ("A7 exists in 5 keys — but here it's the V7/ii in C Major, a
  secondary dominant reaching outside the key"), reusing the chord's own working-
  key reading (the very label drawn on its bar). Bar + strip + reveal now tell one
  story.
- **Two lenses, guaranteed nested.** Strip counts keys that explain the whole song
  (any role for the chord); the reveal counts THIS chord's home keys that survive
  ("of those, 3 explain…"). The reveal set is always a subset of the strip's, so
  the numbers can differ without contradicting.

## Session 8i — tritone substitutions (subV7), the fifth reading

- **A dom7 that fits no key is usually a dominant on loan.** The engine already
  read single secondary dominants AND whole fifths-chains (B7 E7 A7 D7 G7 all
  labelled V7/iii … V7). Two things were still "outside": the backdoor dominant
  (B♭7 → already covered as the borrowed ♭VII7) and the TRITONE SUBSTITUTION.
- **Tritone sub = a dom7 a half-step ABOVE its target** (so it shares that
  dominant's tritone and resolves down a half step). D♭7 subs for G7 → "subV7";
  A♭7 subs for D7=V7/V → "subV7/V". Standard Berklee-style label: subV7 of the
  tonic, subV7/x otherwise. Stu wanted "most standard jazz practice" → subV7.
- **Order of reading matters.** Checked diatonic → secondary → borrowed → tritone,
  so B♭7 in C keeps its stronger backdoor ♭VII7 reading instead of flipping to
  subV7/vi. Nearest/most-common function wins.
- New `kind: 'tritone'` on `Interpretation`; it counts as EXPLAINED (not
  'outside'), wears the accent on the bar like the other reaching chords, and the
  reveal's "visitor" tagline names it ("a tritone substitute — a dominant a
  half-step above its target").
- **Still on the table** (Stu's fuller list): the diminished-scale minor-third
  dominant family (four dom7s a m3 apart), the M3-approach dominant, the vii°
  chain link, and making these quizzable in Ear Training. subV7 is the common one.

## Session 9 — Loop (the first embodiment intent lands)

- **Loop = the teaching vamp**: set a chord or progression going round and round
  and improvise over it (DESIGN.md's first of three "Play actions are embodiment
  moves": Loop / Play-along / Practice card). A Loop pill in Practice options.
- **Gapless by scheduling, not by restarting.** Restarting audio at the loop
  point would put a ~120ms seam in every pass. Instead startSong schedules the
  whole song SEVERAL passes up front (capped ~10 minutes / 200 passes) as one
  continuous Web Audio timeline; only the PLAYHEAD wraps (`(beat - totalBeats) %
  totalBeats`). Pass 1 runs cursor→end, later passes top→tail.
- **Mid-play toggling must not read stale state.** `startSong` takes `loopOn`
  as an explicit parameter (defaulting to the toggle) so flipping Loop while
  playing restarts in place with the NEW value — a closure would still see the
  old one. React state + Web Audio scheduling live on different clocks; pass
  values explicitly across that boundary.
- Also: the handoff brief claimed songs vanish on reload — WRONG, songbook
  persistence already shipped (`method.songbook.v1` in App.tsx). Corrected in
  BACKLOG. Lesson: verify "current state" claims against code before writing
  briefs.

## Session 9b — borrowed chords join the Function quiz (Brief B)

- **A third pool row, "Borrowed":** iv7, ♭VImaj7 and ♭VII7 (the backdoor
  dominant) — the three parallel-minor colours every jazz/pop tune leans on.
  Default OFF (they're the deep end of the dial).
- **One source of truth for "the parallel minor":** `parallelMinorOf` exported
  from theory/suggest.ts, so the quiz builds its borrowed chords from the SAME
  derivation the analysis engine uses (aeolian = 6th mode of the major a m3 up).
  Same ♭-labelling convention too (♭ on the minor's degrees 2/5/6).
- The FnOption/chordFor/pool-snapshot pattern absorbed the new kind with ~20
  lines — the quiz architecture paid off.

## Session 9c — Ramp (the speed trainer), and a debugging lesson

- **Ramp = the woodshed drill**: while looping, each time round adds +5 bpm
  (capped at 280, where it keeps looping). The reached tempo persists with the
  song — "we got it to 140 today" is saved. The pill appears only when Loop is
  on (disclosure by relevance).
- **Design lesson: scheduling beats restarting.** The first attempt restarted
  playback at each pass boundary (flag + a [bpm] effect) — a fragile async dance
  across React state and the audio clock. The fix: build a PASS PLAN up front
  (each pass carries its own tempo) and schedule it all as one continuous Web
  Audio timeline. The tick just reports which pass it's in (playhead position +
  tempo readout). No restarts → no race → and the ramp is gapless too.
- **Debugging lesson: beware the observer.** The "bug" that survived the rewrite
  was my own test harness — overlapping browser evals clicking the transport
  button mid-run. In-page event tracing (window array + timestamps + stack
  slices) settled it where console logs couldn't: the preview's console
  collector duplicates entries per eval hook and persists across reloads.
  Verified clean: one Play event, 100→115 on the exact pass schedule, and a
  60-second unattended run ramping to the 280 ceiling and looping there.

## Session 9d — Brief C's theory calls (Stu ruled; the code obeyed)

- **Blues IV7.** A dominant 7th ON the fourth degree of a major key reads "IV7"
  (kind 'blues') — everyone's name for that colour — never the derivable
  subV7/iii. The TONIC dominant deliberately keeps its V7/IV arrow (it names the
  pull toward IV); a context-free "I7" claim would often be wrong. Stu: IV7 only.
- **♭ numerals everywhere, ONE convention, ONE place.** Jazz numerals measure
  against the MAJOR scale on the same tonic — so harmony.ts now prefixes ♭/♯
  right where romans are built (compare each degree's pc offset to the major
  scale's). C harmonic minor: i(maj7) iiø7 ♭IIImaj7♯5 iv7 V7 ♭VImaj7 vii°7.
  This let us DELETE the manual ♭-hacks in three places (chordsOverBass,
  interpretInKey's borrowed branch, the quiz's borrowed options) — they would
  have double-flattened. Fix the source, not the consumers.
- **V7/III+ kept** (Stu's call — leave the formal derivation), and it now reads
  V7/♭III+, consistent with the new labels.
- Verified: majors unflatted; no double-flats (B♭7 in C stays ♭VII7); blues bars
  read I·IV7·V7·I; Possibility's degree track and the quiz pools all carry the
  convention.

## Session 9e — per-bar units: a bar can DO something (Arc 3 opens)

- **`ChartChord.unit`: 'chord' | 'arpeggio'.** A "Bar plays" segmented track in
  the editor; an arpeggio bar spreads its chord tones evenly across the bar,
  low to high, and wears a quiet ↗ after its symbol. This is the data seam that
  scale runs and interval patterns (paltas) extend — songs as exercises.
- **The hidden-tab discovery.** Browsers throttle requestAnimationFrame to ZERO
  in hidden tabs. Method's playhead is rAF-driven, so in a backgrounded tab the
  LINE freezes — but because all audio is scheduled up front on the Web Audio
  clock (the pass plan), the MUSIC keeps playing correctly, and on return the
  playhead recomputes from the audio clock and lands exactly right. This is why
  the earlier restart-at-boundary ramp design was doomed: its logic lived in the
  rAF tick. Rule of thumb: the audio clock is the timekeeper; rAF is only a
  paintbrush.
- Also explains a day of intermittent test results: the preview tab's
  visibility fluctuates. Browser-verify animations only in a visible tab; verify
  STATE (storage, DOM, classes) any time.

## Session 9f — the voice, de-annoyed (Stu's field note: "the sound is a bit annoying")

- **Three causes, three fixes, one file** (audio/player.ts — the seam built for
  exactly this):
  1. **Droning**: notes sustained at full volume for their whole duration, so a
     4-beat bar = 2.4s of continuous organ tone. Now a PLUCK envelope — fast
     attack, most of the decay early, ring time capped ~1.9s — so a bar rings
     and settles like a strummed chord.
  2. **Clipping**: five voices × 0.28 gain summed past full volume — the harsh
     "cheap synth" edge. Now: per-note peak 0.16 AND a shared master COMPRESSOR
     (threshold −18dB, soft knee) that everything routes through.
  3. **The piercing click**: 2kHz square → a low-mid sine "tock" (1150/820Hz).
- Also: two triangle oscillators 6 cents apart per note — the slow beating
  between them reads as warmth/body, the cheapest chorus there is.
- The REAL instrument voice (Stu's Archive/Soundscape synth code) remains the
  endgame per CLAUDE.md — this pass just makes the seam pleasant until then.
- Tone can't be judged through a headless browser: verified every playback path
  runs clean (sequence, chord, transport + clicks); Stu's ears are the test.

## Session 10 — scale-run units: the bar that runs its chord scale

- **The third unit type**: Bar plays Chord / Arpeggio / **Scale**. A scale bar
  runs its chord scale ascending across the bar (7 tones + octave) and wears ∿.
- **Which scale? Two answers, tried in order** (`theory/chordScale.ts`, pure):
  (1) IN THE KEY — if the chord is diatonic to the working key, the run is the
  key heard from the chord's root (the MODE on that degree): Dm7 in C → D
  dorian. Quality must match too, so a blues F7 in C falls through (Fmaj7 ≠ F7)
  and correctly gets mixolydian, not lydian. (2) FROM THE QUALITY — visitors
  get the standard jazz pairing: maj7→ionian, 7→mixolydian, m7→dorian,
  ø7→locrian, m(maj7)→melodic minor; dim/aug honestly null → chord tones.
- **The Context strip changes what a bar PLAYS now, not just its label**:
  verified the same Am7 bar runs A aeolian under the C-major hypothesis and A
  dorian under G major. One working key, three surfaces (label, reveal, run).
- The editor names the run in place ("runs D Dorian") — the teaching moment.
- New DATA: the m2 interval (locrian's parent sits a half-step up). Performance:
  notes under 0.4s use one oscillator (detune beating is inaudible that fast,
  and a looped run schedules thousands of notes).
- The palta/interval-pattern generator extends this same seam next (direction,
  grouping — 1235, thirds…).

## Session 10b — the inversion quiz (Arc 2's missing ear skill)

- **Ear Training is now three skills**: Chord quality / Inversion / Function.
  The inversion quiz plays a chord on a random root, ROTATED so a random tone
  is lowest, and you name the bass: Root / 3rd / 5th (/ 7th for sevenths).
- **The teaching frame** (in the footnote): root position *sits*, 3rd-in-bass
  *leans*, 5th *floats*, 7th *pulls down* — you're naming a feeling, and the
  random root guarantees it's the SHAPE you hear, not a pitch.
- **Voicing construction is one rotation**: tones below the chosen bass jump up
  an octave (`[...tones.slice(k), ...tones.slice(0,k).map(+12)]`) — the same
  close-position rotation the theory layer uses for inversions.
- Answer pills come from the QUESTION's chord intervals, so triads offer three
  choices and sevenths four, labelled generically from diatonicSteps (a sus
  chord's "4th in bass" would label itself).

## Session 10c — TAB tokens (Brief D closed)

- The three TAB surfaces (Possibility's TabView cards, the horizontal
  TabSequence, Play's score staff) already LOOKED the same — an earlier pass
  matched them by copying values. Now they SHARE them: `--tab-line` and
  `--tab-fret-size` in index.css. Copied values drift; tokens can't. Verified
  all three compute identical line colour + fret size in the browser.

## Session 10d — practice cards: the teaching loop's take-home step

- **A practice card freezes the open chart** — chords (with per-bar units),
  meter and tempo — beside a one-line instruction you type ("loop this ii-V,
  arps only, to 120"). Reopen it to load the chart back. This closes the lesson
  loop (Song -> Analyze -> Voicings/Scales -> **Practice**) and is the first
  seed of DESIGN.md's Practice zone + per-student Palette.
- **Skeleton by design**: the DATA MODEL is the deliverable. Loop/ramp intent
  and per-student grouping layer on later without reshaping the card. Kept the
  card to what App already owns (durable song content), so nothing had to be
  lifted out of SongView's transient transport state.
- **Own storage key** (`method.cards.v1`), same load/normalize/id-counter
  pattern as the songbook — newest first, filtered to cards with >=1 chord.
- **One labeler, two places**: exported `chordLabel` from SongView so a card's
  summary shows the SAME labels (unit glyphs and all — verified the ∿ survives
  the snapshot).
- Verified full lifecycle in-browser: save (input clears, count/note/prog +
  localStorage), mutate chart then Open -> restores, Remove, and persistence
  across a real reload. Preview needed a manual nav to localhost after a reload
  (the recurring stuck-proxy quirk).

## Session 11 — the shape stepper (Stu's field note: "we play them one after another")

- **Walk the TAB row the way you play it.** In Possibility, the shapes ARE a
  sequence — positions up the neck, ladder rungs, voicings. A shared
  `ui/ShapeStepper.tsx` adds ‹ 3 / 7 › buttons AND the ← → arrow keys: step to
  the next/previous shape, pin it, play it. Wraps at the ends. Wired into all
  four TAB views (ScaleExplorer, ChordExplorer, both ladders — the ladders
  gained a pinned selection to step onto).
- **Global key listeners need two guards**: (1) the app keeps hidden areas
  MOUNTED (the `hidden` attribute), so every stepper's listener is always
  alive — check `el.offsetParent === null` to ignore keys while your view is
  off screen; (2) never hijack arrows inside INPUT/TEXTAREA/contentEditable.
  Verified both: arrows in Play don't move Possibility's stepper; arrows in the
  chord field don't step.
- Hook + control shipped as one file: `useStepper` (owns the keys, returns
  `step(delta)`) + `ShapeStepper` (the buttons + live count). They're only ever
  used together.

## Session 11b — interval patterns (paltas): the fourth practice dial

- **One formalism covers every classic drill**: a pattern is a REPEATING CHAIN
  of directed steps through the material — thirds = [+2,-1], fourths = [+3,-2],
  1-2-3-5 = [+1,+1,+2,-3], "up a 4th down a 2nd" = [+3,-1], Stu's zig-zag
  [-3,-1,+3,-1]. Anchored "from each degree" drills and continuous contour
  walks are the same thing; only the chain differs.
- **Material × pattern, orthogonal dials** (Stu's "they're kind of similar in
  function"): the bar's UNIT stays the material (arpeggio or scale) and the
  PATTERN walks it — so "in 3rds" over a scale is diatonic 3rds, and over an
  arpeggio it's skip-a-chord-tone. One pattern datum, both materials.
- **Start on a root with room to move**: the walker computes the chain's lowest
  cumulative position and starts on the lowest ROOT that keeps the run in
  range — ascending chains start on the root itself, net-descending chains on a
  root an octave up (exactly where a player starts them). Verified: the zig-zag
  over C major runs C5 G4 F4 B4 A4 E4 D4 G4.
- Patterns are DATA (data/patterns.ts matching PatternDefinition in types.ts);
  the walker is ~20 lines of pure code (theory/pattern.ts). Pattern bars fill
  at an eighth-note pulse (durationBeats × 2 notes).
- JS gotcha: object keys that look numeric ('1235') get hoisted to the front of
  Object.values — the LIST is now the source of truth and the lookup is derived.

## Session 11c — the pair generator: Patterns as a Possibility study mode

- **Stu's correction: the Play presets were far too simple.** The systematic
  drill belongs in POSSIBILITY, over ANY scale/mode: pair interval (3rds–7ths)
  × contour (up-up, up-down, down-up, down-down) × direction. A third Mode
  segment — Scales / Patterns / Harmony — rides the same Key/Scale/Degree
  plumbing, so degree V of C major drills G Mixolydian.
- **Three ingredients, named separately** (`theory/pairs.ts`): the PAIR
  INTERVAL (how far apart the two notes), the CONTOUR (which way odd/even
  pairs are played — the whole 2×2), and the ANCHOR STEP — the interval nobody
  states when they say "thirds": the pairs themselves march up a 2nd. Stu
  spotted that naming it is what unlocks custom pairings, so it's an explicit
  parameter from day one (anchorStep 2 already gives stacked thirds:
  C E · E G · G B).
- **Indices, not pitches**: pairIndices returns positions into the scale
  (0 = root, 7 = root+octave); the caller maps to midis (indexToMidi wraps
  octaves) and to spelled NAMES from realizeScale — so C melodic minor drills
  say E♭, never D♯.
- Verified against Stu's spec verbatim: ↑↑ C E·D F, ↑↓ C E·F D, ↓↑ E C·D F,
  ↓↓ E C·F D; 6ths ascending + descending; Mixolydian on degree V; melodic
  minor spelling. Next: custom pairings (expose anchorStep + free chains),
  pattern TAB placed into position boxes, and send-a-pattern-to-Play.

## Session 11d — custom pairings + the two-octave standard

- **Every drill now runs ROOT TO ROOT, TWO OCTAVES OUT AND BACK** (Stu's
  standard "for any scale"): the anchor path climbs to 2n and retraces its
  stops without doubling the top — one continuous exercise. A negative march
  goes down two octaves and back up. The separate Ascending/Descending track
  is gone; the round trip replaced it.
- **Custom cells are the discovery space.** The three ingredients each got a
  control: CELL = a typed chain of directed moves ("3 -2", "↓4 ↓2 ↑4"; arrows,
  +/-, or u/d all parse), echoed back in words ("up a 3rd, down a 2nd") so the
  notation teaches itself; MARCH = the anchor step as a segmented (↑2nd…↓4th);
  ALTERNATE = mirror every other cell. The preset contours are exactly
  {alternate, mirrorCell} — the 2×2 fell out of two booleans.
- **patternRun replaced pairIndices**: one engine for presets and customs —
  cells of any length, cumulative moves from each anchor, mirror by parity.
- Also: don't name a React state setter `setInterval` — it shadows the global.

## Session 12 — patterns as TAB, fingered the way a hand plays them

- **Stu's critique: patterns should read as guitar TAB, not note names** (and
  the serif readout font was a mistake). The run is now real tablature, wrapped
  into lines of whole cells, in PLAYING ORDER (TabSequence gained an `ordered`
  prop — its pitch-sort would have flattened every zig-zag back into a scale).
- **Placement = least total movement** (`theory/placeRun.ts`): every note
  lists its candidate string/fret spots; dynamic programming picks the path
  minimising fret travel (+ a smaller cost for string crossings). Staying put
  is free, so POSITIONS HOLD THEMSELVES; when two octaves outgrow the box, the
  cheapest path is the gradual diagonal shift — exactly Stu's rule, emergent
  from one cost function. 7ths place as the classic two-string climb
  (A3 G4 A5 G5 A7 G7...); max fret jump ≤ 3 across all probes.
- **Octave-slide before placing**: a two-octave run from a mid-neck root can
  overrun 17 frets, so the whole run slides down/up an octave first.
- **Clamp the march at the ceiling**: no cell note may exceed two octaves
  above the root (the turn folds early) — this is both the practice-book shape
  and what keeps every run on a real neck (7ths were unplaceable before).
- **Placement adds POSITION to identity, not the reverse**: placeRun takes
  notes already carrying spelling/degree/root-ness (RunNote) and returns
  PlacedNotes — the layering kept honest by the PlacedNote type itself.
- The neck now shows the run's PATH (deduped placements) — the diagonal drift
  made visible. Play sounds the exact placed octaves the TAB shows.

## Session 13 — start from the lowest thing on the neck (Stu's field note)

- **The rule**: every ladder/run starts at the LOWEST playable spot, so the
  whole fretboard is represented. Audit found one real offender and one nearly-
  free improvement:
  1. **The chord-scale ladder always began on I** — and since the seven chords
     repeat every octave, which degree comes first is a FREE choice. Starting on
     I stranded everything below it (C major on the top string set began at fret
     5 and ran off the neck while V, vi, vii° sat unseen at frets 0–3). Worse,
     when a chord couldn't octave-shift up, the ladder FOLDED BACK DOWN
     (…V@12 vi@14 vii°@3) — a broken "ascending" ladder. Fix: begin at the
     lowest-fret degree and cycle from there. Probed 32 key × scale × voicing ×
     triad/7th combinations: all now ascend, every one starting at fret 0–1,
     spanning frets 0–11.
  2. **Pattern runs started mid-neck** (C major 3rds at the low E's 8th fret,
     though C3 also lives at the A string's 3rd). placeRun's start bias went
     0.05 → 0.3: the run now starts at fret 3 for +0.3 of total hand movement,
     with the biggest shift unchanged. Enough to break ties, too small to
     distort the fingering.
- **Already correct, verified not broken**: scale position boxes (built up from
  the lowest ladder tone), the inversion ladder (lowest base per inversion, then
  octave copies up), and ChordExplorer (one shape per string set at its lowest
  octave, via placeOnStringSets' `octaveShift = minShift`).
- Lesson: when the material is cyclic, the STARTING POINT is a free parameter —
  spend it on covering the neck.

## Session 14 — the first aesthetic slice (from Stu's Cosmos boards)

- **Sampling a mood board beats eyeballing it.** Drew all 91+137 images to a
  canvas, converted to HSL, grouped by hue, and EXCLUDED the neutral greys so
  the real colour signature could surface. That produced facts, not vibes:
  terracotta at 9% of one board; 33% dark pixels on the other. It also proved
  Method's coral accent was already on-direction — the app was under-supplied
  (no cool pole), not mis-coloured.
- **Three things shipped**, all token-level and reversible:
  1. **Paper grain** — an `feTurbulence` noise tile in a data URI, `position:
     fixed` (so it reads as the stock the app is printed on, not something that
     scrolls) with `pointer-events: none` (so it never eats a click) at 0.22
     multiply. No image file to load.
  2. **Warmed the ground** `#faf8f4` → `#f4efe3`, a step toward the board's
     sampled `#dad7c8` rather than the whole way — it still has to read as a
     page you take TAB off.
  3. **Function hues split by temperature** — secondary/borrowed/blues/tritone
     all wore one coral, so every chord that reached outside the key looked the
     same distance away. Now warm-near → cool-far.
- **Warming the ground has knock-on effects; find them by grepping for
  literals.** The fretboard's own tint `#f3eee4` became invisible against the
  new `#f4efe3` (deepened to `#ebe3d1`), the segmented track needed the same,
  and `--muted` slipped to 3.11:1 (darkened to `#7f7869`, now 3.82).
- **Measure contrast, don't trust the eye.** The accent coral only reaches
  2.8:1 on paper — fine as a big Play button, too weak for an 11px function
  label. The shipped hues are deliberately deeper than the accent (3.79–6.36),
  and were also checked for pairwise distance from EACH OTHER (min 52) so the
  four kinds stay distinguishable, not just legible.
- **A stray `*/` silently kills the declarations after it.** Vite 500'd, HMR
  stopped applying, and the tokens quietly kept their old values while `--muted`
  (declared above the break) updated — which is what exposed it. When half a
  token change lands, suspect the comment syntax.

## Session 15 — the redesign: Paper & Night in the app itself

- **Stu: "the style guide is perfect… it isn't translating."** Right diagnosis.
  The first pass shipped the PALETTE and skipped the GRAPHIC LANGUAGE — colour
  in 11px labels can't carry a design. What carries it: an identity mark, a
  shape language, type, and colour used at scale.
- **One mark, two worlds.** The masthead rule is gone; in its place a circle
  that IS the thesis — on paper a riso ink blot (a turbulence mask eats its
  edge, giving the indigo-on-oatmeal moon prints from the board), at night the
  same circle unmasked with a warm bloom: the moon. One element, one token
  swap.
- **Shape language: 999px → 2px.** The boards are circles and printed grids,
  never lozenges. A single `--radius` token moved every pill, track and card
  from "app chrome" to "ink on a page". This did more for the feel than any
  colour change.
- **Every colour is now a token defined twice** (paper + night), so no
  component knows which world it's in and the theme is one attribute on
  <html>. The audit that made it possible: grep for colour literals, and
  convert ALL of them — one stray `#f3eee4` on the fretboard was a single digit
  from the new ground and would have made the neck vanish.
- **Degrees finally use the palette**: `--deg-1..7` run warm at the root to
  cool at the 7th, parsed from the interval label (`degreeOf` handles "1",
  "♭3", "M3" alike). The root keeps a RING rather than a louder fill, so
  "which degree" and "is it the root" stay two separate signals.
- **The aura is night-only, and that's a principle, not a setting.** Paper ink
  soaks INTO stock; it doesn't emit. A glowing dot on paper was the one
  dishonest thing on the page — and it also read as candy. Removing it fixed
  both at once. At night it's the whole point (bioluminescence).
- **Riso overprint in a UI = `mix-blend-mode: multiply` + a 1.5px offset.** A
  selected segment isn't a chip lifted off the track, it's a block of ink
  PRINTED on it, with a second misregistered pass. The overlap colour is never
  chosen by hand — the blend makes it, the way real ink does. At night the same
  layer SCREENS instead (light escaping, not ink soaking).
- Type: Newsreader + Karla from Google Fonts, each with the old system stack as
  fallback — a failed font load degrades rather than breaks. This is a
  deliberate departure from the "system fonts only" note in the original
  palette comment; the tradeoff is a network dependency for the intended look.

## Session 15b — the corrections that actually made it land

- **"Too neon" was two mistakes, not one.** (1) I invented saturated night hues
  (#4fb3c9) instead of lifting the boards' own sampled colours; (2) I let ALL
  126 dots glow. Every night photograph on the boards is ONE warm source in a
  cool field — so now only ROOTS glow, everything else is merely lit, and the
  night inks are dusty (#52899b, not #4fb3c9). Neon comes from saturation plus
  ubiquity; fixing either alone wouldn't have done it.
- **Match the style sheet EXACTLY when the style sheet is the thing they
  loved.** I'd "gone further" than the artifact on the paper (#e9e0cc, grain
  0.4) thinking bolder was better. Wrong: the artifact's own #f4efe3 / 0.28 was
  the target all along.
- **TAB was the biggest single win, and it was pure layout**: `inline-flex`
  with fixed 20px columns and 22px rows meant every staff ended wherever its
  notes ran out and was half again too tall. Now `width: 100%`, `flex: 1`
  columns and 15px rows — six lines reaching the right margin, like real
  tablature.
- **Misregistration doesn't read at button scale.** A 1.5px offset ink block on
  a 20px control just looks like a bad drop shadow — which is exactly what Stu
  saw. Real riso misregistration reads on LARGE areas, so the overprint now
  lives only on the mark, and buttons are flat ink.
- **The swatch-table pattern transfers** (Stu's catch): `gap: 1px` over a
  rule-coloured background makes hairline dividers with no double borders. The
  TAB positions are now one outlined table of rows rather than seven floating
  cards — which also fixed the "things float around randomly" spacing problem.
- **Two CSS traps hit in one session**: `mix-blend-mode` on a `position: fixed`
  overlay blends against whatever its stacking context contains, so the night
  grain left a visible seam where the content box ended (fix: no blend at
  night, just a faint overlay); and `.tab-shelf` defined AFTER
  `.tab-shelf--lines` at equal specificity silently won the `display` property
  (fix: qualify the modifier as `.tab-shelf.tab-shelf--lines`).
- Type now carries structure too: uppercase letterspaced EYEBROWS for every
  "what is this row" label and TAB position caption, matching the style guide's
  section labels.

## Session 15c — TAB positions as a track listing (Stu's note)

- **Hover-to-preview made the page feel unstable** — moving the mouse across
  the TAB rows kept re-lighting the neck, so nothing held still long enough to
  read. Removed from the TAB rows entirely: a row stays selected until you pick
  another one.
- **Splitting "select" from "play" is what made that possible.** They used to
  be the same click. Now clicking a row selects it, and each row carries its
  own ▶ button — a track listing, which is exactly the mental model for a list
  of positions you play one after another.
- **The name belongs ABOVE the staff**, not captioned underneath: it labels
  what follows, and it gives the play button somewhere to live.
- The play button is a CIRCLE while everything else is a printed rectangle —
  the boards' shape language, used to separate an action from a surface.

## Session 15d — playback as a state; quiet selection

- **Selection is quiet, playback is loud.** A tinted row reads as "something is
  happening here" when nothing is, so the background wash is gone: selection
  gets a hairline bar in the margin, and the ACCENT bar plus a filled button are
  reserved for the row that is actually sounding. One loud signal, and it means
  the thing you can hear.
- **Playback had to become a state, not fire-and-forget.** `playSequence` now
  returns a `Sequence` handle (`durationSec` + `stop()`), so a row's button can
  show ⏸ while its own run plays and return to ▶ when the last note rings out
  (verified: flips back at ~4s on its own), or when you stop it, or when
  another row starts.
- **Stop in a CLEANUP, not an effect body.** React guarantees a cleanup runs
  before its effect re-runs and on unmount, so no dependency change can slip
  past and leave a button stuck on ⏸.
- **Removing controls was the real fix for redundancy** (Stu): with a play
  button on every row, the global "▶ Play position" and the ‹ 3/7 › stepper were
  both saying the same thing again. Both gone — but the ← → ARROW KEYS stay,
  because stepping through positions by hand was the point; they now just move
  the selection, silently, matching "click selects, ▶ plays".
- **Probe hygiene**: my in-page checks located the visible area as "the first
  non-hidden DIV child of .page" — and the new .theme-switch div broke that,
  so several probes were silently querying the wrong container and I nearly
  "fixed" a bug that didn't exist. When a probe reports something impossible,
  suspect the probe first.

## Session 15e — ROYGBIV degrees: colour and text as two channels

- **Stu's idea, and it was already half-true**: colour is computed from the
  INTERVAL, never from the label, so it keeps meaning "scale degree" no matter
  what's written in the dot. Switching Labels from Degrees to Notes now swaps
  3→E, 4→F, 5→G while the fills stay byte-identical. Two channels, two facts,
  read at once — the note name AND where it sits in the scale.
- **ROYGBIV in riso ink.** Seven degrees, seven spectrum hues in order (1 red,
  5 blue, 7 violet), but muted so it reads as a printed chart rather than a toy
  rainbow. Two numbers make that work: hue climbs monotonically (11° → 278°)
  so the sequence reads AS a sequence, and LIGHTNESS is held nearly flat
  (0.42–0.48) so no degree shouts louder than its neighbours. Saturation stays
  in the 0.26–0.53 band — the riso range.
- Holding lightness constant across a categorical palette is the trick that
  keeps a rainbow from looking like a toy: variation lives in hue alone.

## Session 16 — Marks & Measures: the structural pass

- **Stu's real complaint wasn't the pills, it was the RHYTHM.** Every selector
  was `width: fit-content`, so a 12-key track spanned the page and a 2-option
  track was a stub — the page had no left edge and no beat. Better inks can't
  rescue a page with no rhythm, which is why colour kept feeling like the wrong
  lever.
- **The boards answered it all along.** Looking for STRUCTURE instead of
  colour, one motif is on nearly every image: equal cells, evenly divided (the
  nine mark-tiles, the four moons, the triptych, shelves of record spines) —
  plus Hilma's other half, a label written in the margin. So: one outlined
  block, a fixed label column, rows dividing one measure. Verified: all five
  rows now share a 622px measure.
- **MARKED, NOT BOXED.** Stu spotted two languages for one job: the area nav
  used an underline, the selectors used boxes. Resolved by keeping the mark and
  dropping the boxes — recessed track, ink block and lozenge all retired. The
  hierarchy is now SIZE, not a different device.
- **The mark belongs to the WORD, not the cell.** First cut put the rule on the
  grid cell, so a two-option row drew a half-page rule under one short word.
  Wrapping the label in a span fixed it.
- **A yellow that carries light text can't be a true yellow.** Search proved
  it: to reach 4:1 against paper a hue-40° ink has to drop to ~0.20 lightness,
  which is brown. The fix was the opposite of what made it ugly — the old 3 was
  DESATURATED and mid-light (olive mud); the new one raises saturation to 0.65
  and drops lightness to 0.38, giving a vivid marigold ochre at 3.45. All seven
  now sit in a 3.45–4.99 band with the same light label.
- Useful principle: when a categorical palette must carry one text colour, tune
  SATURATION per hue and let lightness follow the pigment — forcing every hue to
  one lightness is what turns yellows and greens to mud.

## Session 16b — the rule that fits, and view titles as headings

- **Selection rules need a floor AND a ceiling.** Hugging the word gave a 6px
  rule under "I" (looked like a mistake); filling the cell gave a half-page
  rule under "Degrees". The fix is a rule that fills its cell but caps at
  130px — 44–130px across every row size, and every one reads as deliberate.
- **The scale name was body text pretending to be a heading.** It's the single
  most important thing on the page, so it now takes the display serif at 27px
  in INK, with the scale's notes below it as a quiet letterspaced specimen
  line (the way a plate is captioned) instead of one muted run-on sentence.

## Session 17 — the neck was lying (Stu's data note)

- **The fretboard drew the union of 7 position boxes, not the scale.** Boxes
  are FINGERINGS chosen from the material; drawing only them silently deleted
  real notes. Probed across keys: every one was missing 8–12 notes — always the
  open strings and the top frets (C major lost its open E and everything from
  fret 15 up; E♭ also lost fret 1). This is exactly Stu's "if there's a note at
  the 13th it should be at the 1st" — the 12-fret loop was never broken in the
  THEORY (placeScale matches by pitch class across every position), only in what
  the renderer was handed.
- **Fix: the neck shows the whole scale; the boxes light a path through it.**
  Fretboard now draws `highlights` (every note on the neck) as its base layer
  and uses `shapes` only for constellation lines and for deciding what dims. A
  box's positions are a subset of the base, so each position is drawn exactly
  once — no double-render.
- **Two neck drawing errors, both real**: string gauge counted UP from index 0,
  but index 0 is the LOW string and sits at the BOTTOM — so the neck read
  thin-at-the-bottom, backwards from an instrument. And the nut was painted
  before the strings, so they crossed over it; it's a physical part they pass
  over, so it paints last.

## Session 17b — let the label follow the ink

- **The yellow problem was solved backwards.** I'd been darkening yellow so it
  could carry the one light label — which is exactly what turns it to mud.
  Now each degree names its OWN label colour (`--deg-N-ink`), so the bright
  marigold (#d9ac3c) keeps its brightness and takes DARK text. The ink stops
  bending to the label.
- **Red and orange were 15° apart**; the red is now a truer #ab4436, opening
  the gap to 22°. Orange and marigold sit only 10° apart but differ in
  lightness (0.44 vs 0.54), which carries the distinction where hue can't.
- **No glow anywhere, in either theme.** Even cut back to roots only, a bloom
  around small marks read as neon. The dots are printed stamps on a surface;
  the aura idea belongs to the page's big moments (the masthead moon) and to
  nothing else.
- **No ring on the root** — a stroke around it read as an outline bug rather
  than emphasis. Its colour is the signal.

## Session 18 — Stage 1: the neck repeats, and the app gets its name

- **The seventh-chord "gap" was physics, not a bug.** Probing all three
  structures: drop 2 already gives Stu's exact 4 inversions × 3 string sets =
  12, with spans of 1–4 frets. CLOSE sevenths only reach 6 because most of
  their inversions genuinely don't fit a guitar hand (spans 5–6) — which the
  app already warns about. Nothing to fix; the right voicing was already there.
- **The real gap was octave repeats.** `placeVoicingAll` returns each shape at
  its LOWEST playable position only, so the top half of the neck sat empty and
  the app hid the 12-fret repetition a player leans on. `withOctaveCopies`
  adds every copy that still fits; `allVoicings` gives the complete grid
  (inversion × string set × octave) for the Harmony restructure to consume.
  A C major triad goes from 4 placements to 6 (frets 0/3/5/8 → +12/+15).
- **Renamed to FRETBOARD CONSTELLATIONS** — truer to what the app now shows,
  since the neck really is a constellation of coloured degrees. The repo and
  the deploy path stay `/method/` so the live URL doesn't break.
- **DEGREE → GRAVITY** (Stu's word, and a better one): it names the pull toward
  home, which is exactly what the function engine computes.
- The favicon is the ink blot — the same object the masthead draws, so the
  browser tab and the page carry one mark.

## Session 18b — Stages 2–4: scope, controls, and the ink stamp

- **Hide with a FLAG, not a comment.** Play, Ear Training and Patterns are
  gated behind a `READY` map. Commented-out features rot — they stop being
  compiled, type-checked or refactored with the rest. Flagged ones keep
  building, and come back by flipping one boolean.
- **ALL (-1) is "the whole key", degrees are slices of it.** In Scales it shows
  the parent scale itself instead of a mode — the title reads "C Major", not
  "C Ionian". In Harmony it forces the chord scale instead of one degree's
  voicings.
- **Two facts, one dot, no toggle.** The Labels row is gone: dots always print
  NOTE NAMES and colour always carries the gravity, so you read both at once
  instead of switching between them. That only works with a key, so the legend
  under the title names the seven inks and the note each currently lands on.
- **The ink stamp is a MASK, not a filter per dot.** Sixteen turbulence masks
  are defined once in <defs> and referenced by every note, so the browser
  rasterises a handful of textures rather than one per dot. Each note picks its
  stamp from `fret * 3 + string * 7`, which is stable across renders (no
  flicker) and never repeats along a row. The mask bites only the RIM — an
  inner circle at 0.72r stays solid — so however ragged the edge gets, the
  label still sits on ink. A soft radial core over the top reads as pressure.

## Session 18c — the stamp that wasn't printing, and Mode in the panel

- **The ink stamp silently did nothing for a whole session.** An SVG mask reads
  LUMINANCE, and my feColorMatrix was emitting BLACK with a varying alpha —
  luminance zero, so the noise was invisible to the mask. The only thing
  showing was the solid protective disc, which meant every dot had been
  rendering as a plain circle at 62% radius. Lesson: for a mask, force RGB to
  white (`0 0 0 0 1` rows) and vary alpha; if a mask "does nothing", suspect
  luminance before tuning frequencies.
- **Three tuning lessons, in order:** noise scale has to match the object (a
  30-unit dot needs blobs ~half its width — fine noise just greys the edge);
  the alpha ramp is a balance (-22 cuts cookie-cutter edges, -8 turns the dot
  to pale mush, -16 keeps it inked with room to fade); and a whisper of blur
  (~0.55) is what actually sells ink-into-paper, but past ~0.6 the texture
  washes out entirely.
- **The ghost layer replaced the protective disc.** Backing each dot with the
  same ink at 0.8 opacity means the bite reads as uneven DENSITY rather than
  holes punched to the paper — and since the label then always sits on ~80%
  ink, the solid inner circle (which Stu spotted as a visible second circle
  under the letter) became unnecessary and was removed.
- **A switch that hides itself can't switch back.** Ear Training moved from the
  top nav into a MODE row inside the CONTROLS panel, which meant the panel had
  to live where both modes can see it — so `studyMode` sits beside Key/Scale/
  Gravity rather than above them. The fretboard-only View row hides in Ear
  mode. With Ear gone from the nav and Play flagged off, the top nav had one
  item left, so it hides itself.

- **The same row can mean two different things.** Key/Scale/Gravity/View are
  pick-ONE on the fretboard (a neck shows one key at a time) and pick-MANY in
  Ear mode (each extra choice just widens the pool of what might be played).
  Rather than two panels, the rows swap control: `Segmented` (a rule under the
  word) or `MultiSelect` (a dot before it), same grid, same measure. The mark
  carries the meaning, so the layout never lurches when you switch modes.

- **Give the quizzes one source of truth about what's possible.**
  `theory/earMaterial.ts` turns the selections into the actual list of chords
  and scales in play; the quizzes draw from it instead of rolling their own
  random roots. That's why the answer buttons can only ever offer qualities
  that really occur in your selection — pick harmonic minor and "diminished"
  appears; drop it and it goes.

- **A texture has to survive its own scale.** The dots were hand-stamped ink
  for a while (sixteen turbulence masks, no two alike). At 30 units across it
  never read as ink, only as noise. Flat saturated discs — transit-map dots —
  say more with less. Kept at the `ink-stamp-dots` tag.

- **A logo can carry an argument.** The mark is three dots — a triad, in the
  fretboard's own degree colours. Because degrees 1, 3 and 5 land on red,
  yellow and blue, the overlaps are the degrees in between: 1+3 = the 2's
  orange, 3+5 = the 4's green. The triad generates the steps between its own
  notes. The regions are painted with the real palette colours rather than
  produced with `mix-blend-mode: multiply` — a blend mode approximates the
  idea, clipped fills state it.

- **The arrangement decides how much of the idea you can show.** Three equal
  circles in a LINE can never show the 1x5 overlap: if the outer two reach
  each other at all, that lens sits entirely inside the middle circle. Pull
  them apart to free it and the middle dot's own colour shrinks to a sliver
  instead. So the row shows five clean regions (1 2 3 4 5, ascending) and the
  Venn triangle shows seven — but the triangle's radial symmetry reads as a
  browser logo, so the row won.

- **Saturated ink can't overprint.** Real riso multiply on this palette gives
  #922e0d for 1x3 and a dead grey #272121 for 1x5 — multiply always heads for
  black. Inks solved backwards from the palette (#ff978b coral, #afce37
  chartreuse, #7ca1ff periwinkle) DO multiply into the right secondaries, and
  look properly riso, but then the three dots no longer match the fretboard.
  Either the singles are right or the overlaps are; not both.

- **A masthead is not a nameplate.** The centred title-and-moon header cost
  about a third of a phone screen on a tool you open to look at a neck. As a
  newspaper-style bar — mark, name, motto, theme switch, one hairline — the
  whole fretboard and its first TAB now sit above the fold.

- **Texture has a minimum size, and it's not about opacity.** Both failed
  attempts at inking the fretboard dots failed the same way: the noise was too
  FINE. A dot is 30 units across, so features below about 1 unit fall under a
  screen pixel and average out — you lose the texture and keep only dulled,
  greyed colour. Coarse noise (baseFrequency ~0.25, features a few units wide)
  reads as uneven ink at actual size. The other half of the lesson is what the
  noise is allowed to touch: the stamp CUT the dot's edge and looked chewed;
  the press only varies density inside it, and reads as printing.

- **`feComposite` clips a filter to its own artwork for free.** Laying grain
  over 126 dots as 126 filters would be 126 passes; one filter on the layer is
  one. `operator="arithmetic" k1="1"` multiplies alpha along with colour, so
  where the source is transparent the result is too — the grain lands on the
  ink and nowhere else, with no clip path to keep in sync.

- **Overprint runs opposite ways in the two worlds.** The mark's overlaps are
  its secondaries pushed a third of the way toward what a press would really
  have produced. On paper that's toward MULTIPLY — ink over ink darkens. At
  night the inks are light, so it's toward SCREEN — light over light
  brightens. Darkening the overlaps on a dark ground read as holes punched in
  the mark. Same rule, mirrored: `--mark-2/4/6/7` in index.css, one set per
  theme, and setting them back to their `--deg-` twins returns flat painted
  overlaps.

- **A control that hides most of the answer shouldn't exist.** Inversions used
  to make you pick a string set and then showed that one set climbing the neck
  — so the thing you most want to compare, the same inversion on different
  string sets, was the one thing you could never see. The sets are now the
  page's structure: one block each, every inversion inside it, all of it on
  screen. Twelve voicings either way.

- **Close voicings and seventh chords don't get along on a guitar, and that is
  the lesson.** Checked against the placement engine rather than guessed: every
  triad fits all three inversions on all four adjacent string sets, but a
  close-voiced seventh only fits on A D G B. Drop 2 gives the full grid —
  E A D G, A D G B, D G B E, four inversions each. So the default structure is
  Close for triads and DROP 2 for sevenths, which is also just what guitarists
  actually play. Short blocks are still shown, labelled "2 of 4": a set that
  takes only one inversion is a real place to play, and hiding it would quietly
  delete part of the neck.

- **Colour follows gravity.** A dot's colour is its role relative to a centre,
  and which centre depends on what's framed. GRAVITY: All frames the key, so a
  note's colour is its SCALE degree — in C major, D is the 2nd, orange,
  whichever chord it turns up in. GRAVITY: ii moves the centre to that chord,
  and D becomes its root, red. Chord placements arrive labelled relative to
  their own chord, which is right when a chord is the centre and wrong when the
  key is — hence `relabelByScale` in theory/scale.ts. Without it every chord in
  a chord scale came out red-yellow-blue and the harmony's movement through the
  key was invisible. The colour key in the bar reads from the same centre, or
  it would quietly lie.

- **The same question shouldn't be asked twice.** Harmony had a Chord scale /
  Inversions toggle sitting under a GRAVITY row that already decided it (All =
  the whole key, one degree = one chord). Two controls for one fact means they
  can disagree, and then the page is wrong in a way no one can see. Derived it
  instead.


- **Measure the palette, don't squint at it.** "The orange and yellow are very
  close" at night measured as ΔE 16 in CIELAB — and the same check found a
  worse pair nobody had noticed, indigo and violet at 12 (about 20 is where
  two swatches stop being confusable). The fix wasn't new hues but more of the
  hue circle: ROYGBIV crowds both ends, red-to-yellow and blue-to-violet, so
  those runs got opened up. Maximising separation outright produces neon —
  capping chroma at 33 keeps it riso and still lands every neighbouring pair at
  26 or better.

- **The label flips with the ground.** Paper has dark dots and light labels.
  Night has LIGHT dots on a dark page, so it needs dark labels — but it had
  inherited the paper rule unchanged, printing light text on light dots at
  about 2:1. Whenever a theme inverts, check the things sitting ON the inverted
  thing, not just the thing itself.

- **`overflow: hidden` kills `position: sticky`.** The workbench wants clipped
  corners and holds a floating neck; you cannot have both from the same
  element. Children square off their own corners instead.

- **One measure, one place.** Harmony's Type / Voicing / Inversion used to live
  inside the ladders under their own headings, so the page had two things that
  looked like controls: the CONTROLS panel, and then more controls further
  down. They're rows at the end of the panel now, shown only in Harmony, and
  both ladders read the same values so neither can drift from the other.
  INVERSION is the one that comes and goes: with GRAVITY on a single degree the
  page already lays out every inversion, so there's nothing left to choose.

- **Order cells the way a musician looks for them.** The inversion cells are
  ordered by the note in the BASS — root, 3rd, 5th, 7th. Ordering by inversion
  NUMBER is identical for close voicings, where the two agree, but a drop 2
  lists them 5th, 7th, root, 3rd, which reads like a bug.

- **If colour means something, the chrome can't use colour.** Each hue on this
  page is a scale degree — so an accent that is also a hue is a second,
  contradictory colour language. Measured, the terracotta accent sat 14 ΔE from
  the 1st degree's red and the amber night accent 15 from the 2nd degree's
  orange: nearer than most degrees are to each other, so "this is selected" and
  "this is the 2nd" looked the same. The accent is neutral ink now (chroma
  under 8) and emphasis comes from contrast and weight. The seven degrees own
  the colour.

- **"Best grip per register" and "every string set" are different questions.**
  `leastStretchPerRegister` answers the first: a drop 3 from the low E can skip
  the A or stretch up it, keep the better one. Right when the neck is the whole
  answer — and wrong for a page whose sections ARE the string sets, because it
  deletes the loser and the voicing looks like it doesn't exist there. Hence
  `placeVoicingByStringSet`: one shape per SET, not per register.

- **One span limit was doing two jobs.** MAX_SPAN of 4 frets meant "comfortable"
  AND "possible", so real voicings were being quietly declared nonexistent: a
  close ii7 in root position wants five frets across E A D G, so it vanished
  from that set while the Imaj7 — which happens to want four — stayed, and the
  string set flickered in and out chord by chord. Now REACH_SPAN (6) says what
  a hand can do, MAX_SPAN says what it enjoys, and anything between is shown
  and labelled "a stretch". The reach applies to CONTIGUOUS sets only: a
  skipped string exists to make a wide voicing comfortable, and allowing
  stretches there let close triads sprawl onto skipped strings.

- **Some of this really is impossible, and the engine was right.** Close
  seventh chords in inversion still won't fit E A D G: Cmaj7 with the 3rd in
  the bass would need frets 0, 10, 9, 5 — a ten-fret span. Two string sets is
  the true answer there, not three.


- **Two marks in one box read as two designs.** The CONTROLS panel used a rule
  under the word for pick-one rows and a dot before it for pick-many, which was
  a principled distinction and looked like an accident. Everything wears a dot
  now, lit like an indicator lamp. The one/many distinction survives in the row
  rather than the mark — a pick-one row never has two lit — and if that ever
  proves too subtle, the fix is a rounded square for pick-many against the
  round dot, which people read without being taught.

- **A dot has no width to argue about.** The selection rule had to decide how
  wide to be and both answers were wrong: hugging gave "I" a 6px stub, spanning
  the cell made the mark belong to the column instead of the word. Retiring the
  shape retired the problem.

- **Whatever holds the lamp must not clip.** `overflow: hidden` for text
  ellipsis, put on the box containing the dot, sliced the dot's glow off flat
  on one side. The CELL clips (so a long name can't spill into its neighbour)
  and the text truncates; the box between them, which holds the mark, never
  clips.

- **A reference you have to open is a reference you don't consult.** The scale's
  name sat in the gap above the neck and scrolled away; the colour key hid in a
  drawer behind a button. Both failed at the only moment they mattered — mid-
  phrase, having forgotten which key you're in. They're pinned to the floating
  neck now, which also fills the dead space between CONTROLS and the fretboard
  with the two things that were missing from it.

- **SVG paints in document order.** The constellation line ran across the faces
  of the dots in scale mode and under them in chord mode, because chord shapes
  draw their own notes inside the same group after the line, while scale mode
  drew the whole note layer first. One order for both: shapes, then notes.

- **Deleting CSS by scanning to the next comment deletes more than you meant.**
  Pruning the retired Key button took `.sitebar__mark` and `.sitebar__name` with
  it — the mark blew up to 425px and the bar collapsed. Delete rules by name.

- **A rule can lose to itself.** The dots wouldn't centre against the scale
  name, and the cause was `margin: 0` and `margin: 0 0 14px` in the SAME
  `.legend` block — an old declaration left below my new one, so the later
  won. Half of that 14px was exactly the 7px the dots were riding high by. When
  a change appears to do nothing, read the whole rule, not the line you edited.

- **Match the type to what it sits next to.** The colour key prints its numbers
  at 11px on a 19px disc; the neck was printing 13px on a 30px dot, which is
  proportionally much smaller. The key was easier to read than the instrument
  it explains. Same ratio (~0.58 of the dot) and same weight fixes it.

- **Change a colour, re-check what sits on it.** The 2 carried dark text,
  chosen when the orange was #c47a1e and dark clearly won. Adopting the pressed
  palette darkened the orange and nobody re-checked: 3.83 dark against 3.89
  light is a coin flip, which is exactly why it read badly whichever way you
  called it. A palette change is a contrast change.

- **A margin mark only works one-per-line.** The selected bar in the left
  margin reads correctly for scale positions, which stack full width. In the
  chord grid, where cards sit several to a line, the bar lands in the gutter
  BETWEEN two cards and touches the one before the one it means. Marks that
  live outside a thing need the thing to own its whole line; otherwise put the
  mark inside it. The chord cards use the lamp in front of the name, with its
  space reserved whether lit or not so selecting doesn't nudge the row.

- **Number a list AFTER you sort it.** The inversion grid assigned each row an
  index, then sorted the rows by fret, then built the fretboard's array from
  the sorted rows — so a card's index pointed at whatever shape used to be in
  that slot. On the D G B E strings, clicking "7th in bass" lit root position.
  Nothing on screen looked wrong; both halves were individually plausible. The
  fix is structural: a row's index IS its position in the array the fretboard
  is handed, taken from that array. theory/agree.ts then checks it out loud in
  development, because this class of bug is invisible by construction.

- **Group by what stays the same.** Grouping voicings by exact string set
  shattered open triads into seven blocks, several holding one chord — because
  which string an open voicing skips depends on the inversion. Grouping by
  REGISTER (the string it starts from) keeps the voicing whole: three or four
  blocks, each holding every inversion playable from that string. For close and
  drop-2 grips, register and string set are the same thing, so nothing changes
  there.

- **A skipped string has to earn its place.** Offering every physically
  playable set gave a drop 2 five of them, three being awkward novelties. One
  grip per register, least stretch, with a fret-and-a-half penalty on skipping
  a string: enough that a drop 3 (which turns a six-fret stretch into a
  one-fret grab) still wins, and a drop 2 never does.

- **Global class names are a shared namespace.** The new staff renderer took
  the class `.staff` — which the Song score already owned, and had set to
  `position: absolute`. The SVG left the flow and printed itself across the TAB
  below, which looked exactly like a layout bug in the new file. Half an hour
  went into the wrong file. Grep for a class name before claiming it.

- **A staff is what our Note already is.** `letter + octave` IS a staff
  position — that's the whole reason the app stores spelling rather than pitch
  classes, and it means a notation library would convert our notes into its own
  format only to convert them back into the positions we started with. VexFlow
  earns its keep on rhythm, beaming and voices; for note heads on lines this is
  150 lines and no dependency. (The clef glyph does need a real music font:
  system fonts don't reliably carry the Musical Symbols block, so Noto Music
  comes from the Google Fonts link that was already there.)

- **A presentation attribute is not a CSS property.** `transform="translate(x y)"`
  and `style="transform: translate(Xpx, Ypx)"` look identical in the DOM and
  behave differently: a CSS transition animates the property and ignores the
  attribute, so setting the attribute just teleports. That one distinction is
  the whole difference between the pattern sliding along the neck and it
  jumping.

- **What makes a dot "the same dot" decides which way it moves.** Keyed by
  string + degree + WHICH occurrence up the neck, a key change maps each note
  to its nearest cousin automatically — C to A slides the low root three frets
  down rather than nine frets up, without anyone computing a direction, because
  both lists are in fret order and matching by position matches by proximity.
  Notes with no cousin (they were below the nut) fade in where they land.

- **Two staves are one system, or they're two pictures.** The staff and the TAB
  now share a width, a left column, and a bar line that runs from the staff's
  top line through the gap to the TAB's last string — which is how notation and
  tablature are set together on paper. The gap belongs to the staff's own box,
  so the line can be drawn through it and meet the TAB's half.


- **Know what the hard part actually is.** Drawing note heads on five lines is
  easy, and the hand-rolled staff did it fine. What isn't easy is everything
  around them: a TAB staff ruled at the right spacing with T A B in the margin,
  a connector spanning both staves, accidentals placed so they don't collide.
  That's engraving convention, and VexFlow has all of it — including `TabStave`
  and `StaveConnector`, which are exactly the two things the hand-rolled
  version was faking. The right question wasn't "can I draw this" but "how much
  of a discipline am I about to re-derive by eye".

- **Recolouring a drawing library means knowing how it draws.** Forcing
  everything in VexFlow's SVG to `currentColor` broke it twice: the little
  rectangles BEHIND fret numbers are meant to be the page (filling them with
  ink turned every number into a black block), and the staff lines are stroked
  paths with `fill="none"` (filling them does nothing, and removing their
  stroke erased both staves). Fill for shapes, stroke for rules, page colour
  for the gaps things are punched out of.

- **A chord and a scale are the same object.** `render/System.tsx` takes
  EVENTS — a list of moments, each holding the notes sounding at it. A voicing
  is one moment of four notes; a scale run is thirty-five moments of one. The
  drawing is identical; only what you hand it differs. Splitting them into two
  components would have duplicated the stave, the connector and the string
  numbering for no gain.

- **Format the two staves together or they drift.** VexFlow aligns a note with
  its fret number only if the notation voice and the tab voice go through one
  Formatter. Formatting them separately looks fine for a chord (one column) and
  falls apart across a run.

- **Scaling a drawing down shrinks everything in it.** The scale runs were
  engraved at 860 units and displayed in a 680px row, so at 79% the staff
  lines, note heads and fret numbers all came down with it — legible on paper,
  tiny on screen. A system with no fixed width now MEASURES its container and
  draws at that size, so a staff line is a staff line. The first measurement
  has to be synchronous (a layout effect), because ResizeObserver only delivers
  at the end of a rendered frame and never fires at all in a hidden tab.


- **A refactor nobody has to notice is one that can't break what it touches.**
  Collapsing a dozen `useState`s into one `ModuleState` could have meant
  rewriting forty-three call sites. Instead the individual names are read back
  out of the object and the setters put values back in, so every control still
  calls `setDegree(3)` exactly as before, and the diff is one block at the top
  of the component rather than scattered through it.

- **Not everything a component remembers belongs in its state object.** Which
  fret you last clicked is about the current gesture, not about what the panel
  is SET to — so it stayed a separate `useState`. A preset that restored a
  half-finished interaction would be restoring the wrong thing.


- **A global `querySelector` is a bug waiting for a second instance.** The
  scroll-focus hook found the floating neck with
  `document.querySelector('.neckpanel')`, which was correct exactly as long as
  there was one module. With two, the right-hand list measured the left-hand
  neck. It walks up from a card to its own `.module` now — which also meant the
  module needed to be a real element rather than a fragment, so there was
  something to walk up to.

- **Beams have to exist before the notes are drawn.** `Beam.generateBeams` is
  what tells a note it belongs to a beam; a note that doesn't know draws its own
  flag. Generating beams AFTER `voice.draw` gave a scale run thirty-five flags
  with seventeen beams laid over them, and the flags pointed whichever way an
  unbeamed stem would go — which is exactly the "mixed up" look. Also: the
  default grouping is twos, which for a run draws a row of dashes. Fours is how
  a scale is written and counted.

- **The same careless prune bit twice.** Deleting CSS by scanning from a
  comment to the next one took `.page--wide` with it, and the whole app had
  been rendering at 760px instead of 1040 — every "this feels cramped" since
  then was that. It ate `.sitebar__mark` the first time. Delete rules by name.


- **Scroll events don't bubble, but they can be captured.** With two modules
  each scrolling in its own box, a plain `window` scroll listener only ever
  hears the page. `addEventListener('scroll', fn, { capture: true })` on the
  window catches scrolls from any element — one listener, no walking up the
  tree looking for whichever ancestor happens to be scrollable.


- **Matching everything beats matching some of it neatly.** The note-matching
  scored alignments by average distance with a small penalty per note left
  over, so it would happily abandon a note to save a few frets of travel on the
  rest — and a quarter of the neck appeared instead of sliding. Scored
  lexicographically (fewest left over first, THEN least movement) it drops to
  one note per string, all of them at the nut where new material genuinely
  enters. When a cost function trades off two things, check it isn't selling
  the important one cheaply.

- **Watch WHERE, not how many.** "Six notes appeared" sounds wrong until you
  see all six are at fret 0. Moving up a key, every string gains a note at the
  nut and there is nothing for it to slide from; moving down, the same thing
  happens at the far end. The count was never the measure — the position was.

- **Not every change is a move.** Changing GRAVITY inside a key leaves every
  note exactly where it is and renumbers them — C major and D dorian are the
  same seven pitches. Matching by degree couldn't see that (every degree
  changed, so nothing matched) and a page where nothing moved dissolved and
  reassembled. When the set of PLACES is unchanged, notes are matched by place
  instead: same element, same spot, new colour and letter.

- **Whichever path you took, record the result the same way.** The by-place
  path first carried the old degree groups forward untouched — but the notes
  had just been renumbered, so the NEXT key change matched against degrees that
  no longer existed and the whole neck appeared at once. Both paths now end by
  writing down where everything landed under the labels it has now.

- **Group by the degree NUMBER, not its name.** Major to harmonic minor turns
  the 3 into a ♭3 and the 6 into a ♭6. Keyed by the full name those are
  different notes and the neck dissolves; keyed by the number they're the same
  finger moving one fret, which is the single most worth-watching movement the
  thing does.

- **Only some of an SVG can be animated, and geometry isn't it.** A polyline's
  `points` can't be transitioned, and SVG line geometry (`x1`, `y1`…) isn't a
  CSS property in browsers either — `getComputedStyle(line).x1` comes back
  empty. What IS animatable everywhere is `transform`. So the constellation is
  one line per pair, each a single unit long, placed by
  `translate + rotate + scale`: start on its dot, angle swings, length
  stretches, all interpolating as one property. `vector-effect:
  non-scaling-stroke` keeps the sideways scale from thinning the stroke.

- **Everything drawn has to go through the same matcher.** Scales draw their
  notes from `highlights`, Harmony draws them from `shapes` — and only the
  first was being matched, so chord views dissolved while scale views slid.
  With a set focused you could watch both behaviours at once, which is exactly
  what "the faded dots do one thing and the non-faded dots do another" was.
