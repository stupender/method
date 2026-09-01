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
3. **The practice loop** ← DONE (first full pass). **Loop** (gapless vamp),
   **Ramp** (+5 bpm each pass), per-bar units **chord | arpeggio | scale**
   (`theory/chordScale.ts`), **interval patterns / paltas** (a Pattern dial on
   arpeggio/scale bars — repeating chains of directed steps, `data/patterns.ts`
   + `theory/pattern.ts`; add a pattern = add a data line), and the
   **practice-card skeleton** (`ui/PracticeCards.tsx`). Plus the REAL palta
   generator in Possibility (Stu's spec): a **Patterns** mode — pair interval
   (3rds–7ths) × contour (↑↑/↑↓/↓↑/↓↓) × direction over any scale/mode
   (`theory/pairs.ts` + `ui/PatternExplorer.tsx`; the between-pair ANCHOR STEP
   is an explicit parameter). **Custom pairings shipped** (session 11d): a
   Custom segment opens the discovery space — typed CELL ("3 -2", "↓4 ↓2 ↑4",
   echoed back in words), the MARCH as a control (↑2nd…↓4th), an Alternate
   pill; and every run now travels ROOT TO ROOT, TWO OCTAVES OUT AND BACK
   (Stu's standard; the Direction track retired). **Pattern TAB shipped**
   (session 12): runs render as real tablature in playing order, placed by
   least-total-movement DP (`theory/placeRun.ts` — positions hold themselves,
   diagonal drift when the octaves demand it; the march clamps at the
   two-octave ceiling so everything fits a real neck). Next:
   send-a-pattern-to-Play (unify with the bar Pattern dial); Loop / Play-along
   as named presets; per-student card grouping (the Palette); pattern glyph on
   the bar; maybe a fingering preference (start position / string-set bias)
   for placed runs.
4. **Sound & song fidelity** — a tasteful instrument voice; sections/repeats;
   rests/tuplets; voice-leading same-string-set bias; per-chord manual voicing.
5. **Reach** — import (iReal/MIDI/Ableton), accounts & saved prefs, the FULL
   art-book identity pass (after the IA settles — its foundation lands in Arc 1),
   ukulele/alt tunings, other cultures, IP/distribution.

---

## The module idea (Stu, 2026-08-27) — and how it's being staged

A CONTROLS panel, its fretboard and its systems are ONE MODULE. You could have
two side by side, each set to something different, so that practising the move
from one set of triads to another is a single picture rather than two states
you flip between. A module's settings save as a preset. Far out, this is the
building block Play should have been made of.

Staged so each step is useful on its own and none of it is thrown away:

1. **The shape** — `ui/moduleState.ts` (DONE). One type describing everything a
   panel is set to. Nothing renders differently; this exists so that steps 2
   and 3 are additions rather than rewrites.
2. **Bookmarks** (DONE). Save a ModuleState, name it, come back to it. Useful
   today, and it means every preset ever saved already fits a module.
3. **The panel becomes a component that owns its state** (DONE). `StudyArea`
   is now `Module` and holds ONE `useState<ModuleState>`; the individual names
   are read back out of it and the setters put values back in, so every control
   in the file still calls `setDegree(3)` exactly as before. Saving and
   restoring a bookmark became one line each. Two `useState`s remain: the
   module's state, and which fret you last clicked — that one is about this
   moment rather than about what the panel is set to, so it stays out.
4. **Two of them** (DONE). The ⧉ in a panel's header adds a second beside it,
   opening as a COPY of the first — the useful move is "set one up, change one
   control". They share nothing: separate settings, separate necks, separate
   selections. Below 1100px they stack, because two fretboards side by side
   stop being readable. Held as a LIST, so three, or a saved arrangement, is a
   change of data rather than of shape.
5. **Presets as modules** — FLAGGED, waiting on Stu playing with two-up first.
   A saved preset should be able to open INTO either side, and an arrangement
   of two should be savable as one bookmark. The data already supports both (a
   Bookmark holds a ModuleState; a pair is two of them) — what's undecided is
   the UI, and it isn't decidable from a chair: whether you reach for "put this
   preset on the right" or for "save this pair as one thing" depends on how the
   two-up view actually gets used. Deliberately not guessed.

The order matters: doing 4 before 3 means two panels fighting over one blob of
state, which is exactly the mess this staging avoids.

## Held for later — decided but deliberately not built yet

- **The bundle got big, and here's what can be done about it.** Adding VexFlow
  took the app from ~284KB to ~1.4MB (778KB gzipped). It loads fine on a
  desktop and is slow on a phone on a bad connection. Three options, roughly in
  order of effort:

  1. **Split it out.** VexFlow is only used in Harmony. A dynamic `import()`
     behind `React.lazy` means Scales and Ear never download it at all — the
     app opens at its old size and the notation arrives when you first ask for
     a chord. Cheapest real win, no visual change. Half a day.
  2. **Load fewer fonts.** Most of VexFlow's weight is music fonts, and it
     ships several. Version 5 can be told to load one (Bravura) instead of the
     whole set, which is a config line, but the API for it moves between
     versions and needs checking against whatever we're on.
  3. **Draw only what's on screen.** A chord scale renders 21 systems at once
     and you see four. Rendering a system only when it scrolls into view would
     cut the work sharply — but it's a change to how the page renders, not just
     to what it loads, so it's the biggest of the three and the last resort.

  Decided 2026-08-27 to ship the size and fix it later. Worth doing (1) before
  anyone uses this on a phone.

- **Zoom the floating neck — MOBILE ONLY, and near the end.** As you scroll,
  zoom the neck to the frets that matter for the section you're on. Deferred
  deliberately: keeping all six strings visible while narrowing the fret range
  necessarily makes the neck TALLER (fewer frets across the same width means
  everything grows), which is right on a phone and wrong on a desktop where
  the floating panel would eat the screen. So: phone widths only, and last.
  Decided 2026-08-26.

- **CONTROLS as a fixed, collapsible sidebar.** Stu's note, 2026-08-31: while
  you're down in the music actually playing, the panel is off the top of the
  screen and every adjustment costs a scroll. A sidebar keeps it to hand. Held
  rather than built because it's a layout the whole app has to agree with —
  the floating neck already claims the top, two side-by-side modules already
  claim the width, and a phone has neither to spare. Likely lands as a
  SETTING (panel on top / panel at the side) rather than a replacement.

- **Whiteboard mode — for teaching, live.** Draw on the fingerboard; or select
  notes in an order and have the connecting line follow that order; save the
  result; translate it into TAB. This is the demonstration tool, and it's the
  first feature whose primary user is the STUDENT watching rather than Stu
  choosing. Big: it needs an input layer over the neck, a saved drawing
  format, and a drawing → notes → TAB path.

- **Share a preset with a student.** A bookmark is already a `ModuleState`, and
  a `ModuleState` is small — so the honest version of this is to encode one
  into the URL (`?m=…`), which needs no accounts, no server and no database:
  open the link, the panel is set to what the sender was looking at. Do this
  before anything that needs a login. Raised 2026-08-31.

- **More instruments.** Ukulele (tenor, baritone) and alternate guitar tunings
  are pure data — the engine has been instrument/tuning-agnostic since day one,
  so these cost a data file each. **Piano is not**: Stu's framing is the good
  one (a guitar is six keyboard layouts each starting somewhere different), but
  a keyboard needs its own renderer, since `Position` means string + fret. Take
  the tunings first; treat piano as its own arc.

- **Inversion colouring.** When an inversion is selected, colour it in shades
  rather than flat degree colours. Two readings, and Stu hasn't picked:
  (a) shades of the chord's GRAVITY degree, so all of ii's inversions are
  shades of orange and what you see is the chord's function; or (b) shades
  down the voicing itself, so the bass note reads darkest. Raised 2026-08-26,
  parked the same day — ask before building.

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

### ~~Brief C — dominant families, part 2~~ (Stu ruled — done, session 9d)
Rulings implemented: (1) blues **IV7** for a dom7 on the fourth degree of a
major key (tonic dominant keeps V7/IV); (2) **♭/♯ numerals built at the source**
(harmony.ts, measured against the parallel major) so C harmonic minor reads
i(maj7) iiø7 ♭IIImaj7♯5 iv7 V7 ♭VImaj7 vii°7 app-wide — the manual ♭-hacks in
suggest.ts and the quiz are deleted; (3) V7/♭III+ kept (formal derivation
stands). Still open, lower priority: the diminished-scale m3 dominant family
and M3-approach as EXPLICIT teaching labels (they all already get *a* reading),
and a minor-key deep-dive for the strip/quiz.

### ~~Brief D — unify the Possibility/Play TAB look~~ (done — session 10c)
The visual identity was already aligned by an earlier pass (same line colour,
same paper-masked numbers); now it's STRUCTURAL: `--tab-line` and
`--tab-fret-size` tokens in `index.css`, used by all three TAB surfaces
(TabView cards, the horizontal TabSequence, Play's score staff) so they can't
drift. Verified all three compute identical values.

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
- ~~**TAB numbers on the wrong white**~~ (already fixed — the patch behind a fret
  number takes `var(--bg)`, so it's the exact page colour in both themes).
- ~~**TAB and notation too small to read**~~ (done — session 11: fret numbers set
  in Karla rather than VexFlow's music font, and the whole system engraved at
  1.3× via a narrower viewBox. See `ZOOM` in `render/System.tsx`.)
- ~~**"3 per string / Positional / Hybrid" was floating**~~ (done — session 11: it
  moved into CONTROLS as a **Fingering** row below View, where Harmony's own
  three rows sit. Now part of `ModuleState`, so bookmarks remember it.)

### Still open, from Stu's development notes (2026-08-31)

- **A drone / soundscape player keyed to the current key.** Hold a drone on the
  tonic (or the mode's root) to practise against; field recordings as an
  alternative bed. Reuse the Archive / Soundscape audio code — ask Stu for it
  rather than writing fresh playback (see CLAUDE.md).
- **Fretboard dot labels** may want the same readability pass the TAB just got.
- **An animated gradient in the Ear box**, to say "what you're hearing is still
  hidden" — the one place in the app where not-knowing is the point.
- **Shuffle**, and with it **back / forward.** Together with bookmarks these make
  the app read like a browser: somewhere to go, a way back, and a way to be
  surprised. Shuffle already exists in the v1.x generators section; the back
  stack is the new part, and it wants a history of `ModuleState`s — which is
  exactly what a module's state being one object makes cheap.

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
- **Instruments/tunings:** ~~ukulele (baritone + tenor, high-G and low-G)~~
  (done 2026-09-01 — and it really was almost pure data: two instrument
  entries, three tunings, plus threading the pair through the views that had
  been importing GUITAR directly. The only engine change was telling the TAB
  staff how many lines to rule.) Remaining: alternate guitar tunings (drop-D,
  DADGAD), which are now one data file each with nothing else to do.

---

## The v1 brief (2026-09-01) — and what it costs

Stu's brief, in one line: *a guitarist in the Julian Lage masterclass group
opens one link on their phone, immediately uses the fretboard tool, can
optionally make a free account to save their settings, sees Stu's name linking
to Being Sound, and finds one gentle invitation to the Substack.* Anything not
needed for that sentence isn't in v1.

### Checked against what's actually built

- **Not Electron, and never was.** Three dependencies: react, react-dom,
  vexflow. It's a Vite web build, already hosted and already reachable by URL.
  The brief's "priority is to get a hosted web version live" is done.
- **PWA is genuinely missing** — no manifest, no service worker. A day's work.
  But note the constraint that decides how much it matters: **you cannot
  install a PWA from inside WhatsApp's in-app browser.** It's a webview with no
  add-to-home-screen affordance; the reader has to open in Safari or Chrome
  first. So the PWA is worth having and is NOT the first-run experience for the
  audience the brief names. First run is a cold webview over mobile data.
- **"Keep the source private" needs a host change.** A public repo is mandatory
  for Pages on a free plan. Either GitHub Pro (~$4/mo) or move to
  Vercel/Netlify/Cloudflare — and since accounts would force that move anyway,
  one move buys both.
- **Email capture is built**, at the moment the brief describes (saving your
  first setting). But it's a MAILING-LIST signup, not an account. If accounts
  arrive, these have to merge into one ask — nobody should be asked for their
  address twice on the same page.

### The two gaps, and they are not the same size

**Gap 1 — the phone. Cheap, and the brief's first clause is false without it.**
Measured at 375×812 on 2026-09-01, with nothing overflowing the viewport (so it
LOOKS fine to a layout check) and yet:
  - the KEY row renders its twelve keys as bare punctuation — the note names
    are gone entirely;
  - SCALE shows "Melodi…", "Harmo…", "Harmo…", the last two identical;
  - GRAVITY shows "A.." for All and "v…" for vii°; FINGERING shows "3 per stri…";
  - the neck is **77px tall** — six strings and seventeen frets in 77px;
  - and it starts **582px down**, so on a 812px screen the thing the app is FOR
    occupies about 9% of the first view.
  Add ~783KB of gzipped JavaScript arriving over mobile data first.
  This is the release. "Immediately doing something useful" is not true today.

**Gap 2 — the account. Expensive, and it is the entire rest of the release.**
"Auth/storage as light as possible, e.g. email + magic link" is the one item in
the brief that isn't light: it means a backend, a database, personal data held
on a server, GDPR duties that come with holding it, auth edge cases and email
deliverability — and it permanently changes what this codebase IS, from a
static site anyone can fork and run to a service with secrets and users. That
runs straight into the CLAUDE.md constraint that Stu must be able to explain
this in an interview and a small local model must be able to maintain it.

**A middle path worth considering before committing to the backend:** a saved
setting becomes a LINK. Settings already persist per device; the only real gap
is between devices, and a URL closes it (send it to yourself) at zero server
cost — while also being the sharing mechanism the funnel wants. It does not
literally satisfy "make a free account", which is Stu's call to make. The
brief's own logic argues for it though: it says real usage should inform the
curriculum rather than the reverse, and the same applies here — ship, then find
out what people actually want kept.

### Recommended cut

**v1.0** — the phone, PWA, attribution + copyright, the Substack invitation,
and the VexFlow lazy-load (no longer a nicety once the audience is on mobile
data). Ships to the Lage group.
**v1.1** — the account, if real use asks for it, together with the host move
that also makes the repo private.

---

## Business / launch

> **SUPERSEDED IN PART, 2026-09-01.** Stu brought a v1 Build Brief written with
> the business plan in front of it, and it settles several things this section
> was still weighing. **The app is not monetized directly.** It's the FORM
> layer of the Being Sound pedagogy and its job is to be a trust engine and the
> top of a funnel into the teaching — lessons, the Sounding With immersion, the
> Substack. So: no payments, no tiers, no referral mechanics, no gate on core
> features. The founding-supporter link, the eventual paid workbench and the
> unlock-code machinery below are all OFF the plan, not merely deferred.
>
> What survives is the reasoning about EMAIL and ACCOUNTS, because the brief
> lands in the same place by a different route: no signup wall, the core tool
> usable immediately, and email captured as the natural result of saving
> something worth keeping. The brief goes one step further than we had — it
> wants a real free account (email + magic link) so settings follow you between
> devices, which is a backend and is costed honestly under "The v1 brief"
> below.
>
> The rest of this section is kept as the record of how the payment question
> was reasoned through, in case the answer ever needs revisiting.

Written up 2026-08-31, when Stu asked about accounts, payments and
subscriptions ahead of sharing this with the Julian Lage masterclass group and
his own students. Gemini had proposed Clerk + Stripe Checkout with a $25
lifetime pass gating alternate tunings and AI features. Those are good tools;
the disagreement is about ORDER and about what's actually being sold.

### Two facts that decide most of this

1. **There is no server.** The app is a static bundle on GitHub Pages: every
   scale, chord, tuning and rule is downloaded to the browser before anything
   is drawn. A feature gate is therefore an `if` statement in code the visitor
   already has. It's a request, not a lock.
2. **The repo is public** (`github.com/stupender/method`). It has to be, for
   Pages on a free plan. So the source is readable by anyone who looks.

Neither is a reason not to charge. Both are reasons not to spend a week
building enforcement. And (2) is the concrete form of the old "protect the IP"
line: the choice is to go GitHub Pro / move hosts and make the repo private, or
to decide the openness is fine. Decide it deliberately, before sharing widely.

### The beta plan (Stu, 2026-08-31: "reach as many people as possible, track
### who is using it clearly, and have a plan to launch and grow")

Those three pull against each other, and the order they're taken in is what
resolves them. **In beta: no gate, no charge, email + measurement.** Charging
comes after there's evidence of what people value, because you can't price or
gate a thing until you know which parts of it get used.

**Do NOT put the email form in front of the app.** The strongest thing this
app has is its first ten seconds — a fretboard lighting up. That moment is the
marketing, and it's what makes someone send the link on. A signup wall spends
that moment on a form, and most of a WhatsApp group tapping a link on a phone
will simply leave. Reach and email capture are only in tension if the form
comes first.

**Ask at the moment of demonstrated interest instead**, where the ask is also
honest:
- **When someone saves their first bookmark.** Saved settings live in that
  browser and nowhere else, which is true and is a real limitation — so "want
  these to follow you, and to hear when new things land?" is an offer, not a
  bribe.
- A quiet, permanent link in the site bar for everyone else.
- Tag these subscribers in Kit (`fretboard-beta` or similar) so they stay
  distinguishable from the existing Being Sound list. That tag is what makes
  this a funnel rather than a bigger pile: later there's a group who can be
  written to as people who actually used the tool.

**An email list is not usage tracking**, and the two questions need different
tools:
- **Are people coming back, and what do they touch?** A privacy-first
  analytics script — Plausible or Fathom, ~$9/mo — chosen over Google
  Analytics specifically because it needs no cookie banner, and a consent
  popup would land on exactly the first-run moment being protected above.
  Cloudflare Web Analytics is the free floor if the cost isn't wanted, but it
  has no custom events, and custom events are the entire point here: fire one
  on *opened Harmony*, *changed fingering*, *saved a bookmark*, *opened two
  panels*. That's the real feedback — which of the built features anyone
  reaches for.
- **Why?** Ten conversations beat a thousand pageviews at this stage. A "tell
  Stu what's confusing" link that opens an email is worth more than any
  dashboard right now.
- **The number that decides everything: do they come back within a week?**
  Not signups, not visits. Retention is the only beta metric that says whether
  there's a product here.

**Money in beta, without a gate.** A Stripe **Payment Link** is just a URL —
no integration, no entitlement code, nothing locked. A "founding supporter"
link in the app, with everything still free, tests willingness to pay at zero
engineering cost and without spending any reach. Whoever pays becomes the
founding cohort whose early price is honoured permanently. If nobody pays,
that's worth knowing before building a paywall for them.

**What moves this out of beta:** the workbench (Play / songbooks) actually
finished, a list worth launching to, and demonstrated weekly return. Then
Stage 1 below, launched TO the list rather than to a WhatsApp group.

**Housekeeping that comes with collecting email:** Kit handles opt-in and
unsubscribe compliance; privacy-first analytics avoids the cookie banner; a
one-paragraph privacy note covers the rest. Cheap, but only if the tools are
picked with it in mind — which is the other argument against GA.

### The staging

**Stage 0 — before anything is sold.** Cheap, and each part is worth doing
even if nothing is ever charged for.
- **A domain.** `stupender.github.io/method/` is already a live URL and already
  works, so nothing is BLOCKED on this — but a name is worth ~£10/yr before it
  goes to a room full of guitarists. Pages takes a custom domain and issues
  HTTPS itself; it's a `CNAME` file and a DNS record.
- **Shareable preset links** (see the note above). This is the growth
  mechanism, and a better one than any referral scheme: someone sends "look at
  this" and it opens on exactly what they meant.
- **A way to collect email.** More valuable right now than payments, because
  the thing this funnels into is the cohort course, and the list is the asset
  that makes that launchable. A hosted form needs no backend.
- **One quiet line about who made it**, linking to Being Sound. Not an advert
  for a course that doesn't exist yet.

**Stage 1 — charge, without building an auth system.** At this scale a Stripe
**Payment Link** plus an unlock **code** does ~90% of what Clerk + Checkout
does for ~5% of the work and no server: buy → receive a code → paste it into
an "I have a code" box → it's kept in this browser. Free student codes, early
member codes and lifetime codes are then all the same one feature. Yes, a code
can be passed around; at this size that costs less than the infrastructure to
prevent it, and the people being sold to are his students, not adversaries.

**The one rule that makes Stage 1 → Stage 2 painless: the browser is a CACHE,
never the record.** Whatever unlocks the app, the list of who is entitled has
to live somewhere Stu can export — Stripe for buyers, a spreadsheet for the
free ones. Every Payment Link sale creates a Stripe Customer with an email
address, so that list already builds itself; the free codes are the half that
has to be written down by hand. Get this wrong and a buyer who clears their
browser is someone Stu can't verify and can't help.

**Prefer the email over a random code.** Same box, same one-field UX, but the
thing typed in is the identifier an account will later be keyed by — so the
migration stops being a migration. Sketch: keep a list of SHA-256 hashes of
lowercased buyer emails as a small JSON file next to the app; the unlock box
hashes what's typed and looks for it. Hashes rather than addresses so the
bundle isn't a mailing list anyone can lift (a guessed address can still be
checked against it, but the list can't be enumerated). `crypto.subtle` needs a
secure context, which Pages provides. Updating it is committing a file, which
also means unlocking someone is a thirty-second job with no server involved.

Then Stage 2's transfer is: export Stripe customers → seed the new table with
those emails plus the free-access ones → anyone signing up with an email on
the list is a paid account the moment they arrive. Nobody re-enters anything,
nobody is asked to prove they bought it. The only manual case is someone who
signs up under a different address than they paid with, which at this scale is
a "bought with another email?" link that reaches Stu directly.

**Stage 2 — real accounts, only when something must live on a server.**
Songbooks that follow you between devices, a cohort roster, progress history
for the weakness-detection idea. That's when a login pays for itself. It also
means leaving Pages (static only) for Vercel / Netlify / Cloudflare — half a
day, not a rewrite. At that point prefer **Supabase** over Clerk: by then the
need is auth AND a database, and Clerk is only the first half.

### Two changes to the proposal itself

- **Don't sell "lifetime" yet.** It caps the income exactly when the backlog
  says years of building are still coming. Sell the same $25 as an **early
  supporter / founding price**, honoured permanently for those buyers, with
  later pricing free to change. Same money now, same reward for being early,
  no promise that gets in the way later.
- **Gate the workbench, not the data.** Alternate tunings are a data file, and
  putting them behind the wall makes the free version feel deliberately
  crippled. The things worth paying for are the ones with ongoing value and
  ongoing cost: **Play**, saved songbooks, whiteboard/teaching mode, and later
  anything AI. Free = the whole instrument (fretboard, scales, harmony, ear
  training). Paid = the bench you build and teach from.

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
