// ============================================================================
// render/System.tsx — notation over tablature, joined as one system
// ----------------------------------------------------------------------------
// A staff and a TAB staff joined down the left by a connector: a SYSTEM, the
// way guitar music is set on paper.
//
// It takes EVENTS — a list of moments, each holding the notes sounding at that
// moment. A chord voicing is one event of four notes; a scale run is thirty
// events of one note each. Same drawing either way, which is the whole reason
// this isn't two components: the difference between a chord and a scale is
// what you hand it, not how it's drawn.
//
// This is VexFlow, and the switch is worth explaining because the previous
// version wasn't. Hand-drawing note heads on five lines is easy and I did it;
// what isn't easy is everything a system needs around them — a TAB staff ruled
// at the right spacing with T A B in the margin, a connector that spans both
// staves, accidentals placed so they don't collide, note heads offset when two
// pitches are a step apart. That's a lot of engraving convention to
// re-implement by eye, and VexFlow has all of it. It's also what Play will
// need when notation grows rhythm and beaming, so the dependency arrives once
// rather than twice.
//
// VexFlow draws imperatively into a container, so this is the one place in the
// app with a useEffect that writes DOM. The rule for that: clear the container
// first (React can run an effect twice in development), and redraw from
// scratch on any change rather than trying to patch what's there.
//
// TWO CONVENTIONS IT HANDLES FOR US:
//   - Guitar is written an octave above where it sounds, hence the 8 under the
//     clef. We pass octave + 1 and ask for the "8vb" annotation.
//   - VexFlow numbers strings 1..6 from the HIGH e; we number 0..5 from the low
//     E. That's the `6 - stringIndex` below, and it's the only thing in here
//     that would silently produce a wrong-looking TAB if it were missed.
// ============================================================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Accidental,
  Clef,
  Formatter,
  Metrics,
  MetricsDefaults,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  TabNote,
  TabStave,
  Voice,
} from 'vexflow';
import type { PlacedNote } from '../theory/types';
import { midiOf } from '../theory/notes';
import { Beam } from 'vexflow';
import './System.css';

// THE FRET NUMBERS ARE TEXT, SO SET THEM IN A TEXT FACE. VexFlow's default for
// every string it draws is Bravura — the music font — because most of what it
// writes is a musical symbol. Fret numbers aren't: Bravura's digits are the
// heavy, wide ones meant for a time signature, and at VexFlow's default size
// they came out smaller and fainter than the note heads above them, which is
// backwards for a guitarist reading TAB.
//
// This is VexFlow 5's own theming table rather than CSS, and it has to be,
// because the width of each number is MEASURED at construction and used both to
// centre it and to size the little patch of page that breaks the string line
// behind it. Restyle it in CSS afterwards and the number grows while its gap
// stays the old size. `Metrics.clear()` drops the cache the table is read
// through; without it the change is written but never seen.
MetricsDefaults.TabNote.text.fontFamily = "'Karla', system-ui, sans-serif";
MetricsDefaults.TabNote.text.fontSize = 11;
MetricsDefaults.TabNote.text.fontWeight = '600';
Metrics.clear();

// The direction label above each line of a run.
// Eighths are beamed in fours — one beat of 4/4 twice over.
const BEAM_GROUP = 4;

const STAFF_TOP = 0;
const TAB_TOP = 76;
// VexFlow's default gap between two TAB lines.
const TAB_LINE = 13;
// Room below the lowest TAB line for the fret numbers that sit ON it, plus the
// air the stave keeps above its own top line. Found by fitting the figure that
// already worked for six strings: at 190 the bottom line fell outside the SVG
// and was clipped, which reads as a five-string guitar and is a hard thing to
// un-see once you've seen it.
const TAB_MARGIN = 70;

/**
 * How tall one system is — WHICH DEPENDS ON THE INSTRUMENT. This was the fixed
 * 212 that six strings need; a ukulele's four-line TAB is two lines shorter,
 * and a fixed height would have left the difference as dead space under every
 * uke system on the page.
 */
