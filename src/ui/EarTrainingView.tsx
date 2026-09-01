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
import { EarProgress } from './EarProgress';
import { loadProgress, recordAnswer } from './earStats';
import './EarTest.css';
import { CHORDS } from '../data/chords';
import { spellNoteFromInterval, midiOf, noteName } from '../theory/notes';
import { playChord } from '../audio/player';
import { FunctionQuizView } from './FunctionQuizView';
import {
  earMaterial,
  pickOne,
  type EarSelection,
  type EarMaterial,
  type EarChord,
} from '../theory/earMaterial';
import { InversionQuizView } from './InversionQuizView';

// The Ear Training area: a shell that picks WHICH skill to drill. Quality =
// "what did I hear?" (key-agnostic); Inversion = "which tone is on the bottom?"
// (the lean of a voicing); Function = "what is it doing in the key?" (roman
// numerals + secondary dominants + borrowed, riding the function engine).
export function EarTrainingView({
  selection,
  quiz,
}: {
  selection: EarSelection;
  // Which drill — chosen in the CONTROLS panel, like everything else.
  quiz: 'quality' | 'inversion' | 'function';
}) {
  // What the CONTROLS panel above has put in play. The quizzes draw from this
  // rather than inventing their own pools, so what you hear is always
  // something you asked for.
  const material = earMaterial(selection);
  return (
    <>
      {/* One block, like the neck and the CONTROLS panel — the drills used to
          float loose on the page under a bare row of buttons. Which drill it is
          now comes from the CONTROLS panel like every other choice. */}
      <section className="quizpanel">
        <header className="quizpanel__head">
          <span className="quizpanel__title">Ear Training Test</span>
        </header>
        <div className="quizpanel__body">
          {material.chords.length === 0 ? (
            <p className="control-hint control-hint--warn">
              Nothing to quiz yet — choose at least one key, one scale, and one
              quality in the Triads or Sevenths rows above.
            </p>
          ) : quiz === 'inversion' ? (
            <InversionQuizView material={material} />
          ) : quiz === 'function' ? (
            <FunctionQuizView />
          ) : (
            /* The default, and today the only one the panel can ask for. */
            <QualityQuiz material={material} />
          )}
        </div>
      </section>
    </>
  );
}

// The MIDI notes of a chord in root position (root + its chord tones).
function chordMidis(c: EarChord): number[] {
  return c.chord.intervals.map((iv) => midiOf(spellNoteFromInterval(c.root, iv)));
}

function QualityQuiz({ material }: { material: EarMaterial }) {
  // The qualities that actually occur in the chosen material — no invented
  // pool. Narrowing the CONTROLS above narrows these, so the answers on offer
  // are always the answers that are possible.
  const qualities = [...new Set(material.chords.map((c) => c.chord.id))].map(
    (id) => CHORDS[id],
  );
  const [question, setQuestion] = useState<EarChord | null>(null);
  const [guess, setGuess] = useState<string | null>(null); // the chosen quality id
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  // WHAT YOUR EAR HAS LEARNED, as opposed to how this sitting is going. The
  // score above resets when you close the tab; this doesn't. Held in state as
  // well as in storage so the readout moves the moment you answer. See
  // ui/earStats.ts.
  const [progress, setProgress] = useState(loadProgress);
  // True for the moment a chord is sounding, so the glow can bloom with it.
  // A timer rather than an audio callback: the swell is a flourish on the
  // attack, not a meter, and tying it to playback state would mean threading
  // one through for no visible gain.
  const [sounding, setSounding] = useState(false);
  const bloom = () => {
    setSounding(true);
    window.setTimeout(() => setSounding(false), 700);
  };

  // Pose a new question: one of the chords actually in play, then sound it.
  const newQuestion = () => {
    const c = pickOne(material.chords);
    if (!c) return;
    setQuestion(c);
    setGuess(null);
    setRevealed(false);
    playChord(chordMidis(c));
    bloom();
  };

  const replay = () => {
    if (!question) return;
    playChord(chordMidis(question));
    bloom();
  };

  const answer = (id: string) => {
    if (!question || revealed) return;
    setGuess(id);
    setRevealed(true);
    const right = id === question.chord.id;
    setScore((s) => ({
      correct: s.correct + (right ? 1 : 0),
      total: s.total + 1,
    }));
    // Tallied against the QUALITY that was played, not the one you guessed —
    // the question is how well you know that sound, and a wrong answer is
    // evidence about the sound you were played.
    setProgress(recordAnswer('quality', question.chord.id, right));
  };

  return (
    <>
      <div className={revealed ? 'eartest eartest--settled' : 'eartest'}>
        {/* THE ORB IS THE SOUND. Press it to hear the chord — first time, or
            again. One thing to press, in one place, rather than a Start button
            that becomes a Replay button somewhere else. Its glow drifts while
            the chord is unnamed and stills when you've answered. */}
        <button
          className={
            'eartest__orb' +
            (revealed ? ' eartest__orb--settled' : '') +
            (sounding ? ' eartest__orb--sounding' : '')
          }
          onClick={question === null ? newQuestion : replay}
          aria-label={question === null ? 'Play the first chord' : 'Play it again'}
        >
          {/* The seven degrees, orbiting — see EarTest.css. */}
          <span className="eartest__ring" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <span key={n} className="eartest__spark">
                <i />
              </span>
            ))}
          </span>
          <span className="eartest__face" aria-hidden="true">
            {/* Plain ink — the colour is in the orbit around it. */}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.2v13.6L19 12z" />
            </svg>
          </span>
        </button>

        {question === null ? (
          <p className="eartest__hint">Press to hear a chord.</p>
        ) : (
          <>
            <p className="eartest__hint">
              Press again to hear it{' '}
              {score.total > 0 && (
                <span className="eartest__tally">
                  · {score.correct}/{score.total} this sitting
                </span>
              )}
            </p>

            <p className="eartest__ask">What quality did you hear?</p>

            <div
              className="eartest__answers"
              role="group"
              aria-label="Your answer"
            >
              {qualities.map((c) => {
                const isAnswer = c.id === question.chord.id;
                const isGuess = c.id === guess;
                let cls = 'eartest__answer';
                if (revealed && isAnswer) cls += ' eartest__answer--right';
                else if (revealed && isGuess) cls += ' eartest__answer--wrong';
                else if (revealed) cls += ' eartest__answer--quiet';
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

            {/* The answer and the way onward together, below a rule — so
                "what was it" and "go again" are one moment rather than two
                controls in different corners. */}
            {revealed && (
              <div className="eartest__verdict">
                <p className="eartest__said">
                  {guess === question.chord.id ? 'Correct — ' : 'Not quite — '}
                  that was{' '}
                  <strong>
                    {noteName(question.root)} {question.chord.name}
                  </strong>
                  , the <strong>{question.roman}</strong> of{' '}
                  {noteName(question.tonic)} {question.scale.name}.
                </p>
                <button className="eartest__next" onClick={newQuestion}>
                  Next chord →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <EarProgress
        progress={progress}
        quiz="quality"
        nameOf={(id) => CHORDS[id]?.name ?? id}
        onCleared={() => setProgress({})}
      />

      <footer className="footnote">
        The chords come from whatever you put in play in the CONTROLS above —
        keys, scales and degrees. Narrow them to drill one sound; widen them to
        stretch. The answers on offer are only ever the qualities that can
        actually occur in what you selected.
      </footer>
    </>
  );
}
