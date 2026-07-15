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
