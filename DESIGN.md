# DESIGN.md — the UX design pass

A living design doc, the UX counterpart to [BACKLOG.md](BACKLOG.md). BACKLOG says
*what* to build; this says *how it should feel and be organized*. We re-orient the
shell here before piling on more features.

Two jobs live in this doc, and the second is bigger:

1. **Reduce clutter** — the obvious one (button sprawl from adding features on the go).
2. **Organize the app around the way Stu actually teaches** — the structural one.
   The shell is currently organized around *theoretical objects* (Scales, Harmony,
   chords, voicings). It should be organized around the **teaching loop**.

## Who we're designing for (now)

**Stu, teaching live, shared screen.** The primary user is an **expert guiding
students of all levels** in a lesson. Most pedagogy software starts from the lone
self-directed learner; we start from the room where teaching happens. That choice
cascades into the principles below. So:

- **Everything stays reachable** — an expert drives; we don't skill-gate.
- It must be **legible and calm on screen** — a watching student isn't drowning in
  controls; the teacher never hunts for one mid-sentence.
- Disclosure is by **relevance, not by level** (see the heuristic at the end).

**Deferred (separate side-project):** a guided, course-style experience in the
spirit of Ableton's *Learning Synths* (learningsynths.ableton.com) — one concept at
a time, beautifully interactive. It reuses this engine and arrives later as a third
mode (**Self-Guided Mode**). Not part of this pass.

## The deepest move: organize the shell around the teaching loop

The top-level zones today — **Possibility / Play / Scales / Harmony** — are
theoretical categories. But every lesson runs the same loop:

