# BACKLOG.md — triaged feature plan

How to read this: features are grouped by **when**, not just **what**. The rule
from [CLAUDE.md](CLAUDE.md) holds — most of these arrive as DATA + small pure
functions on the existing engine, not as rearchitecting. Nothing below preempts
finishing **v1** (the GPS reveal, then VexFlow + polish, then the study guide).

Each item notes roughly where it plugs into the layers
(`data → theory → render → audio → ui`).

---

## In progress — finish v1 first

These come before anything in this file (see the build plan in CLAUDE.md):

1. **Session 5 — the Search Engine / GPS reveal** (the signature interaction).
2. **Session 6 — VexFlow notation + polish + case study.**
3. **Session 7 — study guide.**

---

## Soon (v1.x) — melodic & harmonic generators

These are clean extensions of the existing scale/chord engine and embody
Method's "one transferable pattern" thesis. Self-contained; good first additions
after v1 ships.

### A. Interval + direction melodic sequences ("paltas")

Set a **series of notes** by repeating a pattern of **interval + direction**
through a scale. Examples Stu gave:

- `↑3 ↑2` repeated through all scale tones.
- `↓4 ↓2 ↑4 ↓2` repeated.

Key insight to build around: **a plain scale and an arpeggio are special cases.**
- Scale = `↑2` repeated (all 2nds).
- Arpeggio = `↑3` repeated (all 3rds).
So this generalises what `theory/scale.ts` already does — likely we reframe the
scale as the simplest pattern and the generator produces an ordered list of
scale-degree positions to light up / play in sequence.

- **data:** a `Sequence` definition = an ordered list of steps, each `{ interval
  (in scale-degrees), direction (up/down) }`, plus a starting degree.
- **theory:** pure function `(root, scale, sequence) → ordered PlacedNote[]`
  (walk the scale by the pattern, wrapping octaves).
- **render/audio/ui:** reuse the fretboard + `playSequence`; add a sequence
  picker. The playback path already exists.

### B. Interval-pairing chord voicings (Vic Juris)

Build chords by stacking a **specified set of intervals through the scale**,
rather than tertian (every-third) stacks. Stu's example: `4th–2nd–6th` built on
each scale degree (from his teacher Vic Juris' book).

- **data:** a "voicing recipe" = a list of scale-step intervals to stack from
  each degree (e.g. `[4th, 2nd, 6th]`), diatonic to the current scale.
- **theory:** extends the chord/voicing engine — instead of tertian chord tones,
  gather tones by the recipe, then the existing `placeVoicingAll` lays them out.
- Relationship to current work: today chords are tertian (stacked 3rds). This
  adds non-tertian construction as another source of "chord tones," then reuses
  inversions / structures / placement unchanged.

---

## Later (v2) — the Progression / Song workbench

A bigger subsystem: assemble chosen chords/voicings into songs, with timing, and
move MIDI in and out. The data-model seam exists in `types.ts` (Section 7) and is
refined now (see "Done now" below); the behaviour is v2.

### C. Progression builder + the three-layer chord model

Arrive at a specific chord + voicing and **add it to a progression**. A "song"
can be:
- a **single bar** — a practice tool to blow over one chord, or
- a **full progression** (hand-entered or imported).

Each bar's chord is understood in **three layers**, most open → most specific:
1. **Neutral chord** — what the chord literally is (e.g. `Dm7`).
2. **Roman numeral relative to a key center** — e.g. `ii7 in C`. Crucially this
   can stay **open / not fixed to one interpretation**: the same `Dm7` is `ii in
   C`, `vi in F`, `iii in Bb`… and that multiplicity is exactly the harmonic
   "possibility space" the GPS reveal is about. Keep this layer plural where the
   user hasn't committed to a key center.
3. **Chosen voicing** — the specific structure/inversion/shape to play.

- **data/theory:** `Progression`/`Section`/`Bar`/`ChordRef` (already seeded);
  `ChordRef` carries the three layers (see seam refinement).
- **ui:** a progression strip you append the current chord+voicing to.

### D. Bar/beat timing + chords across bar lines

- Bar lines, but chords that **extend beyond them**.
- Enter a chord's **start and end by bar + beat**.
- A **drag** interaction to set/resize a chord's span on a timeline.
- **data:** `ChordRef` carries start/end in beats (seam refinement below).
- **ui:** a timeline/piano-roll-ish editor; the drag layer is the bulk of the work.

### E. MIDI export

After voicings are chosen, **export the progression as a MIDI file** to drop into
a DAW.
- **audio/export:** a small MIDI-file writer from the placed notes + timing. Pure
  data → bytes; no playback dependency. (Standard MIDI File format is simple.)

### F. MIDI import + editing

- **Import** MIDI files; **edit** the resulting progression (chords, timing).
- Inverse of E plus the editing UI from C/D.

### G. iReal Pro import (already planned)

Parse iReal charts (title, key, time signature, measures, repeats/endings) into
the `Progression` model, feeding C/D. The model is shaped for this; importer not
built.

---

## Existing data backlog (no new engine code)

Added by dropping in data files that match the schema:

- **Scales/modes:** harmonic minor, melodic minor, harmonic major (next
  checkpoint), diminished, augmented, and their modes.
- **Chord qualities:** augmented, dim7, minor-major 7, etc. (needed by the above
  scales' harmony).
- Slash chords; negative harmony; ear training (per unit).
- **Instruments/tunings:** alternate tunings (drop-D, DADGAD), ukulele — the
  engine is already instrument/tuning-agnostic.

---

## Design note — open Roman numerals ↔ the GPS reveal

Stu's point that a chord's Roman numeral should stay **open** (a `Dm7` is `ii/iii/
vi…` depending on key center) is the same idea as the **GPS reveal** (Session 5):
fewer fixed commitments = larger possibility space, each commitment narrows it.
Build the progression's "function" layer (C, layer 2) to hold a *set* of possible
interpretations, not a single fixed one, so it can share machinery with the GPS
reveal.
