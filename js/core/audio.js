// Web Audio engine. Each "voice group" is a set of sources started at one instant,
// which keeps the relative phase of A and B correct. Structural changes crossfade
// from the old group to a new one, so there are no hard edges (no clicks).
import { periodicCoefficients } from './signal.js';

const RAMP = 0.03;
const HEADROOM = 1 / 3; // three sources at most, so their sum stays within range
const HARMONICS = 256;  // the browser drops any that would exceed Nyquist

export const audioSupported = () => Boolean(globalThis.AudioContext || globalThis.webkitAudioContext);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.group = null;
    this.noiseBuffer = null;
    this.suspendTimer = null;
  }

  get playing() { return this.group !== null; }

  /** Must be called from a user gesture (autoplay policy). */
  async start(state) {
    if (!this.ctx) {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = state.volume;
      this.master.connect(this.ctx.destination);
    }
    clearTimeout(this.suspendTimer);
    await this.ctx.resume();
    this.master.gain.setTargetAtTime(state.volume, this.ctx.currentTime, RAMP / 3);
    this.rebuild(state);
  }

  stop() {
    if (!this.group) return;
    this.release(this.group);
    this.group = null;
    this.suspendTimer = setTimeout(() => this.ctx?.suspend(), 200);
  }

  /** Replace all sources (waveform, phase, on/off changes, or re-aligning phase). */
  rebuild(state) {
    if (!this.ctx) return;
    if (this.group) this.release(this.group);
    const ctx = this.ctx;
    const when = ctx.currentTime + 0.005;
    const group = { out: ctx.createGain(), parts: {} };
    group.out.gain.setValueAtTime(0, ctx.currentTime);
    group.out.gain.setValueAtTime(0, when);
    group.out.gain.linearRampToValueAtTime(1, when + RAMP);
    group.out.connect(this.master);

    const add = (key, source, level) => {
      const gain = ctx.createGain();
      gain.gain.value = level * HEADROOM;
      source.connect(gain).connect(group.out);
      source.start(when);
      group.parts[key] = { source, gain };
    };
    const oscillator = (o) => {
      const node = ctx.createOscillator();
      const { real, imag } = periodicCoefficients(o.type, o.phase, HARMONICS);
      node.setPeriodicWave(ctx.createPeriodicWave(real, imag, { disableNormalization: true }));
      node.frequency.value = o.freq;
      return node;
    };

    add('a', oscillator(state.a), state.a.amp);
    if (state.b.on) add('b', oscillator(state.b), state.b.amp);
    if (state.noise.on) {
      const node = ctx.createBufferSource();
      node.buffer = this.getNoise();
      node.loop = true;
      add('noise', node, state.noise.level);
    }
    this.group = group;
  }

  /** Smoothly apply continuous parameters without restarting sources. */
  update(state) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (param, value) => param.setTargetAtTime(value, t, RAMP / 3);
    set(this.master.gain, state.volume);
    if (!this.group) return;
    const { a, b, noise } = this.group.parts;
    for (const [part, o] of [[a, state.a], [b, state.b]]) {
      if (!part) continue;
      set(part.source.frequency, o.freq);
      set(part.gain.gain, o.amp * HEADROOM);
    }
    if (noise) set(noise.gain.gain, state.noise.level * HEADROOM);
  }

  release(group) {
    const t = this.ctx.currentTime;
    const gain = group.out.gain;
    const current = gain.value;
    gain.cancelScheduledValues(t);
    gain.setValueAtTime(current, t);
    gain.linearRampToValueAtTime(0, t + RAMP);
    const parts = Object.values(group.parts);
    parts.forEach(({ source }, i) => {
      source.onended = () => {
        source.disconnect();
        parts[i].gain.disconnect();
        if (i === 0) group.out.disconnect();
      };
      source.stop(t + RAMP + 0.02);
    });
  }

  getNoise() {
    if (!this.noiseBuffer) {
      const { sampleRate } = this.ctx;
      this.noiseBuffer = this.ctx.createBuffer(1, sampleRate * 2, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }

  dispose() {
    clearTimeout(this.suspendTimer);
    this.stop();
    clearTimeout(this.suspendTimer);
    this.ctx?.close();
    this.ctx = this.master = this.group = this.noiseBuffer = null;
  }
}
