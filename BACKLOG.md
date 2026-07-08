# BACKLOG.md — triaged feature plan

How to read this: features are grouped by **when**, not just **what**. The rule
from [CLAUDE.md](CLAUDE.md) holds — most arrive as DATA + small pure functions on
the existing engine, not as rearchitecting. Each item notes roughly where it
plugs into the layers (`data → theory → render → audio → ui`).

**Where we are now (built & live, 2026-07):** three areas. **Possibility**
(scales/modes in three fingering systems with click-to-re-root; Harmony's three
explore axes — one chord / chord scale ladder / inversions ladder — with bass-note
labels and string sets), **Play** (songbook + per-song meter; text/paste/bass-first
entry; full transport with playhead, scrub, count-in, metronome; the FUNCTION
ENGINE live everywhere — Context strip key hypotheses, function labels drawn on the
bars, the tolerant reveal, the bass-first heat map; slash chords; auto
voice-leading), and **Ear Training** (chord-quality quiz + the FUNCTION quiz).
Plus the design passes (global Labels, grouped transport, text-first editing, the
segmented-track control grammar). Arc 1 is essentially DONE; Arc 2 is half done
(the function quiz shipped ahead of dictation/inversions).

## The road ahead — five arcs (the working structure)

Ordered by what unlocks what. The key dependency: **Arc 1's function/ranking
engine is the substrate** for the heat maps, the Context strip, AND ear training's
function layer — build once, reuse everywhere.

