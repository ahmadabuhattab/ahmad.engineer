import './dimension-portal.css';
import { TESSERACT_VERTICES, TESSERACT_EDGES, projectTesseract } from './dimension-math.js';

const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const instances = new WeakMap();

export function initializeDimensionPortal(element = document.getElementById('dimension-iv')) {
  if (!element) return () => {};
  if (instances.has(element)) return instances.get(element);
  const canvas = element.querySelector('canvas');
  const input = element.querySelector('input[type="range"]');
  const output = element.querySelector('output');
  const stage = element.querySelector('.dimension-portal-stage');
  const entry = element.querySelector('[data-lab-form="tesseract"]');
  if (!canvas || !input || !output || !stage) return () => {};
  let drawing;
  try { drawing = canvas.getContext('2d', { alpha: true }); } catch {}
  if (!drawing) {
    input.disabled = true;
    const hint = element.querySelector('#dimension-axis-hint');
    if (hint) hint.textContent = 'Enter Dimension IV to explore the full experiment.';
    element.dataset.dimensionRender = 'static';
    return () => {};
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  const projected = new Float32Array(48);
  const screen = new Float32Array(64);
  const edgeDepth = new Float32Array(32);
  const edgeOrder = Array.from({ length: 32 }, (_, index) => index);
  const faceOrder = Array.from({ length: 24 }, (_, index) => index);
  const faceDepth = new Float32Array(24);
  const faces = new Uint8Array(96);
  let faceOffset = 0;
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    for (let corner = 0; corner < 16; corner++) {
      if (corner & ((1 << a) | (1 << b))) continue;
      faces[faceOffset++] = corner;
      faces[faceOffset++] = corner | (1 << a);
      faces[faceOffset++] = corner | (1 << a) | (1 << b);
      faces[faceOffset++] = corner | (1 << b);
    }
  }
  const colors = [[119, 218, 236], [185, 149, 232], [232, 196, 126]];
  const strokes = colors.map(color => Array.from({ length: 24 }, (_, index) => `rgba(${color.join(',')},${.045 + index * .04})`));
  const faceFills = colors.map(color => `rgba(${color.join(',')},.027)`);
  const dotted = [2, 7], solid = [];
  const edgeColors = new Uint8Array(32);
  for (let edge = 0; edge < 32; edge++) {
    const a = TESSERACT_EDGES[edge * 2], b = TESSERACT_EDGES[edge * 2 + 1];
    edgeColors[edge] = (a ^ b) === 8 ? 2 : a & 8 ? 1 : 0;
  }
  const compareEdges = (a, b) => edgeDepth[a] - edgeDepth[b];
  const compareFaces = (a, b) => faceDepth[a] - faceDepth[b];
  let width = 0, height = 0, dpr = 1, scale = 1, halo;
  let frame = 0, lastFrame = 0, elapsed = 0, visible = false, worldOpen = false, suspended = false, disposed = false;
  let paused = document.body.classList.contains('motion-paused') || (!document.body.classList.contains('motion-enabled') && reduced.matches);
  let fold = clamp(Number(input.value) / 360, 0, 1), targetFold = fold;
  let touchId = null, touchX = 0, touchY = 0;

  function updateReadout(value) {
    const degrees = Math.round(value * 360);
    input.value = String(degrees);
    output.value = `${degrees}°`;
    input.setAttribute('aria-valuetext', `${degrees} degrees through the fourth axis`);
    element.dataset.dimensionFold = value.toFixed(4);
    if (entry) entry.dataset.labFold = value.toFixed(4);
  }

  function render() {
    if (disposed || !width || !height) return;
    projectTesseract(TESSERACT_VERTICES, projected, elapsed, fold);
    const yaw = -.48 + Math.sin(elapsed * .08) * .16;
    const pitch = -.28, sy = Math.sin(yaw), cy = Math.cos(yaw), sx = Math.sin(pitch), cx = Math.cos(pitch);
    let extentX = 0, extentY = 0;
    for (let vertex = 0; vertex < 16; vertex++) {
      const at = vertex * 3, to = vertex * 4;
      const x = projected[at] * cy + projected[at + 2] * sy;
      const z = -projected[at] * sy + projected[at + 2] * cy;
      const y = projected[at + 1] * cx - z * sx;
      const depth = projected[at + 1] * sx + z * cx;
      const perspective = 6.8 / (6.8 - depth);
      screen[to] = x * perspective * scale;
      screen[to + 1] = -y * perspective * scale;
      screen[to + 2] = depth;
      screen[to + 3] = perspective;
      extentX = Math.max(extentX, Math.abs(screen[to])); extentY = Math.max(extentY, Math.abs(screen[to + 1]));
    }
    // Keep the larger sculpture inside the instrument through every 4D fold.
    const fit = Math.min(1, width * .45 / Math.max(1, extentX), height * .42 / Math.max(1, extentY));
    if (fit < 1) for (let vertex = 0; vertex < 16; vertex++) { screen[vertex * 4] *= fit; screen[vertex * 4 + 1] *= fit; }
    drawing.setTransform(dpr, 0, 0, dpr, width * .5 * dpr, height * .48 * dpr);
    drawing.clearRect(-width * .5, -height * .48, width, height);
    drawing.fillStyle = halo;
    drawing.fillRect(-width * .5, -height * .48, width, height);
    drawing.strokeStyle = '#b8c5d014'; drawing.lineWidth = .6; drawing.setLineDash(dotted);
    drawing.beginPath(); drawing.moveTo(-width * .45, 0); drawing.lineTo(width * .45, 0);
    drawing.moveTo(0, -height * .42); drawing.lineTo(0, height * .42); drawing.stroke();
    drawing.setLineDash(solid);
    drawing.strokeStyle = '#b8c5d020';
    drawing.beginPath(); drawing.ellipse(0, height * .44, width * .32, height * .025, 0, 0, TAU); drawing.stroke();
    for (let mark = 0; mark < 48; mark++) {
      const angle = mark / 48 * TAU, x = Math.cos(angle), y = Math.sin(angle);
      const length = mark % 4 ? 2.5 : 5;
      drawing.beginPath(); drawing.moveTo(x * width * .32, height * .44 + y * height * .025);
      drawing.lineTo(x * (width * .32 + length), height * .44 + y * (height * .025 + length * .3)); drawing.stroke();
    }
    for (let face = 0; face < 24; face++) {
      faceDepth[face] = 0;
      for (let corner = 0; corner < 4; corner++) faceDepth[face] += screen[faces[face * 4 + corner] * 4 + 2];
    }
    faceOrder.sort(compareFaces);
    for (let order = 0; order < 24; order++) {
      const face = faceOrder[order];
      drawing.beginPath();
      for (let corner = 0; corner < 4; corner++) {
        const index = faces[face * 4 + corner] * 4;
        if (corner) drawing.lineTo(screen[index], screen[index + 1]);
        else drawing.moveTo(screen[index], screen[index + 1]);
      }
      drawing.closePath(); drawing.fillStyle = faceFills[face % 3]; drawing.fill();
    }
    for (let edge = 0; edge < 32; edge++) edgeDepth[edge] = (screen[TESSERACT_EDGES[edge * 2] * 4 + 2] + screen[TESSERACT_EDGES[edge * 2 + 1] * 4 + 2]) * .5;
    edgeOrder.sort(compareEdges);
    for (let order = 0; order < 32; order++) {
      const edge = edgeOrder[order], a = TESSERACT_EDGES[edge * 2] * 4, b = TESSERACT_EDGES[edge * 2 + 1] * 4;
      const x = screen[a], y = screen[a + 1], dx = screen[b] - x, dy = screen[b + 1] - y;
      const depth = clamp(Math.round(12 + edgeDepth[edge] * 4), 4, 22);
      const palette = strokes[edgeColors[edge]];
      drawing.strokeStyle = palette[1]; drawing.lineWidth = 4;
      drawing.beginPath(); drawing.moveTo(x, y); drawing.lineTo(x + dx, y + dy); drawing.stroke();
      drawing.strokeStyle = palette[depth]; drawing.lineWidth = .85 + depth * .032;
      drawing.beginPath(); drawing.moveTo(x, y); drawing.lineTo(x + dx, y + dy); drawing.stroke();
      const position = (elapsed * .14 + edge * .6180339) % 1;
      const end = Math.min(1, position + .07);
      drawing.strokeStyle = palette[23]; drawing.lineWidth = 1.9;
      drawing.beginPath(); drawing.moveTo(x + dx * position, y + dy * position); drawing.lineTo(x + dx * end, y + dy * end); drawing.stroke();
      drawing.fillStyle = palette[Math.min(23, depth + 3)];
      for (let point = 0; point < 7; point++) {
        const t = (point / 7 + elapsed * .045 + edge * .03125) % 1;
        const radius = point === 0 ? 1.6 : .75;
        drawing.beginPath(); drawing.arc(x + dx * t, y + dy * t, radius, 0, TAU); drawing.fill();
      }
    }
    for (let vertex = 0; vertex < 16; vertex++) {
      const at = vertex * 4, radius = 1.65 * screen[at + 3];
      drawing.fillStyle = vertex & 8 ? '#decdfa' : '#d5f8ff';
      drawing.beginPath(); drawing.arc(screen[at], screen[at + 1], radius, 0, TAU); drawing.fill();
      drawing.strokeStyle = vertex & 8 ? '#cba5f535' : '#b2f3fa35'; drawing.lineWidth = .65;
      drawing.beginPath(); drawing.arc(screen[at], screen[at + 1], radius + 3.5, 0, TAU); drawing.stroke();
    }
  }

  function canAnimate() { return !disposed && !paused && visible && !worldOpen && !document.hidden && !suspended; }
  function tick(now) {
    frame = 0;
    if (!canAnimate()) return;
    const interval = coarse.matches ? 1000 / 24 : 1000 / 30;
    const delta = now - lastFrame;
    if (delta >= interval) {
      const remainder = delta % interval;
      elapsed += Math.min((delta - remainder) / 1000, .08); lastFrame = now - remainder;
      fold += (targetFold - fold) * .075;
      render();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastFrame = performance.now();
    element.dataset.dimensionMotion = canAnimate() ? 'running' : 'still';
    if (canAnimate()) frame = requestAnimationFrame(tick);
  }
  function resize() {
    if (disposed) return;
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    width = bounds.width; height = bounds.height;
    dpr = Math.min(devicePixelRatio || 1, coarse.matches ? 1.5 : 2);
    canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
    scale = Math.min(width, height) * .235;
    halo = drawing.createRadialGradient(0, 0, 0, 0, 0, Math.min(width, height) * .52);
    halo.addColorStop(0, '#679faf0e'); halo.addColorStop(.45, '#7f7faf05'); halo.addColorStop(1, '#00000000');
    render(); element.dataset.dimensionRender = 'canvas';
  }
  function onInput() { targetFold = fold = clamp(Number(input.value) / 360, 0, 1); updateReadout(fold); render(); }
  function onPointerDown(event) { if (event.pointerType !== 'touch') return; touchId = event.pointerId; touchX = event.clientX; touchY = event.clientY; }
  function onPointerMove(event) {
    if (event.pointerType === 'touch') {
      if (touchId !== event.pointerId || Math.abs(event.clientX - touchX) < 12 || Math.abs(event.clientX - touchX) <= Math.abs(event.clientY - touchY)) return;
    } else if (!canAnimate()) return;
    const bounds = canvas.getBoundingClientRect();
    targetFold = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    updateReadout(targetFold);
    if (!canAnimate()) { fold = targetFold; render(); }
  }
  function clearTouch() { touchId = null; }
  function onMotion(event) { if (typeof event.detail?.paused === 'boolean') paused = event.detail.paused; sync(); }
  function onPreference() { paused = document.body.classList.contains('motion-paused') || (!document.body.classList.contains('motion-enabled') && reduced.matches); sync(); }
  function onWorldView(event) { worldOpen = event.detail?.active === true; clearTouch(); sync(); }
  function onVisibility() { clearTouch(); sync(); }
  function onPageHide(event) { if (event.persisted) { suspended = true; sync(); } else dispose(); }
  function onPageShow() { suspended = false; resize(); sync(); }
  const visibility = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting === true; sync(); }, { threshold: .03 });
  const dimensions = new ResizeObserver(resize);
  function dispose() {
    if (disposed) return;
    disposed = true; if (frame) cancelAnimationFrame(frame); frame = 0;
    visibility.disconnect(); dimensions.disconnect();
    input.removeEventListener('input', onInput);
    canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', clearTouch); canvas.removeEventListener('pointercancel', clearTouch); canvas.removeEventListener('pointerleave', clearTouch);
    document.removeEventListener('experience-motion', onMotion); document.removeEventListener('world-view', onWorldView); document.removeEventListener('visibilitychange', onVisibility);
    reduced.removeEventListener('change', onPreference); coarse.removeEventListener('change', resize);
    window.removeEventListener('pagehide', onPageHide); window.removeEventListener('pageshow', onPageShow);
    instances.delete(element); element.dataset.dimensionMotion = 'still';
  }
  input.addEventListener('input', onInput);
  canvas.addEventListener('pointerdown', onPointerDown, { passive: true }); canvas.addEventListener('pointermove', onPointerMove, { passive: true });
  canvas.addEventListener('pointerup', clearTouch); canvas.addEventListener('pointercancel', clearTouch); canvas.addEventListener('pointerleave', clearTouch);
  document.addEventListener('experience-motion', onMotion); document.addEventListener('world-view', onWorldView); document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onPreference); coarse.addEventListener('change', resize);
  window.addEventListener('pagehide', onPageHide); window.addEventListener('pageshow', onPageShow);
  visibility.observe(stage); dimensions.observe(stage);
  updateReadout(fold); resize(); instances.set(element, dispose);
  return dispose;
}

initializeDimensionPortal();
