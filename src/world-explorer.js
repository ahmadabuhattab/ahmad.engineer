import { createWorldAudio } from './world-audio.js';
import { initializeWorldPointer } from './world-pointer.js';
import { sampleSpacetime, SPACETIME_DURATION } from './world-spacetime.js';
import './world-interface.css';
import './world-spacetime.css';

const dialog = document.getElementById('worldDialog');
const stage = document.getElementById('worldStage');
const visual = document.querySelector('.hero-visual');
const host = document.getElementById('energyScene');
const canvas = document.getElementById('energyCanvas');
const motion = document.getElementById('experienceMotion');
const close = document.getElementById('worldClose');
const destinations = {
  overview: { index: '00 / THE OBSERVATORY', title: 'Follow the impossible.', copy: 'Three forces. One engineering mindset. Touch a landmark, follow the journey, or find your own way through.', link: '#about', action: 'Meet the engineer' },
  energy: { index: '01 / THE ENERGY CHAMBER', title: 'Everything starts with energy.', copy: 'Tune the field and watch a wave move through the chamber. A visual study inspired by the physics of interconnected systems.', link: '#work', action: 'Explore the engineering', study: 'resonance', experiment: 'Resonate the chamber', running: 'The field is resonating.' },
  intelligence: { index: '02 / THE INTELLIGENCE LATTICE', title: 'A thought becomes a signal.', copy: 'Send a pulse through the lattice. Connections light up as information travels from one node to the next.', link: '#work', action: 'Explore the AI projects', study: 'signal', experiment: 'Send a signal', running: 'Your signal is travelling through the lattice.' },
  industry: { index: '03 / THE INDUSTRIAL HEART', title: 'An idea becomes a world.', copy: 'Ignite the furnace. Light, motion, and heat bring the structure to life, an imaginative echo of engineering at industrial scale.', link: '#in-the-field', action: 'Meet the real steelworks', study: 'forge', experiment: 'Ignite the forge', running: 'The furnace is alive. Follow the material flow.' },
};

