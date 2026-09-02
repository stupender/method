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
import { noteName } from '../theory/notes';
import { voicingName, structureName } from '../theory/chord';
import { playChord } from '../audio/player';
import { FunctionQuizView } from './FunctionQuizView';
import {
  earMaterial,
  pickOne,
  pickVoicing,
  voicingMidis,
  type EarSelection,
  type EarMaterial,
  type EarChord,
  type EarDifficulty,
  type EarVoicing,
} from '../theory/earMaterial';
import { InversionQuizView } from './InversionQuizView';

// The Ear Training area: a shell that picks WHICH skill to drill. Quality =
// "what did I hear?" (key-agnostic); Inversion = "which tone is on the bottom?"
// (the lean of a voicing); Function = "what is it doing in the key?" (roman
// numerals + secondary dominants + borrowed, riding the function engine).
export function EarTrainingView({
  selection,
  quiz,
  difficulty,
}: {
  selection: EarSelection;
  /** How much the chord is allowed to hide behind its arrangement — root
   *  position and close, any inversion, or any inversion and any spacing.
   *  Chosen in the CONTROLS panel like everything else. */
  difficulty: EarDifficulty;
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
            <QualityQuiz material={material} difficulty={difficulty} />
          )}
        </div>
      </section>
    </>
  );
}

/**
 * How this one was voiced, in words — or nothing at all when it was the plain
 * root-position close chord, which needs no saying.
 *
 * Two names, joined: which tone was in the bass, and how far apart the voices
 * were. `voicingName` already picks the more useful of the two true names for
 * the bass (an inversion number for a close voicing, the bass note itself for
 * a dropped one — see theory/chord.ts), and the spacing is added only when it
 * isn't close.
 */
function arrangement(q: Question): string | null {
  const { structure, inversion } = q.voicing;
  const close = structure.id === 'close';
  if (close && inversion === 0) return null;
  const bass = voicingName(q.chord.chord, structure, inversion).toLowerCase();
  if (close) return bass;
  const spacing = structureName(
    structure,
    q.chord.chord.intervals.length,
  ).toLowerCase();
  return `${spacing}, ${bass}`;
}

// ONE QUESTION: a chord, and the arrangement it's being played in. The two
// travel together because "hear it again" has to play the same thing — see
// pickVoicing in theory/earMaterial.ts.
interface Question {
  chord: EarChord;
  voicing: EarVoicing;
}

