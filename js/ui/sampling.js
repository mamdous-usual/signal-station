// Visual-only sampling experiment. Nothing here produces audio.
import { TAU, signedAlias, aliasFrequency } from '../core/signal.js';
import { fitCanvas, css } from './canvas.js';

export function initSampling(root) {
  const canvas = root.querySelector('canvas');
  const fIn = root.querySelector('#sig-f');
  const fsIn = root.querySelector('#sig-fs');
  const out = root.querySelector('#sampling-result');

  function draw() {
    const f = Number(fIn.value);
    const fs = Number(fsIn.value);
    root.querySelector('#sig-f-out').textContent = `${f} Hz`;
    root.querySelector('#sig-fs-out').textContent = `${fs} samples/s`;

    const alias = aliasFrequency(f, fs);
    if (f * 2 < fs) out.textContent = `Below Nyquist (${fs / 2} Hz): the samples represent ${f} Hz correctly.`;
    else if (f * 2 === fs) out.textContent = `Exactly at Nyquist (${fs / 2} Hz): the result depends on phase. Here every sample lands on zero.`;
    else out.textContent = `Aliased: above Nyquist (${fs / 2} Hz), so ${f} Hz is indistinguishable from ${alias} Hz.`;
    out.classList.toggle('warn', f * 2 >= fs);

    const { ctx, w, h } = fitCanvas(canvas);
    const y = (v) => h / 2 - v * (h / 2 - 10);
    const curve = (freq, color, width, dash) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      for (let px = 0; px <= w; px++) ctx.lineTo(px, y(Math.sin(TAU * freq * (px / w))));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = css('--grid');
    ctx.fillRect(0, h / 2, w, 1);
    curve(f, css('--a'), 1.5, []);
    curve(signedAlias(f, fs), css('--b'), 2, [7, 5]);
    ctx.fillStyle = css('--text');
    for (let n = 0; n <= fs; n++) {
      ctx.beginPath();
      ctx.arc((n / fs) * w, y(Math.sin((TAU * f * n) / fs)), 3.5, 0, TAU);
      ctx.fill();
    }
  }

  fIn.addEventListener('input', draw);
  fsIn.addEventListener('input', draw);
  new ResizeObserver(draw).observe(canvas);
}
