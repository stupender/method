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

const LABEL_FONT = "'Karla', system-ui, sans-serif";
const LABEL_SIZE = 11;

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
// Room above the first staff line for the Ascending / Descending label.
const LABEL_ROOM = 16;

const heightFor = (strings: number) =>
  LABEL_ROOM + TAB_TOP + (strings - 1) * TAB_LINE + TAB_MARGIN;
/** Distance from one system to the next when the music wraps. */
const lineHeightFor = (strings: number) => heightFor(strings) + 24;
// The narrowest a note may sit from its neighbour before the music goes onto
// another line instead. Below about this the fret numbers start colliding.
const MIN_NOTE_SPACING = 26;
// Roughly what the clef, the 8 and the T A B take at the left of every system,
// and the breathing room left at the right end.
const CLEF_COLUMN = 56;
const TAIL = 14;
// HOW BIG THE ENGRAVING READS. VexFlow draws at a fixed size — a staff line is
// 10 units apart and that's that — so the way to make everything larger is to
// engrave into a NARROWER page and let the SVG scale up to fill its container.
// At 1.15 a system is drawn as if the column were a seventh narrower, then
// stretched back out: staff lines, note heads, fret numbers and clef all grow
// together, and because it's a viewBox and not a bitmap nothing softens.
//
// It also means fewer notes fit on a line, so a long run wraps sooner.
//
// FOUND BY OVERSHOOTING. This was 1.0 and the fret numbers were too small to
// read; it went to 1.3 and a two-octave scale turned into three enormous
// systems that dominated the page — on a phone the notation was bigger than
// the fretboard it was describing. The real problem at 1.0 was never the
// engraving's size, it was that the fret numbers were set in a music font (see
// the metrics block below); with that fixed, the drawing only needed a nudge.
const ZOOM = 1.15;

// VexFlow wants "c#/4" — letter, accidental, slash, octave. Written pitch, so
// an octave above where the guitar sounds.
const ACCIDENTAL_CODE: Record<number, string> = {
  [-2]: 'bb',
  [-1]: 'b',
  [0]: '',
  [1]: '#',
  [2]: '##',
};

function vexKey(p: PlacedNote): string {
  const octave = (p.note.octave ?? 4) + 1;
  return `${p.note.letter.toLowerCase()}${ACCIDENTAL_CODE[p.note.accidental]}/${octave}`;
}

