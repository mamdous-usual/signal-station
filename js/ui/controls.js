import { WAVES } from '../core/signal.js';
import { LIMITS, clamp } from '../core/state.js';

// Frequency sliders are logarithmic: equal travel = equal musical interval.
const [FMIN, FMAX] = LIMITS.freq;
const toSlider = (f) => Math.round((Math.log(f / FMIN) / Math.log(FMAX / FMIN)) * 1000);
const fromSlider = (s) => Math.round(FMIN * (FMAX / FMIN) ** (s / 1000));

/** Build one oscillator panel. onChange(structural) reports edits. */
export function oscillatorControls(host, key, getState, onChange, onCommit) {
  const id = (name) => `${key}-${name}`;
  host.innerHTML = `
    <fieldset class="waves"><legend>Waveform</legend>
      ${WAVES.map((w) => `<label><input type="radio" name="${id('type')}" value="${w}"><span>${w}</span></label>`).join('')}
    </fieldset>
    <div class="param"><label for="${id('freq')}">Frequency (Hz)</label>
      <input type="number" id="${id('freq')}" min="${FMIN}" max="${FMAX}" step="1">
      <input type="range" id="${id('freq-r')}" min="0" max="1000" aria-label="Frequency, logarithmic slider"></div>
    <div class="param"><label for="${id('amp')}">Amplitude</label><output id="${id('amp-o')}"></output>
      <input type="range" id="${id('amp')}" min="0" max="1" step="0.01"></div>
    <div class="param"><label for="${id('phase')}">Phase</label><output id="${id('phase-o')}"></output>
      <input type="range" id="${id('phase')}" min="0" max="360" step="1"></div>`;
  const el = (name) => host.querySelector(`#${id(name)}`);
  const radios = [...host.querySelectorAll('input[type=radio]')];
  const osc = () => getState()[key];

  radios.forEach((r) => r.addEventListener('change', () => { osc().type = r.value; onChange(true); }));
  el('freq-r').addEventListener('input', (e) => { osc().freq = fromSlider(e.target.value); onChange(false); });
  el('freq-r').addEventListener('change', onCommit);
  el('freq').addEventListener('change', (e) => {
    osc().freq = clamp(e.target.value, LIMITS.freq, osc().freq);
    e.target.value = osc().freq;
    onChange(true);
  });
  el('amp').addEventListener('input', (e) => { osc().amp = Number(e.target.value); onChange(false); });
  el('phase').addEventListener('input', (e) => { osc().phase = Number(e.target.value); onChange(true); });

  return function sync() {
    const o = osc();
    radios.forEach((r) => { r.checked = r.value === o.type; });
    if (document.activeElement !== el('freq')) el('freq').value = o.freq;
    el('freq-r').value = toSlider(o.freq);
    el('amp').value = o.amp;
    el('phase').value = o.phase;
    el('amp-o').textContent = o.amp.toFixed(2);
    el('phase-o').textContent = `${o.phase}°`;
  };
}
