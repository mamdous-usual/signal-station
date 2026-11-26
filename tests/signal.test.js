import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/core/signal.js';
import { sanitize, defaultState } from '../js/core/state.js';
import { PRESETS } from '../js/core/presets.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('waveform key points', () => {
  near(S.waveValue('sine', 0.25), 1);
  assert.equal(S.waveValue('square', 0.25), 1);
  assert.equal(S.waveValue('square', 0.75), -1);
  near(S.waveValue('triangle', 0.25), 1);
  near(S.waveValue('triangle', 0.75), -1);
  near(S.waveValue('sawtooth', 0.25), 0.5);
  near(S.waveValue('sawtooth', 0.75), -0.5);
});

test('waveforms are periodic, including negative time', () => {
  for (const w of S.WAVES) near(S.waveValue(w, -0.8), S.waveValue(w, 2.2), 1e-9);
});

test('unknown waveform throws', () => assert.throws(() => S.waveValue('x', 0), RangeError));

test('audio coefficients match the drawn shapes and phase', () => {
  for (const type of S.WAVES) {
    for (const phase of [0, 90, 217]) {
      const { real, imag } = S.periodicCoefficients(type, phase, 4000);
      for (const p of [0.1, 0.37, 0.62, 0.9]) {
        const ideal = S.waveValue(type, p + phase / 360);
        const jump = (p + phase / 360) % 1;
        if (Math.abs(jump - 0.5) < 0.02 || jump < 0.02 || jump > 0.98) continue;
        let sum = 0;
        for (let n = 1; n < real.length; n++) sum += real[n] * Math.cos(S.TAU * n * p) + imag[n] * Math.sin(S.TAU * n * p);
        near(sum, ideal, 0.02);
      }
    }
  }
});

test('constructive and destructive interference', () => {
  const state = defaultState();
  state.b = { ...state.a, on: true };
  near(S.mixValue(state, 0.001), 2 * S.oscillatorValue(state.a, 0.001));
  state.b.phase = 180;
  for (let i = 0; i < 100; i++) near(S.mixValue(state, i / 9973), 0, 1e-9);
});

test('period, cycles, beats', () => {
  assert.equal(S.periodMs(100), 10);
  assert.equal(S.cyclesInWindow(100, 50), 5);
  assert.equal(S.beatFrequency(444, 440), 4);
});

test('aliases pass through the same samples', () => {
  assert.equal(S.aliasFrequency(3, 20), 3);
  assert.equal(S.aliasFrequency(17, 20), 3);
  assert.equal(S.aliasFrequency(23, 20), 3);
  assert.equal(S.aliasFrequency(20, 20), 0);
  assert.equal(S.aliasFrequency(10, 20), 10);
  for (const [f, fs] of [[17, 20], [29, 8], [13, 9]]) {
    for (let n = 0; n < fs; n++) {
      near(Math.sin((S.TAU * f * n) / fs), Math.sin((S.TAU * S.signedAlias(f, fs) * n) / fs), 1e-8);
    }
  }
});

test('noise is bounded and repeatable', () => {
  for (let i = 0; i < 1000; i++) {
    const v = S.noiseValue(i / 777);
    assert.ok(v >= -1 && v <= 1);
    assert.equal(v, S.noiseValue(i / 777));
  }
});

test('sanitize clamps and rejects bad input', () => {
  const s = sanitize({ a: { type: 'evil', freq: 1e9, amp: -2, phase: 'x' }, volume: 99, windowMs: 3 });
  assert.deepEqual(s.a, { type: 'sine', freq: 2000, amp: 0, phase: 0 });
  assert.equal(s.volume, 0.5);
  assert.equal(s.windowMs, 20);
  assert.deepEqual(sanitize(null), defaultState());
});

test('every preset survives sanitizing unchanged', () => {
  for (const p of PRESETS) {
    const s = sanitize(p.state);
    for (const key of ['a', 'b', 'noise', 'windowMs']) assert.deepEqual(s[key], p.state[key], `${p.id}.${key}`);
  }
});
