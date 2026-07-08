// ============================================================================
// ui/EarTrainingView.tsx — the ear-training quiz (MVP: chord quality)
// ----------------------------------------------------------------------------
// The first ear-training mode: the app plays a chord on a RANDOM root (so the
// absolute pitch isn't a cue — you can't memorise "that bright one is always C")
// and you name its QUALITY. You narrow/widen which qualities are in play. No key,
// no root-by-name: naming an absolute root with no reference is a perfect-pitch
// task; root/bass identification arrives later, relative to a tonic, with the
// progression layer. Quality (and soon inversion) is what relative pitch hears.
//
// It's a thin UI over pieces we already have: the chord data, correct spelling,
// and the Web Audio player. See BACKLOG.md "Ear training" for the bigger plan.
// ============================================================================

import { useState } from 'react';
import { CHORDS } from '../data/chords';
import { ROOT_CHOICES } from '../data/roots';
import { spellNoteFromInterval, midiOf, noteName } from '../theory/notes';
import { playChord } from '../audio/player';
import { FunctionQuizView } from './FunctionQuizView';
import { InversionQuizView } from './InversionQuizView';
import { Segmented } from './Segmented';

const CHORD_LIST = Object.values(CHORDS);

// The Ear Training area: a shell that picks WHICH skill to drill. Quality =
// "what did I hear?" (key-agnostic); Inversion = "which tone is on the bottom?"
// (the lean of a voicing); Function = "what is it doing in the key?" (roman
// numerals + secondary dominants + borrowed, riding the function engine).
export function EarTrainingView() {
  const [quiz, setQuiz] = useState<'quality' | 'inversion' | 'function'>('quality');
  return (
    <>
      <div className="controls">
        <Segmented
          ariaLabel="Quiz"
          options={[
            { value: 'quality' as const, label: 'Chord quality' },
            { value: 'inversion' as const, label: 'Inversion' },
            { value: 'function' as const, label: 'Function' },
          ]}
          value={quiz}
          onChange={setQuiz}
        />
      </div>
      {quiz === 'quality' ? (
        <QualityQuiz />
      ) : quiz === 'inversion' ? (
        <InversionQuizView />
      ) : (
        <FunctionQuizView />
      )}
    </>
  );
}

// A quiz question: which root the chord is built on, and which quality it is.
interface Question {
  rootIndex: number;
  chordId: string;
}

// The MIDI notes of a chord in root position (root + its chord tones).
function chordMidis(q: Question): number[] {
  const root = ROOT_CHOICES[q.rootIndex];
  return CHORDS[q.chordId].intervals.map((iv) => midiOf(spellNoteFromInterval(root, iv)));
}

function QualityQuiz() {
  // Which qualities are in play. Start gentle — three clearly different sounds.
  const [enabled, setEnabled] = useState<Set<string>>(
    new Set(['major-triad', 'minor-triad', 'dominant-seventh']),
  );
  const [question, setQuestion] = useState<Question | null>(null);
  const [guess, setGuess] = useState<string | null>(null); // the chosen quality id
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const enabledList = CHORD_LIST.filter((c) => enabled.has(c.id));

  // Toggle a quality in/out of the pool (never let it go empty).
  const toggleQuality = (id: string) => {
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

  // Pose a new question: a random enabled quality on a random root, then play it.
  const newQuestion = () => {
    const ids = [...enabled];
    const chordId = ids[Math.floor(Math.random() * ids.length)];
    const rootIndex = Math.floor(Math.random() * ROOT_CHOICES.length);
    const q = { rootIndex, chordId };
    setQuestion(q);
    setGuess(null);
    setRevealed(false);
    playChord(chordMidis(q));
  };

  const replay = () => question && playChord(chordMidis(question));

  // Answer = pick a quality. We reveal immediately and score it.
  const answer = (id: string) => {
    if (!question || revealed) return;
    setGuess(id);
    setRevealed(true);
    setScore((s) => ({
      correct: s.correct + (id === question.chordId ? 1 : 0),
      total: s.total + 1,
    }));
  };

  return (
    <>
      <p className="tagline">Ear training — name the chord quality you hear.</p>

      {/* Which qualities are in the pool. Narrow for an easier drill, widen for a
          harder one. */}
      <div className="view-controls">
        <div className="control-group control-group--wrap" role="group" aria-label="Qualities in play">
          {CHORD_LIST.map((c) => (
            <button
              key={c.id}
              className={enabled.has(c.id) ? 'pill pill--on' : 'pill'}
              onClick={() => toggleQuality(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {question === null ? (
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

          <p className="control-hint">What quality did you hear?</p>
          <div className="control-group control-group--wrap" role="group" aria-label="Your answer">
            {enabledList.map((c) => {
              const isAnswer = c.id === question.chordId;
              const isGuess = c.id === guess;
              let cls = 'pill';
              if (revealed && isAnswer) cls += ' pill--correct';
              else if (revealed && isGuess) cls += ' pill--wrong';
              return (
                <button
                  key={c.id}
                  className={cls}
                  disabled={revealed}
                  onClick={() => answer(c.id)}
                >
                  {c.name}
                </button>
              );
            })}
          </div>

          {revealed && (
            <p className="tagline">
              {guess === question.chordId ? 'Correct — ' : 'Not quite — '}that was a{' '}
              <strong>
                {noteName(ROOT_CHOICES[question.rootIndex])} {CHORDS[question.chordId].name}
              </strong>
              .
            </p>
          )}
        </>
      )}

      <footer className="footnote">
        The root is randomised each time, so you're hearing the quality, not
        memorising a pitch. Narrow the pool to drill two sounds; widen it to stretch.
      </footer>
    </>
  );
}
