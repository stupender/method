// ============================================================================
// ui/bars.ts — a progression: the bars in the dock, and what each one says
// ----------------------------------------------------------------------------
// A BAR IS A SAVED PANEL. Each bar holds a whole ModuleState — key, scale,
// degree, view, voicing, everything the control panel sets — so selecting a
// bar is just "make the panel this". That's why a progression needs so little
// new machinery: the panel already knew how to be anything; the dock only
// remembers several of them in order.
//
// This file is the progression's DATA: the shape of a bar, how it's kept in
// this browser, and what each bar SAYS on the dock (its chord, its key, and
// its job in the song). No React here — the dock draws it, the app owns it.
// ============================================================================

import { defaultModuleState, type ModuleState } from './moduleState';
import { ROOT_CHOICES } from '../data/roots';
import { SCALES } from '../data/scales';
import { diatonicChords } from '../theory/harmony';
import { noteName } from '../theory/notes';
import { rankKeys, type Interpretation } from '../theory/suggest';
import type { ChordDefinition, Note } from '../theory/types';

export interface Bar {
  id: string;
  /** Everything this bar's panel is set to. */
  state: ModuleState;
  /**
   * Bumped when the bar is REPLACED from outside its panel — restoring a saved
   * setting into it, say. The panel only reads its setting when it first
   * appears, so a new `rev` is how the app says "start over from this".
   */
  rev: number;
}

export interface Progression {
  bars: Bar[];
  /** The id of the bar the panel is showing. */
  selected: string;
}

const STORAGE_KEY = 'method.progression.v1';
const FALLBACK_SCALE = Object.keys(SCALES)[0];

/** A fresh, unique bar id. */
export function newBarId(): string {
  return `bar-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** One bar holding `state` (or the panel's default setting). */
export function makeBar(state?: ModuleState): Bar {
  return { id: newBarId(), state: state ?? defaultModuleState(FALLBACK_SCALE), rev: 0 };
}

/**
 * The progression saved in this browser, or a single default bar.
 * Never throws: a broken or missing store reads as "start fresh".
 *
 * Stored bars are laid over the default setting, so a bar saved before some
 * newer setting existed still opens with every field filled in.
 */
export function loadProgression(): Progression {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Progression>;
      const bars = (parsed.bars ?? [])
        .filter((b) => b && typeof b.id === 'string' && b.state)
        .map((b) => ({
          id: b.id,
          rev: 0,
          state: { ...defaultModuleState(FALLBACK_SCALE), ...b.state },
        }));
      if (bars.length > 0) {
        const selected = bars.some((b) => b.id === parsed.selected)
          ? (parsed.selected as string)
          : bars[0].id;
        return { bars, selected };
      }
    }
  } catch {
    // Unreadable store: fall through to a fresh progression.
  }
  const first = makeBar();
  return { bars: [first], selected: first.id };
}

export function saveProgression(p: Progression): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // A full or disabled store shouldn't take the page down with it.
  }
}

// ---------------------------------------------------------------------------
// WHAT A BAR SAYS
// ---------------------------------------------------------------------------

export interface BarSummary {
  /** "D7", "Fm", "Cmaj7" — or null when the bar is a whole key (Gravity All). */
  symbol: string | null;
  /** "G Major", "C Harmonic Minor". */
  keyName: string;
  /** The chord itself, for the function engine. Absent for a whole-key bar. */
  root?: Note;
  chord?: ChordDefinition;
}

/**
 * What a bar holds, read from its panel setting.
 *
 * The CHORD is the one built on the bar's Gravity degree, in its key: Gravity
 * V in G major is D (or D7 with sevenths on). That's true in the Scales view
 * too, where the same degree picks the mode — D Mixolydian is the scale you'd
 * play over that D7, so the bar's harmony is the same either way. Gravity
 * "All" means the bar is the whole key, with no chord singled out.
 */
export function summarize(state: ModuleState): BarSummary {
  const tonic = ROOT_CHOICES[state.rootIndex] ?? ROOT_CHOICES[0];
  const scale = SCALES[state.scaleId] ?? SCALES[FALLBACK_SCALE];
  const keyName = `${noteName(tonic)} ${scale.name}`;
  if (state.degree < 0) return { symbol: null, keyName };
  try {
    const dc = diatonicChords(tonic, scale, state.seventh)[state.degree];
    if (!dc) return { symbol: null, keyName };
    return {
      symbol: noteName(dc.chordRoot) + dc.chord.symbol,
      keyName,
      root: dc.chordRoot,
      chord: dc.chord,
    };
  } catch {
    return { symbol: null, keyName };
  }
}

export interface ProgressionReading {
  /** The key that best explains the bars' chords, e.g. "C Major". */
  keyName: string | null;
  /** One per bar, in order: its job in that key, or null for a whole-key bar. */
  functions: (Interpretation | null)[];
}

/**
 * Each bar's JOB IN THE SONG — I, V/V, iv — read against the single key that
 * best explains the whole progression.
 *
 * This is the same engine Play's lead sheet uses (`rankKeys` in
 * theory/suggest.ts), so the dock and Play can never disagree. It's tolerant:
 * a chord from outside the key reads as a visitor (a secondary dominant, a
 * borrowed chord) rather than knocking the key out.
 */
export function readProgression(summaries: BarSummary[]): ProgressionReading {
  const withChords = summaries
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.root && s.chord);
  const functions: (Interpretation | null)[] = summaries.map(() => null);
  if (withChords.length === 0) return { keyName: null, functions };

  const best = rankKeys(
    withChords.map(({ s }) => ({ root: s.root as Note, chord: s.chord as ChordDefinition })),
  )[0];
  if (!best) return { keyName: null, functions };

  withChords.forEach(({ i }, n) => {
    functions[i] = best.labels[n] ?? null;
  });
  return { keyName: `${noteName(best.tonic)} ${best.scale.name}`, functions };
}
