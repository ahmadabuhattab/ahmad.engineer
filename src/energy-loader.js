import './energy-core.css';

const host = document.getElementById('energyScene');
const canvas = document.getElementById('energyCanvas');
const button = document.getElementById('energyBurst');
const status = document.getElementById('energyStatus');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
if (host && navigator.connection?.saveData) host.dataset.saveData = 'true';
let loaded = false;
const labels = { orbit: 'Orbit stable', charging: 'Energy rising', release: 'Energy released', suspended: 'Beautiful chaos', reforming: 'Coming back together' };

function updateControl() {
  if (!host || !button || !status) return;
  const ready = ['webgl', 'canvas'].includes(host.dataset.render);
  const paused = document.body.classList.contains('motion-paused');
  const phase = host.dataset.phase || 'orbit';
  button.hidden = !ready;
  // Keep keyboard focus in place when an automatic cycle becomes busy.
  button.setAttribute('aria-disabled', String(!ready || paused || phase !== 'orbit'));
  status.textContent = paused ? 'Motion paused' : ready ? labels[phase] || labels.orbit : 'Nothing exists in isolation.';
  canvas?.classList.toggle('energy-interactive', ready && !paused && phase === 'orbit');
}
function burst() {
  if (!button || button.getAttribute('aria-disabled') === 'true' || button.hidden) return;
  document.dispatchEvent(new CustomEvent('energy-burst'));
}

button?.addEventListener('click', burst);
// A short tap also activates the sculpture. Scrolling and dragging never do.
let pointerStart;
canvas?.addEventListener('pointerdown', event => {
  pointerStart = event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
});
canvas?.addEventListener('pointerup', event => {
  if (pointerStart?.id === event.pointerId && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 8) burst();
  pointerStart = null;
});
canvas?.addEventListener('pointercancel', () => { pointerStart = null; });
canvas?.addEventListener('pointerleave', () => { pointerStart = null; });
document.addEventListener('energy-phase', updateControl);
document.addEventListener('experience-motion', enhance);
if (host) new MutationObserver(updateControl).observe(host, { attributes: true, attributeFilter: ['data-render'] });

function enhance() {
  updateControl();
  if (loaded || !host || document.body.classList.contains('motion-paused') || navigator.connection?.saveData) return;
  loaded = true;
  // Pick one renderer for this page's lifetime; it resizes without replacing
  // the canvas context. The phone version never downloads the Three.js bundle.
  const mobile = matchMedia('(max-width: 760px)').matches;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    (mobile ? import('./energy-mobile.js') : import('./energy-core.js')).catch(() => {
      host.dataset.render = 'fallback';
    });
  }));
}
if (document.readyState === 'complete') enhance();
else addEventListener('load', enhance, { once: true });
reducedMotion.addEventListener('change', enhance);
