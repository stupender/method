// ============================================================================
// audio/player.ts — Web Audio note playback
// ----------------------------------------------------------------------------
// The AUDIO layer. Plain Web Audio (no Tone.js). It exposes a tiny seam — three
// functions — so the rest of the app just says "play this note" without knowing
// anything about oscillators. If you later drop in the synth/transport code from
// Archive or Soundscape, this is the ONLY file that changes.
//
// How Web Audio works in one breath: you build a little graph of nodes — here a
// tone generator (oscillator) -> a volume control (gain) -> the speakers
// (destination) — and schedule them on the audio clock. The gain envelope (a
// quick rise then a slow fade) is what turns a flat buzz into a pluck-like note.
// ============================================================================

// One shared AudioContext for the whole app, created lazily. Browsers won't let
// audio start until the user interacts, so we create/resume it on first play.
let audioContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  // If the browser suspended it (autoplay policy), wake it back up.
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
}

// The shared AudioContext, for callers that need to read its clock (e.g. the
// Song playhead, which animates off `ctx.currentTime`). Same single context.
export function getAudioContext(): AudioContext {
  return getContext();
}

// Convert a MIDI note number to its frequency in Hz. A=440 is MIDI 69, and every
// 12 semitones doubles the frequency — that's this formula.
export function frequencyOfMidi(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Schedule one note to start at `when` (a time on the audio clock) and last
// `duration` seconds. This is the single place a note is built — both playNote
// and playSequence go through it, and it's what you'd replace to use your own
// synth from Archive/Soundscape.
function scheduleNote(
  ctx: AudioContext,
  midi: number,
  when: number,
  duration: number,
  destination: AudioNode = ctx.destination,
): OscillatorNode {
  // Tone generator. A triangle wave is soft and warm, good for an instrument.
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = frequencyOfMidi(midi);

  // A gentle low-pass filter rounds off the harsh high harmonics.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2200;

  // Volume envelope: near-silent -> quick attack -> slow exponential fade.
  // (We ramp to/from a tiny value, not 0, because exponential ramps can't hit 0.)
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(0.28, when + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

  // Wire the graph (oscillator -> filter -> volume -> `destination`) and run it.
  // `destination` is usually the speakers, but the transport routes through a
  // master gain it can mute, so it passes that instead. We return the oscillator
  // so the transport can stop it early on Pause.
  osc.connect(filter).connect(gain).connect(destination);
  osc.start(when);
  osc.stop(when + duration + 0.05);
  return osc;
}

// A short metronome click — a dry percussive blip, not a tone. The downbeat (the
// first beat of a bar) is "accented": a touch higher and louder.
function scheduleClick(
  ctx: AudioContext,
  when: number,
  accent: boolean,
  destination: AudioNode,
): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = accent ? 2000 : 1400;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.12, when + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
  osc.connect(gain).connect(destination);
  osc.start(when);
  osc.stop(when + 0.06);
  return osc;
}

// Play a single note (given as a MIDI number) for `duration` seconds, now.
export function playNote(midi: number, duration = 1.1): void {
  const ctx = getContext();
  scheduleNote(ctx, midi, ctx.currentTime, duration);
}

// Play a list of notes one after another, `gap` seconds apart (e.g. a scale).
// Scheduling on the audio clock keeps the timing steady and drift-free.
export function playSequence(midis: number[], gap = 0.34): void {
  const ctx = getContext();
  const start = ctx.currentTime;
  midis.forEach((midi, i) => scheduleNote(ctx, midi, start + i * gap, 0.9));
}

// Play notes together as a chord, with a tiny `strum` delay between voices so it
// sounds plucked across the strings rather than mechanically simultaneous.
export function playChord(midis: number[], strum = 0.022): void {
  const ctx = getContext();
  const start = ctx.currentTime;
  midis.forEach((midi, i) => scheduleNote(ctx, midi, start + i * strum, 1.6));
}

// One chord in a transport: its notes, when it starts and how long it lasts
// (both in SECONDS, relative to beat 0).
export interface ChordEvent {
  midis: number[];
  atSec: number;
  durSec: number;
}

// One metronome click: when it sounds (seconds from beat 0) and whether it's an
// accented downbeat. Caller builds the list, so it can do count-ins, partial
// bars, etc. — the transport just plays whatever times it's handed.
export interface ClickEvent {
  atSec: number;
  accent: boolean;
}

export interface PlaybackOptions {
  chordEvents: ChordEvent[]; // the chords to strum (empty if chord audio is muted)
  clicks?: ClickEvent[]; // metronome clicks (empty = metronome off)
  leadInSec?: number; // a beat of silence before beat 0, so playback starts clean
}

// A running transport: the audio-clock time of beat 0 (so the UI can animate a
// playhead off `getAudioContext().currentTime`), and a stop() to cut it short.
export interface Playback {
  startTime: number;
  stop: () => void;
}

// Start a progression playing and hand back a handle to stop it (for Pause).
// Everything routes through one master gain so a single ramp-to-silence cleanly
// kills all the scheduled chords and clicks at once; we also stop each oscillator
// so nothing keeps running after Pause.
export function startPlayback(opts: PlaybackOptions): Playback {
  const ctx = getContext();
  const start = ctx.currentTime + (opts.leadInSec ?? 0.12);

  const master = ctx.createGain();
  master.gain.value = 1;
  master.connect(ctx.destination);

  const oscs: OscillatorNode[] = [];
  for (const e of opts.chordEvents) {
    e.midis.forEach((midi, i) =>
      oscs.push(scheduleNote(ctx, midi, start + e.atSec + i * 0.018, e.durSec, master)),
    );
  }
  (opts.clicks ?? []).forEach((c) => {
    oscs.push(scheduleClick(ctx, start + c.atSec, c.accent, master));
  });

  const stop = () => {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    oscs.forEach((o) => {
      try {
        o.stop(now + 0.05);
      } catch {
        /* already stopped — fine */
      }
    });
    setTimeout(() => master.disconnect(), 120);
  };

  return { startTime: start, stop };
}
