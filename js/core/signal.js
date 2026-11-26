// Pure signal math. No DOM, no audio: everything here is unit-testable.
export const TAU = Math.PI * 2;
export const WAVES = ['sine', 'square', 'triangle', 'sawtooth'];

const frac = (x) => x - Math.floor(x);

/** One sample of a unit-amplitude waveform. `cycles` is position measured in periods.
 *  All shapes start a cycle in step with a sine: zero or rising at 0. */
export function waveValue(type, cycles) {
  const p = frac(cycles);
  switch (type) {
    case 'sine': return Math.sin(TAU * p);
    case 'square': return p < 0.5 ? 1 : -1;
    case 'triangle': return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
    case 'sawtooth': return p < 0.5 ? 2 * p : 2 * p - 2;
    default: throw new RangeError(`Unknown waveform: ${type}`);
  }
}

/** Sine-series coefficient of harmonic n (n >= 1) for the shapes above. */
export function harmonic(type, n) {
  const odd = n % 2 === 1;
  switch (type) {
    case 'sine': return n === 1 ? 1 : 0;
    case 'square': return odd ? 4 / (Math.PI * n) : 0;
    case 'triangle': return odd ? (8 / (Math.PI * n) ** 2) * (((n - 1) / 2) % 2 ? -1 : 1) : 0;
    case 'sawtooth': return (2 / (Math.PI * n)) * (odd ? 1 : -1);
    default: throw new RangeError(`Unknown waveform: ${type}`);
  }
}

/** Fourier coefficients for AudioContext.createPeriodicWave, with phase applied.
 *  b·sin(n(wt+φ)) = b·sin(nφ)·cos(nwt) + b·cos(nφ)·sin(nwt) */
export function periodicCoefficients(type, phaseDeg, count) {
  const real = new Float32Array(count + 1);
  const imag = new Float32Array(count + 1);
  const phi = (phaseDeg * Math.PI) / 180;
  for (let n = 1; n <= count; n++) {
    const b = harmonic(type, n);
    real[n] = b * Math.sin(n * phi);
    imag[n] = b * Math.cos(n * phi);
  }
  return { real, imag };
}

export function oscillatorValue(osc, t) {
  return osc.amp * waveValue(osc.type, osc.freq * t + osc.phase / 360);
}

/** Deterministic noise in [-1, 1] so a frozen or redrawn trace does not shimmer. */
export function noiseValue(t) {
  let x = Math.floor(t * 48000) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (((x ^ (x >>> 16)) >>> 0) / 0xffffffff) * 2 - 1;
}

/** Sum of all enabled sources at time t (seconds). */
export function mixValue(state, t) {
  let v = oscillatorValue(state.a, t);
  if (state.b.on) v += oscillatorValue(state.b, t);
  if (state.noise.on) v += state.noise.level * noiseValue(t);
  return v;
}

export const periodMs = (freq) => 1000 / freq;
export const cyclesInWindow = (freq, windowMs) => (freq * windowMs) / 1000;
export const beatFrequency = (f1, f2) => Math.abs(f1 - f2);

/** Signed alias of f sampled at fs. A sine at this frequency passes through the same samples. */
export const signedAlias = (f, fs) => f - fs * Math.round(f / fs);
export const aliasFrequency = (f, fs) => Math.abs(signedAlias(f, fs));
