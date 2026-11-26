import { mixValue, oscillatorValue } from '../core/signal.js';
import { fitCanvas, css } from './canvas.js';

const DIVS_X = 10;
const PAD = { l: 46, r: 10, t: 10, b: 24 };

export function fullScale(state) {
  if (state.scale !== 'auto') return Number(state.scale);
  const peak = state.a.amp + (state.b.on ? state.b.amp : 0) + (state.noise.on ? state.noise.level : 0);
  return peak > 1.25 ? 2.5 : 1.25;
}

/** Draw the oscilloscope. `view` is { start (s), span (s), cursor (0..1 or null) }. */
export function drawScope(canvas, state, view) {
  const { ctx, w, h } = fitCanvas(canvas);
  const pw = w - PAD.l - PAD.r;
  const ph = h - PAD.t - PAD.b;
  const max = fullScale(state);
  const x = (u) => PAD.l + u * pw;
  const y = (v) => PAD.t + ph / 2 - (v / max) * (ph / 2);

  ctx.clearRect(0, 0, w, h);
  ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillStyle = css('--muted');
  ctx.lineWidth = 1;

  const line = (x1, y1, x2, y2, color) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const every = pw < 460 ? 5 : 2;
  for (let i = 0; i <= DIVS_X; i++) {
    const px = x(i / DIVS_X);
    line(px, PAD.t, px, PAD.t + ph, css('--grid'));
    if (i % every === 0) {
      ctx.textAlign = i === 0 ? 'left' : i === DIVS_X ? 'right' : 'center';
      ctx.fillText(`${+((view.span * 1000 * i) / DIVS_X).toPrecision(3)} ms`, px, h - 8);
    }
  }
  ctx.textAlign = 'right';
  for (let i = -2; i <= 2; i++) {
    const v = (max * i) / 2;
    line(PAD.l, y(v), PAD.l + pw, y(v), css(i === 0 ? '--axis' : '--grid'));
    ctx.fillText(String(+v.toFixed(2)), PAD.l - 6, y(v) + 4);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD.l, PAD.t, pw, ph);
  ctx.clip();

  // Several samples per pixel column, drawn as min/max, so dense signals keep
  // their true envelope instead of aliasing on screen.
  const trace = (fn, color, width, alpha = 1) => {
    const columns = Math.max(1, Math.floor(pw));
    const sub = Math.min(64, Math.max(1, Math.ceil((view.span * 4000 * 8) / columns)));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let c = 0; c <= columns; c++) {
      let lo = Infinity, hi = -Infinity, first = 0;
      for (let s = 0; s < sub; s++) {
        const v = fn(view.start + ((c + s / sub) / columns) * view.span);
        if (s === 0) first = v;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      const px = PAD.l + (c / columns) * pw;
      if (c === 0) ctx.moveTo(px, y(first));
      else ctx.lineTo(px, y(first));
      if (sub > 1) {
        ctx.lineTo(px, y(lo));
        ctx.lineTo(px, y(hi));
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  };

  const combined = state.b.on || state.noise.on;
  if (combined) trace((t) => oscillatorValue(state.a, t), css('--a'), 1, 0.55);
  if (state.b.on) trace((t) => oscillatorValue(state.b, t), css('--b'), 1, 0.55);
  trace((t) => mixValue(state, t), css(combined ? '--sum' : '--a'), 2);

  if (view.cursor !== null) line(x(view.cursor), PAD.t, x(view.cursor), PAD.t + ph, css('--text'));
  ctx.restore();
}

export const plotFraction = (canvas, clientX) => {
  const rect = canvas.getBoundingClientRect();
  const u = (clientX - rect.left - PAD.l) / (rect.width - PAD.l - PAD.r);
  return Math.min(1, Math.max(0, u));
};
