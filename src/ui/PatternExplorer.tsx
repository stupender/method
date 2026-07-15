// ============================================================================
// ui/PatternExplorer.tsx — drill any scale in interval patterns (Possibility)
// ----------------------------------------------------------------------------
// The palta generator, a study mode beside Scales and Harmony. Every drill is
// built from Stu's three ingredients (see theory/pairs.ts): the CELL played at
// each stop, the ANCHOR STEP the stops march by, and how cells are mirrored.
// The presets (3rds–7ths × the ↑↑/↑↓/↓↑/↓↓ contours) cover the classics; the
// CUSTOM cell is the discovery space — type any chain of directed moves
// ("3 -2" = up a 3rd, down a 2nd) and choose how it marches.
//
// THE RUN is always root to root, two octaves out and back (the standard).
// The neck shows the scale constellation; the readout spells the run cell by
// cell; ▶ plays it.
// ============================================================================

import { useState } from 'react';
import type { Note, ScaleDefinition, PlacedNote } from '../theory/types';
import { GUITAR } from '../data/instruments';
import { GUITAR_STANDARD } from '../data/tunings';
import {
  patternRun,
  parseCellMoves,
  describeMove,
  type PatternSpec,
} from '../theory/pairs';
import { placeRun, type RunNote } from '../theory/placeRun';
import { realizeScale } from '../theory/scale';
import { midiOf } from '../theory/notes';
import { playSequence } from '../audio/player';
import { Fretboard } from '../render/Fretboard';
import { TabSequence } from '../render/TabSequence';
import { Segmented } from './Segmented';

// The pair intervals on offer (2 scale steps = a 3rd), plus the open door.
const INTERVAL_CHOICES = [
  { value: 2, label: '3rds' },
  { value: 3, label: '4ths' },
  { value: 4, label: '5ths' },
  { value: 5, label: '6ths' },
  { value: 6, label: '7ths' },
  { value: 'custom', label: 'Custom' },
] as const;

type PairContour = 'up-up' | 'up-down' | 'down-up' | 'down-down';