if (dialog && stage && visual && host && canvas && typeof dialog.showModal === 'function') {
  const marker = document.createComment('Observatory home');
  visual.before(marker);
  let opener, realm = 'overview', active = false, pointer = null;
  const touches = new Map();
  let pinch = null;
  let orbit = { x: 0, y: 0, zoom: 0 };
  let scrollPosition = 0;
  let soundEnabled = false, ownsFullscreen = false;
  let tour = false, tourTime = 0, tourStep = -1, tourActed = false;
  let flightRemaining = 0, activityRemaining = 0, strength = .65;
  let clockFrame = 0, lastTick = 0;
  let spacetimeTime = 0, spacetimeActive = false, spacetimePhase = '';
  const visited = new Set();
  const audio = createWorldAudio();
  const disposePointer = initializeWorldPointer(dialog, canvas);
  const gravityButton = document.getElementById('worldGravity');
  const gravityStatus = document.getElementById('worldGravityStatus');
  const tourButton = document.getElementById('worldTour');
  const experiment = document.getElementById('worldExperiment');
  const experimentStatus = document.getElementById('worldActivityStatus');
  const soundButton = document.getElementById('worldSound');
  const fullButton = document.getElementById('worldFullscreen');
  const detailsButton = document.getElementById('worldDetails');
  const isPaused = () => document.body.classList.contains('motion-paused');
  const rendererReady = () => ['canvas', 'webgl'].includes(host.dataset.render);
  const dispatch = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
  const updateAudio = () => audio.update({ realm, activity: activityRemaining > 0 ? strength : 0, paused: isPaused(), active });
  function fitLayout() {
    if (!active) return;
    const titleSize = parseFloat(getComputedStyle(document.getElementById('worldTitle')).fontSize);
    const shortViewport = innerWidth <= 600 ? innerHeight < 540 : innerHeight < 360;
    dialog.classList.toggle('world-compact', titleSize > 44 || shortViewport);
  }
  const layoutObserver = new ResizeObserver(fitLayout);
  layoutObserver.observe(document.getElementById('worldTitle'));
  window.addEventListener('resize', () => { clearGesture(); fitLayout(); }, { passive: true });
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const emitOrbit = () => document.dispatchEvent(new CustomEvent('world-orbit', { detail: { ...orbit } }));
  function selectRealm(next, revealStage = true) {
    clearGesture();
    stopSpacetime();
    stopActivity();
    realm = Object.hasOwn(destinations, next) ? next : 'overview';
    const item = destinations[realm];
    host.dataset.realm = realm;
    dialog.dataset.realm = realm;
    document.getElementById('worldIndex').textContent = item.index;
    document.getElementById('worldTitle').textContent = item.title;
    document.getElementById('worldDescription').textContent = item.copy;
    const link = document.getElementById('worldChapter');
    link.href = item.link;
    link.textContent = item.action + ' ↗';
    experiment.hidden = !item.study;
    experiment.textContent = item.experiment || 'Explore a district';
    experimentStatus.textContent = item.study ? 'An interactive study. Make it come alive.' : 'Touch a landmark to get closer.';
    document.getElementById('worldIntensityControl').hidden = realm !== 'energy';
    if (item.study) visited.add(realm);
    document.getElementById('worldDiscovered').textContent = `${visited.size} / 3 discovered`;
    dialog.querySelectorAll('[data-world-realm]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.worldRealm === realm)));
    orbit = { x: 0, y: 0, zoom: 0 };
    emitOrbit();
    document.dispatchEvent(new CustomEvent('world-view', { detail: { active, realm } }));
    updateAudio();
    if (revealStage && dialog.classList.contains('world-compact')) stage.scrollIntoView({ block: 'start', behavior: isPaused() ? 'instant' : 'smooth' });
  }
  function openWorld(event) {
    opener = event.currentTarget;
    if (active) return;
    scrollPosition = window.scrollY;
    active = true;
    host.dataset.world = 'true';
    // One canvas, one renderer: keep its GPU resources and animation clock.
    stage.append(visual);
    dialog.showModal();
    dialog.scrollTop = 0;
    document.documentElement.classList.add('world-is-open');
    selectRealm(opener.dataset.realm || 'overview', false);
    fitLayout();
    dialog.scrollTop = 0;
    if (!isPaused()) startFlight();
    if (realm === 'overview' && !isPaused() && visited.size === 0) startTour();
    updateAudio();
    close.focus({ preventScroll: true });
  }
  function restore() {
    if (!active) return;
    active = false;
    stopSpacetime();
    stopTour();
    stopActivity();
    flightRemaining = 0;
    host.dataset.flight = 'false';
    stopClock();
    updateAudio();
    if (ownsFullscreen && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    ownsFullscreen = false;
    setCinema(false);
    clearGesture();
    host.dataset.world = 'false';
    marker.after(visual);
    document.documentElement.classList.remove('world-is-open');
    document.dispatchEvent(new CustomEvent('world-view', { detail: { active: false, realm: 'overview' } }));
    window.scrollTo({ top: scrollPosition, behavior: 'instant' });
    opener?.focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-world-open]').forEach(button => { button.hidden = false; button.addEventListener('click', openWorld); });
  document.documentElement.classList.add('world-available');
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', restore);
  dialog.addEventListener('cancel', () => { /* Native Escape closes the dialog. */ });
  dialog.querySelectorAll('[data-world-realm]').forEach(button => button.addEventListener('click', () => { stopTour(); selectRealm(button.dataset.worldRealm); }));
  document.getElementById('worldChapter').addEventListener('click', event => {
    const id = event.currentTarget.getAttribute('href');
    event.preventDefault();
    dialog.close();
    restore();
    const target = document.querySelector(id);
    target?.setAttribute('tabindex', '-1');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: isPaused() ? 'instant' : 'auto' });
    history.replaceState(null, '', id);
  });
  const worldMotion = document.getElementById('worldMotion');
  function syncMotion() {
    const paused = document.body.classList.contains('motion-paused');
    worldMotion.textContent = paused ? 'Play world' : 'Pause world';
    worldMotion.setAttribute('aria-pressed', String(paused));
    updateAudio();
    runClock();
  }
  worldMotion.addEventListener('click', () => motion?.click());
  document.addEventListener('experience-motion', syncMotion);
  syncMotion();
  const hint = dialog.querySelector('.world-hint');
  function syncRenderer() {
    const ready = rendererReady();
    const failed = host.dataset.render === 'fallback';
    dialog.dataset.render = ready ? 'ready' : failed ? 'fallback' : 'loading';
    dialog.querySelectorAll('[data-world-camera]').forEach(button => { button.disabled = !ready; });
    document.getElementById('worldCapture').disabled = !ready;
    experiment.disabled = !ready;
    tourButton.disabled = !ready;
    gravityButton.disabled = !ready;
    hint.textContent = ready ? 'Drag to explore / Touch a landmark / 1 · 2 · 3 to travel' : failed ? 'Static view / Discover the work through the chapter links' : 'Preparing the observatory…';
    if (ready) runClock();
    else { stopClock(); clearGesture(); }
  }
  new MutationObserver(syncRenderer).observe(host, { attributes: true, attributeFilter: ['data-render'] });
  syncRenderer();
  dialog.querySelectorAll('[data-world-camera]').forEach(button => button.addEventListener('click', () => {
    stopTour();
    const action = button.dataset.worldCamera;
    if (action === 'reset') orbit = { x: 0, y: 0, zoom: 0 };
    if (action === 'left') orbit.x = clamp(orbit.x - .18, -1, 1);
    if (action === 'right') orbit.x = clamp(orbit.x + .18, -1, 1);
    if (action === 'in') orbit.zoom = clamp(orbit.zoom + .15, -.5, 1);
    if (action === 'out') orbit.zoom = clamp(orbit.zoom - .15, -.5, 1);
    emitOrbit();
  }));
  function beginDrag(id, point) {
    pointer = { id, x: point.x, y: point.y, startX: orbit.x, startY: orbit.y };
  }
  function rebaseTouchGesture() {
    pointer = pinch = null;
    if (touches.size > 1) {
      // The scrollable layout preserves the browser's own page zoom gesture.
      if (dialog.classList.contains('world-compact') && !dialog.classList.contains('world-cinema')) return;
      const [first, second] = touches.values();
      pinch = { distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)), startZoom: orbit.zoom };
    } else if (touches.size === 1) {
      const [id, point] = touches.entries().next().value;
      beginDrag(id, point);
    }
  }
  function clearGesture() {
    const captured = new Set(touches.keys());
    if (pointer) captured.add(pointer.id);
    touches.clear();
    pointer = pinch = null;
    for (const id of captured) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
  canvas.addEventListener('pointerdown', event => {
    if (!active || spacetimeActive || !rendererReady() || event.button !== 0) return;
    if (!event.isPrimary && !(event.pointerType === 'touch' && touches.size)) return;
    stopTour();
    if (event.pointerType === 'touch') {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      rebaseTouchGesture();
    } else {
      if (touches.size) return;
      beginDrag(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!active || spacetimeActive || !rendererReady()) return;
    if (touches.has(event.pointerId)) {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch) {
        const [first, second] = touches.values();
        const distance = Math.max(1, Math.hypot(first.x - second.x, first.y - second.y));
        orbit.zoom = clamp(pinch.startZoom + Math.log2(distance / pinch.distance) * .6, -.5, 1);
        emitOrbit();
        return;
      }
    }
    if (pointer?.id !== event.pointerId) return;
    orbit.x = clamp(pointer.startX + (event.clientX - pointer.x) / Math.max(240, innerWidth * .55), -1, 1);
    orbit.y = clamp(pointer.startY + (event.clientY - pointer.y) / Math.max(240, innerHeight * .65), -1, 1);
    emitOrbit();
  });
  const releasePointer = event => {
    if (touches.delete(event.pointerId)) rebaseTouchGesture();
    else if (pointer?.id === event.pointerId) pointer = null;
  };
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('lostpointercapture', releasePointer);
  canvas.addEventListener('wheel', event => {
    if (!active || event.ctrlKey) return;
    stopTour();
    event.preventDefault();
    orbit.zoom = clamp(orbit.zoom - event.deltaY * .0015, -.5, 1);
    emitOrbit();
  }, { passive: false });

  function startFlight() {
    flightRemaining = 3.4;
    host.dataset.flight = 'true';
    dispatch('world-flight', { active: true, progress: 0, duration: 3.4 });
    runClock();
  }
  function startTour() {
    if (tour) { stopTour(); return; }
    stopSpacetime();
    if (isPaused()) motion.click();
    tour = true; tourTime = 0; tourStep = -1; tourActed = false;
    host.dataset.touring = 'true';
    tourButton.textContent = 'Stop journey';
    tourButton.setAttribute('aria-pressed', 'true');
    dialog.classList.add('world-touring');
    runClock();
  }
  function stopTour() {
    tour = false;
    host.dataset.touring = 'false';
    tourButton.textContent = visited.size === 3 ? 'Replay the journey' : 'Take the journey';
    tourButton.setAttribute('aria-pressed', 'false');
    dialog.classList.remove('world-touring');
    document.getElementById('worldJourneyStatus').textContent = 'YOUR CURIOSITY IS THE COMPASS';
  }
  function stopActivity() {
    if (destinations[realm].study) dispatch('world-activity', { kind: destinations[realm].study, strength: 0, active: false });
    activityRemaining = 0;
    experiment.setAttribute('aria-disabled', 'false');
    updateAudio();
  }
  function activateStudy() {
    const item = destinations[realm];
    if (!item.study || experiment.disabled) return;
    activityRemaining = 7;
    experimentStatus.textContent = isPaused() ? 'Study activated. Play world to see it unfold.' : item.running;
    experiment.setAttribute('aria-disabled', 'true');
    dispatch('world-activity', { kind: item.study, strength, active: true });
    updateAudio(); runClock();
  }
  function stopSpacetime() {
    if (!spacetimeActive) return;
    spacetimeActive = false;
    spacetimeTime = 0;
    spacetimePhase = '';
    dialog.classList.remove('world-singularity-active');
    host.dataset.singularity = 'false';
    gravityButton.textContent = 'Bend spacetime';
    gravityButton.setAttribute('aria-pressed', 'false');
    dispatch('world-singularity', { active: false, progress: 0 });
    gravityStatus.textContent = '';
    updateAudio();
  }
  function startSpacetime() {
    if (spacetimeActive) { stopSpacetime(); return; }
    if (!active || gravityButton.disabled) return;
    stopTour();
    selectRealm('overview');
    flightRemaining = 0;
    host.dataset.flight = 'false';
    dispatch('world-flight', { active: false, progress: 1 });
    spacetimeActive = true;
    spacetimeTime = 0;
    host.dataset.singularity = 'true';
    dialog.classList.add('world-singularity-active');
    gravityButton.textContent = 'Restore the world';
    gravityButton.setAttribute('aria-pressed', 'true');
    gravityButton.focus({ preventScroll: true });
    gravityStatus.textContent = 'A world drawn together.';
    dialog.style.setProperty('--spacetime-progress', '0');
    dispatch('world-singularity', { active: true, progress: 0 });
    // Choosing this cinematic experiment explicitly starts its animation.
    if (isPaused()) motion.click();
    runClock();
  }
  function runClock() {
    if (!active || isPaused() || document.hidden || clockFrame || !rendererReady() || !(tour || spacetimeActive || flightRemaining > 0 || activityRemaining > 0)) return;
    lastTick = performance.now(); clockFrame = requestAnimationFrame(tick);
  }
  function stopClock() {
    if (clockFrame) cancelAnimationFrame(clockFrame);
    clockFrame = 0;
    lastTick = 0;
  }
  function tick(now) {
    clockFrame = 0;
    if (!active || isPaused() || document.hidden || !rendererReady()) return;
    const delta = Math.min(.1, (now - lastTick) / 1000); lastTick = now;
    if (spacetimeActive) {
      spacetimeTime = Math.min(SPACETIME_DURATION, spacetimeTime + delta);
      const progress = spacetimeTime / SPACETIME_DURATION;
      const { phase } = sampleSpacetime(progress);
      dispatch('world-singularity', { active: true, progress });
      dialog.style.setProperty('--spacetime-progress', String(progress));
      if (phase !== spacetimePhase) {
        spacetimePhase = phase;
        gravityStatus.textContent = { gather: 'A world drawn together.', collapse: 'Everything bends.', hold: 'A moment outside time.', unfold: 'Possibility unfolds.', restore: 'Nothing exists in isolation.' }[phase];
      }
      if (progress === 1) stopSpacetime();
    }
    if (flightRemaining > 0) {
      flightRemaining = Math.max(0, flightRemaining - delta);
      if (!flightRemaining) { host.dataset.flight = 'false'; dispatch('world-flight', { active: false, progress: 1 }); }
    } else if (tour) {
      tourTime += delta;
      const step = Math.floor(tourTime / 12);
      if (step > 2) {
        stopTour(); selectRealm('overview');
        experimentStatus.textContent = 'Three forces. One perspective. Now find your own path.';
      } else {
        if (step !== tourStep) { tourStep = step; tourActed = false; selectRealm(['energy', 'intelligence', 'industry'][step]); }
        if (!tourActed && tourTime % 12 > 3) { tourActed = true; activateStudy(); }
        document.getElementById('worldJourneyStatus').textContent = `Journey ${step + 1} / 3 · ${['Energy', 'Intelligence', 'Industry'][step]}`;
        dialog.style.setProperty('--journey-progress', String(tourTime / 36));
      }
    }
    if (activityRemaining > 0) {
      activityRemaining = Math.max(0, activityRemaining - delta);
      if (!activityRemaining) { stopActivity(); experimentStatus.textContent = 'The system settles. Try it again, or explore further.'; }
    }
    if (tour || spacetimeActive || flightRemaining > 0 || activityRemaining > 0) clockFrame = requestAnimationFrame(tick);
  }
  gravityButton.addEventListener('click', startSpacetime);
  tourButton.addEventListener('click', startTour);
  experiment.addEventListener('click', () => { if (experiment.getAttribute('aria-disabled') !== 'true') activateStudy(); });
  document.getElementById('worldIntensity').addEventListener('input', event => {
    strength = Number(event.target.value) / 100;
    document.getElementById('worldIntensityValue').textContent = `${event.target.value}%`;
    activateStudy();
  });
  detailsButton.addEventListener('click', () => {
    const expanded = detailsButton.getAttribute('aria-expanded') !== 'true';
    detailsButton.setAttribute('aria-expanded', String(expanded));
    dialog.classList.toggle('world-details-open', expanded);
    detailsButton.textContent = expanded ? 'Less detail −' : 'Behind the world +';
  });
  soundButton.addEventListener('click', async () => {
    soundEnabled = await audio.setEnabled(!soundEnabled);
    soundButton.textContent = soundEnabled ? 'Sound on' : 'Sound off';
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    updateAudio();
  });
  fullButton.hidden = !document.fullscreenEnabled;
  fullButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await document.documentElement.requestFullscreen(); ownsFullscreen = true; }
    } catch { experimentStatus.textContent = 'Full screen is unavailable in this browser. You can still explore here.'; }
  });
  document.addEventListener('fullscreenchange', () => {
    fullButton.setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen');
    fullButton.setAttribute('aria-pressed', String(!!document.fullscreenElement));
  });
  function setCinema(enabled) {
    dialog.classList.toggle('world-cinema', enabled);
    document.getElementById('worldCinema').setAttribute('aria-pressed', String(enabled));
    document.getElementById('worldShowInterface').hidden = !enabled;
    if (enabled) document.getElementById('worldShowInterface').focus({ preventScroll: true });
  }
  document.getElementById('worldCinema').addEventListener('click', () => setCinema(true));
  document.getElementById('worldShowInterface').addEventListener('click', () => { setCinema(false); document.getElementById('worldCinema').focus({ preventScroll: true }); });
  document.getElementById('worldCapture').addEventListener('click', () => dispatch('world-capture'));
  document.addEventListener('world-capture-ready', event => {
    if (!active || !(event.detail?.blob instanceof Blob)) return;
    const url = URL.createObjectURL(event.detail.blob), link = document.createElement('a');
    link.href = url; link.download = `ahmad-observatory-${realm}.png`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    experimentStatus.textContent = 'Your view has been saved.';
  });
  document.addEventListener('world-select', event => {
    if (!active || spacetimeActive || !Object.hasOwn(destinations, event.detail?.realm)) return;
    stopTour();
    if (realm === event.detail.realm) activateStudy(); else selectRealm(event.detail.realm);
  });
  dialog.addEventListener('keydown', event => {
    if (event.target.matches('input,textarea,select') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === 'b' && !event.repeat) { event.preventDefault(); startSpacetime(); }
    const target = { '1': 'energy', '2': 'intelligence', '3': 'industry', '0': 'overview' }[event.key];
    if (target) { stopTour(); selectRealm(target); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopClock(); clearGesture(); }
    else runClock();
  });
  addEventListener('pagehide', event => { stopClock(); clearGesture(); if (!event.persisted) { audio.dispose(); disposePointer(); layoutObserver.disconnect(); } });
  addEventListener('pageshow', () => { updateAudio(); runClock(); });
}
