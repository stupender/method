// ============================================================================
// ui/FunctionQuizView.tsx — ear training: name each chord's FUNCTION
// ----------------------------------------------------------------------------
// The function layer of ear training (Arc 2 riding Arc 1's engine). The app
// picks a RANDOM major key and plays a four-chord progression whose first chord
// is always the I — that's the ear's anchor; everything else is heard RELATIVE
// to it. You then name chords 2–4 by function: the diatonic numerals, plus
// SECONDARY DOMINANTS (V7/x) when they're in the pool — because real songs
// reach outside the key, and hearing that reach is the skill (Stu's note:
// "sometimes progressions will have ii-V of the IV... those are important").
//
// The pool of functions is the difficulty dial: narrow it to drill I/IV/V,
// widen it to every degree and every V7/x. Same quiz rhythm as the quality
// quiz: play, answer, immediate green/red, running score.
// ============================================================================

import { useState } from 'react';
import type { Note } from '../theory/types';
import { MAJOR_SCALE } from '../data/scales';
import { ROOT_CHOICES } from '../data/roots';
import { DOMINANT_SEVENTH } from '../data/chords';
import { P5 } from '../data/intervals';
import { diatonicChords } from '../theory/harmony';
import { realizeScale } from '../theory/scale';
import { parallelMinorOf } from '../theory/suggest';
import { spellNoteFromInterval, midiOf, noteName } from '../theory/notes';
import { playChord } from '../audio/player';

// One function the quiz can ask about. Labels are key-independent (the roman is
// the same string in every major key), so we compute them once from C.
interface FnOption {
  id: string;
  label: string; // "ii7", "V7/IV", "♭VII7", ...
  kind: 'diatonic' | 'secondary' | 'borrowed';
  degree: number; // diatonic: the degree itself; secondary: the TARGET degree;
  // borrowed: the degree IN THE PARALLEL MINOR
}

const C = ROOT_CHOICES[0];
const OPTIONS: FnOption[] = [];
for (const [i, d] of diatonicChords(C, MAJOR_SCALE, true).entries()) {
  OPTIONS.push({ id: `d${i}`, label: d.roman, kind: 'diatonic', degree: i });
}
for (const [i, t] of diatonicChords(C, MAJOR_SCALE, false).entries()) {
  // A V7 pointing at each degree except the tonic (that's just the plain V7)
  // and the diminished vii° (no V7 of °).
  if (i === 0 || t.chord.id === 'diminished-triad') continue;
  OPTIONS.push({ id: `s${i}`, label: `V7/${t.roman}`, kind: 'secondary', degree: i });
}
{
  // Borrowed from the parallel minor — the three every jazz/pop tune leans on:
  // iv7, ♭VImaj7 and ♭VII7 (the backdoor dominant). Same ♭-labelling convention
  // as interpretInKey: the minor's 3rd/6th/7th degrees sit a half-step below
  // major's, so degrees 2/5/6 get a ♭ (iv, at degree 3, doesn't).
  const { modeRoot, modeScale } = parallelMinorOf(C);
  for (const i of [3, 5, 6]) {
    const d = diatonicChords(modeRoot, modeScale, true)[i];
    const flat = i === 2 || i === 5 || i === 6 ? '♭' : '';
    OPTIONS.push({ id: `b${i}`, label: flat + d.roman, kind: 'borrowed', degree: i });
  }
}
const OPTION_BY_ID = new Map(OPTIONS.map((o) => [o.id, o]));

// The actual chord an option means in a given key.
function chordFor(o: FnOption, tonic: Note) {
  if (o.kind === 'diatonic') {
    const d = diatonicChords(tonic, MAJOR_SCALE, true)[o.degree];
    return { root: d.chordRoot, chord: d.chord };
  }
  if (o.kind === 'borrowed') {
    const { modeRoot, modeScale } = parallelMinorOf(tonic);
    const d = diatonicChords(modeRoot, modeScale, true)[o.degree];
    return { root: d.chordRoot, chord: d.chord };
  }
  const target = realizeScale(tonic, MAJOR_SCALE)[o.degree].note;
  return { root: spellNoteFromInterval(target, P5), chord: DOMINANT_SEVENTH };
}
const midisFor = (o: FnOption, tonic: Note) => {
  const { root, chord } = chordFor(o, tonic);
  return chord.intervals.map((iv) => midiOf(spellNoteFromInterval(root, iv)));
};

// One round: a key, the three unknown slots (chords 2–4), and a SNAPSHOT of the
// pool (so narrowing the pool mid-round can't strand the correct answer).
interface Question {
  tonicIndex: number;
  slots: string[]; // option ids for chords 2, 3, 4
  pool: string[];
}

