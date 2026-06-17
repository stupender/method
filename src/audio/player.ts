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
): void {
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

  // Wire the graph (oscillator -> filter -> volume -> speakers) and run it.
  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(when);
  osc.stop(when + duration + 0.05);
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

// Play a progression: each chord strummed at its own time, lasting its own
// duration (both in SECONDS, relative to now). Scheduled on the audio clock so
// the rhythm is tight. Returns nothing; nothing to stop for these short notes.
export function playProgression(
  events: { midis: number[]; atSec: number; durSec: number }[],
): void {
  const ctx = getContext();
  const start = ctx.currentTime + 0.08; // tiny lead-in
  for (const e of events) {
    e.midis.forEach((midi, i) =>
      scheduleNote(ctx, midi, start + e.atSec + i * 0.018, e.durSec),
    );
  }
}
