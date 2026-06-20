# BACKLOG.md — triaged feature plan

How to read this: features are grouped by **when**, not just **what**. The rule
from [CLAUDE.md](CLAUDE.md) holds — most arrive as DATA + small pure functions on
the existing engine, not as rearchitecting. Each item notes roughly where it
plugs into the layers (`data → theory → render → audio → ui`).

**Where we are now (built & live):** two top-level areas —
**Study** (Scales as position boxes / modes; Harmony = diatonic chords with Roman
numerals; chord voicings as constellations + TAB across all string sets) and
**Song** (lead-sheet score: chords in bars with rhythm, drag-resize, line-wrap,
tempo, playback; the GPS "possibility" reveal that narrows as you add chords;
auto voice-leading from an anchor; the TAB staff integrated under the chords).
Everything below is the forward plan.

---

## Quick wins / near-term polish (small, do soon)

- ~~**Rename the two areas to "Possibility" & "Play"**~~ (done).
- ~~**Copy:** "Over Fm — 9 keys" → **"Fm exists in 9 keys"**~~ (done).
- ~~**Never show a blank voicing.**~~ (done — `placeVoicingAll` last-resort pass +
  ChordExplorer "wide stretch — try Drop 2/3" disclaimer.)
- ~~**Flexible time signature** in Song~~ (done — typed numerator + `/` dropdown).
- ~~**Unify the TAB look** between Study and Song~~ (done — plain numbers on light
  string lines in both).

---

## Study / "Possibility" — restructure & additions

### Roman numerals as the top-level degree selector

Lift the Roman numeral / scale-degree above the Scale-vs-Harmony choice, so it
**stays selected when you switch** between them. Then:
- In **Scale**, the Roman numeral selects the **mode** (e.g. picking `5` gives
  Mixolydian) — replacing today's separate scale-type-then-mode controls. The
  bottom TAB then explores the **positions** of that mode.
- In **Harmony**, it selects the **chord degree** in the chord-scale (as now).

### Click a note → the scale/mode from that degree, in position

Instead of the 3nps-vs-positional rules and exceptions, let the user **click any
note on the neck** and generate the scale/mode starting on that **degree**, in
the appropriate position. Bonus: see **all the places a mode lives** (e.g. every
Mixolydian box) by clicking `5` anywhere. Still honour the "first string starts
with 2 or 3 notes" idea — that choice sets which position the whole shape lands
in (3-on-first-string sits at/above the first note's fret; 2-on-first-string sits
a little below).

**Add the diatonic chord from a Scales degree.** Same family: in the Scales view,
clicking a scale degree/note should offer to **Add the diatonic chord built on
that degree** to Play (the chord-on-a-degree machinery already exists in Harmony
via `diatonicChords`). Today "Add to Play" lives only in the Harmony sub-mode
because that's the view with a single selected chord; this brings the same Add
affordance to Scales once notes are individually selectable. Its own step.

### Positional fingering, refined

In positional mode you still can't skip scale notes, but rather than 3 notes on
the low E, the **3rd note moves to the A string**, continuing 2–3 per string and
generally staying in one position. (Refine `positionalBoxes`.)

### String sets are a first-class choice

Let the user choose the **string set** for any chord voicing — a key step,
including in Voice Leading. Also a **"whole chord scale" button** next to the
Harmony Roman numerals that lays out the entire chord-scale (chord by chord, all
string sets); you can still then pick inversion / voicing per chord.

### Horizontal TAB for scales & patterns

