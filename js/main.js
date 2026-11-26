import { mixValue, periodMs, cyclesInWindow, beatFrequency } from './core/signal.js';
import { defaultState, sanitize } from './core/state.js';
import { PRESETS } from './core/presets.js';
import { AudioEngine, audioSupported } from './core/audio.js';
import { drawScope, plotFraction } from './ui/scope.js';
import { oscillatorControls } from './ui/controls.js';
import { initSampling } from './ui/sampling.js';

const KEY = 'signal-station:v1';
const $ = (sel) => document.querySelector(sel);

function load() {
  try { return sanitize(JSON.parse(localStorage.getItem(KEY))); } catch { return defaultState(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

let state = load();
const engine = new AudioEngine();
const canvas = $('#scope');
// sweep: slow-motion scrolling. frozen: snapshot held on screen while controls move.
const view = { offset: 0, cursor: null, sweep: false, frozen: null, singleCycle: false };
let frame = 0;
let lastTime = 0;
let rebuildTimer = 0;

const shownState = () => view.frozen?.state ?? state;
const shownSpan = () => view.frozen?.span
  ?? (view.singleCycle ? 1 / state.a.freq : state.windowMs / 1000);

function requestDraw() {
  if (!frame) frame = requestAnimationFrame(render);
}

function render(now) {
  frame = 0;
  const running = view.sweep && !view.frozen;
  // One screen width every 4 seconds, whatever the time scale.
  if (running && lastTime) view.offset += ((now - lastTime) / 4000) * shownSpan();
  lastTime = running ? now : 0;
  drawScope(canvas, shownState(), { start: view.offset, span: shownSpan(), cursor: view.cursor });
  updateCursorText();
  if (running) requestDraw();
}

function updateCursorText() {
  if (view.cursor === null) {
    $('#cursor').textContent = 'Hover, tap or use ← → on the display to read values.';
    return;
  }
  const t = view.cursor * shownSpan();
  const v = mixValue(shownState(), view.offset + t);
  $('#cursor').textContent = `Cursor: ${(t * 1000).toFixed(3)} ms · value ${v.toFixed(3)}`;
}

const syncA = oscillatorControls($('#osc-a'), 'a', () => state, changed, commit);
const syncB = oscillatorControls($('#osc-b'), 'b', () => state, changed, commit);

function refresh() {
  syncA();
  syncB();
  $('#b-on').checked = state.b.on;
  $('#osc-b').classList.toggle('off', !state.b.on);
  $('#noise-on').checked = state.noise.on;
  $('#noise-level').value = state.noise.level;
  $('#noise-out').textContent = state.noise.level.toFixed(2);
  $('#window').value = state.windowMs;
  $('#window').disabled = view.singleCycle;
  $('#scale').value = state.scale;
  $('#volume').value = state.volume;
  $('#volume-out').textContent = `${Math.round(state.volume * 200)}%`;

  const play = $('#play');
  play.textContent = engine.playing ? '■ Stop' : '▶ Play';
  play.setAttribute('aria-pressed', String(engine.playing));
  $('#sweep').setAttribute('aria-pressed', String(view.sweep));
  $('#freeze').setAttribute('aria-pressed', String(Boolean(view.frozen)));
  $('#single').setAttribute('aria-pressed', String(view.singleCycle));

  const { a, b } = state;
  const spanMs = (view.singleCycle ? 1 / a.freq : state.windowMs / 1000) * 1000;
  const describe = (o) => `${o.type} ${o.freq} Hz, amp ${o.amp.toFixed(2)}, ${o.phase}°`;
  const rows = [
    ['A', describe(a)],
    ['A period', `${periodMs(a.freq).toFixed(3)} ms`],
    ['A cycles on screen', cyclesInWindow(a.freq, spanMs).toFixed(2)],
    ['Time / division', `${+(spanMs / 10).toPrecision(3)} ms`],
  ];
  if (b.on) {
    rows.push(['B', describe(b)]);
    const beat = beatFrequency(a.freq, b.freq);
    if (beat > 0 && beat <= 20) rows.push(['Beat frequency', `${+beat.toFixed(2)} Hz`]);
  }
  $('#readouts').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('#frozen-badge').hidden = !view.frozen;
  requestDraw();
}

/** Called after any edit. structural = sources must be restarted. */
function changed(structural) {
  $('#preset-note').textContent = '';
  if (engine.playing) {
    engine.update(state);
    if (structural) scheduleRebuild();
  }
  save();
  refresh();
}

// Throttled so dragging the phase slider does not create hundreds of nodes.
function scheduleRebuild() {
  if (rebuildTimer) return;
  rebuildTimer = setTimeout(() => {
    rebuildTimer = 0;
    if (engine.playing) engine.rebuild(state);
  }, 60);
}

// After a frequency drag, restart sources together to restore the set phases.
function commit() {
  if (engine.playing) scheduleRebuild();
}

async function togglePlay() {
  if (!audioSupported()) return;
  try {
    if (engine.playing) engine.stop();
    else await engine.start(state);
    $('#message').textContent = '';
  } catch (error) {
    $('#message').textContent = `Audio could not start: ${error.message}`;
  }
  refresh();
}

function toggleFreeze() {
  view.frozen = view.frozen ? null : { state: structuredClone(state), span: shownSpan() };
  refresh();
}

function reset() {
  engine.stop();
  state = defaultState();
  Object.assign(view, { offset: 0, cursor: null, sweep: false, frozen: null, singleCycle: false });
  $('#preset-note').textContent = '';
  $('#message').textContent = '';
  save();
  refresh();
}

$('#play').addEventListener('click', togglePlay);
$('#freeze').addEventListener('click', toggleFreeze);
$('#reset').addEventListener('click', reset);
$('#sweep').addEventListener('click', () => {
  view.sweep = !view.sweep;
  if (view.sweep) view.frozen = null;
  else view.offset = 0;
  refresh();
});
$('#single').addEventListener('click', () => {
  view.singleCycle = !view.singleCycle;
  Object.assign(view, { offset: 0, frozen: null, sweep: false });
  refresh();
});
$('#b-on').addEventListener('change', (e) => { state.b.on = e.target.checked; changed(true); });
$('#noise-on').addEventListener('change', (e) => { state.noise.on = e.target.checked; changed(true); });
$('#noise-level').addEventListener('input', (e) => { state.noise.level = Number(e.target.value); changed(false); });
$('#volume').addEventListener('input', (e) => {
  state.volume = Number(e.target.value);
  engine.update(state);
  save();
  refresh();
});
$('#window').addEventListener('change', (e) => { state.windowMs = Number(e.target.value); view.offset = 0; save(); refresh(); });
$('#scale').addEventListener('change', (e) => { state.scale = e.target.value; save(); refresh(); });

$('#copy').addEventListener('click', async () => {
  const { volume, ...settings } = state;
  try {
    await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
    $('#message').textContent = 'Settings copied.';
  } catch {
    $('#message').textContent = 'Copy was blocked by the browser.';
  }
});
$('#export').addEventListener('click', () => {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#04100d';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  const link = Object.assign(document.createElement('a'), { href: out.toDataURL('image/png'), download: 'signal-station.png' });
  link.click();
});

for (const preset of PRESETS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = preset.name;
  button.addEventListener('click', () => {
    state = sanitize({ ...structuredClone(preset.state), volume: state.volume, scale: 'auto' });
    Object.assign(view, { offset: 0, frozen: null, singleCycle: false });
    if (engine.playing) engine.rebuild(state);
    save();
    refresh();
    $('#preset-note').textContent = preset.note;
  });
  $('#presets').append(button);
}

canvas.addEventListener('pointermove', (e) => { view.cursor = plotFraction(canvas, e.clientX); requestDraw(); });
canvas.addEventListener('pointerdown', (e) => { view.cursor = plotFraction(canvas, e.clientX); requestDraw(); });
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') { view.cursor = null; requestDraw(); }
});
canvas.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') view.cursor = null;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const step = (e.shiftKey ? 0.05 : 0.005) * (e.key === 'ArrowLeft' ? -1 : 1);
    view.cursor = Math.min(1, Math.max(0, (view.cursor ?? 0.5) + step));
  } else return;
  requestDraw();
});

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (e.target.closest('input, select, button, summary, a, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key.toLowerCase() === 'f') toggleFreeze();
  else if (e.key.toLowerCase() === 'r') reset();
});

window.addEventListener('pagehide', () => { engine.dispose(); refresh(); });
new ResizeObserver(requestDraw).observe(canvas);

if (!audioSupported()) {
  $('#play').disabled = true;
  $('#message').textContent = 'This browser has no Web Audio support. The visual tools still work.';
}
initSampling($('#sampling'));
refresh();
