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
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  TabNote,
  TabStave,
  Voice,
} from 'vexflow';
import type { PlacedNote } from '../theory/types';
import { Beam } from 'vexflow';
import './System.css';

const STAFF_TOP = 0;
const TAB_TOP = 76;
// Tall enough for SIX tab lines and the fret numbers that sit on the lowest of
// them. At 190 the bottom string's line fell outside the SVG and was clipped —
// a five-string guitar, which is a hard thing to un-see once you've seen it.
const HEIGHT = 212;

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
  width,
}: {
  // Each entry is one moment: the notes sounding together at it.
  events: PlacedNote[][];
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
    const duration = moments.length === 1 ? 'w' : '8';

    const drawWidth = width ?? measured;
    if (!drawWidth) return; // nothing drawn until we know how much room there is

    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(drawWidth, HEIGHT);
    const ctx = renderer.getContext();

    const staveWidth = drawWidth - 2;
    const stave = new Stave(0, STAFF_TOP, staveWidth);
    // "8vb" is the little 8 under the clef: sounds an octave lower than
    // written, which is what guitar notation means.
    stave.addClef('treble', 'default', '8vb');
    stave.setContext(ctx).draw();

    const tab = new TabStave(0, TAB_TOP, staveWidth);
    tab.addClef('tab');
    // The T A B letters are drawn tall and the formatter doesn't leave much
    // after them, so the first fret number lands against the A and the B. A few
    // pixels of air is all it needs.
    tab.setNoteStartX(tab.getNoteStartX() + 10);
    tab.setContext(ctx).draw();

    // The line down the left that makes these two staves one system.
    new StaveConnector(stave, tab)
      .setType(StaveConnector.type.SINGLE_LEFT)
      .setContext(ctx)
      .draw();

    const staveNotes: StaveNote[] = [];
    const tabNotes: TabNote[] = [];
    for (const moment of moments) {
      const low = [...moment].sort(
        (a, b) => a.position.stringIndex - b.position.stringIndex,
      );
      const note = new StaveNote({
        keys: low.map(vexKey),
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
            // VexFlow strings count 1..6 down from the high e; ours count 0..5
            // up from the low E.
            str: 6 - p.position.stringIndex,
            fret: p.position.fret,
          })),
          duration,
        }),
      );
    }

    // The two staves are formatted TOGETHER so a note and its fret number line
    // up in the same column. Formatting them separately is what makes notation
    // and tab drift apart across a long run.
    const voice = new Voice({ numBeats: moments.length, beatValue: 4 })
      .setStrict(false)
      .addTickables(staveNotes);
    const tabVoice = new Voice({ numBeats: moments.length, beatValue: 4 })
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

    // Beams, but only for a run — a single chord has nothing to beam.
    if (moments.length > 1) {
      Beam.generateBeams(staveNotes).forEach((b) => b.setContext(ctx).draw());
    }

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
  }, [events, width, measured]);

  return <div className="system" ref={host} aria-label="Notation and tablature" />;
}
