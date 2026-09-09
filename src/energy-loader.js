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
  pointerStart = host?.dataset.world !== 'true' && event.isPrimary && event.button === 0 ? { x: event.clientX, y: event.clientY, id: event.pointerId } : null;
});
canvas?.addEventListener('pointerup', event => {
  if (host?.dataset.world !== 'true' && pointerStart?.id === event.pointerId && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) < 8) burst();
  pointerStart = null;
});
canvas?.addEventListener('pointercancel', () => { pointerStart = null; });
canvas?.addEventListener('pointerleave', () => { pointerStart = null; });
document.addEventListener('energy-phase', updateControl);
document.addEventListener('experience-motion', enhance);
document.addEventListener('world-view', enhance);
if (host) new MutationObserver(updateControl).observe(host, { attributes: true, attributeFilter: ['data-render'] });

function enhance() {
  updateControl();
  if (loaded || !host || (host.dataset.world !== 'true' && (document.body.classList.contains('motion-paused') || navigator.connection?.saveData))) return;
  loaded = true;
  // All capable screens get the same real geometry. Data-saving connections
  // retain the lightweight projected scene, and failed WebGL has that fallback.
  const lightweight = navigator.connection?.saveData;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    (lightweight ? import('./energy-mobile.js') : import('./energy-core.js'))
      .then(() => host.dataset.render === 'fallback' ? import('./energy-mobile.js') : null)
      .catch(() => { host.dataset.render = 'fallback'; });
  }));
}
if (document.readyState === 'complete') enhance();
else addEventListener('load', enhance, { once: true });
reducedMotion.addEventListener('change', enhance);
