// ============================================================================
// theory/chord.ts — realize a chord voicing onto the neck
// ----------------------------------------------------------------------------
// THEORY LOGIC layer (pure functions). Two jobs:
//   1. buildVoices  — turn (root + chord + voicing) into ordered, spelled
//      pitches (low -> high). Pure music: stack the chord in close root
//      position, then apply each voice's octave shift. No guitar yet.
//   2. placeVoicing — lay those pitches onto a string set as a PLAYABLE shape,
//      sliding the whole voicing up/down octaves to find a comfortable spot.
// The renderer and TAB just draw the PlacedNote[] this returns.
// ============================================================================

import type {
  Note,
  ChordDefinition,
  VoicingDefinition,
  Instrument,
  Tuning,
  PlacedNote,
  Interval,
} from './types';
import { spellNoteFromInterval, midiOf } from './notes';

// A scale-degree label for a chord tone, derived from its interval. The degree
// number is just "letters moved + 1" (P1 -> 1, M3 -> 3, P5 -> 5, M7 -> 7).
function degreeLabel(interval: Interval): string {
  return String(interval.diatonicSteps + 1);
}

// One voice of a built voicing: the spelled note plus which chord tone it is.
interface Voice {
  note: Note;
  degree: string;
  isRoot: boolean;
}

// Step 1 — stack the chord, then apply the voicing's octave shifts. Returns the
// voices in the LOW->HIGH order the voicing data specifies.
export function buildVoices(
  root: Note,
  chord: ChordDefinition,
  voicing: VoicingDefinition,
): Voice[] {
  // Spell each chord tone once, in close root position above the root.
  const toneByName = new Map<string, { note: Note; interval: Interval }>();
  for (const interval of chord.intervals) {
    toneByName.set(interval.name, {
      note: spellNoteFromInterval(root, interval),
      interval,
    });
  }

  return voicing.tones.map((voice) => {
    const tone = toneByName.get(voice.intervalName);
    if (!tone) {
      throw new Error(
        `Voicing "${voicing.id}" asks for tone ${voice.intervalName} which the chord "${chord.id}" doesn't have.`,
      );
    }
    const baseOctave = tone.note.octave ?? 4;
    return {
      note: { ...tone.note, octave: baseOctave + voice.octaveShift },
      degree: degreeLabel(tone.interval),
      isRoot: tone.interval.diatonicSteps === 0,
    };
  });
}

// The MIDI number of an open string.
function openMidi(tuning: Tuning, stringIndex: number): number {
  return midiOf(tuning.openNotes[stringIndex]);
}

// Step 2 — place the built voicing on the neck. The voicing fixes the voices'
// relative pitches and which string each one goes on (the string set); the only
// freedom left is WHERE on the neck. We try shifting the whole shape by whole
// octaves and keep the lowest one whose frets all fit the neck — a comfortable
// default near the nut.
export function placeVoicing(
  instrument: Instrument,
  tuning: Tuning,
  root: Note,
  chord: ChordDefinition,
  voicing: VoicingDefinition,
): PlacedNote[] {
  const voices = buildVoices(root, chord, voicing);

  // The string set: explicit guitar hint, or a simple contiguous fallback.
  const stringSet =
    voicing.stringSet ?? defaultStringSet(voices.length, instrument.stringCount);

  // Try whole-octave shifts and collect every placement that fits the neck.
  let best: { octaveShift: number; frets: number[]; maxFret: number } | null = null;
  for (let octaveShift = -3; octaveShift <= 3; octaveShift++) {
    const frets = voices.map(
      (v, i) => midiOf(v.note) + 12 * octaveShift - openMidi(tuning, stringSet[i]),
    );
    const fits = frets.every((f) => f >= 0 && f <= instrument.fretCount);
    if (!fits) continue;

    const maxFret = Math.max(...frets);
    if (!best || maxFret < best.maxFret) {
      best = { octaveShift, frets, maxFret };
    }
  }

  if (!best) return []; // no playable position found on this string set

  // Build the PlacedNotes, carrying the octave shift onto the notes so audio
  // plays the pitch you actually see.
  return voices.map((v, i) => ({
    position: { stringIndex: stringSet[i], fret: best!.frets[i] },
    note: { ...v.note, octave: (v.note.octave ?? 4) + best!.octaveShift },
    intervalName: v.degree,
    isRoot: v.isRoot,
  }));
}

// Fallback string set when a voicing doesn't name one: the top N contiguous
// strings. (All v1 voicings name their own set, so this is rarely used.)
function defaultStringSet(voiceCount: number, stringCount: number): number[] {
  const start = Math.max(0, stringCount - voiceCount);
  return Array.from({ length: voiceCount }, (_, i) => start + i);
}
