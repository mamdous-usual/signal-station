import { WAVES } from './signal.js';

export const LIMITS = {
  freq: [20, 2000], amp: [0, 1], phase: [0, 360], noise: [0, 0.5], volume: [0, 0.5],
};
export const WINDOWS_MS = [5, 10, 20, 50, 100, 250, 500, 1000];

export function defaultState() {
  return {
    a: { type: 'sine', freq: 220, amp: 0.8, phase: 0 },
    b: { on: false, type: 'sine', freq: 330, amp: 0.8, phase: 0 },
    noise: { on: false, level: 0.1 },
    windowMs: 20,
    scale: 'auto',
    volume: 0.15,
  };
}

export function clamp(value, [min, max], fallback = min) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Turn untrusted input (e.g. stored preferences) into a valid state. */
export function sanitize(input) {
  const d = defaultState();
  const osc = (src = {}, def) => ({
    ...def,
    type: WAVES.includes(src.type) ? src.type : def.type,
    freq: clamp(src.freq, LIMITS.freq, def.freq),
    amp: clamp(src.amp, LIMITS.amp, def.amp),
    phase: clamp(src.phase, LIMITS.phase, def.phase),
  });
  const s = input && typeof input === 'object' ? input : {};
  return {
    a: osc(s.a ?? {}, d.a),
    b: { ...osc(s.b ?? {}, d.b), on: s.b?.on === true },
    noise: { on: s.noise?.on === true, level: clamp(s.noise?.level, LIMITS.noise, d.noise.level) },
    windowMs: WINDOWS_MS.includes(s.windowMs) ? s.windowMs : d.windowMs,
    scale: ['auto', '1.25', '2.5'].includes(s.scale) ? s.scale : d.scale,
    volume: clamp(s.volume, LIMITS.volume, d.volume),
  };
}
