import * as THREE from 'three';
import './energy-core.css';

// A small, self-contained armillary: real geometry, a luminous nucleus, no
// postprocessing passes. The page's background remains visible through it.
const host = document.getElementById('energyScene');
const canvas = document.getElementById('energyCanvas');

if (host && canvas) initializeArmillary(host, canvas);

function initializeArmillary(host, canvas) {
  // Fallback artwork is present in the HTML, including before scripts load.

  const smallScreen = window.matchMedia('(max-width: 760px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, stencil: false,
      powerPreference: smallScreen.matches ? 'low-power' : 'high-performance',
    });
  } catch {
    host.dataset.render = 'fallback';
    return;
  }

  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallScreen.matches ? 1.25 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 45);
  camera.position.set(0, 0, 10.6);
  const instrument = new THREE.Group();
  scene.add(instrument);
  const resources = new Set();
  const retain = resource => { resources.add(resource); return resource; };
  const gold = new THREE.Color('#dbc392');
  const ice = new THREE.Color('#c5e3d7');

  scene.add(new THREE.HemisphereLight(0xe9e7cf, 0x072923, 2));
  const key = new THREE.DirectionalLight(0xfff1d4, 4.5);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xa3d5cd, 2.4);
  rim.position.set(3, -2, -2);
  scene.add(rim);
  const heartLight = new THREE.PointLight(0xffbf73, 13, 9, 2);
  heartLight.position.set(0, 0, 0.45);
  scene.add(heartLight);

  const glowTexture = retain(makeGlowTexture());
  function glow(color, scale, opacity = 0.4) {
    const material = retain(new THREE.SpriteMaterial({
      map: glowTexture, color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
      toneMapped: false,
    }));
    const sprite = new THREE.Sprite(material);
    sprite.scale.setScalar(scale);
    return sprite;
  }

  const halo = glow(0xe7bc78, 5.1, 0.36);
  instrument.add(halo);
  const innerGlow = glow(0xffdfab, 2.75, 0.56);
  instrument.add(innerGlow);

  const nucleusMaterial = retain(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vView;
      void main() {
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vView;
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(.1, .2, .3));
        p *= 17.;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3. - 2. * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                       mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                       mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      void main() {
        vec3 p = vPosition * 7.5;
        p.y += uTime * .07;
        float n = noise(p) * .65 + noise(p * 2.7) * .25 + noise(p * 6.5) * .1;
        float filaments = pow(1. - abs(sin(p.y * 2.1 + n * 8. + p.x * .8)), 7.);
        float facing = max(dot(normalize(vNormal), normalize(vView)), 0.);
        float edge = pow(1. - facing, 2.1);
        float light = .60 + .40 * max(dot(normalize(vNormal), normalize(vec3(-.5,.8,1.))), 0.);
        vec3 amber = vec3(1.0, .57, .19);
        vec3 ivory = vec3(1.0, .94, .71);
        vec3 color = mix(amber, ivory, n * .8 + .22) * light;
        color += ivory * (filaments * .45 + edge * .95);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  const nucleus = new THREE.Mesh(retain(new THREE.SphereGeometry(0.65, 56, 36)), nucleusMaterial);
  instrument.add(nucleus);

  const metal = retain(new THREE.MeshStandardMaterial({
    color: 0x9f947b, metalness: 0.82, roughness: 0.31,
    emissive: 0x493318, emissiveIntensity: 0.13,
    side: THREE.DoubleSide,
  }));
  const coolMetal = retain(new THREE.MeshStandardMaterial({
    color: 0x91b4a7, metalness: 0.76, roughness: 0.28,
    emissive: 0x20382f, emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
  }));
  const warmTrace = retain(new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.75, toneMapped: false }));
  const coolTrace = retain(new THREE.MeshBasicMaterial({ color: ice, transparent: true, opacity: 0.58, toneMapped: false }));
  const beadMaterial = retain(new THREE.MeshBasicMaterial({ color: 0xffefd4, toneMapped: false }));
  const beadGeometry = retain(new THREE.SphereGeometry(0.033, 10, 8));
  const orbits = [];

  function makeOrbit({ radius, width, tilt, speed, cool = false, phase = 0 }) {
    const frame = new THREE.Group();
    frame.rotation.set(...tilt);
    instrument.add(frame);
    const rotor = new THREE.Group();
    rotor.rotation.z = phase;
    frame.add(rotor);
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius + width / 2, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, radius - width / 2, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const band = new THREE.Mesh(
      retain(new THREE.ExtrudeGeometry(shape, { depth: 0.024, bevelEnabled: false, curveSegments: 112 })),
      cool ? coolMetal : metal,
    );
    band.position.z = -0.012;
    rotor.add(band);

    // Interrupted rails and index marks give the orbit a manufactured quality.
    [0.14, Math.PI + 0.14].forEach(start => {
      const rail = new THREE.Mesh(
        retain(new THREE.TorusGeometry(radius + width * 0.53, 0.007, 5, 100, Math.PI * 0.83)),
        cool ? coolTrace : warmTrace,
      );
      rail.rotation.z = start;
      rotor.add(rail);
    });
    const ticks = [];
    const tickCount = 108;
    for (let index = 0; index < tickCount; index++) {
      const angle = index / tickCount * Math.PI * 2;
      const long = index % 9 === 0;
      const inner = radius + width * 0.6;
      const outer = inner + (long ? 0.095 : 0.037);
      ticks.push(Math.cos(angle) * inner, Math.sin(angle) * inner, 0);
      ticks.push(Math.cos(angle) * outer, Math.sin(angle) * outer, 0);
    }
    const tickGeometry = retain(new THREE.BufferGeometry());
    tickGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
    const tickMaterial = retain(new THREE.LineBasicMaterial({
      color: cool ? ice : gold, transparent: true, opacity: cool ? 0.35 : 0.44,
      depthWrite: false,
    }));
    rotor.add(new THREE.LineSegments(tickGeometry, tickMaterial));

    const bead = new THREE.Mesh(beadGeometry, beadMaterial);
    bead.position.set(radius, 0, 0.035);
    rotor.add(bead);
    const beadGlow = glow(cool ? 0xb9eadc : 0xffdbae, 0.43, 0.83);
    beadGlow.position.copy(bead.position);
    rotor.add(beadGlow);
    orbits.push({ rotor, speed, phase });
  }

  makeOrbit({ radius: 2.61, width: 0.050, tilt: [1.13, 0.27, -0.39], speed: 0.035, phase: 0.8 });
  makeOrbit({ radius: 2.19, width: 0.076, tilt: [0.38, 1.08, 0.42], speed: -0.055, cool: true, phase: 2.4 });
  makeOrbit({ radius: 1.78, width: 0.046, tilt: [1.04, -0.65, 0.28], speed: 0.073, phase: -0.5 });

  const fineMaterial = retain(new THREE.LineBasicMaterial({
    color: 0xadc8b8, transparent: true, opacity: 0.19, depthWrite: false,
  }));
  const innerMaterial = retain(new THREE.LineBasicMaterial({
    color: 0xf5d6a4, transparent: true, opacity: 0.29, depthWrite: false,
  }));
  function lineOrbit(radius, tilt, material, start = 0, arc = Math.PI * 2) {
    const points = [];
    for (let i = 0; i <= 160; i++) {
      const theta = start + i / 160 * arc;
      points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
    }
    const line = new THREE.Line(retain(new THREE.BufferGeometry().setFromPoints(points)), material);
    line.rotation.set(...tilt);
    instrument.add(line);
    return line;
  }
  lineOrbit(2.91, [1.12, 0.27, -0.39], fineMaterial);
  lineOrbit(2.91, [0.38, 1.08, 0.42], fineMaterial, 0.2, Math.PI * 1.7);
  lineOrbit(1.28, [0.73, 0.58, 1.15], innerMaterial);
  lineOrbit(1.18, [1.18, -0.3, 0.16], innerMaterial);
  lineOrbit(0.95, [0.4, 1.02, -0.2], innerMaterial);

  // A deterministic dust field reads as depth, without any ambient randomness
  // changing on resize or an additional full-screen rendering pass.
  let seed = 2411;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const dustPositions = [];
  const dustColors = [];
  const dustCount = smallScreen.matches ? 140 : 290;
  for (let index = 0; index < dustCount; index++) {
    const azimuth = random() * Math.PI * 2;
    const height = random() * 2 - 1;
    const radius = 1.15 + random() * 2.5;
    const spread = Math.sqrt(1 - height * height);
    dustPositions.push(Math.cos(azimuth) * spread * radius, height * radius * 0.84, Math.sin(azimuth) * spread * radius);
    const shade = random() > 0.67 ? ice : gold;
    dustColors.push(shade.r, shade.g, shade.b);
  }
  const dustGeometry = retain(new THREE.BufferGeometry());
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  dustGeometry.setAttribute('color', new THREE.Float32BufferAttribute(dustColors, 3));
  const dustMaterial = retain(new THREE.PointsMaterial({
    map: glowTexture, size: 0.041, vertexColors: true, transparent: true,
    opacity: 0.71, blending: THREE.AdditiveBlending, depthWrite: false,
    toneMapped: false, sizeAttenuation: true,
  }));
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  scene.add(dust);

  let isVisible = true;
  let isPaused = document.body.classList.contains('motion-paused');
  let disposed = false;
  let contextLost = false;
  let frameId = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let pointerX = 0;
  let pointerY = 0;
  let easedX = 0;
  let easedY = 0;

  function canAnimate() {
    return !disposed && !contextLost && isVisible && !document.hidden && !isPaused && !reducedMotion.matches;
  }

  function render() {
    instrument.rotation.set(-0.055 + easedY * 0.095, 0.10 + easedX * 0.15 + Math.sin(elapsed * 0.055) * 0.08, -0.07);
    nucleus.rotation.y = elapsed * 0.022;
    nucleusMaterial.uniforms.uTime.value = elapsed;
    for (const { rotor, speed, phase } of orbits) rotor.rotation.z = phase + elapsed * speed;
    dust.rotation.y = elapsed * -0.012;
    dust.rotation.z = 0.08;
    halo.material.opacity = 0.33 + Math.sin(elapsed * 0.42) * 0.025;
    renderer.render(scene, camera);
  }

  function tick(timestamp) {
    frameId = 0;
    if (!canAnimate()) return;
    const minimumInterval = smallScreen.matches ? 1000 / 30 : 1000 / 45;
    const deltaMs = timestamp - lastFrame;
    if (deltaMs >= minimumInterval) {
      elapsed += Math.min(deltaMs / 1000, 0.065);
      lastFrame = timestamp - (deltaMs % minimumInterval);
      easedX += (pointerX - easedX) * 0.06;
      easedY += (pointerY - easedY) * 0.06;
      render();
    }
    frameId = requestAnimationFrame(tick);
  }

  function syncAnimation() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    lastFrame = performance.now();
    if (canAnimate()) frameId = requestAnimationFrame(tick);
  }

  function resize() {
    if (disposed || contextLost) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.position.z = Math.max(10.1, 10.1 / camera.aspect);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, smallScreen.matches ? 1.25 : 1.6));
    renderer.setSize(width, height, false);
    render();
  }

  function onPointerMove(event) {
    if (event.pointerType === 'touch' || !canAnimate()) return;
    const bounds = host.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  }
  function onPointerLeave() { pointerX = 0; pointerY = 0; }
  function onMotion(event) {
    if (typeof event.detail?.paused !== 'boolean') return;
    isPaused = event.detail.paused;
    syncAnimation();
  }
  function onContextLost(event) {
    event.preventDefault();
    contextLost = true;
    host.dataset.render = 'fallback';
    syncAnimation();
  }
  function onContextRestored() {
    contextLost = false;
    resize();
    host.dataset.render = 'webgl';
    syncAnimation();
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  resizeObserver?.observe(host);
  if (!resizeObserver) window.addEventListener('resize', resize, { passive: true });
  const visibilityObserver = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
    isVisible = entries[0].isIntersecting;
    syncAnimation();
  }, { rootMargin: '60px' }) : null;
  visibilityObserver?.observe(host);
  host.addEventListener('pointermove', onPointerMove, { passive: true });
  host.addEventListener('pointerleave', onPointerLeave, { passive: true });
  document.addEventListener('visibilitychange', syncAnimation);
  document.addEventListener('experience-motion', onMotion);
  reducedMotion.addEventListener('change', syncAnimation);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  function dispose(event) {
    // The browser may freeze this page into its back/forward cache.
    if (event?.persisted) { if (frameId) cancelAnimationFrame(frameId); frameId = 0; return; }
    disposed = true;
    if (frameId) cancelAnimationFrame(frameId);
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    if (!resizeObserver) window.removeEventListener('resize', resize);
    host.removeEventListener('pointermove', onPointerMove);
    host.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('visibilitychange', syncAnimation);
    document.removeEventListener('experience-motion', onMotion);
    reducedMotion.removeEventListener('change', syncAnimation);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    window.removeEventListener('pagehide', dispose);
    window.removeEventListener('pageshow', syncAnimation);
    resources.forEach(resource => resource.dispose());
    renderer.dispose();
  }
  window.addEventListener('pagehide', dispose);
  window.addEventListener('pageshow', syncAnimation);

  resize();
  host.dataset.render = 'webgl';
  syncAnimation();
}

function makeGlowTexture() {
  const bitmap = document.createElement('canvas');
  bitmap.width = bitmap.height = 128;
  const context = bitmap.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.08, 'rgba(255,255,255,.82)');
  gradient.addColorStop(0.22, 'rgba(255,255,255,.33)');
  gradient.addColorStop(0.48, 'rgba(255,255,255,.085)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(bitmap);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
