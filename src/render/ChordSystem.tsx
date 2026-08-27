// ============================================================================
// render/ChordSystem.tsx — one voicing, as notation over tablature
// ----------------------------------------------------------------------------
// A staff and a TAB staff joined down the left by a connector: a SYSTEM, the
// way guitar music is set on paper.
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

import { useEffect, useRef } from 'react';
import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  TabNote,
  TabStave,
} from 'vexflow';
import type { PlacedNote } from '../theory/types';
import './ChordSystem.css';

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

export function ChordSystem({
  placed,
  width = 210,
}: {
  placed: PlacedNote[];
  width?: number;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    el.innerHTML = ''; // effects can run twice in development
    if (placed.length === 0) return;

    const renderer = new Renderer(el, Renderer.Backends.SVG);
    renderer.resize(width, HEIGHT);
    const ctx = renderer.getContext();

    const staveWidth = width - 2;
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

    const low = [...placed].sort(
      (a, b) => a.position.stringIndex - b.position.stringIndex,
    );

    // One whole note holding every pitch — a voicing, not a rhythm.
    const chord = new StaveNote({
      keys: low.map(vexKey),
      duration: 'w',
      clef: 'treble',
    });
    low.forEach((p, i) => {
      if (p.note.accidental !== 0) {
        chord.addModifier(new Accidental(ACCIDENTAL_CODE[p.note.accidental]), i);
      }
    });

    const tabChord = new TabNote({
      positions: low.map((p) => ({
        // VexFlow strings count 1..6 down from the high e; ours count 0..5 up
        // from the low E.
        str: 6 - p.position.stringIndex,
        fret: p.position.fret,
      })),
      duration: 'w',
    });

    Formatter.FormatAndDraw(ctx, stave, [chord]);
    Formatter.FormatAndDraw(ctx, tab, [tabChord]);

    return () => {
      el.innerHTML = '';
    };
  }, [placed, width]);

  return <div className="system" ref={host} aria-label="Notation and tablature" />;
}
