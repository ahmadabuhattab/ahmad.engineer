import './steel-card.css';

const wrapper = document.getElementById('pokemonCardWrapper');
if (wrapper) initializeCard(wrapper);

function initializeCard(wrapper) {
  const tilt = wrapper.querySelector('#pokemonCardTilt');
  const front = wrapper.querySelector('.pokemon-card-front');
  const back = wrapper.querySelector('.pokemon-card-back');
  const flipButton = wrapper.querySelector('#pokemonFlipBtn');
  const awakenButton = wrapper.querySelector('#pokemonAwakenBtn');
  const motionButton = wrapper.querySelector('#pokemonMotionBtn');
  const mount = wrapper.querySelector('#steelworksMount');
  const status = document.getElementById('pokemonCardStatus');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = window.matchMedia('(pointer: coarse)');
  let reduced = motionPreference.matches;
  let paused = false, visible = false, hovering = false, flipped = false, awakened = false;
  let pointer = null, dragged = false, suppressClick = false;
  let model = null, loading = false, failed = false, frame = 0, lastTime = 0, time = 0;
  let targetX = 0, targetY = 0, orbitTarget = 0;
  const state = { x: 0, y: 0, lift: 0, power: 0, orbit: 0, speed: 0 };
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const stopped = () => reduced || paused;
  const set = (key, value) => wrapper.style.setProperty(key, value);

  function render(dt = 1/60) {
    const still = stopped();
    const ease = 1 - Math.exp(-dt * 9);
    const aimX = hovering || pointer ? targetX : Math.sin(time * .58) * .28;
    const aimY = hovering || pointer ? targetY : Math.cos(time * .42) * .13;
    state.x += ((still ? 0 : aimX) - state.x) * (still ? 1 : ease);
    state.y += ((still ? 0 : aimY) - state.y) * (still ? 1 : ease);
    state.lift += ((still ? 0 : hovering ? 12 : 3 + Math.sin(time * .9) * 3) - state.lift) * ease;
    state.power += ((awakened && !flipped ? 1 : 0) - state.power) * (still ? 1 : ease * .5);
    state.orbit += (orbitTarget - state.orbit) * (still ? 1 : ease * .7);
    state.speed *= Math.exp(-dt * 5);
    set('--rx', (-state.y * 10).toFixed(3));
    set('--ry', (state.x * 15).toFixed(3));
    set('--rz', (state.x * 1.5).toFixed(3));
    set('--lift', state.lift.toFixed(2));
    set('--mx', (50 + state.x * 43).toFixed(2));
    set('--my', (42 + state.y * 40).toFixed(2));
    set('--holo', still ? '.35' : hovering ? '.95' : '.5');
    set('--speed', state.speed.toFixed(3));
    set('--power', state.power.toFixed(4));
    if (model && !flipped) model.render({ time, x: state.x, y: state.y, energy: state.power, orbit: state.orbit, still });
  }
  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || stopped()) return;
    const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 1/60;
    lastTime = now;
    time += dt;
    render(dt);
    // No WebGL rendering on the back. CSS still handles the card's physical tilt.
    frame = requestAnimationFrame(tick);
  }
  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
  }
  function schedule() {
    if (!visible || document.hidden) return;
    if (stopped()) { render(); return; }
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function syncMotion() {
    wrapper.classList.toggle('is-paused', stopped());
    motionButton.hidden = reduced;
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? 'Resume card animation' : 'Pause card animation');
    motionButton.querySelector('[data-motion-icon]').textContent = paused ? '▷' : 'Ⅱ';
    stop(); render(); schedule();
  }
  function fallback() {
    failed = true;
    model?.dispose();
    model = null;
    mount.replaceChildren();
    wrapper.classList.remove('steelworks-ready', 'is-awakened');
    awakenButton.hidden = true;
    awakened = false;
    state.power = 0;
    render();
  }
  async function loadModel() {
    if (loading || model || failed) return;
    loading = true;
    try {
      const { createSteelworks } = await import('./steelworks.js');
      model = await createSteelworks(mount, fallback);
      wrapper.classList.add('steelworks-ready');
      wrapper.dataset.renderer = model.gpu ? 'webgl' : 'geometry';
      awakenButton.hidden = false;
      render(); schedule();
    } catch {
      // WebGL unavailable: the readable foil card and flip remain functional.
      fallback();
    } finally { loading = false; }
  }
  function flip() {
    flipped = !flipped;
    wrapper.classList.toggle('is-flipped', flipped);
    front.setAttribute('aria-hidden', String(flipped));
    back.setAttribute('aria-hidden', String(!flipped));
    flipButton.setAttribute('aria-pressed', String(flipped));
    flipButton.setAttribute('aria-label', flipped ? 'Flip card to front' : 'Flip card to back');
    flipButton.querySelector('[data-flip-label]').textContent = flipped ? 'Front of card' : 'Flip card';
    status.textContent = flipped ? 'Trainer card. Ahmad Abu-Hattab, evolution chain and stats.' : 'STELCO card. Lake Erie Works.';
    // An immediate frame prevents an old hidden canvas from flashing on return.
    render(); schedule();
  }
  flipButton.addEventListener('click', flip);
  awakenButton.addEventListener('click', () => {
    awakened = !awakened;
    if (flipped) flip();
    wrapper.classList.toggle('is-awakened', awakened);
    awakenButton.setAttribute('aria-pressed', String(awakened));
    awakenButton.setAttribute('aria-label', awakened ? 'Return steelworks to idle' : 'Unleash the steelworks');
    awakenButton.querySelector('[data-awaken-label]').textContent = awakened ? 'Return to idle' : 'Unleash';
    status.textContent = awakened ? 'Steelworks unleashed.' : 'Steelworks returned to idle.';
    orbitTarget += awakened ? Math.PI * 2 : 0;
    schedule();
  });
  motionButton.addEventListener('click', () => { paused = !paused; syncMotion(); });

  // Pointer Events unify mouse, pen and touch; vertical swipes keep native scrolling.
  function aim(event) {
    const rect = tilt.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
    const y = clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
    state.speed = Math.min(1.5, Math.abs(x-targetX) * 6 + Math.abs(y-targetY) * 6);
    targetX = x; targetY = y;
  }
  tilt.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    hovering = true; wrapper.classList.add('is-hover'); aim(event); schedule();
  });
  tilt.addEventListener('pointerleave', () => {
    if (pointer) return;
    hovering = false; wrapper.classList.remove('is-hover'); targetX = targetY = 0;
  });
  tilt.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, orbit: orbitTarget };
    dragged = false; suppressClick = false;
    aim(event); schedule();
  });
  tilt.addEventListener('pointermove', event => {
    if (pointer && pointer.id !== event.pointerId) return;
    aim(event);
    if (!pointer) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (Math.hypot(dx, dy) > 8) {
      dragged = true;
      // Only capture a horizontal gesture. Browser handles vertical scroll/cancel.
      if (Math.abs(dx) > Math.abs(dy)) {
        tilt.setPointerCapture(event.pointerId);
        wrapper.classList.add('is-dragging');
        orbitTarget = pointer.orbit + dx * .008;
      }
    }
    if (stopped()) render();
  });
  function release(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    if (tilt.hasPointerCapture(event.pointerId)) tilt.releasePointerCapture(event.pointerId);
    suppressClick = dragged || event.type === 'pointercancel';
    pointer = null;
    wrapper.classList.remove('is-dragging');
    if (event.pointerType === 'touch' || !tilt.matches(':hover')) {
      hovering = false; wrapper.classList.remove('is-hover'); targetX = targetY = 0;
    }
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  tilt.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    flip();
  });

  motionPreference.addEventListener('change', event => { reduced = event.matches; syncMotion(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else schedule();
  });
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    wrapper.classList.toggle('is-visible', visible);
    if (visible) { loadModel(); schedule(); } else stop();
  }, { rootMargin: '80px' });
  visibilityObserver.observe(wrapper);
  window.addEventListener('pagehide', () => { stop(); });
  window.addEventListener('pageshow', schedule);
  // A single sharp render is needed after resizing when animation is paused.
  const sizeObserver = new ResizeObserver(() => { if (stopped() && model) render(); });
  sizeObserver.observe(mount);
  document.getElementById('pokemonCardInstructions').textContent = coarse.matches
    ? 'Swipe sideways to explore · Tap the card to flip'
    : 'Drag to explore · Click the card to flip';
  syncMotion();
}
