import type { Theme } from "./i18n";
import type { Door } from "./score";
import { doorTimes, sceneDuration } from "./scene";

const RATE = 48_000;
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

type Ctx = OfflineAudioContext;

function tone(ctx: Ctx, out: AudioNode, at: number, dur: number, freq: number, type: OscillatorType, vol: number, glideTo?: number) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at); o.stop(at + dur + 0.02);
}

function noiseBuffer(ctx: Ctx) {
  const b = ctx.createBuffer(1, RATE, RATE), d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; }
  return b;
}

function noise(ctx: Ctx, out: AudioNode, buf: AudioBuffer, at: number, dur: number, vol: number, cutoff: number, sweepTo?: number) {
  const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = buf; n.loop = true;
  f.type = "lowpass"; f.frequency.setValueAtTime(cutoff, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  n.connect(f).connect(g).connect(out);
  n.start(at); n.stop(at + dur + 0.02);
}

// Minor and spooky at 4/4 for Halloween; a major 3/4 waltz for Día de Muertos.
const SCORES = {
  halloween: {
    beat: 0.25,
    bass: [45, 45, 52, 45, 41, 41, 48, 41, 43, 43, 50, 43, 40, 40, 47, 44],
    melody: [69, 0, 72, 76, 0, 72, 69, 0, 65, 0, 69, 72, 0, 69, 65, 0, 67, 0, 71, 74, 0, 71, 67, 0, 68, 0, 71, 76, 0, 74, 71, 68],
    wave: "square" as OscillatorType,
  },
  muertos: {
    beat: 0.2,
    bass: [48, 0, 0, 43, 0, 0, 41, 0, 0, 43, 0, 0],
    melody: [72, 76, 79, 76, 79, 84, 69, 72, 77, 72, 77, 81, 71, 74, 79, 74, 79, 83, 72, 76, 79, 84, 79, 76],
    wave: "triangle" as OscillatorType,
  },
};

function music(ctx: Ctx, out: AudioNode, theme: Theme, duration: number) {
  const s = SCORES[theme];
  const bassBus = ctx.createGain(); bassBus.gain.value = 0.16; bassBus.connect(out);
  const melodyBus = ctx.createGain(); melodyBus.gain.value = 0.05; melodyBus.connect(out);
  for (let step = 0, t = 0; t < duration - 1; step++, t = step * s.beat) {
    const b = s.bass[step % s.bass.length];
    if (b && (theme === "muertos" || step % 2 === 0)) tone(ctx, bassBus, t, s.beat * 1.8, midi(b), "triangle", 1);
    const m = s.melody[step % s.melody.length];
    if (m) tone(ctx, melodyBus, t, s.beat * 1.4, midi(m), s.wave, 1);
  }
}

export async function renderSoundtrack(doors: Door[], theme: Theme): Promise<AudioBuffer> {
  const duration = sceneDuration(doors.length);
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * RATE), RATE);
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  const buf = noiseBuffer(ctx);

  music(ctx, comp, theme, duration);

  doors.forEach((door, i) => {
    const { knock, react } = doorTimes(i);
    for (let k = 0; k < 3; k++) {
      tone(ctx, comp, knock + k * 0.25, 0.1, 150, "sine", 0.6, 70);
      noise(ctx, comp, buf, knock + k * 0.25, 0.05, 0.3, 900);
    }
    if (door.outcome === "treat") {
      [76, 79, 84, 88].forEach((n, j) => tone(ctx, comp, react + j * 0.08, 0.32, midi(n), "triangle", 0.3));
    } else {
      tone(ctx, comp, react, 1.1, 220, "sawtooth", 0.22, 42);
      noise(ctx, comp, buf, react, 1.2, 0.3, 3200, 200);
    }
  });

  const end = duration - 5;
  const chord = theme === "muertos" ? [60, 64, 67, 72] : [57, 60, 64, 69];
  chord.forEach((n) => tone(ctx, comp, end, 3.8, midi(n), "triangle", 0.2));

  return ctx.startRendering();
}
