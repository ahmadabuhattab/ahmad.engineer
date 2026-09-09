const dialog = document.getElementById('worldDialog');
const stage = document.getElementById('worldStage');
const visual = document.querySelector('.hero-visual');
const host = document.getElementById('energyScene');
const canvas = document.getElementById('energyCanvas');
const motion = document.getElementById('experienceMotion');
const close = document.getElementById('worldClose');
const destinations = {
  overview: { index: '00 / THE OBSERVATORY', title: 'Everything is connected.', copy: 'Energy. Intelligence. Industry. Three worlds, one engineering mindset. Choose a destination and look a little closer.', link: '#about', action: 'Meet the engineer' },
  energy: { index: '01 / ENERGY', title: 'First principles. Infinite possibility.', copy: 'Neutron transport, heat transfer, reactor kinetics. The physics behind the systems that power our world.', link: '#work', action: 'Explore the work' },
  intelligence: { index: '02 / INTELLIGENCE', title: 'Signals become understanding.', copy: 'Voice synthesis, frontier models, and the space between an ambitious idea and a working system.', link: '#work', action: 'Explore AI projects' },
  industry: { index: '03 / INDUSTRY', title: 'Ideas meet the real world.', copy: 'Data, processes, and technology at the scale of a steel mill. Engineering where the consequences are tangible.', link: '#in-the-field', action: 'Enter the steelworks' },
};

if (dialog && stage && visual && host && canvas && typeof dialog.showModal === 'function') {
  const marker = document.createComment('Observatory home');
  visual.before(marker);
  let opener, realm = 'overview', active = false, pointer = null;
  let orbit = { x: 0, y: 0, zoom: 0 };
  let scrollPosition = 0;
  function fitLayout() {
    if (!active) return;
    const titleSize = parseFloat(getComputedStyle(document.getElementById('worldTitle')).fontSize);
    dialog.classList.toggle('world-compact', innerHeight < 600 || titleSize > 44);
  }
  const layoutObserver = new ResizeObserver(fitLayout);
  layoutObserver.observe(document.getElementById('worldTitle'));
  window.addEventListener('resize', fitLayout, { passive: true });
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const emitOrbit = () => document.dispatchEvent(new CustomEvent('world-orbit', { detail: { ...orbit } }));
  function selectRealm(next) {
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
    dialog.querySelectorAll('[data-world-realm]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.worldRealm === realm)));
    orbit = { x: 0, y: 0, zoom: 0 };
    emitOrbit();
    document.dispatchEvent(new CustomEvent('world-view', { detail: { active, realm } }));
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
    selectRealm(opener.dataset.realm || 'overview');
    fitLayout();
    close.focus({ preventScroll: true });
  }
  function restore() {
    if (!active) return;
    active = false;
    pointer = null;
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
  dialog.querySelectorAll('[data-world-realm]').forEach(button => button.addEventListener('click', () => selectRealm(button.dataset.worldRealm)));
  document.getElementById('worldChapter').addEventListener('click', event => {
    const id = event.currentTarget.getAttribute('href');
    event.preventDefault();
    dialog.close();
    restore();
    const target = document.querySelector(id);
    target?.setAttribute('tabindex', '-1');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: document.body.classList.contains('motion-paused') ? 'instant' : 'smooth' });
    history.replaceState(null, '', id);
  });
  const worldMotion = document.getElementById('worldMotion');
  function syncMotion() {
    const paused = document.body.classList.contains('motion-paused');
    worldMotion.textContent = paused ? 'Play world' : 'Pause world';
    worldMotion.setAttribute('aria-pressed', String(paused));
  }
  worldMotion.addEventListener('click', () => motion?.click());
  document.addEventListener('experience-motion', syncMotion);
  syncMotion();
  const hint = dialog.querySelector('.world-hint');
  function syncRenderer() {
    const ready = ['canvas', 'webgl'].includes(host.dataset.render);
    const failed = host.dataset.render === 'fallback';
    dialog.dataset.render = ready ? 'ready' : failed ? 'fallback' : 'loading';
    dialog.querySelectorAll('[data-world-camera]').forEach(button => { button.disabled = !ready; });
    hint.textContent = ready ? 'Drag to look around / Scroll to move closer' : failed ? 'Static view / Discover the work through the chapter links' : 'Preparing the observatory…';
  }
  new MutationObserver(syncRenderer).observe(host, { attributes: true, attributeFilter: ['data-render'] });
  syncRenderer();
  dialog.querySelectorAll('[data-world-camera]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.worldCamera;
    if (action === 'reset') orbit = { x: 0, y: 0, zoom: 0 };
    if (action === 'left') orbit.x = clamp(orbit.x - .18, -1, 1);
    if (action === 'right') orbit.x = clamp(orbit.x + .18, -1, 1);
    if (action === 'in') orbit.zoom = clamp(orbit.zoom + .15, -.5, 1);
    if (action === 'out') orbit.zoom = clamp(orbit.zoom - .15, -.5, 1);
    emitOrbit();
  }));
  canvas.addEventListener('pointerdown', event => {
    if (!active || !event.isPrimary || event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: orbit.x, startY: orbit.y };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!active || pointer?.id !== event.pointerId) return;
    orbit.x = clamp(pointer.startX + (event.clientX - pointer.x) / Math.max(240, innerWidth * .55), -1, 1);
    orbit.y = clamp(pointer.startY + (event.clientY - pointer.y) / Math.max(240, innerHeight * .65), -1, 1);
    emitOrbit();
  });
  const releasePointer = event => { if (pointer?.id === event.pointerId) pointer = null; };
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('lostpointercapture', releasePointer);
  canvas.addEventListener('wheel', event => {
    if (!active || event.ctrlKey) return;
    event.preventDefault();
    orbit.zoom = clamp(orbit.zoom - event.deltaY * .0015, -.5, 1);
    emitOrbit();
  }, { passive: false });
}