function QualityQuiz({
  material,
  difficulty,
}: {
  material: EarMaterial;
  difficulty: EarDifficulty;
}) {
  // The qualities that actually occur in the chosen material — no invented
  // pool. Narrowing the CONTROLS above narrows these, so the answers on offer
  // are always the answers that are possible.
  const qualities = [...new Set(material.chords.map((c) => c.chord.id))].map(
    (id) => CHORDS[id],
  );
  const [question, setQuestion] = useState<Question | null>(null);
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

  // Pose a new question: one of the chords actually in play, arranged as the
  // chosen difficulty allows, then sound it.
  const newQuestion = () => {
    const c = pickOne(material.chords);
    if (!c) return;
    const q = { chord: c, voicing: pickVoicing(c.chord, difficulty) };
    setQuestion(q);
    setGuess(null);
    setRevealed(false);
    playChord(voicingMidis(q.chord.root, q.chord.chord, q.voicing));
    bloom();
  };

  const replay = () => {
    if (!question) return;
    playChord(voicingMidis(question.chord.root, question.chord.chord, question.voicing));
    bloom();
  };

  const answer = (id: string) => {
    if (!question || revealed) return;
    setGuess(id);
    setRevealed(true);
    const right = id === question.chord.chord.id;
    setScore((s) => ({
      correct: s.correct + (right ? 1 : 0),
      total: s.total + 1,
    }));
    // Tallied against the QUALITY that was played, not the one you guessed —
    // the question is how well you know that sound, and a wrong answer is
    // evidence about the sound you were played.
    setProgress(recordAnswer('quality', question.chord.chord.id, right));
  };

  return (
    <>
      <div
        className={
          'eartest' +
          (revealed ? ' eartest--settled' : '') +
          (sounding ? ' eartest--sounding' : '')
        }
      >
        {/* The seven degrees, orbiting — see EarTest.css. */}
        <span className="eartest__ring" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <span key={n} className="eartest__spark">
              <i />
          </span>
          ))}
        </span>

        {/* THE ORB IS THE SOUND. Press it to hear the chord — first time, or
            again. One thing to press, in one place, rather than a Start button
            that becomes a Replay button somewhere else. Its glow drifts while
            the chord is unnamed and stills when you've answered. */}
        <button
          className="eartest__orb"
          onClick={question === null ? newQuestion : replay}
          aria-label={question === null ? 'Play the first chord' : 'Play it again'}
        >
          {/* The close orbit — the small dots, over the weather behind. */}
          <span className="eartest__ring eartest__ring--near" aria-hidden="true">
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

        <p className="eartest__hint">
          {question === null ? (
            'Press to hear a chord.'
          ) : (
            <>
              Press again to hear it{' '}
              {score.total > 0 && (
                <span className="eartest__tally">
                  · {score.correct}/{score.total} this sitting
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {/* THE QUESTION HAS ITS OWN SECTION, and it is ALWAYS THERE.
          Everything below used to live inside the colour field, appearing the
          moment you first pressed play — so the box you were looking at grew
          by half its height under your eyes, which is a jolt in the middle of
          the one screen that's meant to be calm.
          Two fixes in one: the answers move out of the weather and onto plain
          ground, and they're drawn from the start, disabled until there's a
          chord to name. Nothing appears when you press play; something simply
          becomes live. It's better before the first press too — you can see
          the pool you're about to be tested on, which is a fair thing to
          know. */}
      <div className="eartest__quiz">
        <p className="eartest__ask">What quality did you hear?</p>

        <div className="eartest__answers" role="group" aria-label="Your answer">
          {qualities.map((c) => {
            const isAnswer = question !== null && c.id === question.chord.chord.id;
            const isGuess = c.id === guess;
            let cls = 'eartest__answer';
            if (revealed && isAnswer) cls += ' eartest__answer--right';
            else if (revealed && isGuess) cls += ' eartest__answer--wrong';
            else if (revealed) cls += ' eartest__answer--quiet';
            return (
              <button
                key={c.id}
                className={cls}
                disabled={revealed || question === null}
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
        {revealed && question && (
          <div className="eartest__verdict">
            <p className="eartest__said">
              {guess === question.chord.chord.id ? 'Correct — ' : 'Not quite — '}
              that was{' '}
              <strong>
                {noteName(question.chord.root)} {question.chord.chord.name}
              </strong>
              , the <strong>{question.chord.roman}</strong> of{' '}
              {noteName(question.chord.tonic)} {question.chord.scale.name}.
              {/* AND HOW IT WAS ARRANGED, when the arrangement is what made
                  it hard. On Easy every chord is root position and close,
                  so saying so every time would be noise; anything else is
                  the thing you were probably hearing and couldn't place,
                  and naming it is where the learning is. */}
              {arrangement(question) && <> Played {arrangement(question)}.</>}
            </p>
            <button className="eartest__next" onClick={newQuestion}>
              Next chord →
            </button>
          </div>
        )}
      </div>

      <EarProgress
        progress={progress}
        quiz="quality"
        nameOf={(id) => CHORDS[id]?.name ?? id}
        onCleared={() => setProgress({})}
      />

      <footer className="footnote">
        The chords come from whatever you put in play in the CONTROL PANEL
        above —
        keys, scales and degrees. Narrow them to drill one sound; widen them to
        stretch. The answers on offer are only ever the qualities that can
        actually occur in what you selected.{' '}
        {difficulty === 'easy'
          ? 'On Easy every chord arrives in root position, close — the shape you learned it in.'
          : difficulty === 'medium'
            ? 'On Medium any chord tone can be in the bass, so the interval you lean on may not be at the bottom.'
            : 'On Hard the voices are spread as well as inverted — the same notes, much further apart.'}
      </footer>
    </>
  );
}
