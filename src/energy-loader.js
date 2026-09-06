import './energy-core.css';

const wideScreen = matchMedia('(min-width: 761px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let loaded = false;
function enhance() {
  if (loaded || !wideScreen.matches || reducedMotion.matches || navigator.connection?.saveData) return;
  loaded = true;
  // The same rendered artwork is already visible. Upgrade capable screens after paint.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    import('./energy-core.js').catch(() => {
      document.getElementById('energyScene')?.setAttribute('data-render', 'fallback');
    });
  }));
}
if (document.readyState === 'complete') enhance();
else addEventListener('load', enhance, { once: true });
wideScreen.addEventListener('change', enhance);
reducedMotion.addEventListener('change', enhance);
