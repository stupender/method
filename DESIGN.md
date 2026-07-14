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
