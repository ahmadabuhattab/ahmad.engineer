import './world-pointer.css';

const instances = new WeakMap();
const labels = { energy: 'ENERGY', intelligence: 'INTELLIGENCE', industry: 'INDUSTRY' };

// This is a small instrument annotation beside the native pointer. It never
// captures input, replaces the cursor, or performs its own scene picking.
export function initializeWorldPointer(dialog, canvas) {
  if (!dialog?.ownerDocument || !canvas?.ownerDocument) return () => {};
  if (instances.has(dialog)) return instances.get(dialog);
  const page = dialog.ownerDocument, view = page.defaultView;
  if (!view) return () => {};
  const fine = view.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = page.createElement('div');
  pointer.className = 'world-pointer';
  pointer.setAttribute('aria-hidden', 'true');
  pointer.hidden = true;
  const mark = page.createElement('span');
  mark.className = 'world-pointer__mark';
  const caption = page.createElement('span');
  caption.className = 'world-pointer__caption';
  caption.textContent = 'DRAG TO ORBIT';
  pointer.append(mark, caption);
  dialog.append(pointer);

  let disposed = false, suspended = false, inside = false, pressed = false;
  let frame = 0, clientX = 0, clientY = 0, realm = null, hoveredRealm = null;
  const listeners = [];
  function on(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    listeners.push(() => target.removeEventListener(type, listener, options));
  }
  function allowed() {
    return !disposed && !suspended && !page.hidden && fine.matches && !reduced.matches
      && dialog.open && dialog.isConnected && dialog.contains(canvas)
      && dialog.dataset.render === 'ready'
      && !page.body.classList.contains('motion-paused')
      && !dialog.classList.contains('world-cinema')
      && !dialog.classList.contains('world-singularity-active');
  }
  function setRealm(next) {
    const target = !pressed && Object.hasOwn(labels, next) ? next : null;
    if (realm === target) return;
    realm = target;
    caption.textContent = realm ? labels[realm] : 'DRAG TO ORBIT';
    pointer.classList.toggle('has-target', !!realm);
  }
  function hide() {
    inside = false;
    pressed = false;
    pointer.hidden = true;
    pointer.classList.remove('is-pressed');
    setRealm(null);
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
  }
  function draw() {
    frame = 0;
    if (!inside || !allowed()) { hide(); return; }
    // Pointer capture can deliver moves after the mouse has left the stage.
    // Hit testing also excludes the real buttons layered above the canvas.
    const scene = canvas.getBoundingClientRect();
    if (clientX < scene.left || clientX > scene.right || clientY < scene.top || clientY > scene.bottom
      || page.elementFromPoint(clientX, clientY) !== canvas) { hide(); return; }
    const bounds = dialog.getBoundingClientRect();
    pointer.style.transform = `translate3d(${Math.round(clientX - bounds.left + dialog.scrollLeft)}px,${Math.round(clientY - bounds.top + dialog.scrollTop)}px,0)`;
    pointer.classList.toggle('align-left', clientX + 158 > Math.min(scene.right, view.innerWidth));
    pointer.classList.toggle('align-up', clientY + 42 > Math.min(scene.bottom, view.innerHeight));
    pointer.hidden = false;
  }
  function schedule() {
    if (!frame) frame = view.requestAnimationFrame(draw);
  }
  function move(event) {
    if (event.pointerType !== 'mouse' || !event.isPrimary || !allowed()) { hide(); return; }
    clientX = event.clientX;
    clientY = event.clientY;
    inside = true;
    setRealm(hoveredRealm);
    schedule();
  }
  function down(event) {
    if (event.pointerType !== 'mouse' || !event.isPrimary || event.button !== 0 || !allowed()) return;
    move(event);
    pressed = true;
    setRealm(null);
    pointer.classList.add('is-pressed');
  }
  function up() {
    pressed = false;
    pointer.classList.remove('is-pressed');
  }
  function hover(event) {
    // The renderer emits only target changes. Keep that state while the HUD is
    // hidden so keyboard pause/resume can redisplay an unchanged target.
    hoveredRealm = Object.hasOwn(labels, event.detail?.realm) ? event.detail.realm : null;
    if (allowed() && inside) setRealm(hoveredRealm);
  }
  function reset() { hoveredRealm = null; hide(); }
  function checkMode() { if (!allowed()) hide(); }

  on(canvas, 'pointerenter', move, { passive: true });
  on(canvas, 'pointermove', move, { passive: true });
  on(canvas, 'pointerdown', down, { passive: true });
  on(canvas, 'pointerup', up, { passive: true });
  on(canvas, 'pointercancel', reset, { passive: true });
  on(canvas, 'pointerleave', reset, { passive: true });
  on(canvas, 'lostpointercapture', up, { passive: true });
  on(page, 'world-hover', hover);
  on(page, 'world-view', reset);
  on(page, 'experience-motion', checkMode);
  on(page, 'visibilitychange', hide);
  on(view, 'blur', hide);
  on(view, 'resize', hide, { passive: true });
  on(dialog, 'scroll', hide, { passive: true });
  on(dialog, 'close', hide);
  on(fine, 'change', checkMode);
  on(reduced, 'change', checkMode);
  const observer = new view.MutationObserver(checkMode);
  observer.observe(dialog, { attributes: true, attributeFilter: ['class', 'open', 'data-render'] });

  function dispose() {
    if (disposed) return;
    hide();
    disposed = true;
    observer.disconnect();
    for (const remove of listeners) remove();
    pointer.remove();
    instances.delete(dialog);
  }
  on(view, 'pagehide', event => {
    if (!event.persisted) { dispose(); return; }
    suspended = true;
    hide();
  });
  on(view, 'pageshow', () => { suspended = false; hide(); });
  instances.set(dialog, dispose);
  return dispose;
}
