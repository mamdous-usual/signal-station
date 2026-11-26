const osc = (freq, amp = 0.8, phase = 0, type = 'sine') => ({ type, freq, amp, phase });
const off = { on: false, ...osc(330) };
const quiet = { on: false, level: 0.1 };

export const PRESETS = [
  { id: 'tone', name: 'Concert A', note: 'A 440 Hz sine. One period lasts about 2.27 ms.',
    state: { a: osc(440), b: off, noise: quiet, windowMs: 10 } },
  { id: 'cycles', name: 'Count the cycles', note: '100 Hz in 50 ms shows 5 cycles. Double the frequency of A and you will see 10.',
    state: { a: osc(100), b: off, noise: quiet, windowMs: 50 } },
  { id: 'constructive', name: 'Constructive', note: 'Same frequency, same phase: the peaks add and the sum is twice as tall.',
    state: { a: osc(220), b: { on: true, ...osc(220) }, noise: quiet, windowMs: 20 } },
  { id: 'destructive', name: 'Destructive', note: 'B is 180° out of phase, so the sum is flat and silent. Move B’s phase to hear it return.',
    state: { a: osc(220), b: { on: true, ...osc(220, 0.8, 180) }, noise: quiet, windowMs: 20 } },
  { id: 'beats', name: 'Beat frequency', note: '440 Hz and 444 Hz: loudness swells 4 times per second.',
    state: { a: osc(440), b: { on: true, ...osc(444) }, noise: quiet, windowMs: 1000 } },
  { id: 'fifth', name: 'Perfect fifth', note: 'A 2:3 frequency ratio. The combined pattern repeats every 10 ms.',
    state: { a: osc(200, 0.7), b: { on: true, ...osc(300, 0.7) }, noise: quiet, windowMs: 20 } },
  { id: 'harmonic', name: 'Building a square', note: 'A sine plus its third harmonic at one third the amplitude starts to look square.',
    state: { a: osc(200, 0.9), b: { on: true, ...osc(600, 0.3) }, noise: quiet, windowMs: 20 } },
  { id: 'noisy', name: 'Tone in noise', note: 'White noise is random and has no period. Raise its level to bury the tone.',
    state: { a: osc(300, 0.7), b: off, noise: { on: true, level: 0.2 }, windowMs: 20 } },
];