const heightFor = (strings: number) =>
  TAB_TOP + (strings - 1) * TAB_LINE + TAB_MARGIN;
/** Distance from one system to the next when the music wraps. */
const lineHeightFor = (strings: number) => heightFor(strings) + 24;
// The narrowest a note may sit from its neighbour before the music goes onto
// another line instead. Below about this the fret numbers start colliding.
const MIN_NOTE_SPACING = 26;
// Roughly what the clef, the 8 and the T A B take at the left of every system,
// and the breathing room left at the right end.
const CLEF_COLUMN = 56;
const TAIL = 14;
// ============================================================================
// HOW BIG THE ENGRAVING READS — one number for the whole app
// ----------------------------------------------------------------------------
// VexFlow draws at a fixed internal size: a staff line is 10 units from the
// next and that's that. What varies is how many of those units the SVG is
// engraved into before CSS stretches it to fill its column — engrave narrow
// and it magnifies, engrave wide and it shrinks.
//
// That knob used to be turned separately in two places and they disagreed. A
// scale run engraved into `container / 1.15` and came out at 11.5 screen pixels
// a staff line; a chord card engraved into a fixed 210 and, squeezed into a
// phone's 130px column, came out at 6.2. The same app printing the same music
// at nearly twice the size in one view as the other — which is exactly what
// Stu saw.
//
// So the knob is the OUTPUT now, not the input: say how big a staff line
// should be ON SCREEN and let each system work out its own engraving width
// from the room it has. Scales and Harmony can't drift apart, because there's
// only one number.
//
// TEN PIXELS is the resting size. It's what the scale runs were already close
// to and the chord cards were well under; below about eight the fret numbers
// start to close up, and much above twelve a two-octave run turns into a wall
// of systems that dominates the page it's describing.
//
// (This is also the height lever. A bigger staff means fewer notes per line,
// which means more lines, and on a phone a line is about 200px of scrolling.)
// ============================================================================
const STAFF_PX = 10;
/** VexFlow's own unit: the distance between two staff lines, before scaling. */
const STAFF_UNITS = 10;

// VexFlow wants "c#/4" — letter, accidental, slash, octave. Written pitch, so
// an octave above where the guitar sounds.
const ACCIDENTAL_CODE: Record<number, string> = {
  [-2]: 'bb',
  [-1]: 'b',
  [0]: '',
  [1]: '#',
  [2]: '##',
};

// WHICH OCTAVE IT'S WRITTEN IN. Guitar music is written an octave above where
// it sounds — that's what the little 8 under the clef means — so a guitar's
// written octave is its sounding one plus 1. A keyboard is written where it
// sounds, like everything else. It's one number, and getting it wrong would
// put every note on the wrong line while looking perfectly plausible.
const writtenOctave = (p: PlacedNote, keyboard: boolean) =>
  (p.note.octave ?? 4) + (keyboard ? 0 : 1);

function vexKey(p: PlacedNote, keyboard: boolean): string {
  const octave = writtenOctave(p, keyboard);
  return `${p.note.letter.toLowerCase()}${ACCIDENTAL_CODE[p.note.accidental]}/${octave}`;
}

// ============================================================================
// THE GRAND STAFF — one line of keyboard music
// ----------------------------------------------------------------------------
// Treble over bass, braced together, with MIDDLE C as the line between them: a
// note goes on the staff its hand would play it with, and the other staff
// rests. That last part is what makes it read as keyboard music rather than as
// two unrelated staves — a rest is a statement that the other hand is silent
// here, and the eye needs it to keep the two lines in step.
//
// It's a separate function rather than another set of branches through the
// fretted path because almost nothing is shared: no tablature, no string
// numbers, no 8vb, two staves instead of one, and rests, which the guitar
// systems never have.
// ============================================================================
const BASS_TOP = 84; // where the lower staff sits under the treble one
const MIDDLE_C = 60; // C4 in MIDI — the line between the two hands

