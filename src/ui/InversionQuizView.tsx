// ============================================================================
// ui/InversionQuizView.tsx — ear training: which chord tone is in the BASS?
// ----------------------------------------------------------------------------
// The third ear-training skill. The app plays a chord on a random root, in a
// random INVERSION — the same tones, rotated so a different one is lowest —
// and you name the bass: root, 3rd, 5th (or 7th, for four-note chords). This
// is the sound of stability vs lean: root position sits, a 3rd-in-bass wants
// to walk, a 5th-in-bass floats. Naming that lean is the skill.
//
// Same rhythm as the other quizzes: a pool of qualities as the difficulty
// dial, play, answer, immediate green/red, running score.
// ============================================================================

import { useState } from 'react';
import { CHORDS } from '../data/chords';
import { ROOT_CHOICES } from '../data/roots';
import { spellNoteFromInterval, midiOf, noteName } from '../theory/notes';
import { inversionName } from '../theory/chord';
import { playChord } from '../audio/player';

const CHORD_LIST = Object.values(CHORDS);

// "Root", "3rd", "5th", "7th" — from an interval's letter-steps (0-based).
// Generic on purpose, so a sus chord's 4th or a 6th chord would label itself.
const ORDINALS = ['Root', '2nd', '3rd', '4th', '5th', '6th', '7th'];
const toneLabel = (diatonicSteps: number) => ORDINALS[diatonicSteps] ?? `${diatonicSteps + 1}th`;

// One question: which chord, on which root, in which inversion.
interface Question {
  rootIndex: number;
  chordId: string;
  inversion: number; // 0 = root position, 1 = 3rd in bass, ...
}

// The chord's tones in close position, ROTATED so tone `inversion` is lowest:
// everything below the chosen bass jumps up an octave. C major, inversion 2 ->
// G C(+12) E(+12) — the classic close second inversion.
function voicedMidis(q: Question): number[] {
  const root = ROOT_CHOICES[q.rootIndex];
  const tones = CHORDS[q.chordId].intervals.map((iv) =>
    midiOf(spellNoteFromInterval(root, iv)),
  );
  return [...tones.slice(q.inversion), ...tones.slice(0, q.inversion).map((m) => m + 12)];
}

export function InversionQuizView() {
  // The difficulty dial: which qualities can appear. Start with the two
  // plainest sounds; widen to sevenths for four answer choices.
  const [enabled, setEnabled] = useState<Set<string>>(
    new Set(['major-triad', 'minor-triad']),
  );
  const [question, setQuestion] = useState<Question | null>(null);
  const [guess, setGuess] = useState<number | null>(null); // the chosen inversion
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const toggle = (id: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size === 1) return prev; // keep at least one quality
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const replay = () => question && playChord(voicedMidis(question));

  // A new round: random enabled quality, random root, random inversion (not
  // the same inversion twice running — that teaches nothing).
  const newQuestion = () => {
    const ids = [...enabled];
    const chordId = ids[Math.floor(Math.random() * ids.length)];
    const count = CHORDS[chordId].intervals.length;
    let inversion = Math.floor(Math.random() * count);
    if (question && count > 1) {
      while (inversion === question.inversion) {
        inversion = Math.floor(Math.random() * count);
      }
    }
    const q = {
      rootIndex: Math.floor(Math.random() * ROOT_CHOICES.length),
      chordId,
      inversion,
    };
    setQuestion(q);
    setGuess(null);
    setRevealed(false);
    playChord(voicedMidis(q));
  };

  const answer = (inv: number) => {
    if (!question || revealed) return;
    setGuess(inv);
    setRevealed(true);
    setScore((s) => ({
      correct: s.correct + (inv === question.inversion ? 1 : 0),
      total: s.total + 1,
    }));
  };

  const qChord = question ? CHORDS[question.chordId] : null;

  return (
    <>
      <p className="tagline">
        Ear training — which chord tone is in the <strong>bass</strong>?
      </p>

      {/* Which qualities are in the pool. Sevenths add the 7th-in-bass answer. */}
      <div className="view-controls">
        <div className="controls-row">
          <span className="control-label">Qualities</span>
          <div className="control-group control-group--wrap" role="group" aria-label="Qualities in play">
            {CHORD_LIST.map((c) => (
              <button
                key={c.id}
                className={enabled.has(c.id) ? 'pill pill--on' : 'pill'}
                onClick={() => toggle(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {question === null || !qChord ? (
        <button className="pill pill--play" onClick={newQuestion}>
          ▶ Start
        </button>
      ) : (
        <>
          <div className="controls-row">
            <button className="pill pill--play" onClick={replay}>
              ▶ Replay
            </button>
            {revealed && (
              <button className="pill" onClick={newQuestion}>
                Next →
              </button>
            )}
            <span className="quiz-score">
              {score.correct} / {score.total}
            </span>
          </div>

          <p className="control-hint">Same chord, rotated — what's on the bottom?</p>
          <div className="control-group" role="group" aria-label="Your answer">
            {qChord.intervals.map((iv, inv) => {
              const isAnswer = inv === question.inversion;
              const isGuess = inv === guess;
              let cls = 'pill';
              if (revealed && isAnswer) cls += ' pill--correct';
              else if (revealed && isGuess) cls += ' pill--wrong';
              return (
                <button key={inv} className={cls} disabled={revealed} onClick={() => answer(inv)}>
                  {toneLabel(iv.diatonicSteps)} in bass
                </button>
              );
            })}
          </div>

          {revealed && (
            <p className="tagline">
              {guess === question.inversion ? 'Correct — ' : 'Not quite — '}that was{' '}
              <strong>
                {noteName(ROOT_CHOICES[question.rootIndex])} {qChord.name}
              </strong>{' '}
              with the{' '}
              <strong>{toneLabel(qChord.intervals[question.inversion].diatonicSteps)}</strong>{' '}
              in the bass ({inversionName(question.inversion).toLowerCase()}).
            </p>
          )}
        </>
      )}

      <footer className="footnote">
        Root position <em>sits</em>; a 3rd in the bass <em>leans</em>; a 5th{' '}
        <em>floats</em>; a 7th <em>pulls down</em>. You're learning to name that
        feeling. The root is randomised, so it's the shape you're hearing, not a
        pitch.
      </footer>
    </>
  );
}