export function PatternExplorer({
  root,
  scale,
  labelMode = 'degree',
}: {
  root: Note;
  scale: ScaleDefinition;
  // What the dots say — a global display setting, owned by the view above.
  labelMode?: 'note' | 'degree';
}) {
  const [interval, setIntervalChoice] = useState<number | 'custom'>(2); // 3rds
  const [contour, setContour] = useState<PairContour>('up-up');
  // The custom drill: a typed cell, its anchor march, and the zig-zag toggle.
  const [cellText, setCellText] = useState('3 -2');
  const [anchorStep, setAnchorStep] = useState(1);
  const [alternate, setAlternate] = useState(false);

  // The spelled scale tones — the drill's material AND its spelling (F major
  // says B♭, never A♯).
  const tones = realizeScale(root, scale);
  const n = tones.length;

  // The drill spec: a preset pair (contour = the two mirror booleans), or the
  // custom cell as typed.
  const customMoves = parseCellMoves(cellText);
  const spec: PatternSpec | null =
    interval === 'custom'
      ? customMoves && {
          cellMoves: customMoves,
          anchorStep,
          alternate,
          mirrorCell: false,
        }
      : {
          cellMoves: [interval],
          anchorStep: 1,
          alternate: contour === 'up-down' || contour === 'down-up',
          mirrorCell: contour === 'down-down' || contour === 'down-up',
        };

  const indices = spec ? patternRun(n, spec) : [];

  // The run as IDENTIFIED notes (spelling + degree + octave), then placed on
  // the neck the way a hand would play it (theory/placeRun.ts): staying in
  // position while possible, drifting diagonally when the octaves demand it.
  const runNotes: RunNote[] = indices.map((idx) => {
    const wrapped = ((idx % n) + n) % n;
    const tone = tones[wrapped];
    return {
      note: { ...tone.note, octave: (tone.note.octave ?? 4) + Math.floor(idx / n) },
      intervalName: tone.degree,
      isRoot: tone.isRoot,
    };
  });
  const placedRun = placeRun(GUITAR, GUITAR_STANDARD, runNotes);

  // Play what the TAB shows — same placements, same octaves.
  const play = () =>
    placedRun && playSequence(placedRun.map((p) => midiOf(p.note)), 0.26);

  // The TAB, wrapped into lines of whole cells (tablature line breaks).
  const cellSize = (spec?.cellMoves.length ?? 1) + 1;
  const notesPerLine = Math.max(3, Math.floor(24 / cellSize)) * cellSize;
  const tabLines: PlacedNote[][] = [];
  for (let i = 0; placedRun && i < placedRun.length; i += notesPerLine) {
    tabLines.push(placedRun.slice(i, i + notesPerLine));
  }

  // The run's PATH on the neck (deduped): the positions it uses, and the
  // diagonal drift between them, made visible.
  const pathShape: PlacedNote[] = [];
  const seen = new Set<string>();
  for (const p of placedRun ?? []) {
    const key = `${p.position.stringIndex}-${p.position.fret}`;
    if (!seen.has(key)) {
      seen.add(key);
      pathShape.push(p);
    }
  }

  return (
    <>
      <div className="view-controls">
        {/* Row 1 — the drill: which interval (or a custom cell) + play. */}
        <div className="controls-row">
          <Segmented
            ariaLabel="Pair interval"
            options={INTERVAL_CHOICES.map((c) => ({ value: c.value, label: c.label }))}
            value={interval}
            onChange={setIntervalChoice}
          />
          <button className="pill pill--play" onClick={play}>
            ▶ Play pattern
          </button>
        </div>

        {/* Row 2, presets — the contour: which way odd/even pairs are played. */}
        {interval !== 'custom' && (
          <div className="controls-row">
            <span className="control-label">Contour</span>
            <Segmented
              ariaLabel="Contour"
              options={[
                { value: 'up-up' as const, label: '↑ ↑' },
                { value: 'up-down' as const, label: '↑ ↓' },
                { value: 'down-up' as const, label: '↓ ↑' },
                { value: 'down-down' as const, label: '↓ ↓' },
              ]}
              value={contour}
              onChange={setContour}
            />
          </div>
        )}

        {/* Rows 2–3, custom — the discovery space: type a cell, pick its march. */}
        {interval === 'custom' && (
          <>
            <div className="controls-row">
              <span className="control-label">Cell</span>
              <div className="chord-input">
                <input
                  type="text"
                  value={cellText}
                  placeholder="e.g. 3 -2  (up a 3rd, down a 2nd)"
                  aria-label="Custom cell"
                  onChange={(e) => setCellText(e.target.value)}
                />
              </div>
              {customMoves ? (
                <span className="control-hint">
                  {customMoves.map(describeMove).join(', ')}
                </span>
              ) : (
                <span className="control-hint control-hint--warn">
                  numbers with a direction — e.g. 3 -2, or ↓4 ↓2 ↑4
                </span>
              )}
            </div>
            <div className="controls-row">
              <span className="control-label">March</span>
              <Segmented
                ariaLabel="Anchor step"
                options={[
                  { value: 1, label: '↑2nd' },
                  { value: 2, label: '↑3rd' },
                  { value: 3, label: '↑4th' },
                  { value: -1, label: '↓2nd' },
                  { value: -2, label: '↓3rd' },
                  { value: -3, label: '↓4th' },
                ]}
                value={anchorStep}
                onChange={setAnchorStep}
              />
              <button
                className={alternate ? 'pill pill--on' : 'pill'}
                onClick={() => setAlternate((a) => !a)}
              >
                Alternate
              </button>
            </div>
          </>
        )}
      </div>

      {/* The run as TAB, wrapped like real tablature — two octaves out and
          back, fingered in position, drifting up the neck when it must. */}
      {tabLines.length > 0 ? (
        <div className="pattern-tab">
          {tabLines.map((line, i) => (
            <TabSequence
              key={i}
              instrument={GUITAR}
              tuning={GUITAR_STANDARD}
              placed={line}
              ordered
            />
          ))}
        </div>
      ) : (
        spec && (
          <p className="control-hint control-hint--warn">
            This run doesn't fit the neck — try another key or a smaller cell.
          </p>
        )
      )}

      {/* The run's footprint on the neck: the positions it lives in, and the
          diagonal shifts between them. */}
      <Fretboard
        instrument={GUITAR}
        tuning={GUITAR_STANDARD}
        shapes={[pathShape]}
        labelMode={labelMode}
      />

      <footer className="footnote">
        Every run goes root to root, two octaves out and back. The TAB fingers
        it the way a hand would — staying in a scale position while it can,
        then drifting diagonally up the neck. A drill is three choices: the{' '}
        <em>cell</em> at each stop, the <em>march</em> the stops move by (the
        interval nobody states when they say "thirds"), and whether cells{' '}
        <em>alternate</em>. Custom is the discovery space.
      </footer>
    </>
  );
}