/**
 * WHICH STAVES THIS MUSIC NEEDS.
 *
 * A grand staff is right for two hands and wrong for one. A one-octave scale
 * is one hand: printed across a braced pair it comes out as a line of music
 * with a matching line of RESTS above or below it, and thirteen rests is a lot
 * of ink to say "nothing here". A scale book prints that run on one staff with
 * a couple of ledger lines, which is what anyone reading it expects.
 *
 * So the choice is made by range, with a generous allowance for ledger lines
 * — two or three of them are ordinary. Only music that genuinely reaches
 * across both hands, like a spread voicing from the bottom of the keyboard to
 * the top, gets the braced pair.
 */
// The pitches the two staves cover between their outermost lines: E4–F5 for
// treble, G2–A3 for bass. Everything outside them hangs on ledger lines.
const TREBLE_LOW = 64; // E4, the bottom line
const TREBLE_HIGH = 77; // F5, the top line
const BASS_LOW = 43; // G2
const BASS_HIGH = 57; // A3
// About an octave's worth of ledger lines. Past that a staff is the wrong one
// and the music wants both.
const TOO_FAR = 14;

function stavesNeeded(moments: PlacedNote[][]): 'treble' | 'bass' | 'grand' {
  const midis = moments.flat().map((p) => midiOf(p.note));
  if (midis.length === 0) return 'treble';
  const low = Math.min(...midis);
  const high = Math.max(...midis);
  // How far outside each staff this music reaches, in semitones — a stand-in
  // for how many ledger lines it would need, which is what makes a staff the
  // wrong one to read it on.
  const outside = (lo: number, hi: number) =>
    Math.max(0, lo - low) + Math.max(0, high - hi);
  const onTreble = outside(TREBLE_LOW, TREBLE_HIGH);
  const onBass = outside(BASS_LOW, BASS_HIGH);
  if (Math.min(onTreble, onBass) > TOO_FAR) return 'grand';
  return onTreble <= onBass ? 'treble' : 'bass';
}