1. **Bring in a song** (an Olivia Dean tune, a Quincy line, a student's riff).
2. **Listen & reverse-engineer** — what key? what chord? what's the melody doing?
3. **Surface the search space** — what contexts could this chord live in? what
   narrows it?
4. **Land on the concept** — *oh, that's a secondary dominant / a dom7sus4 / an
   upper-triadic extension.*
5. **Hand back as a constraint** — try it with these two chords; loop it; record
   three phrases.

The information architecture should **mirror that loop**, so the natural move on
screen is the natural move in the lesson:

> **Song → Analyze → Voicings / Scales → Practice**

Most individual views barely change; what changes is the *navigation and priority
order*. The whole app reads left-to-right (or top-to-bottom) as a lesson flows.
Single-chord and single-scale work become *steps inside* this loop, not the
top-level organizing idea.

## Lesson Mode vs Studio Mode (the central UX problem)

Because the primary user is *Stu teaching live*, the **projected-view problem is
the main problem, not an edge case.** So the app has two states:

- **Lesson Mode (default).** Calm, focused, **neck/score at maximum size**, minimal
  chrome. Only what's needed to teach is visible; advanced controls are reachable
  but visually muted. This is where most v1 time is spent — the real primary state.
- **Studio Mode.** The working studio — all controls visible — for preparing
  material or exploring alone.
- *(Later: **Self-Guided Mode** — the Learning-Synths-style course, same engine.)*

This single distinction declutters more than any control regrouping, and it scopes
the deferred guided experience cleanly.

## The search engine, made visible — the Context strip

This is the load-bearing pedagogical move and the thing that makes Method *Method*
and not Hooktheory. The app is a **search tool**, not just a display tool: here's a
chord → here are the keys it could live in → watch the space narrow as you add the
melody note / next chord / mode.

Today that lives only inside the Play "reveal." It should be a thin, **persistent
Context strip** — a band above the neck — showing:

- the current **key hypothesis (or hypotheses)**,
- the **candidates still in play**,
- **what just narrowed** the search (and why).

As you change a chord, add a melody note, or switch a mode, the strip updates — the
student watches the search engine *run*. It's a band, not a new view.

## Display: labels AND constellation states

Labels (Degrees / Notes) should be **one global display setting**, not duplicated
per view — but the constellation insight is bigger than labels. The neck can show
**the relevant notes in the current harmonic context, with overlapping
constellations color-coded when the context is ambiguous.** So the global display
setting is two axes:

- **Label:** degrees / notes / off
- **Constellation:** single (current key) / overlay (all candidate keys, color-coded)
  / off

Overlay is the mental image an experienced player carries internally; Method
externalizes it. (Finger numbers join the Label axis later.)

## Play actions are embodiment moves, not "transport"

The scattered Play buttons (transport, the editor's Play, a future loop) are really
**three distinct teaching intents** — return-to-the-instrument moments — that can
share machinery underneath but should read as distinct affordances:

- **Loop** — a single chord or short pattern to *improvise over* (the bhāva setup).
- **Play-along** — a progression rolling while you play *with* it (reverse-engineering
  in real time).
- **Practice card** — a constraint to take away: concept + chord(s) + duration +
  a voice-memo capture.

Splitting the transport into Playback / Options (the earlier proposal) is still
right, but these three intents are the real organizing idea.

## Lead with a Song, not a chord

Leading Play's editor with text entry (and demoting the 12+11 pill grids behind a
*"pick visually ▾"* disclosure) is correct and high-leverage. But go one step
further: **in a lesson I rarely type one chord — I paste a *song*** (a progression,
a section, lyrics with chords above, a URL, or just `Am Dm G C`). So the top of Play
leads with a **Song / Section input**; Method parses and lays it out. **Single-chord
entry is then the simplest case of the song input.** Reverse-engineering songs is
the engine; single-chord work is downstream of it.

## A home for the lesson's output — the Practice zone

The loop ends in something the student takes home, and there's no zone for it yet.
A small **Practice** drawer where you can: capture a chord + concept + duration +
instruction as one **card**; attach a voice-memo button; save it (locally by
default); and print/export a one-line constraint. Skeleton-only is fine for v1 — but
the architecture should *know it's coming* so it isn't shoehorned in.

## Content tiers — Scratch / Palette / Library

Not all content is equal, and the distinction is the long-term promise of Method:

- **Scratch** — ephemeral exploration; clears on close (the casual chord, the random
  ear-training cycle).
- **Palette** — saved **per student**; the voicings, progressions, and modes *this*
  student is working on, accumulating over weeks. (*Did the palette widen?* is the
  whole teaching promise.)
- **Library** — the canonical repertoire (songs, exercises, constraints).

Not a v1 requirement, but the data model should anticipate it.

## The control grammar (implemented — Stu's "many buttons" note)

Three visually distinct roles, so a control's *meaning* is legible before you read
its label:

- **Segmented track** (`ui/Segmented.tsx`) — choose exactly ONE: a recessed track
  holds the options as a single connected unit; the chosen segment sits raised on
  it like a paper chip. Used for Key, Scale type, Degree, Scales/Harmony, Labels,
  Fingering, Direction, Explore, Chord size, Bass note, Structure, String set,
  and the Quality/Function quiz switch.
- **Pill** — an independent on/off toggle (Metronome, Count-in, All positions,
  Voice-lead…) or a multi-select pool (the ear-training pools).
- **Accent pill** — an action (▶ Play …).

Dynamic data chips (songbook tabs, key hypotheses, the reveal, suggestions) stay
chips — they're content, not settings. One more small role: the **stepper**
(`ui/ShapeStepper.tsx`, ‹ 3 / 7 ›) walks a sequence of shapes in playing order —
tiny prev/next actions around a live readout, mirrored by the ← → arrow keys.

## The hierarchy (re-audited, 2026-09)

Four scopes, and each now sits at its own level:

1. **The room** — the light. That's all: the site bar's cluster once held four
   marks and three of them were about a PANEL, not the app.
**One underline, one meaning.** A chosen nav item wears the same rule the
scale's name above the fretboard wears when it's showing the whole scale: 1px,
`--line`, 4px under the word. That underline was set once, for a switch, and a
second heavier one in the accent colour was the nav inventing its own answer to
a question already answered. (It's `text-decoration`, not a border or a
pseudo-element — a decoration is painted rather than laid out, so it adds
nothing to the bottom of a box that has to stay vertically centred.)

2. **What you're doing** — `Fretboard | Ear Training` in the nav, at the FAR
   END of the bar with the light. The bar reads left to right as identity then
   instruments-of-use: the mark and the name are who this is, everything you
   can press is gathered at the other end. ("Possibility" is what the app is
   about — it's in the footer, and it's the idea the whole thing rests on — but
   a nav item has one job, which is to say what's behind it.) It was a "Mode" row *inside* CONTROLS, which was the wrong level
   twice over: a control that decides which rows exist beneath it — and quietly
   turns two survivors from pick-one into pick-many — can't sit inside the box
   it rewrites; and in an app that teaches modes, a row called "Mode" that isn't
   about modes is a collision you can't explain away (Gravity is the mode
   picker). The nav says what you're DOING; the panel says what you're doing it
   TO.
3. **What you're working on** — instrument, key, scale, gravity: CONTROLS rows.
   The instrument came DOWN from the site bar as part of the same move. It does
   nothing at all in Ear Training, so up there it was a control on screen
   changing nothing you could see or hear; and a guitar beside a ukulele in the
   same key is the most useful thing two panels have ever been for, which one
   app-wide instrument made impossible.
4. **How you're looking at it** — Scales/Harmony, fingering, voicing, difficulty.

**The panel folds at any width, by choice.** It used to fold only on a phone,
on the reasoning that a wide screen has room for the rows. Room was never the
only reason to shut it: once you've set a key and a fingering you're looking at
the NECK, and six rows you're no longer touching sit between you and it. The
viewport now decides only which way it OPENS.

**A setting is a thing you can send.** A saved setting lives in one browser and
nowhere else — the honest thing to say about it, and a real limit, because the
setting you've just found is often what you most want to hand a student. So
every row in the saved list has a Copy mark that puts a link on the clipboard,
and the list opens with a field to paste one into. (A paste MARK was tried and
dropped: Safari and Firefox both refuse `clipboard.readText`, so it would have
silently done nothing for most people. A field needs no permission, works
everywhere, and is visible — which a mark you have to recognise never is.) The
code rides in the URL's hash, so a shared link works on GitHub Pages with no
routing, and opening one lands you in the area it was made in.

**A folded panel says what the neck doesn't.** It sits directly above its own
fretboard, whose header already gives the key, the scale and the position — so
repeating those is the one thing the summary shouldn't do. What's invisible
below is the fingering system, the voicing, and (when it isn't the guitar) what
you're holding. In Ear Training there's no neck and no single setting at all,
so it describes the POOL instead: `All keys · Major · Triads & Sevenths · Hard`.
Defaults stay silent — a guitar isn't named, and neither is Easy.

**What a panel's title strip carries**: the saved list, the save mark, and
`+` / `×`. All three are about THIS panel. The saved list moved off the site
bar because up there it couldn't say which panel a preset should load into —
with two open, "which side?" had no answer; asked from a panel's own strip the
question disappears. And `+` / `×` replaced a split-screen toggle in the bar
because adding a panel is the same gesture that will one day add a BAR: a
module per bar is where Play is heading, so the plus belongs on the thing
being multiplied.

**What it costs**: a fretboard beside an ear test is no longer possible. That
was a good idea the build never delivered — the two panels didn't share a key,
so it was two unrelated things side by side rather than a reference sheet for
the drill, and it didn't exist on a phone at all. The coordinated version is
better and lives in one panel: the ear test showing its answer on a neck.

**The margin's table of contents** (`ui/PageMarks.tsx`). A living textbook
should read like one: once a key and a fingering are set, the page below the
neck is pages of engraved music — seven modal positions, or three or four
string sets each holding a key's worth of chords. That's a document, and it
gets what every note-taking app grew for long documents: a rail of hairlines in
the right margin, one per section, the one you're in naming itself. Applied to
what this app's headings actually are — which MODE, or which STRING SET.

It costs almost nothing because the app already knew: `useScrollFocus` has been
deciding which section sits under the neck since the neck started floating. The
rail draws that same answer in the margin, so the mark and the neck can't
disagree — one piece of state seen twice. And it reads both ways: scrolling
names the section, pressing a mark goes there.

**A menu is a small panel** (`ui/Menu.tsx`). The two menus in the site bar —
what's in your hands, and what you've saved — each used to have their own box: a
rounded card with a drop shadow, floating under an icon, rows styled to taste.
Nothing else in this app looks like that. Everything else is a flat outlined
BLOCK on paper with a title strip across the top and rows underneath, so two
floating cards read as an afterthought.

A menu now takes the panel's language exactly: same hairline border, same square
corners, same uppercase eyebrow in the same strip, same ground, one width for
both, **no shadow** — nothing in this app casts one, and a hairline on solid
stock is how a printed thing sits on a page. Rows are the panel's three-part row:
a mark, a name that takes the measure, a quiet fact at the end. The instrument
rows wear the app's own dot, lit for the one you're on; the saved rows wear the
save button's bookmark, quietly, so the list is visibly the thing that button
fills (a lit dot would be wrong — a dot means "this is the one you're on", and a
list of saved places has no current one).

`ui/Menu.tsx` is the one place that decides this, and it also does the two things
both menus were missing: close on a click away, and close on Escape with focus
put back on the button that opened it.

## The aesthetic direction — "Paper & Night"

Pulled from Stu's three Cosmos boards (*Vision Is Expanding*, *Color, Texture,
Symbol*, *Gradients*) by sampling every image and grouping pixels by hue. The
full study, with live specimens, is published as an artifact:
<https://claude.ai/code/artifact/61a718ff-eff0-4c3a-98b3-31f29f9286c4>

**The finding: two worlds sharing one warm light.**

- **Paper** — riso ink on oatmeal stock. Terracotta is the single most common
  chromatic pixel (9% of *Color, Texture, Symbol*), then tan and sand, with
  slate blue as the cool counterpoint. This is where Method already lives.
- **Night** — a third of *Vision Is Expanding* is dark field, and the colour
  that survives is amber: firelight, moonlight, a lamp under a shelf of
  records, against deep teal and indigo. **This is the half that isn't built**,
  and it's exactly the "constellations + bioluminescence" backlog line.

The boards VALIDATE the existing coral accent (it sits in the dominant hue
family) — Method wasn't off-direction, it was **under-supplied**: what was
missing is a *cool pole* to answer the warm one.

**Shipped (the first slice, session 14):** paper grain over the ground;
`--bg` warmed from `#faf8f4` toward the board's sampled `#dad7c8` (landing at
`#f4efe3`); function hues split by temperature. See LEARNED.md.

