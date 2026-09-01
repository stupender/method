// ============================================================================
// ui/earStats.ts — what your ear has actually learned
// ----------------------------------------------------------------------------
// The quiz kept a score for as long as you stayed on the page, which answers
// "how am I doing right now" and nothing else. What a guitarist wants to know
// is whether the thing they couldn't hear last month is a thing they can hear
// today, and that needs the answers to outlive the session.
//
// SO IT'S A TALLY PER ITEM, and the item is the point rather than the total.
// "72% overall" is a number you can't do anything with; "you're 90% on major
// and minor and 40% on half-diminished" tells you what to put on tonight.
//
// LOCAL FIRST, AND LOCAL IS ENOUGH FOR NOW. This is one browser's history, in
// that browser. No account, no server, nothing to sign up for — and it's
// exactly the thing that later makes an account worth making, which is the
// order that keeps the offer honest: build the value first, then ask.
//
// IT ALSO HAPPENS TO BE THE DATA an adaptive quiz would need — per-item
// accuracy is what you'd bias the next question against. That's deliberately
// NOT built (see the build brief: it's a counter and a sort, not AI, and it
// should wait until real use shows what people actually miss). Storing the
// tally now costs nothing and means the day it's wanted, the history is there
// rather than starting from empty.
//
// NAMED earStats RATHER THAN earProgress because the component beside it is
// EarProgress.tsx, and on a case-insensitive filesystem — which macOS is by
// default — `./EarProgress` resolved to THIS file instead of the component.
// The import failed at run time and only at run time; the type-checker was
// perfectly happy. Two files whose names differ only in case is a trap worth
// not setting.
// ============================================================================

const STORAGE_KEY = 'method.ear.v1';

/** How one item has gone: how many asked, how many right. */
export interface Tally {
  correct: number;
  total: number;
}

/** quiz name -> item name -> tally. */
export type Progress = Record<string, Record<string, Tally>>;

/** Never throws: a broken or blocked store reads as "nothing learned yet". */
export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Progress) : {};
  } catch {
    return {};
  }
}

function write(progress: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // A full or disabled store shouldn't cost you the answer you just gave.
  }
}

/**
 * Record one answer and hand back the updated progress.
 *
 * Returns rather than mutating so the caller can put it straight into state —
 * the readout should change the moment you answer, not on the next reload.
 */
export function recordAnswer(
  quiz: string,
  item: string,
  correct: boolean,
): Progress {
  const progress = loadProgress();
  const forQuiz = progress[quiz] ?? {};
  const tally = forQuiz[item] ?? { correct: 0, total: 0 };
  forQuiz[item] = {
    correct: tally.correct + (correct ? 1 : 0),
    total: tally.total + 1,
  };
  progress[quiz] = forQuiz;
  write(progress);
  return progress;
}

/** Start again — offered next to the readout, because a fresh start is a real
 *  thing to want and a tally you can't reset is a tally you stop trusting. */
export function clearProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

export interface Standing {
  correct: number;
  total: number;
  /** 0–100, or null when nothing has been asked yet. */
  accuracy: number | null;
  /** Weakest first — the useful order, since that's what to practise. */
  byItem: { item: string; correct: number; total: number; accuracy: number }[];
}

/** Where one quiz stands. */
export function standing(progress: Progress, quiz: string): Standing {
  const forQuiz = progress[quiz] ?? {};
  const byItem = Object.entries(forQuiz)
    .map(([item, t]) => ({
      item,
      correct: t.correct,
      total: t.total,
      accuracy: t.total ? Math.round((t.correct / t.total) * 100) : 0,
    }))
    // Weakest first, and among equals the one you've done most of — that's the
    // one you've had the most chances to learn and haven't.
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);

  const correct = byItem.reduce((n, i) => n + i.correct, 0);
  const total = byItem.reduce((n, i) => n + i.total, 0);
  return {
    correct,
    total,
    accuracy: total ? Math.round((correct / total) * 100) : null,
    byItem,
  };
}