export function FunctionQuizView() {
  // The difficulty dial. Default: every diatonic degree, plus a taste of
  // outside (V7/IV and V7/V) — widen or narrow from there.
  const [enabled, setEnabled] = useState<Set<string>>(
    new Set(['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 's3', 's4']),
  );
  const [question, setQuestion] = useState<Question | null>(null);
  const [slotIndex, setSlotIndex] = useState(0); // which of chords 2–4 we're naming
  const [guess, setGuess] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const toggle = (id: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Play a question's progression: the I first (the anchor), then the slots.
  const playQuestion = (q: Question) => {
    const tonic = ROOT_CHOICES[q.tonicIndex];
    const seq = [
      midisFor(OPTION_BY_ID.get('d0')!, tonic),
      ...q.slots.map((id) => midisFor(OPTION_BY_ID.get(id)!, tonic)),
    ];
    seq.forEach((midis, i) => setTimeout(() => playChord(midis), i * 750));
  };

  // A new round: random key, three functions from the pool (no immediate
  // repeats — hearing the same chord twice in a row teaches nothing).
  const newQuestion = () => {
    const pool = [...enabled];
    const slots: string[] = [];
    for (let i = 0; i < 3; i++) {
      let pick = pool[Math.floor(Math.random() * pool.length)];
      while (pool.length > 1 && pick === slots[i - 1]) {
        pick = pool[Math.floor(Math.random() * pool.length)];
      }
      slots.push(pick);
    }
    const q = {
      tonicIndex: Math.floor(Math.random() * ROOT_CHOICES.length),
      slots,
      pool,
    };
    setQuestion(q);
    setSlotIndex(0);
    setGuess(null);
    setRevealed(false);
    playQuestion(q);
  };

  const answer = (id: string) => {
    if (!question || revealed) return;
    setGuess(id);
    setRevealed(true);
    setScore((s) => ({
      correct: s.correct + (id === question.slots[slotIndex] ? 1 : 0),
      total: s.total + 1,
    }));
  };

  // After the reveal: the next unknown chord, or a fresh progression.
  const next = () => {
    if (!question) return;
    if (slotIndex < question.slots.length - 1) {
      setSlotIndex(slotIndex + 1);
      setGuess(null);
      setRevealed(false);
    } else {
      newQuestion();
    }
  };

  // The reveal line: what the chord actually was, named in its key.
  const revealText = () => {
    if (!question) return null;
    const tonic = ROOT_CHOICES[question.tonicIndex];
    const o = OPTION_BY_ID.get(question.slots[slotIndex])!;
    const { root, chord } = chordFor(o, tonic);
    return (
      <>
        chord {slotIndex + 2} was <strong>{noteName(root)}{chord.symbol}</strong> —
        the <strong>{o.label}</strong> in {noteName(tonic)} major
      </>
    );
  };

  const diatonicOptions = OPTIONS.filter((o) => o.kind === 'diatonic');
  const secondaryOptions = OPTIONS.filter((o) => o.kind === 'secondary');
  const borrowedOptions = OPTIONS.filter((o) => o.kind === 'borrowed');

  return (
    <>
      <p className="tagline">
        Ear training — name each chord's <strong>function</strong> in the key.
      </p>

      {/* The pool: which functions can appear. In-key degrees, and the reaches. */}
      <div className="view-controls">
        <div className="controls-row">
          <span className="control-label">In key</span>
          <div className="control-group" role="group" aria-label="Diatonic functions">
            {diatonicOptions.map((o) => (
              <button
                key={o.id}
                className={enabled.has(o.id) ? 'pill pill--on' : 'pill'}
                onClick={() => toggle(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="controls-row">
          <span className="control-label">Reaching out</span>
          <div className="control-group" role="group" aria-label="Secondary dominants">
            {secondaryOptions.map((o) => (
              <button
                key={o.id}
                className={enabled.has(o.id) ? 'pill pill--on' : 'pill'}
                onClick={() => toggle(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div className="controls-row">
          <span className="control-label">Borrowed</span>
          <div className="control-group" role="group" aria-label="Borrowed chords">
            {borrowedOptions.map((o) => (
              <button
                key={o.id}
                className={enabled.has(o.id) ? 'pill pill--on' : 'pill'}
                onClick={() => toggle(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {question === null ? (
        <button className="pill pill--play" onClick={newQuestion}>
          ▶ Start
        </button>
      ) : (
        <>
          <div className="controls-row">
            <button className="pill pill--play" onClick={() => playQuestion(question)}>
              ▶ Replay
            </button>
            {revealed && (
              <button className="pill" onClick={next}>
                {slotIndex < question.slots.length - 1 ? 'Next chord →' : 'Next progression →'}
              </button>
            )}
            <span className="quiz-score">
              {score.correct} / {score.total}
            </span>
          </div>

          <p className="control-hint">
            Chord 1 is the <strong>I</strong> — your anchor. What is chord{' '}
            {slotIndex + 2} of 4?
          </p>
          <div className="control-group control-group--wrap" role="group" aria-label="Your answer">
            {question.pool.map((id) => {
              const o = OPTION_BY_ID.get(id)!;
              const isAnswer = id === question.slots[slotIndex];
              const isGuess = id === guess;
              let cls = 'pill';
              if (revealed && isAnswer) cls += ' pill--correct';
              else if (revealed && isGuess) cls += ' pill--wrong';
              return (
                <button key={id} className={cls} disabled={revealed} onClick={() => answer(id)}>
                  {o.label}
                </button>
              );
            })}
          </div>

          {revealed && (
            <p className="tagline">
              {guess === question.slots[slotIndex] ? 'Correct — ' : 'Not quite — '}
              {revealText()}.
            </p>
          )}
        </>
      )}

      <footer className="footnote">
        The key is random every round, so you're hearing each chord's{' '}
        <em>relationship</em> to the I, not absolute pitches. The V7/x chords step
        outside the key; borrowed chords (iv7, ♭VImaj7, ♭VII7) darken into the
        parallel minor — those pulls and colours are what you're learning to catch.
      </footer>
    </>
  );
}