**Still to come:** the heat ramp re-cut as a two-pole warm→cool ramp (Hilma af
Klint's concentric rings — hot at the tonic, cooling outward); a mark language
for fretboard roles (the nine-tile grid — so a constellation reads without
relying on colour); and the night theme proper, which wants a deliberate pass
over the fretboard, TAB and score.

## Design principles (for the live-teaching tool)

1. **The neck, TAB, and score are the stars.** Controls support; never out-shout
   the music. Quiet by default — calm spacing serves *the music being the star*,
   which serves embodiment over screen-time.
2. **Predictable placement.** A control lives in the same spot every time; muscle
   memory builds; no hunting mid-lesson.
3. **One clear primary action per view.** Everything else demoted or disclosed.
4. **Group by job, order by priority** (choose / display / play / edit).
5. **Disclosure heuristic — "the music calls for it."** An advanced control appears
   when **the current music requires it, the student asks, or the teaching moment
   opens it** — not by user skill, view, or frequency. Paste a song full of m9 /
   m11 / m13 and "Upper Triadic Extensions" can surface even if you've never opened
   that menu. *The current music is the trigger; the teacher is the override.*

## Current-state audit — RESOLVED in the Fable-5 design pass (2026-07)

The audit below was implemented; kept for the record:

- ~~**Labels duplicated across four views** (and resetting on every switch — it was
  per-component state).~~ Now ONE global Degrees/Notes toggle in the Possibility
  selector stack, passed down to every explorer/ladder.
- ~~**Possibility stacked 4 selector rows before content.**~~ Degree + Scales/Harmony
  (+ Labels, right-aligned) share one row; the neck sits a row higher.
- ~~**ScaleExplorer crammed 5 clusters into one row.**~~ Two rows by job: primary
  (Fingering + ▶ Play), then reading options (Direction + All positions).
- ~~**Play transport: eight controls in one soup.**~~ Three clusters divided by quiet
  rules: *playback* (time-sig · play · tempo) | *practice options* (metronome ·
  mute · count-in) | *song actions* (+add · voice-lead). Nothing hidden — grouped.
- ~~**Play's 23 chord pills duplicated the text input.**~~ The pill grids live behind
  a "Pick visually" disclosure; the text field leads (same pattern as the paste
  box). Stu's explicit call.
- ~~**Ladders' string-set pills ("E A D") were unlabelled.**~~ A quiet "Strings"
  label now fronts them.
- ~~**Flow bug: ▶ Play position/chord always played the FIRST shape**~~ even with
  another pinned. Now plays the active (pinned/hovered) shape.

## Sequenced first moves (revised — small, reversible, but aimed at the right shape)

1. ~~**Lesson Mode vs Studio Mode** as a top-level distinction; Lesson Mode the
   default.~~ **(done)** — a `page--lesson` root class + CSS hides anything tagged
   `advanced`. First-pass: Play hides the pill grids (leads with text) + the
   transport options + Voice-lead; Possibility hides All-positions + direction.
   Re-tune by adding/removing the `advanced` class. The "what's essential per view"
   call is now made in code and easy to adjust.
2. **Reorganize the shell around the teaching loop** — Song → Analyze →
   Voicings/Scales → Practice. Navigation + priority order mirror the lesson even if
   views barely change.
3. ~~**Add the persistent Context strip**~~ **(done — Arc 1, then refined)**: in
   Play, above the score — key hypotheses (click to re-read) and a direction-aware
   narrowing readout ("anchors / keeps / narrows N readings"). The chord-by-chord
   FUNCTIONS are drawn **on the bars themselves** (Stu's call: the analysis lives
   with the chord — an accented V7/ii sits right under its A7, and switching the
   hypothesis re-labels the score). Built on `interpretInKey` + `rankKeys`.
   ~~Still open: unify the old strict reveal with tolerant readings.~~ **(done —
   the reveal now reads against the same `ranked` list, so a lit chip is always a
   strip reading; the strict `keysContainingAll` "0 fit" is retired. A chord whose
   home keys don't explain the song names its role instead — "here it's the V7/ii
   in C Major, a secondary dominant reaching outside the key".)**
4. **Lead Play with Song input**; demote single-chord entry inside it; ~~demote the
   pill grids behind "pick visually ▾"~~ **(pill grids demoted — Fable-5 pass;**
   the full Song/Section input — paste a URL, lyrics-with-chords — is still to come).
5. ~~**Unify Labels into one global display setting**~~ **(done — Fable-5 pass)**;
   the **Constellation** axis (single / overlay / off) is still to come.
6. **Split Play actions into Loop / Play-along / Practice card** as distinct intents
   sharing machinery. **Loop is done** (a Practice-options pill; gapless — the whole
   song is scheduled several passes up front and only the playhead wraps; toggling
   mid-play takes effect immediately). Play-along and Practice card still to come.
7. ~~**Scaffold the Practice zone** (constraint cards). Skeleton-only for v1.~~
   **(done, skeleton — session 10d)** Practice cards in Play: freeze the open
   chart (chords + per-bar units + meter + tempo) beside a typed instruction,
   saved locally; reopen to restore. The first seed of the per-student Palette —
   next: group cards by student, capture loop/ramp intent, a voice-memo button.

The earlier tidy-ups still happen *inside* these — regroup the transport into
Playback / Options, group the Scales sub-controls, establish a shared control-row
grammar. They're now in service of the larger reframe, not a tidier version of the
current shape.

## What not to change

- **Small, reversible, checkpoint-driven moves.** None of the above contradicts it;
  each move stays small — they just aim at the right destination.
- **The art-book aesthetic** (BACKLOG). *Quiet by default* is a teaching principle,
  not just taste: decluttering serves the music being the star → embodiment over
  screen-time → technology in service of embodiment.


## Archive — marks we're keeping in case

Tagged in git, so they can come back whole rather than being reconstructed:

- **`ink-moon-mark`** — the original single mark: a riso ink blot on paper (one
  saturated ink, its edge eaten by a turbulence mask), becoming the moon at
  night (no mask, warm light blooming into the dark field). One element, two
  worlds. Retired when the masthead became a site bar. `git show
  ink-moon-mark:src/App.css`
- **`ink-stamp-dots`** — the fretboard's notes as hand-stamped ink: sixteen
  turbulence masks so no two dots printed alike. Retired because at 30 units
  across the texture read as noise rather than ink. `git show
  ink-stamp-dots:src/render/Fretboard.tsx`
