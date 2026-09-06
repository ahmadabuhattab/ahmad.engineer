import './experience.css';

const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const motionButton = document.getElementById('experienceMotion');
const motionLabel = motionButton?.querySelector('[data-motion-label]');
let userPaused = false;
try { userPaused = sessionStorage.getItem('experience-paused') === 'true'; } catch {}
let observer;

function setMotion() {
  const paused = motionPreference.matches || userPaused;
  document.body.classList.toggle('motion-enabled', !paused);
  document.body.classList.toggle('motion-paused', paused);
  if (motionButton) {
    motionButton.hidden = false;
    motionButton.disabled = motionPreference.matches;
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', motionPreference.matches ? 'Reduced motion enabled in your device settings' : paused ? 'Resume scene animation' : 'Pause scene animation');
    motionLabel.textContent = motionPreference.matches ? 'Reduced motion' : paused ? 'Motion paused' : 'Pause motion';
  }
  document.dispatchEvent(new CustomEvent('experience-motion', { detail: { paused } }));
  if (paused) {
    document.querySelectorAll('.is-pending').forEach(el => el.classList.remove('is-pending'));
    observer?.disconnect();
  }
}
setMotion();
motionPreference.addEventListener('change', setMotion);
motionButton?.addEventListener('click', () => {
  userPaused = !userPaused;
  try { sessionStorage.setItem('experience-paused', String(userPaused)); } catch {}
  setMotion();
});

// Content starts visible. Only enhance off-screen sections after script initialization.
if (!motionPreference.matches && !userPaused && 'IntersectionObserver' in window) {
  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove('is-pending');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.06 });
  document.querySelectorAll('.reveal').forEach(el => {
    if (el.getBoundingClientRect().top > innerHeight) {
      el.classList.add('is-pending');
      observer.observe(el);
    }
  });
}

const progress = document.getElementById('scrollProgress');
let scheduled = false;
function updateProgress() {
  const range = document.documentElement.scrollHeight - innerHeight;
  if (progress) progress.style.transform = `scaleX(${range > 0 ? Math.min(1, Math.max(0, scrollY / range)) : 0})`;
  scheduled = false;
}
addEventListener('scroll', () => {
  if (!scheduled) { scheduled = true; requestAnimationFrame(updateProgress); }
}, { passive: true });
addEventListener('resize', updateProgress, { passive: true });
updateProgress();
