# DESIGN.md — the UX design pass

A living design doc, the UX counterpart to [BACKLOG.md](BACKLOG.md). BACKLOG says
*what* to build; this says *how it should feel and be organized*. We re-orient the
shell here before piling on more features, so everything after inherits a clean
structure instead of the current add-as-we-go button sprawl.

## Who we're designing for (now)

**Stu, teaching live.** The primary user today is an **expert guiding students of
all levels** — using the full app on a shared screen in a lesson. So:

- **Everything stays reachable** (an expert drives; we don't skill-gate or lock
  features). This is NOT a self-guided beginner path.
- But it must be **legible and calm on screen** — a student watching shouldn't be
  overwhelmed by rows of buttons; the teacher shouldn't hunt for a control
  mid-sentence.
- Disclosure is by **relevance, not by level**: advanced controls tuck away until
  needed; the expert can always open them.

**Deferred (separate side-project):** a guided, course-style learning experience
in the spirit of Ableton's *Learning Synths* (learningsynths.ableton.com) — one
concept at a time, beautifully interactive. It would **reuse this engine** but live
as its own thing. Not part of this pass.

## Design principles (for the live-teaching tool)

1. **The neck, TAB, and score are the stars.** Controls support them; they never
   out-shout the thing being taught. Keep the visual weight on the music.
2. **Predictable placement.** A control lives in the same spot every time, so
   muscle memory builds. No hunting mid-lesson.
3. **One clear primary action per view.** Everything else is demoted or disclosed.
4. **Group by job, order by priority.** Controls cluster by what they do
   (choose / display / play / edit), in a consistent priority order.
5. **Quiet by default.** Calm spacing, few visible buttons; the art-book aesthetic
   (see BACKLOG "Aesthetic") is the long-term direction, and decluttering is step
   one toward it.

## Current-state audit (where the clutter is)

**Possibility** — the global selector stack is actually well-ordered
(Key → Scale type → Degree → Mode), but it's *tall* before the neck appears, and
the sub-views pile on toggles:
- Scales view: Fingering (3) · All positions · Direction (2) · Labels (2) · Play —
  five clusters competing in one zone.
- Harmony view: Chord size (2) · Add-to-Play · then ChordExplorer (Inversion ·
  Structure · Labels · Play).
- **Labels (Degrees/Notes)** is duplicated in Scales and Harmony — should be one
  global display setting.

**Play** — two genuinely crowded zones:
- **Transport row**: time-sig · Play/Pause · tempo ± · Metronome · Mute · Count-in
  · +Add chord · Voice-lead — *eight* controls wrapping in one row.
- **Chord editor**: a text field, then a **12-button root grid + 11-button quality
  grid**, then the paste disclosure. The pill grids now duplicate the text input.

## Proposed direction (to react to, not final)

**Play**
- **Lead with text entry; demote the pill grids.** The "Type a chord" field becomes
  the primary way to set a chord; the root + quality grids collapse behind a
  *"pick visually ▾"* disclosure. (Removes ~23 buttons from the default view — your
  call-out.)
- **Split the transport into two tidy clusters:** *Playback* (Play/Pause · tempo ·
  time-sig) on one line; *Options* (Metronome · Mute · Count-in) grouped, possibly
  behind a small "⋯" until opened; song actions (+Add · Voice-lead) with the
  editor, not the transport.

**Possibility**
- **Make Labels (and later finger numbers) a single global display toggle**, not
  per-view.
- **Group the Scales sub-controls:** a *Fingering* cluster (system · direction ·
  all-positions) and a *Display* cluster (labels), with the Play action set apart.
- Consider compressing the four selector rows (e.g. Scale type + Mode share a line)
  so the neck rises higher on the screen.

**Cross-cutting**
- A consistent **control-row grammar**: primary controls in a fixed top zone,
  secondary/advanced disclosed or in a fixed secondary zone, the same in both areas.
- Revisit whether a quiet **"presentation" affordance** (hide advanced controls for
  a clean projected view) is worth it, or whether per-view disclosure is enough.

## Sequenced first moves (smallest, highest-impact)

1. Play: collapse the root/quality pill grids behind a disclosure; lead with text.
2. Play: regroup the transport into Playback / Options / (move song actions out).
3. Possibility: lift Labels to one global display setting.
4. Possibility: group the Scales sub-controls into Fingering / Display clusters.
5. Establish the shared control-row grammar; apply consistently.

Each is a small, reversible change — same checkpoint rhythm as the build plan.