function drawKeyboardSystem({
  ctx,
  top,
  staveWidth,
  line,
  duration,
  isRun,
  staves,
}: {
  ctx: ReturnType<Renderer['getContext']>;
  top: number;
  staveWidth: number;
  line: PlacedNote[][];
  duration: string;
  isRun: boolean;
  staves: 'treble' | 'bass' | 'grand';
}) {
  const grand = staves === 'grand';
  // A single staff sits at the top on its own; a pair is braced together.
  const treble =
    staves === 'bass' ? null : new Stave(0, STAFF_TOP + top, staveWidth);
  treble?.addClef('treble');
  treble?.setContext(ctx).draw();

  const bass =
    staves === 'treble'
      ? null
      : new Stave(0, (grand ? BASS_TOP : STAFF_TOP) + top, staveWidth);
  bass?.addClef('bass');
  bass?.setContext(ctx).draw();

  if (treble && bass) {
    // The brace at the left, and the thin line closing the system — the pair
    // of marks that say "these two staves are played at once".
    new StaveConnector(treble, bass)
      .setType(StaveConnector.type.BRACE)
      .setContext(ctx)
      .draw();
    new StaveConnector(treble, bass)
      .setType(StaveConnector.type.SINGLE_LEFT)
      .setContext(ctx)
      .draw();
  }

  // A staff with nothing to play at this moment holds a rest of the same
  // length, so both voices carry the same number of beats and the formatter
  // lines the two hands up.
  const REST_KEY = { treble: 'b/4', bass: 'd/3' };
  // WHICH NOTES GO WHERE. On a grand staff middle C is the border; on a single
  // staff there is no border, so everything goes on the one staff there is.
  const belongsTo = (p: PlacedNote, clef: 'treble' | 'bass') =>
    !grand || (clef === 'treble' ? midiOf(p.note) >= MIDDLE_C : midiOf(p.note) < MIDDLE_C);
  const trebleNotes: StaveNote[] = [];
  const bassNotes: StaveNote[] = [];
  // Which moments are real notes on each staff — rests can't be beamed, and a
  // beam drawn across one would join two groups that aren't a group.
  const trebleSounds: boolean[] = [];
  const bassSounds: boolean[] = [];

  for (const moment of line) {
    for (const clef of ['treble', 'bass'] as const) {
      if (clef === 'treble' && !treble) continue;
      if (clef === 'bass' && !bass) continue;
      const mine = moment
        .filter((p) => belongsTo(p, clef))
        .sort((a, b) => midiOf(a.note) - midiOf(b.note));
      const sounds = mine.length > 0;
      const note = new StaveNote({
        keys: sounds ? mine.map((p) => vexKey(p, true)) : [REST_KEY[clef]],
        duration: sounds ? duration : `${duration}r`,
        clef,
      });
      mine.forEach((p, i) => {
        if (p.note.accidental !== 0) {
          note.addModifier(new Accidental(ACCIDENTAL_CODE[p.note.accidental]), i);
        }
      });
      if (clef === 'treble') {
        trebleNotes.push(note);
        trebleSounds.push(sounds);
      } else {
        bassNotes.push(note);
        bassSounds.push(sounds);
      }
    }
  }

  // Beamed in fours like the guitar systems, but only across notes that
  // actually sound — a run that crosses middle C hands the beam from one staff
  // to the other, and each staff beams the stretch it holds.
  const beams: Beam[] = [];
  if (isRun) {
    for (const [notes, sounds] of [
      [trebleNotes, trebleSounds],
      [bassNotes, bassSounds],
    ] as const) {
      let run: StaveNote[] = [];
      // Fours, then pairs, and a lone note joins its neighbour rather than
      // standing off flagged at the end — the same rule, stated the same way,
      // as the guitar systems below. See the long note there.
      const flush = () => {
        const sizes: number[] = [];
        let left = run.length;
        while (left >= BEAM_GROUP + 2 || left === BEAM_GROUP) {
          sizes.push(BEAM_GROUP);
          left -= BEAM_GROUP;
        }
        while (left >= 2) {
          sizes.push(2);
          left -= 2;
        }
        if (left === 1 && sizes.length > 0) sizes[sizes.length - 1] += 1;
        let at = 0;
        for (const size of sizes) {
          const group = run.slice(at, at + size);
          if (group.length > 1) beams.push(new Beam(group));
          at += size;
        }
        run = [];
      };
      notes.forEach((n, i) => {
        if (sounds[i]) run.push(n);
        else flush();
      });
      flush();
    }
  }

  // A HAND THAT NEVER PLAYS ON THIS LINE GETS AN EMPTY STAFF, not a row of
  // rests. Rests keep the two hands in step when they take turns — which is
  // what they're for — but a scale that lives entirely below middle C printed
  // sixteen treble rests above it, and sixteen rests is a lot of ink to say
  // "nothing here". The staff is still drawn, braced, with its clef: the
  // system stays a grand staff, it just has one line of music on it.
  const voices: Voice[] = [];
  const stavesFor: Stave[] = [];
  if (treble && trebleSounds.some(Boolean)) {
    voices.push(
      new Voice({ numBeats: line.length, beatValue: 4 })
        .setStrict(false)
        .addTickables(trebleNotes),
    );
    stavesFor.push(treble);
  }
  if (bass && bassSounds.some(Boolean)) {
    voices.push(
      new Voice({ numBeats: line.length, beatValue: 4 })
        .setStrict(false)
        .addTickables(bassNotes),
    );
    stavesFor.push(bass);
  }
  if (voices.length === 0) return;

  const startX = Math.max(
    treble?.getNoteStartX() ?? 0,
    bass?.getNoteStartX() ?? 0,
  );
  treble?.setNoteStartX(startX);
  bass?.setNoteStartX(startX);

  const formatter = new Formatter();
  voices.forEach((v) => formatter.joinVoices([v]));
  formatter.format(voices, staveWidth - startX - 10);

  voices.forEach((v, i) => v.draw(ctx, stavesFor[i]));
  beams.forEach((b) => b.setContext(ctx).draw());
}