export function System({
  events,
  strings = 6,
  width,
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
   * Draw at this many units wide. Omit it and the system MEASURES its
   * container and draws at that size instead — which is the difference between
   * a scale run rendered at 860 units and squeezed into a 680px row at 79%
   * (everything shrinks: staff lines, note heads, fret numbers) and one drawn
   * at 680 in the first place, where a staff line is a staff line.
   */
  width?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);

  // Only when no width is given. A chord card wants a fixed engraving that
  // scales down into its column; a run wants the room it actually has.
  //
  // The first measurement is taken SYNCHRONOUSLY in a layout effect rather than
  // waiting for the ResizeObserver, which only delivers at the end of a
  // rendered frame — so in a tab that isn't visible it never fires at all and
  // nothing is ever drawn. The observer then handles later changes, which is
  // what it's good for.
  useLayoutEffect(() => {
    if (width !== undefined) return;
    const el = host.current;
    if (!el) return;
    const w = Math.round(el.getBoundingClientRect().width);
    if (w > 0) setMeasured(w);
  }, [width]);

  useEffect(() => {
    if (width !== undefined) return;
    const el = host.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setMeasured(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.innerHTML = ''; // effects can run twice in development
    const moments = events.filter((e) => e.length > 0);
    if (moments.length === 0) return;
    // A single moment is a chord and gets a whole note; a run of them is read
    // as a line, and eighths beamed in fours are how a scale exercise is
    // written.
    // HOW LONG EACH NOTE IS. A chord is a whole note; a run is eighths — with
    // the LAST note of every line a quarter.
    //
    // That last part is what makes the bars come out even. A two-octave
    // pattern is fifteen notes: fourteen eighths and a quarter is exactly two
    // bars of four, so the ascent fills its bars and the descent fills its
    // own. All eighths would leave each line half a beat short and every line
    // would start mid-bar. It also reads the way the phrase is played — you
    // arrive on the top note and sit on it before turning round.
    const isRun = moments.length > 1;
    const durationAt = (indexInLine: number, lineLength: number) =>
      !isRun ? 'w' : indexInLine === lineLength - 1 ? 'q' : '8';

    // A given width is a fixed engraving that CSS already fits to its column, so
    // zooming it would change nothing you could see. A MEASURED width is the
    // room actually available, and that's where engraving smaller and scaling up
    // buys legibility.
    const drawWidth =
      width !== undefined ? width : measured ? Math.round(measured / ZOOM) : null;
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
    const HEIGHT = heightFor(strings);
    const LINE_HEIGHT = lineHeightFor(strings);

    const room = Math.max(1, drawWidth - CLEF_COLUMN - TAIL);
    const perLine =
      moments.length === 1 ? 1 : Math.max(4, Math.floor(room / MIN_NOTE_SPACING));

    // BREAK IT IN HALF, NOT BY THE YARD.
    //
    // This used to fill each line to capacity and start a new one wherever the
    // count ran out, which put the break at an arbitrary note — a run would
    // turn around in the middle of line two for no reason you could see.
    //
    // A scale run is a shape: up, then back down. Halving it puts the break
    // exactly at the turn, so the ascent is one line and the descent is the
    // next. Halve again if a half still doesn't fit, and the breaks keep
    // landing on the shape's own joints instead of cutting across them.
    //
    // The count is odd (the top note is played once, not twice), so the first
    // half takes the extra note — which is the apex itself. Line one therefore
    // ENDS on the top note and line two begins the way down, which is how
    // you'd read it aloud.
    let lineCount = 1;
    while (Math.ceil(moments.length / lineCount) > perLine) lineCount *= 2;
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
      const top = LABEL_ROOM + lineIndex * LINE_HEIGHT;

      // WHICH WAY THIS LINE GOES, written above it. The run breaks at the
      // turn, so a line is entirely one direction or the other and the label
      // is simply true — read off the notes rather than assumed, so it stays
      // right when a long run halves twice and gives two lines each way.
      if (isRun && lines.length > 1) {
        const lowestOf = (moment: PlacedNote[]) =>
          Math.min(...moment.map((p) => midiOf(p.note)));
        const first = lowestOf(line[0]);
        const last = lowestOf(line[line.length - 1]);
        if (first !== last) {
          ctx.save();
          ctx.setFont(LABEL_FONT, LABEL_SIZE, '600');
          ctx.fillText(last > first ? 'Ascending' : 'Descending', 1, STAFF_TOP + top - 6);
          ctx.restore();
        }
      }

      const stave = new Stave(0, STAFF_TOP + top, staveWidth);
      // "8vb" is the little 8 under the clef: sounds an octave lower than
      // written, which is what guitar notation means.
      stave.addClef('treble', 'default', '8vb');
      stave.setContext(ctx).draw();

      // Ruled for THIS instrument: six lines for a guitar, four for a uke.
      const tab = new TabStave(0, TAB_TOP + top, staveWidth, { numLines: strings });
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
        const clef = tab.getModifiers().find((m) => m instanceof Clef) as Clef | undefined;
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
      let momentIndex = 0;
      for (const moment of line) {
        const low = [...moment].sort(
          (a, b) => a.position.stringIndex - b.position.stringIndex,
        );
        const note = new StaveNote({
          keys: low.map(vexKey),
          duration: durationAt(momentIndex, line.length),
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
            duration: durationAt(momentIndex, line.length),
          }),
        );
        momentIndex++;
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
      const beams: Beam[] = [];
      if (isRun) {
        let group: StaveNote[] = [];
        const flush = () => {
          if (group.length > 1) beams.push(new Beam(group));
          group = [];
        };
        for (const note of staveNotes) {
          if (note.getDuration() !== '8') {
            flush(); // a quarter can't be beamed, and it ends the group
            continue;
          }
          group.push(note);
          if (group.length === BEAM_GROUP) flush();
        }
        flush();
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
  }, [events, strings, width, measured]);

  return <div className="system" ref={host} aria-label="Notation and tablature" />;
}