1. **The function engine & heat maps** ← CURRENT. `theory` module ranking a
   chord's interpretations by harmonic distance (diatonic → inversion → secondary
   dominant → borrowed → related keys), on `keysContaining`. Then: **bass-first
   input → chord-suggestion heat map** (Stu's songwriting/transcription flow);
   the **Context strip**; slash-chord + extension data. *Includes the palette
   FOUNDATION: the heat ramp is the first real aesthetic token, designed to keep.*
2. **Ear training, deepened** — inversions + parameter panel → progression
   dictation (bass motion + quality) → the function quiz (rides Arc 1).
3. **The practice loop** — per-bar unit types + the palta/sequence generator;
   add scales/patterns from Possibility to Play; Loop / Play-along intents;
   practice-card skeleton.
4. **Sound & song fidelity** — a tasteful instrument voice; sections/repeats;
   rests/tuplets; voice-leading same-string-set bias; per-chord manual voicing.
5. **Reach** — import (iReal/MIDI/Ableton), accounts & saved prefs, the FULL
   art-book identity pass (after the IA settles — its foundation lands in Arc 1),
   ukulele/alt tunings, other cultures, IP/distribution.

---

## Next-session briefs (handoff, written 2026-07-06)

Self-contained specs for the next sessions — the design decisions are already
made (or explicitly flagged as Stu's call). Pick ONE per session, verify in the
browser, ship, and update this section. General method: probe theory with a tiny
`npx tsx` script at the repo root (relative imports need it there; delete after);
verify UI with the preview tools — note the preview resets to the Possibility
area on reload, so drive each check in ONE self-contained eval (navigate → act →
read), find the visible area via the non-`hidden` child of `.page`, and set
textarea values via the native setter + `input` event.

### ~~Brief A — persist songs & settings~~ (WITHDRAWN — already built)
This brief was written on a stale assumption: songbook persistence already
ships (`method.songbook.v1` in `App.tsx` — songs, meters, tempos, names, open
song id; versioned key, normalize-on-load, id-counter advance). The only
session-only display state is the global Labels toggle — persist it if it ever
annoys Stu, not before.

### ~~Brief B — borrowed chords in the Function quiz pool~~ (done — session 9b)
A third pool row "Borrowed" (iv7, ♭VImaj7, ♭VII7 from the parallel minor,
default OFF); `parallelMinorOf` exported from `theory/suggest.ts` so quiz and
analysis share one derivation and one ♭-labelling convention.

### Brief C — dominant families, part 2 (NEEDS STU: theory calls first)
`interpretInKey` now reads diatonic → V7/x → borrowed → subV7/x, so every dom7
root gets SOME reading in a major key. Open expert calls before coding more:
(1) blues dominants — F7 in C currently reads subV7/iii; a blues IV7 label may
serve teaching better (and I7 for C7 instead of V7/IV when it's the tonic
sound); (2) minor keys — mostly sane (probed: ii7/V7/subV7 fine in C melodic
minor) but A♭maj7 in C harmonic minor reads "VImaj7" (♭VImaj7?) and B♭7 reads
"V7/III+" (tonicizing an augmented chord — musically odd; suppress?); (3) the
diminished-scale m3 dominant family and M3-approach labels. Ask Stu in-lesson,
then implement as more steps in `interpretInKey`.

### Brief D — unify the Possibility/Play TAB look (quick win, visual)
The score's TAB staff in Play and the TabView cards in Possibility use different
spacing/typography. Extract shared CSS values (string gap, fret-number font)
into variables in `index.css` and align. Screenshot both before/after.

Known-and-intended (don't "fix"): the Context strip counts keys explaining the
whole song; the reveal counts the SELECTED chord's home keys that survive — the
reveal set is a subset, so the numbers legitimately differ. The reveal's strict
`keysContainingAll` is retired; don't reintroduce it.

---

## Ear training — reverse-engineering (CORE, not a v2 nicety)

The front door to the whole teaching loop: *hear a song you love → name what it's
doing → see everything else it could have been → use that as a constraint to write
and improvise.* Reverse-engineering by ear is the way **in**; the possibility space
is what you do once you're in. Stu flags this as essential, not optional.

**The framing: ear training is the "Analyze" step run in reverse.** Normal Analyze
takes chords IN and reveals key / roman numerals / candidates. Ear training plays
the chords and the user PRODUCES the analysis; the engine checks them. Same engine,
input ↔ output flipped. The Context strip (the search engine made visible, see
[DESIGN.md](DESIGN.md)) becomes a quiz: predict what narrows when the next chord
lands, instead of watching it narrow.

**The skill is layered** (isolate any layer, or stack into full progression dictation):
- **Bass note / root motion** — the foundation (4ths? down a step?).
- **Chord quality** — maj / min / dom7 / m7♭5 / the colour.
- **Function / roman numeral** — *given a key*, is this IV, V, a secondary dominant,
  a borrowed ♭VII?
- **Colour tones** — the 9, ♯11, the note that says Lydian not Ionian.

**Reuses what's already built** — `diatonicChords` (roman numerals of a key),
`keysContaining` / the GPS reveal (the search), the audio player (chords, bass,
progressions), `chordParser` (read the guess). Mostly a NEW UI mode + a progression
generator, not new engine. Shares the **Shuffle filter** model (keys / qualities /
diatonic-only vs include-secondary-dominants / given-key vs find-the-key).

**Two faces, one engine:**
- **In-lesson (Lesson Mode)** — reverse-engineering a real progression live.
- **A quiz module / page (Studio Mode)** — the student narrows/widens the
  parameters (key, triad vs seventh, inversions, which qualities, …) and the app
  drills them. The Shuffle-filter model as a practice tool.

**Worry less about KEY — it simplifies the MVP.** First version drops the key
entirely: play a chord (or short progression), identify **quality + root/bass**
(and inversion when enabled). No key to commit to, no roman numerals yet — pure,
fully-parameterized chord recognition. Ships fast (audio player + chord data +
filters only). Then progressions (quality + root *motion*), then function on top.

**Beyond diatonic (the important part).** Real progressions tonicize and borrow —
**ii-V of IV, secondary dominants (V7/x), borrowed ♭VII, out-of-key chords.** So the
FUNCTION layer can't be purely diatonic (`diatonicChords` only knows the 7 in-key
chords). We recognize **local function units** (a ii-V heard as a gesture, wherever
it points) and **secondary dominants/tonicizations**, built on the GPS reveal
(`keysContaining` already knows a C7 lives in F's key → it's the V7/IV). This is
where the richest teaching lives, and it ties to the "open Roman numerals" note at
the bottom of this file. "Worry less about key" fits: hear the ii-V gesture and
where it points, don't force a global key label.

**Suggested layering:** (1) parameterized chord-recognition quiz (quality +
root/inversion, key-agnostic) → (2) progression dictation (quality + root motion) →
(3) function layer with secondary dominants & tonicizations on the GPS reveal.

**Dominant-substitution family (`interpretInKey`)** — a dom7 that fits no key is
usually a dominant on loan. DONE: secondary dominants V7/x, fifths-chains of them,
the backdoor ♭VII7 (as a borrowed chord), and the **tritone substitution** (subV7 /
subV7/x — a dom7 a half-step above its target). STILL TO ADD (Stu's fuller list):
the **diminished-scale minor-third family** (the four dom7s a m3 apart that share a
tritone/dim scale and can all sub for one V), the **major-third-approach** dominant
(e.g. E7 into C), and the **vii° chain link** (a secondary dominant that tonicizes
the diminished degree, which we currently skip). Then make these quizzable in Ear
Training's Function drill (a "Reaching further" pool tier).

~~**Step 1 — chord-QUALITY quiz**~~ (done — `ui/EarTrainingView.tsx`, a new top-level
area). Plays a chord on a random root; you name the quality; narrow/widen the
quality pool; immediate green/red feedback + running score.

~~**Step 3 — the FUNCTION quiz**~~ (done, MVP — `ui/FunctionQuizView.tsx`; Ear
Training now toggles Quality / Function). A random major key, four chords with the
I always first (the anchor); name chords 2–4 by function. Pool = "In key" (seven
diatonic sevenths) + "Reaching out" (secondary dominants V7/ii…V7/vi). Still to
come for the quiz module: **inversion** identification; **bass-line dictation**
(root motion, step 2 — partially subsumed but still worth isolating);
**borrowed chords** in the function pool (♭VI, iv…, riding `interpretInKey`);
minor keys; tempo/voicing options; and (later) quizzing REAL pasted progressions
instead of generated ones.

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

### Roman numerals as the top-level degree selector ✓ (done)

~~Lift the Roman numeral / scale-degree above the Scale-vs-Harmony choice, so it
stays selected when you switch.~~ Done (`theory/mode.ts` + StudyArea):
- In **Scale**, the Roman numeral selects the **mode** (picking `V` gives
  Mixolydian); the neck/TAB explore its positions. ✓
- In **Harmony**, it selects the **chord degree** (as before). ✓
- Persists across the Scales/Harmony switch. ✓
- Still to come: a **"whole chord scale" / all-positions** view, and a primary
  "Major" label at degree 0 instead of "Ionian" if that reads better.

### Click a note → the scale/mode from that degree, in position

Instead of the 3nps-vs-positional rules and exceptions, let the user **click any
note on the neck** and generate the scale/mode starting on that **degree**, in
the appropriate position. Bonus: see **all the places a mode lives** (e.g. every
Mixolydian box) by clicking `5` anywhere. Still honour the "first string starts
with 2 or 3 notes" idea — that choice sets which position the whole shape lands
in (3-on-first-string sits at/above the first note's fret; 2-on-first-string sits
a little below).

~~**Click a note → the mode from that degree, in position.**~~ (done — clicking any
note in the Scales view re-roots the mode to start there AND pins the position
that sits at the clicked fret; the degree selector follows.)
~~**See all the places a mode lives at once.**~~ (done — an "All positions" toggle
draws every box's constellation together.)

**Add the diatonic chord from a Scales degree.** Same family: in the Scales view,
clicking a scale degree/note should offer to **Add the diatonic chord built on
that degree** to Play (the chord-on-a-degree machinery already exists in Harmony
via `diatonicChords`). Now that notes are individually clickable (re-root), a
modifier/secondary action could add that degree's chord. Its own step.

### Positional fingering, refined ✓ (done)

~~In positional mode the 3rd low-E note moves to the A string, continuing 2–3 per
string in one position.~~ Done — `positionalBoxes` rewritten as a true in-position
scan (2 on the low E for most boxes). Also added a third system, `hybridBoxes`
(**Hybrid**: 2 on the low E, then 3 per string — a common learned blend), and
clarified the naming: **Positional = the 7-position system** (not CAGED).
Still open: a **CAGED** (5-shape) system; per-user **saved fingering preference**;
the open-position nuance (Positional keeps 3 on the low E there).

### String sets are a first-class choice

~~A **"whole chord scale"** view that lays out the entire chord-scale, chord by
chord, in one voicing on a chosen string set.~~ (done — `ui/ChordScaleLadder.tsx`;
Harmony toggles **This chord / Chord scale**; pick structure + bass + string set
and the seven diatonic chords climb the neck, playable.) String-set choice is a
first-class control there. ~~The **inversions ladder** (Stu's other axis — one
chord, all its inversions up the neck).~~ (done — `ui/InversionLadder.tsx`; Harmony
now toggles This chord / Chord scale / Inversions.) Still to come: string-set choice
in ChordExplorer + **Voice Leading**, and a multi-select of string sets to practice.

### Horizontal TAB for scales & patterns

~~Chords read vertically (stacked); scales/arpeggios/patterns should read
horizontally, note by note, ascending.~~ (done — `render/TabSequence.tsx`; each
scale position reads left-to-right like real TAB.) ~~a **descending** option~~ (done
— Ascending/Descending toggle reverses the TAB + playback). Still to come:
octave/position shifts (Jon Gordon's "every scale up & down, two octaves, every
key"), and then the **Add +** button dropping a scale/pattern into Play as a
practice exercise.

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
- ~~**Multiple songs / songbooks**~~ (done — named songs: switch tabs, + New song,
  inline rename, Delete; the open song feeds Play). ~~**persistence**~~ (done —
  saved to localStorage, survives reload) and ~~**per-song tempo/time-sig**~~ (done
  — each song carries its own meter). Still to come: setlists, accounts/cloud sync,
  and (later) Spotify / Apple Music playlist sync.

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

### Bass-first input → chord suggestions (a heat map) ✓ (MVP done)

~~Type in just the BASS NOTES; the engine suggests the chords that could sit over
each bass as a heat map from most obvious → least obvious, including inversions.~~
(done — `theory/suggest.ts` + Play's "Start from a bass line": dashed bass-only
bars that play as a bass line; candidate working keys from the whole line; ranked
suggestions with slash names + function labels (tier 0 diatonic root-in-bass,
tier 1 slash/inversion, tier 2 secondary dominants); click to fill the bar. The
heat ramp `--heat-0..3` is the first art-book palette token.)
~~A **borrowed-chords tier**~~ (done — tier 3, parallel minor derived via `modeAt`,
numerals labelled against the major key: ♭III/♭VI/♭VII). ~~Storing the chosen
inversion/bass on the chart~~ (done — `ChartChord.bassIndex`: committed slashes
like F/A survive into the label, playback and localStorage; "C/E" also parses from
text/paste). Still to come: **true slash chords** (bass as a NON-chord tone under
an upper structure), richer qualities (6ths/extensions data), the slash reaching
**voicing/voice-leading** (it's playback-only today), and re-ranking as bars
commit (committed chords should narrow the working keys — mind the open-numeral
subtlety: a committed V7/ii must NOT rule out its key).

### Heat map of harmonic possibilities

A visual **heat map** over the reveal that highlights which harmonic choices are
most crucial to the flow of the song (vs interchangeable). Extends the GPS reveal.
(Shares the ranking model with the bass-first flow above.)

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
  **(See the dedicated section below — Stu has flagged this as a core priority, not
  a v2 nicety.)**
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

**Secondary-dominant recognition IS the reveal, read inward (Stu's note).** The
Play-mode reveal already lists every key a chord could live in; "A7 lives in D's
key" is the same fact as "A7 is the V7 of ii there." So detecting secondary
dominants / tonicizations (for Analyze and ear-training's function layer) is mostly
*re-pointing `keysContaining`*, not a new engine — once you see the connection it's
not a crazy rebuild.
