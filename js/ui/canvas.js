/** Size a canvas to its CSS box at device resolution; returns a context in CSS pixels. */
export function fitCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const { clientWidth: w, clientHeight: h } = canvas;
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