export function System({
  events,
  strings = 6,
  staffPx = STAFF_PX,
  keyboard = false,
}: {
  // Each entry is one moment: the notes sounding together at it.
  events: PlacedNote[][];
  /**
   * How many strings the instrument has, so the TAB staff is ruled for the
   * instrument in hand — four lines for a ukulele, six for a guitar. It also
   * sets where each fret number lands, since VexFlow numbers strings downward
   * from the highest one and we number them upward from the lowest.
   */
  strings?: number;
  /**
   * How many SCREEN PIXELS one staff line should sit from the next. The system
   * measures its container and picks an engraving width that lands on this, so
   * a chord card in a 130px column and a scale run in a 700px one are drawn at
   * the same size as each other. See STAFF_PX above.
   */
  staffPx?: number;
  /**
   * IT'S FOR A KEYBOARD — so there is no tablature.
   *
   * TAB says which string and which fret, and a keyboard has neither; a
   * one-line TAB stave with a fret number on it would be a diagram of nothing.
   * So this draws a single staff instead, at concert pitch (no 8vb, because a
   * keyboard sounds where it's written), and picks its clef from where the
   * music actually sits — bass for a left-hand register, treble for a
   * right-hand one — which is what stops a low run becoming six ledger lines.
   */
  keyboard?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);

  // EVERY system measures its column now, because the size it draws at is
  // worked out from the room it has (see STAFF_PX).
  //
  // The first measurement is taken SYNCHRONOUSLY in a layout effect rather than
  // waiting for the ResizeObserver, which only delivers at the end of a
  // rendered frame — so in a tab that isn't visible it never fires at all and
  // nothing is ever drawn. The observer then handles later changes, which is
  // what it's good for.
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const w = Math.round(el.getBoundingClientRect().width);
    if (w > 0) setMeasured(w);
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setMeasured(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.innerHTML = ''; // effects can run twice in development
    const moments = events.filter((e) => e.length > 0);
    if (moments.length === 0) return;
    // A single moment is a chord and gets a whole note; a run of them is read
    // as a line, and eighths beamed in fours are how a scale exercise is
    // written.
    // A chord is a whole note; a run is eighths, all the way through.
    //
    // A quarter on the last note of each line was tried — it makes the bars
    // come out even — and it read as fussier than it was worth. Even eighths
    // are what a scale exercise looks like; the grouping below is what gives
    // it shape.
    const isRun = moments.length > 1;
    const duration = isRun ? '8' : 'w';

    // THE ENGRAVING WIDTH THAT LANDS ON THE ASKED-FOR SIZE. Draw into `d` units
    // and display across `measured` pixels and a staff line comes out
    // `10 * measured / d` pixels; solve for `d`.
    const drawWidth = measured
      ? Math.max(120, Math.round((measured * STAFF_UNITS) / staffPx))
      : null;
    if (!drawWidth) return; // nothing drawn until we know how much room there is

    // HOW MANY LINES. Music that doesn't fit runs onto the next line; it
    // doesn't get squeezed until the notes touch, and it certainly doesn't run
    // off the edge and stop, which is what a single stave did with a long run
    // in a narrow column — the last third of the scale simply wasn't there.
    //
    // So: work out how many notes this width can hold at a readable spacing,
    // then draw that many staves, stacked. Every line is a full system, clef
    // and TAB and connector, because a guitarist reading the third line should
    // not have to look back up at the first to find out what clef it's in.
    // Room for notes: the width less the clef column and a little air at the
    // end. Both staves reserve about the same, so one figure serves.
    // HEADROOM FOR NOTES ABOVE THE STAFF. The staff is drawn at a fixed top,
    // so anything sitting on ledger lines above it is drawn ABOVE the SVG and
    // simply cut off — which is what happens to the high end of a 4NPS or
    // 5NPS run, where the pattern climbs much further than a three-per-string
    // one does.
    //
    // So the drawing measures its own highest note first and pushes everything
    // down by however far it reaches. Counted in STAFF STEPS (a line or a
    // space) rather than semitones, because that's what the notation is spaced
    // by: F on the top line is the last note that needs no help, and each step
    // above it is half the gap between two lines.
    const TOP_LINE_STEP = 3 + 7 * 5; // F5, in letter-steps from C0
    const LETTER_STEP: Record<string, number> = {
      C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
    };
    let highestStep = TOP_LINE_STEP;
    for (const moment of moments) {
      for (const p of moment) {
        // Written pitch, an octave above where the guitar sounds — the same
        // `octave + 1` the keys use.
        const step = LETTER_STEP[p.note.letter] + 7 * writtenOctave(p, keyboard);
        if (step > highestStep) highestStep = step;
      }
    }
    // Half a line-gap per step, plus room for the ledger line itself.
    const headroom =
      highestStep > TOP_LINE_STEP ? (highestStep - TOP_LINE_STEP) * 5 + 8 : 0;

    // KEYBOARD MUSIC IS WRITTEN ON ITS OWN STAVES — treble, bass, or the two
    // braced together when the music really does need both hands. See
    // stavesNeeded above for how that's decided and why it isn't always a
    // grand staff.
    const keyStaves = keyboard ? stavesNeeded(moments) : 'treble';

    // Room for the staff, plus the ledger lines that hang off it — and for a
    // second staff underneath when there is one.
    const KEYBOARD_HEIGHT = keyStaves === 'grand' ? 168 : 108;
    const HEIGHT = (keyboard ? KEYBOARD_HEIGHT : heightFor(strings)) + headroom;
    const LINE_HEIGHT = keyboard ? KEYBOARD_HEIGHT + 16 : lineHeightFor(strings);

    const room = Math.max(1, drawWidth - CLEF_COLUMN - TAIL);
    const perLine =
      moments.length === 1 ? 1 : Math.max(4, Math.floor(room / MIN_NOTE_SPACING));

    // BREAK AT THE TURN IF YOU CAN; PACK IF YOU CAN'T.
    //
    // A scale run is a shape — up, then back down — so two lines is the good
    // break: the ascent is one line, the descent is the next, and the count
    // being odd (the top note is played once, not twice) puts the apex at the
    // end of line one, which is how you'd read it aloud.
    //
    // This used to get there by HALVING, which is right at two lines and
    // ruinous past it. On a phone a 35-note run has room for eight notes a
    // line, so halving went 1 → 2 → 4 → 8 and drew eight lines of four notes
    // where five lines would have held it: one position came to 2190px, more
    // than two and a half phone screens, and seven positions to nearly twenty.
    // Worse, the break it was paying all that for wasn't even landing on the
    // apex any more — at four lines and beyond the turn falls mid-line like
    // any other note.
    //
    // So: the fewest lines that fit. Where two of them fit, that IS two, and
    // the break lands on the turn exactly as before; where they don't, the
    // shape argument has already lost and the height is worth more.
    const lineCount = Math.max(1, Math.ceil(moments.length / perLine));
    const lines: PlacedNote[][][] = [];
    for (let i = 0; i < lineCount; i++) {
      const from = Math.round((i * moments.length) / lineCount);
      const to = Math.round(((i + 1) * moments.length) / lineCount);
      if (to > from) lines.push(moments.slice(from, to));
    }

    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(drawWidth, HEIGHT + (lines.length - 1) * LINE_HEIGHT);
    const ctx = renderer.getContext();
    const staveWidth = drawWidth - 2;

    lines.forEach((line, lineIndex) => {
      const top = headroom + lineIndex * LINE_HEIGHT;

      // ---- THE KEYBOARD'S OWN SYSTEM: a grand staff, no tablature ----------
      if (keyboard) {
        drawKeyboardSystem({
          ctx,
          top,
          staveWidth,
          line,
          duration,
          isRun,
          staves: keyStaves,
        });
        return;
      }

      const stave = new Stave(0, STAFF_TOP + top, staveWidth);
      // "8vb" is the little 8 under the clef: sounds an octave lower than
      // written, which is what guitar notation means.
      stave.addClef('treble', 'default', '8vb');
      stave.setContext(ctx).draw();

      // Ruled for THIS instrument: six lines for a guitar, four for a uke.
      const tab = new TabStave(0, TAB_TOP + top, staveWidth, {
        numLines: strings,
      });
      tab.addClef('tab');
      // ...AND THE "TAB" MARK RESIZED TO MATCH. VexFlow's `tab` clef is hard
      // wired to the SIX-string glyph, so on a four-line ukulele stave the
      // lettering was drawn at its full height from a centre meant for six
      // lines — the B hung off the bottom of the stave entirely.
      //
      // SMuFL has a four-string version of the mark and Bravura carries it;
      // VexFlow simply never wires it up. The codepoint is written out here
      // because `Glyphs` isn't exported from the package — but SMuFL is a
      // published standard and these numbers don't move.
      //   U+E06D  6-string TAB clef   (VexFlow's default)
      //   U+E06E  4-string TAB clef
      if (strings !== 6) {
        const clef = tab.getModifiers().find((m) => m instanceof Clef) as
          | Clef
          | undefined;
        if (clef) {
          clef.code = strings <= 4 ? '\uE06E' : '\uE06D';
          clef.setText(clef.code);
          // Centre of the stave: line 2.5 of six, line 1.5 of four.
          clef.line = (strings - 1) / 2;
        }
      }
      // The T A B letters are drawn tall and the formatter doesn't leave much
      // after them, so the first fret number lands against the A and the B. A
      // few pixels of air is all it needs.
      tab.setNoteStartX(tab.getNoteStartX() + 10);
      tab.setContext(ctx).draw();

      // The line down the left that makes these two staves one system.
      new StaveConnector(stave, tab)
        .setType(StaveConnector.type.SINGLE_LEFT)
        .setContext(ctx)
        .draw();

      const staveNotes: StaveNote[] = [];
      const tabNotes: TabNote[] = [];
      for (const moment of line) {
        const low = [...moment].sort(
          (a, b) => a.position.stringIndex - b.position.stringIndex,
        );
        const note = new StaveNote({
          keys: low.map((n) => vexKey(n, false)),
          duration,
          clef: 'treble',
        });
        low.forEach((p, i) => {
          if (p.note.accidental !== 0) {
            note.addModifier(new Accidental(ACCIDENTAL_CODE[p.note.accidental]), i);
          }
        });
        staveNotes.push(note);
        tabNotes.push(
          new TabNote({
            positions: low.map((p) => ({
              // VexFlow counts strings DOWNWARD from the highest (1 = high e on
              // a guitar, 1 = A on a ukulele); we count UPWARD from string 0,
              // the one nearest your face. So the two orders are mirrors, and
              // the count of strings is what turns one into the other.
              str: strings - p.position.stringIndex,
              fret: p.position.fret,
            })),
            duration,
          }),
        );
      }

      // BEAMS BEFORE DRAWING. Generating them afterwards leaves every note
      // already drawn with its own flag, so a beamed run came out with beams
      // AND a flag on every note, and the flags — which point whichever way an
      // unbeamed note's stem goes — disagreed with the beams above them.
      // `generateBeams` tells each note it belongs to a beam, and a note that
      // knows that draws no flag and takes its stem direction from the group.
      //
      // BEAMED IN FOURS, AND WHATEVER'S LEFT IS BEAMED TOO.
      //
      // `generateBeams` with a group of 4/8 does the fours correctly and then
      // abandons the remainder: fourteen eighths came out as three beamed
      // groups and TWO LOOSE FLAGGED NOTES at the end of every line. Two
      // eighths in a row are beamed together — they don't stand as singles —
      // so the grouping is done here instead, where the rule can be stated
      // plainly: take up to four, beam anything that isn't alone, and let a
      // genuinely lone eighth keep its flag.
      //
      // (Left entirely to itself VexFlow groups in twos, which for a scale run
      // draws a row of dashes rather than a line of music — hence fours.)
      // FOURS, THEN PAIRS — and never a note left standing alone if a pair
      // can take it.
      //
      // Fours are the shape of the beat. But a line rarely divides by four:
      // fifteen eighths is three fours and a three, and a straight walk would
      // leave that three as a beam of two plus a lone flagged note. So the
      // TAIL is planned before it's drawn — whatever doesn't divide into fours
      // is split into twos, and only a genuinely odd single is left flagged.
      const beams: Beam[] = [];
      if (isRun) {
        const sizes: number[] = [];
        let left = staveNotes.length;
        while (left >= BEAM_GROUP + 2 || left === BEAM_GROUP) {
          sizes.push(BEAM_GROUP);
          left -= BEAM_GROUP;
        }
        // What's left is 0, or too small for a four: pairs, then any odd one.
        while (left >= 2) {
          sizes.push(2);
          left -= 2;
        }
        // A LONE NOTE JOINS ITS NEIGHBOUR rather than standing off on its own.
        // Fifteen eighths can't divide into fours and twos at all — it's odd —
        // so something has to give, and a beamed three reads far better than a
        // flagged single hanging at the end of the line.
        if (left === 1) {
          if (sizes.length > 0) sizes[sizes.length - 1] += 1;
          else sizes.push(1);
        }

        let at = 0;
        for (const size of sizes) {
          const group = staveNotes.slice(at, at + size);
          if (group.length > 1) beams.push(new Beam(group));
          at += size;
        }
      }

      // The two staves are formatted TOGETHER so a note and its fret number
      // line up in the same column. Formatting them separately is what makes
      // notation and tab drift apart across a long run.
      const voice = new Voice({ numBeats: line.length, beatValue: 4 })
        .setStrict(false)
        .addTickables(staveNotes);
      const tabVoice = new Voice({ numBeats: line.length, beatValue: 4 })
        .setStrict(false)
        .addTickables(tabNotes);

      const startX = Math.max(stave.getNoteStartX(), tab.getNoteStartX());
      stave.setNoteStartX(startX);
      tab.setNoteStartX(startX);

      new Formatter()
        .joinVoices([voice])
        .joinVoices([tabVoice])
        .format([voice, tabVoice], staveWidth - startX - 10);

      voice.draw(ctx, stave);
      tabVoice.draw(ctx, tab);
      beams.forEach((b) => b.setContext(ctx).draw());
    });

    // LET IT SCALE. VexFlow sizes the SVG in fixed pixels, which means four
    // seventh-chord systems can't share a row that would hold them at 90% —
    // they just wrap. It also writes a viewBox, so handing the width over to
    // CSS is enough to make the drawing responsive: it shrinks to its column
    // and never grows past the size it was engraved at.
    const svg = el.querySelector('svg');
    if (svg) {
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.width = '100%';
      svg.style.height = 'auto';
    }

    return () => {
      el.innerHTML = '';
    };
  }, [events, strings, staffPx, measured, keyboard]);

  return <div className="system" ref={host} aria-label="Notation and tablature" />;
}