Chords read vertically (stacked); **scales/arpeggios/patterns should read
horizontally**, note by note, like a sheet of music — **ascending**, with options
for **descending**, octave/position shifts (Jon Gordon's "every scale up & down,
two octaves, every key"). Then the **Add +** button can drop a scale/pattern into
Song as a practice exercise.

### More voicing shapes

**Barre chords, open chords, fuller 6-string guitar-specific shapes/voicings** —
added as voicing data + placement.

### Smaller display options

- **Finger numbers** on the fretboard (alongside scale degrees / note names /
  open strings).

---

## Song / "Play" — remaining build

### Add chords (and other units) from Study; persistent songs

- ~~**Add + from Study**~~ (done for Harmony) — the song state now lives in App and
  persists across area switches; a "+ Add <chord> to Play" button in Possibility's
  Harmony view appends the selected diatonic chord. Still to come: the same Add
  from the **Scales** view (see Possibility → "click a note" above), and full
  **per-chord manual voicing** via the Study expansion.
- **Multiple songs / songbooks & setlists** — hold many charts; (later) sync with
  Spotify / Apple Music playlists to auto-generate a song or find a chart for it.

### Per-bar UNIT type

A bar can hold not just a chord but a **Scale / Arpeggio / Interval-Pattern /
Phrase / Harmony**, and the Song view plays the chosen unit per bar. So a "song"
could be an **arpeggio exercise that shifts keys**, or an interval exercise. Ties
directly to the palta generator (item A).

### Text chord entry & paste import

- ~~**type its name** (e.g. "F-7"), with recognition~~ (done — a "Type a chord"
  field sets the selected chord; `theory/chordParser.ts`).
- ~~**Paste a text progression** … read it into bars; a `,` or `|` denotes a bar
  line.~~ (done — Replace / Append; bars split on `|` `,` newline, chords in a bar
  share its beats.)
- Still to come: **filter-search/autocomplete** as you type; richer qualities
  (6ths, 9/11/13, slash bass) once that chord data exists.

### Playback / transport

- ~~**Play → Pause** toggle; a **playhead** (vertical scrub line) on the current
  beat.~~ (done — `startPlayback` transport + a playhead animated off the audio
  clock that rewinds at the end.)
- ~~**Metronome** option, and a **mute toggle for chord audio**~~ (done — a click
  per beat accented on the downbeat; Mute sends an empty chord list so the
  playhead + metronome still run.)
- ~~**click-to-scrub / set the playhead** by clicking the score, and a
  **count-in**.~~ (done — the playhead doubles as a cursor: click to place, Play
  starts there, Pause resumes; one-bar Count-in toggle.)

### Rhythm, refined

- **Rests / pickups**, finer **tuplets** / subdivisions.
- **Sections** (A / B / intro, repeats, endings, codas) — the `Section` type is
  seeded for this.

### Voice leading, refined

For guitar/ukulele specifically (not piano), prefer staying in the **same string
set / same position**, keeping as many notes the same / the **shortest distance**.
(Tighten `voiceLeadDistance` with a string-set/position bias.)

### Heat map of harmonic possibilities

A visual **heat map** over the reveal that highlights which harmonic choices are
most crucial to the flow of the song (vs interchangeable). Extends the GPS reveal.

---

## v1.x generators (clean extensions of the engine)

### A. Interval + direction melodic sequences ("paltas")

Set a **series of notes** by repeating a pattern of **interval + direction**
through a scale (e.g. `↑3 ↑2`, or `↓4 ↓2 ↑4 ↓2`). Key insight: a **scale is `↑2`
repeated**, an **arpeggio is `↑3` repeated** — special cases of one generator.

- **data:** a `Sequence` = ordered `{ interval (scale-degrees), direction }` steps
  + a starting degree.
- **theory:** `(root, scale, sequence) → ordered PlacedNote[]`.
- **render/audio/ui:** reuse the fretboard + `playSequence`. Feeds the Song
  per-bar "unit type" above, and the horizontal scale/pattern TAB.

### B. Interval-pairing chord voicings (Vic Juris)

Build voicings by stacking a **specified interval set through the scale** (e.g.
`4th–2nd–6th` on each degree), not tertian thirds. A "voicing recipe" → gather
tones → reuse `placeVoicingAll`.

### Tasteful instrument voices

A few rich default sounds (the current one is a plain triangle synth). The audio
seam (`playNote`/`playChord`/`playSequence`) already isolates this — swap-in work.

### Shuffle / Randomize for practice

A randomise button for the fretboard + TABs within chosen filters (keys,
chord/scale types, intervals, voicings), to discover a new set. Shares its filter
model with ear training.

---

## Import / DAW

- **iReal Pro import** — parse charts (title, key, time sig, measures,
  repeats/endings) into the `Progression` model. Big public library of standards.
- **MIDI export / import** — write/read Standard MIDI Files (the model carries
  timing); edit imported progressions.
- **Ableton Live bridge** — pair directly via Ableton's JavaScript Extensions SDK
  (https://www.ableton.com/en/live/extensions) — a bridge / VST-like interface.

---

## Later (v2) — analysis, practice & expression

- **Identify a voicing (reverse lookup)** — import/enter a custom voicing (MIDI or
  sheet) and have the app name which chords/scales/interval-pairings it matches,
  via the same fingerprint matcher `theory/harmony.ts` already uses.
- **Ear training** — quiz any unit (chord/voicing/interval/arpeggio/scale): "what
  was that?" with difficulty filters (always triads in root position; always F in
  F major; key/voicing/chord/scale/interval sets). Shares the Shuffle filter model.
- **Negative harmony** — set an axis, reflect notes/chords/progressions to their
  Levy counterpart; then re-spell and re-voice.
- **Search → practice** — search any chord/scale/voicing/concept and jump there,
  set up to practise.
- **Annotations, tags & emotional tagging** — text tags on chords/voicings/etc.,
  including **mood/emotion** associations ("this chord feels like blue"), to build
  personal associations. Needs per-user storage.

---

## AI / ML (v3) — a small, mostly-local layer

- **Weakness detection** — a lightweight local model reads ear-training results,
  finds weak spots, tailors the practice.
- **Mood / tagging assistance** — help generate or find mood associations for
  chords (Spotify-audio-features style), feeding the emotional tagging above.
- **Audio-to-chord detection** — listen to an audio file and write out its chord
  progression. Plus **live** input (mic / live MIDI) with live suggestions.

---

## Personalization & accounts (v2+)

User accounts so preferences and annotations persist: **fingering style** (3nps
vs positional/varied), **preferred note position** when a note has several spots,
saved tags/comments, and personal **songbooks/setlists**.

---

## Content & guided experience

- **Soundscapes / guided practices** — pre-recorded, especially contemplative ones
  to *open* a session.
- **Songbooks** — encourage songwriters/producers to release a songbook alongside
  a release.
- **Bridge to Archive** (Stu's earlier app) — connect voice memos, project audio,
  voice notes, lyrics. Likely a late step.

---

## Onboarding & user flows (important UX direction)

As-is, the app is **overwhelming for an average user** — too much at once. Design
around **user types and user flows**, and consider a **course-style progressive
disclosure**: reveal sounds/possibilities gradually, in increasing complexity,
rather than every option at once. This is the "living textbook" pedagogy applied
to the product shell, and should shape how features are surfaced.

---

## Aesthetic / theming (the "living art book")

- Switchable **colour palettes** — five elements; bold pairings; gradients;
  analogue-film filters. The app themes from CSS variables, so a palette is a
  named set of values.
- An **analog / craft-paper** look for page and text.
- **Constellations + bioluminescence**; rainbow light refracting onto paper.
- Coffee-table-art-book quality: typography, sizing, colour pairings. (Pairs with
  the Session 6 polish pass.)

---

## Other cultures & systems (v3+)

Raga Sangeet (characteristic phrases; translate notes into **SARGAM** for
vocalists), Barry Harris' bebop theory, and more — as data + theory modules
beside the Western defaults.

---

## Data backlog (no new engine code)

- **Scales/modes:** ~~harmonic minor, melodic minor, harmonic major~~ (done) —
  remaining: diminished, augmented/whole-tone, bebop scales, and their modes.
- **Chord qualities:** ~~augmented, dim7, m(maj7), maj7♯5~~ (done) — remaining:
  6ths, 9/11/13 extensions, altered dominants.
- Slash chords.
- **Instruments/tunings:** alternate tunings (drop-D, DADGAD), ukulele — the
  engine is already instrument/tuning-agnostic.

---

## Business / launch (non-engineering)

- **Protect the IP** before any public offering.
- Define the **distribution strategy**.

---

## Design note — open Roman numerals ↔ the GPS reveal

A chord's Roman numeral should stay **open** (a `Dm7` is `ii/iii/vi…` depending on
key center) — the same idea as the GPS reveal: fewer fixed commitments = larger
possibility space, each commitment narrows it. The progression's "function" layer
(`ChordRef.romanNumerals[]`) holds a *set* of interpretations, sharing machinery
with the reveal. This also motivates lifting the Roman numeral to a top-level
selector in Study (above).
