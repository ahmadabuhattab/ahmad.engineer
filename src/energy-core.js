import * as THREE from 'three';
import { sampleCycle, CYCLE_DURATION, BURST_START } from './energy-cycle.js';
import { createWorldEnvironment } from './world-environment.js';
import { createWorldCinematic } from './world-cinematic.js';
import { createWorldSingularity } from './world-singularity.js';
import { createWorldFieldLab } from './world-field-lab.js';
import { sampleSpacetime } from './world-spacetime.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import './energy-core.css';

// The armillary and observatory share one bounded HDR renderer and clock.
const host = document.getElementById('energyScene');
const canvas = document.getElementById('energyCanvas');

if (host && canvas) initializeArmillary(host, canvas);

function initializeArmillary(host, canvas) {
  // Fallback artwork is present in the HTML, including before scripts load.

  const smallScreen = window.matchMedia('(max-width: 760px)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  // Rotating a phone should change its composition, not raise its GPU budget.
  const mobileBudget = () => smallScreen.matches || coarsePointer.matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, stencil: false,
      powerPreference: mobileBudget() ? 'low-power' : 'high-performance',
    });
  } catch {
    host.dataset.render = 'fallback';
    return;
  }

  renderer.setClearColor(0x050505, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileBudget() ? 1.25 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 140);
  camera.position.set(1, 4, 20);
  const instrument = new THREE.Group();
  scene.add(instrument);
  const resources = new Set();
  const retain = resource => { resources.add(resource); return resource; };
  const gold = new THREE.Color('#bcbcbc');
  const ice = new THREE.Color('#eeeeee');

  scene.add(new THREE.HemisphereLight(0xffffff, 0x141414, 1.65));
  const key = new THREE.DirectionalLight(0xffffff, 4.3);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 2.0);
  rim.position.set(3, -2, -2);
  scene.add(rim);
  const heartLight = new THREE.PointLight(0xffffff, 9, 9, 2);
  heartLight.position.set(0, 0, 0.45);
  scene.add(heartLight);
  // A locally generated reflection environment gives metals readable faces
  // and edges. No HDR image or external texture has to be downloaded.
  let reflections;
  function regenerateReflections() {
    if (reflections) { resources.delete(reflections); reflections.dispose(); }
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    reflections = retain(pmrem.fromScene(room, .04));
    scene.environment = reflections.texture;
    room.dispose();
    pmrem.dispose();
  }
  regenerateReflections();
  scene.environmentIntensity = .45;
  scene.environmentRotation.y = .65;
  const world = createWorldEnvironment(THREE, scene);
  const singularity = createWorldSingularity(THREE, scene);
  const fieldLab = createWorldFieldLab(THREE, scene, { mobile: mobileBudget() });
  const cinematic = createWorldCinematic(renderer, scene, camera, mobileBudget());

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

  const halo = glow(0xbcbcbc, 6.2, 0.3);
  instrument.add(halo);
  const innerGlow = glow(0xe8e8e8, 2.75, 0.28);
  instrument.add(innerGlow);

  const nucleusMaterial = retain(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHeat: { value: 0 } },
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
      uniform float uHeat;
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
        p.y += uTime * (.12 + uHeat * .12);
        float n = noise(p) * .65 + noise(p * 2.7) * .25 + noise(p * 6.5) * .1;
        float filaments = pow(1. - abs(sin(p.y * 2.1 + n * 8. + p.x * .8)), 7.);
        float facing = clamp(dot(normalize(vNormal), normalize(vView)), 0., 1.);
        float edge = pow(1. - facing, 2.1);
        vec3 lightDirection = normalize(vec3(-.5,.8,1.));
        float light = .24 + .56 * max(dot(normalize(vNormal), lightDirection), 0.);
        float polished = pow(max(dot(reflect(-lightDirection, normalize(vNormal)), normalize(vView)), 0.), 32.);
        vec3 graphite = vec3(.18);
        vec3 silver = vec3(.88);
        vec3 color = mix(graphite, silver, n * .8 + .22) * light;
        color += silver * (filaments * (.30 + uHeat * .7) + edge * .72 + polished * .9);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  const nucleus = new THREE.Mesh(retain(new THREE.SphereGeometry(0.65, 56, 36)), nucleusMaterial);
  instrument.add(nucleus);

  const metal = retain(new THREE.MeshStandardMaterial({
    color: 0x888888, metalness: 0.94, roughness: 0.24,
    emissive: 0x262626, emissiveIntensity: 0.13,
    side: THREE.DoubleSide,
  }));
  const coolMetal = retain(new THREE.MeshStandardMaterial({
    color: 0xc2c2c2, metalness: 0.96, roughness: 0.18,
    emissive: 0x171717, emissiveIntensity: 0.12,
    side: THREE.DoubleSide,
  }));
  const warmTrace = retain(new THREE.MeshBasicMaterial({ color: gold, transparent: true, opacity: 0.75, toneMapped: false }));
  const coolTrace = retain(new THREE.MeshBasicMaterial({ color: ice, transparent: true, opacity: 0.58, toneMapped: false }));
  const beadMaterial = retain(new THREE.MeshBasicMaterial({ color: 0xf4f4f4, toneMapped: false }));
  const beadGeometry = retain(new THREE.SphereGeometry(0.033, 10, 8));
  const orbits = [];
  const transform = new THREE.Object3D();

  function makeOrbit({ radius, width, tilt, speed, cool = false, phase = 0 }) {
    const frame = new THREE.Group();
    frame.rotation.set(...tilt);
    instrument.add(frame);
    const rotor = new THREE.Group();
    rotor.rotation.z = phase;
    frame.add(rotor);
    const segmentCount = 48;
    const halfArc = Math.PI / segmentCount * .975;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius + width / 2, -halfArc, halfArc, false);
    shape.absarc(0, 0, radius - width / 2, halfArc, -halfArc, true);
    shape.closePath();
    const segmentGeometry = retain(new THREE.ExtrudeGeometry(shape, {
      depth: .034, bevelEnabled: false, curveSegments: 5,
    }));
    segmentGeometry.translate(-radius, 0, -.017);
    const band = retain(new THREE.InstancedMesh(segmentGeometry, cool ? coolMetal : metal, segmentCount));
    band.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    band.frustumCulled = false;
    const pieces = Array.from({ length: segmentCount }, (_, i) => {
      const angle = i / segmentCount * Math.PI * 2;
      const noise = Math.sin(i * 73.13 + radius * 9.1);
      return { angle, noise, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
    rotor.add(band);

    // Interrupted rails and index marks give the orbit a manufactured quality.
    const details = new THREE.Group();
    rotor.add(details);
    [0.14, Math.PI + 0.14].forEach(start => {
      const rail = new THREE.Mesh(
        retain(new THREE.TorusGeometry(radius + width * 0.53, 0.007, 5, 100, Math.PI * 0.83)),
        cool ? coolTrace : warmTrace,
      );
      rail.rotation.z = start;
      details.add(rail);
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
    details.add(new THREE.LineSegments(tickGeometry, tickMaterial));

    const bead = new THREE.Mesh(beadGeometry, beadMaterial);
    bead.position.set(radius, 0, 0.035);
    details.add(bead);
    const beadGlow = glow(cool ? 0xeeeeee : 0xd2d2d2, 0.43, 0.73);
    beadGlow.position.copy(bead.position);
    details.add(beadGlow);
    orbits.push({ rotor, frame, tilt, band, pieces, details, speed, phase });
  }

  makeOrbit({ radius: 2.61, width: 0.050, tilt: [1.13, 0.27, -0.39], speed: 0.035, phase: 0.8 });
  makeOrbit({ radius: 2.19, width: 0.076, tilt: [0.38, 1.08, 0.42], speed: -0.055, cool: true, phase: 2.4 });
  makeOrbit({ radius: 1.78, width: 0.046, tilt: [1.04, -0.65, 0.28], speed: 0.073, phase: -0.5 });

  const fineMaterial = retain(new THREE.LineBasicMaterial({
    color: 0xbebebe, transparent: true, opacity: 0.19, depthWrite: false,
  }));
  const innerMaterial = retain(new THREE.LineBasicMaterial({
    color: 0xd6d6d6, transparent: true, opacity: 0.29, depthWrite: false,
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
  const dustCount = mobileBudget() ? 140 : 290;
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

  // Instanced facets give the nucleus physical pieces, in two draw calls
  // instead of one material/mesh/scene object for every shard.
  const shardCount = 112;
  const shardGeometry = retain(new THREE.OctahedronGeometry(.082, 0));
  const shardMaterial = retain(new THREE.MeshStandardMaterial({
    color: 0xd9d9d9, metalness: .91, roughness: .2,
    emissive: 0x939393, emissiveIntensity: .28,
  }));
  const shards = retain(new THREE.InstancedMesh(shardGeometry, shardMaterial, shardCount));
  shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shards.frustumCulled = false;
  instrument.add(shards);
  const shardHomes = Array.from({ length: shardCount }, (_, i) => {
    const y = 1 - (i + .5) / shardCount * 2;
    const angle = i * 2.3999632297;
    const r = Math.sqrt(1 - y * y);
    return { x: Math.cos(angle) * r, y, z: Math.sin(angle) * r, seed: random() };
  });
  shardHomes.forEach((p, i) => shards.setColorAt(i, i % 7 === 0 ? ice : gold));

  const sparkCount = 820;
  const sparkHomes = [], sparkTravel = [], sparkSeeds = [];
  for (let i = 0; i < sparkCount; i++) {
    const a = random() * Math.PI * 2;
    const y = random() * 2 - 1;
    const r = Math.sqrt(1 - y * y);
    const homeR = .5 + random() * .4;
    const travel = 1.7 + random() * 2;
    sparkHomes.push(Math.cos(a) * r * homeR, y * homeR, Math.sin(a) * r * homeR);
    sparkTravel.push(Math.cos(a) * r * travel, y * travel, Math.sin(a) * r * travel);
    sparkSeeds.push(random());
  }
  const sparkGeometry = retain(new THREE.BufferGeometry());
  sparkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sparkHomes, 3));
  sparkGeometry.setAttribute('aTravel', new THREE.Float32BufferAttribute(sparkTravel, 3));
  sparkGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(sparkSeeds, 1));
  const sparkMaterial = retain(new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uScatter: { value: 0 }, uHeat: { value: 0 }, uDpr: { value: 1 } },
    vertexShader: `
      attribute vec3 aTravel;
      attribute float aSeed;
      uniform float uTime, uScatter, uHeat, uDpr;
      varying float vSeed, vAlpha;
      void main() {
        vec3 p = position + aTravel * uScatter;
        float twist = uScatter * (1.5 + aSeed * 1.2 + uTime * .09);
        p.xz = mat2(cos(twist), -sin(twist), sin(twist), cos(twist)) * p.xz;
        p.y += sin(uScatter * 3.14159) * sin(aSeed * 45. + uTime * .65) * .45;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((2. + aSeed * 2. + uHeat * 3.) * uDpr * 8. / -mv.z, 1., 11.);
        vSeed = aSeed;
        vAlpha = .08 + uHeat * .86;
      }
    `,
    fragmentShader: `
      varying float vSeed, vAlpha;
      void main() {
        float radius = length(gl_PointCoord - .5) * 2.;
        if (radius > 1.) discard;
        float alpha = exp(-radius * radius * 5.) * vAlpha;
        vec3 color = mix(vec3(.76), vec3(1.), step(.8, vSeed));
        gl_FragColor = vec4(color, alpha);
      }
    `,
  }));
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false;
  instrument.add(sparks);

  const waves = Array.from({ length: 3 }, (_, i) => {
    const material = retain(new THREE.MeshBasicMaterial({
      color: i === 1 ? 0xeeeeee : 0xbdbdbd,
      transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    const wave = new THREE.Mesh(retain(new THREE.RingGeometry(.987, 1.007, 128)), material);
    wave.rotation.set(i === 1 ? 1.12 : .15 * i, .1, -.2);
    scene.add(wave);
    return wave;
  });
  const flare = glow(0xdcdcdc, 1, 0);
  flare.scale.set(8, .12, 1);
  scene.add(flare);

  const coronaGeometry = retain(new THREE.BufferGeometry());
  const coronaPoints = new Float32Array(3 * 128 * 6);
  coronaGeometry.setAttribute('position', new THREE.BufferAttribute(coronaPoints, 3).setUsage(THREE.DynamicDrawUsage));
  const coronaMaterial = retain(new THREE.LineBasicMaterial({
    color: 0xd4d4d4, transparent: true, opacity: .25,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const corona = new THREE.LineSegments(coronaGeometry, coronaMaterial);
  corona.frustumCulled = false;
  instrument.add(corona);

  let isVisible = true;
  let isPaused = document.body.classList.contains('motion-paused');
  let disposed = false;
  let contextLost = false;
  let frameId = 0;
  let lastFrame = 0;
  let elapsed = 0;
  let cycleOffset = 0;
  let spinOffset = 0;
  let pointerX = 0;
  let pointerY = 0;
  let easedX = 0;
  let easedY = 0;
  let lastPhase = '';
  let immersive = host.dataset.world === 'true';
  let fieldActive = host.dataset.lab === 'true';
  let fieldForm = host.dataset.labForm || 'sphere';
  let realm = host.dataset.realm || 'overview';
  const activity = { kind: null, strength: 0, progress: 0 };
  let activityTarget = 0;
  let activityStarted = 0;
  let flightStarted = host.dataset.flight === 'true' ? 0 : -100;
  let flightDuration = 3.4;
  let warp = 0;
  let spacetime = sampleSpacetime(0, false);
  const gravityPosition = new THREE.Vector3();
  const gravityTarget = new THREE.Vector3();
  const lensPosition = new THREE.Vector3();
  let framesMeasured = 0, renderCost = 0;
  const flightPosition = new THREE.Vector3();
  const flightLook = new THREE.Vector3();
  const entryCurve = new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, 1.35, -19), new THREE.Vector3(0, 1.35, -1),
    new THREE.Vector3(1, 3.8, 9), new THREE.Vector3(12, 7, 19),
  );
  const orbit = { x: 0, y: 0, zoom: 0 };
  const cameraTarget = new THREE.Vector3(-3, -.6, 0);
  const desiredPosition = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const viewOffset = new THREE.Vector3();
  const viewSphere = new THREE.Spherical();
  const views = {
    overview: { position: [12, 7, 19], target: [0, -.2, -4] },
    energy: { position: [5.5, 2.7, 10], target: [0, -.15, 0] },
    intelligence: { position: [-5, 2.5, 5], target: [-8, 0, -4] },
    industry: { position: [12, 3.2, 5], target: [8, 0, -5] },
  };
  const fieldView = { position: [3, 1.5, 9], target: [0, 0, 0] };
  const raycaster = new THREE.Raycaster();
  const hitPoint = new THREE.Vector3();
  const hitPointer = new THREE.Vector2();
  const landmarks = [
    { realm: 'energy', sphere: new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2.8) },
    { realm: 'intelligence', sphere: new THREE.Sphere(new THREE.Vector3(-8, 0, -4), 2.4) },
    { realm: 'industry', sphere: new THREE.Sphere(new THREE.Vector3(8, -.2, -5), 2.5) },
  ];
  let tapStart = null;
  let hoveredRealm = null;
  function hoverLandmark(realm) {
    if (realm === hoveredRealm) return;
    hoveredRealm = realm;
    document.dispatchEvent(new CustomEvent('world-hover', { detail: { realm } }));
  }
  function pickLandmark(event) {
    if (fieldActive) return null;
    const box = canvas.getBoundingClientRect();
    hitPointer.set((event.clientX - box.left) / box.width * 2 - 1, 1 - (event.clientY - box.top) / box.height * 2);
    raycaster.setFromCamera(hitPointer, camera);
    let nearest = null, distance = Infinity;
    for (const landmark of landmarks) {
      if (raycaster.ray.intersectSphere(landmark.sphere, hitPoint)) {
        const next = hitPoint.distanceToSquared(camera.position);
        if (next < distance) { distance = next; nearest = landmark.realm; }
      }
    }
    return nearest;
  }
  function onSceneDown(event) {
    tapStart = immersive && event.isPrimary && event.button === 0 ? { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false } : null;
  }
  function onSceneMove(event) {
    if (tapStart?.id === event.pointerId && Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y) > 7) tapStart.dragged = true;
    if (immersive && !event.buttons) {
      const hovered = spacetime.strength > 0 ? null : pickLandmark(event);
      canvas.style.cursor = hovered ? 'pointer' : 'grab';
      hoverLandmark(hovered);
    }
  }
  function onSceneUp(event) {
    if (immersive && !spacetime.strength && tapStart?.id === event.pointerId && !tapStart.dragged) {
      const selected = pickLandmark(event);
      if (selected) document.dispatchEvent(new CustomEvent('world-select', { detail: { realm: selected } }));
    }
    tapStart = null;
  }
  function cancelSceneTap() { tapStart = null; }
  function leaveScene() { hoverLandmark(null); }

  function updateCamera(scatter, charge) {
    if (immersive) {
      const view = fieldActive ? fieldView : views[realm] || views.overview;
      desiredTarget.fromArray(view.target);
      viewOffset.fromArray(view.position).sub(desiredTarget);
      viewSphere.setFromVector3(viewOffset);
      viewSphere.theta += orbit.x * 1.35 + (host.dataset.touring === 'true' ? Math.sin(elapsed * .16) * .12 : 0);
      viewSphere.phi = THREE.MathUtils.clamp(viewSphere.phi + orbit.y * .55, .38, 1.49);
      viewSphere.radius *= (1 - orbit.zoom * .38) * Math.max(1, Math.min(1.4, .75 / camera.aspect));
      if (fieldActive && camera.aspect < .9) viewSphere.radius *= 1.28;
      if (realm === 'energy') viewSphere.radius += scatter * 1.2;
      desiredPosition.setFromSpherical(viewSphere).add(desiredTarget);
      if (camera.aspect < .9) { desiredTarget.y -= fieldActive ? 2 : .85; desiredPosition.y -= fieldActive ? .7 : .3; }
    } else if (smallScreen.matches) {
      desiredTarget.set(0, -.5, -1);
      desiredPosition.set(.6, 2.6, Math.max(13, 12 / camera.aspect) + scatter * 1.5);
    } else {
      desiredTarget.set(-3.8 + easedX * .25, -.4 + easedY * .18, -1.2);
      const arrival = isPaused ? 0 : Math.pow(Math.max(0, 1 - elapsed / 3.2), 3);
      desiredPosition.set(.7 + easedX * .35, 2.5 + arrival * 2, 14 + arrival * 7 + scatter * 1.1 + charge * .15);
    }
    if (immersive && spacetime.strength > 0) {
      gravityPosition.set(Math.sin(spacetime.progress * Math.PI * 2) * 2.6, 2.4 - spacetime.collapse * .9, 15 - spacetime.collapse * 6);
      gravityTarget.set(0, -.15, 0);
      desiredPosition.lerp(gravityPosition, spacetime.strength);
      desiredTarget.lerp(gravityTarget, spacetime.strength);
    }
    const journey = (elapsed - flightStarted) / flightDuration;
    warp = immersive && journey >= 0 && journey < 1 && !isPaused ? Math.sin(journey * Math.PI) : 0;
    if (warp > 0) {
      const progress = THREE.MathUtils.smootherstep(journey, 0, 1);
      entryCurve.v3.copy(desiredPosition);
      entryCurve.getPoint(progress, flightPosition);
      flightLook.set(0, 1.1, 7).lerp(desiredTarget, THREE.MathUtils.smoothstep(journey, .2, 1));
      camera.position.copy(flightPosition);
      cameraTarget.copy(flightLook);
    } else {
    // Direct camera input still works when ambient motion is paused.
    camera.position.lerp(desiredPosition, isPaused ? 1 : .055);
    cameraTarget.lerp(desiredTarget, isPaused ? 1 : .055);
    }
    const fov = 42 + warp * 14 + spacetime.bloom * 8;
    if (Math.abs(camera.fov - fov) > .01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const roll = Math.sin(spacetime.progress * Math.PI * 2) * spacetime.strength * .075;
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(cameraTarget);
  }

  function canAnimate() {
    return !disposed && !contextLost && (isVisible || immersive) && !document.hidden && !isPaused;
  }

  function render() {
    const cycle = sampleCycle(elapsed + cycleOffset);
    cycle.spin += spinOffset;
    const { scatter, charge, shock, heat } = cycle;
    if (cycle.phase !== lastPhase) {
      lastPhase = cycle.phase;
      host.dataset.phase = lastPhase;
      document.dispatchEvent(new CustomEvent('energy-phase', { detail: cycle }));
    }
    instrument.rotation.set(-.055 + easedY * .15 + Math.sin(elapsed * .23) * .09,
      .1 + easedX * .23 + elapsed * .07, -.07 + Math.sin(elapsed * .14) * .06);
    updateCamera(scatter, charge);
    activity.strength += (activityTarget - activity.strength) * (isPaused ? 1 : .07);
    activity.progress = Math.min(1, (elapsed - activityStarted) / 7);
    world.update({ time: elapsed, scatter, charge, realm, immersive, activity, warp, collapse: spacetime.collapse, bloom: spacetime.bloom, visible: !fieldActive });
    instrument.visible = !fieldActive;
    fieldLab.update({ time: elapsed, active: immersive && fieldActive, form: fieldForm, pointer: { x: easedX, y: easedY }, paused: isPaused });
    instrument.scale.setScalar(1 - spacetime.collapse * .92 + spacetime.bloom * .08);
    singularity.update({ time: elapsed, scatter, charge, realm, immersive, singularity: spacetime, pointer: { x: easedX, y: easedY }, visible: !fieldActive });
    nucleus.rotation.y = elapsed * .15;
    nucleus.scale.setScalar(Math.max(.035, (1 - Math.min(1, scatter * 2.7)) * (1 - charge * .25)));
    nucleusMaterial.uniforms.uTime.value = elapsed;
    nucleusMaterial.uniforms.uHeat.value = heat + (activity.kind === 'resonance' ? activity.strength * .55 : 0);
    for (const orbit of orbits) {
      const { rotor, frame, tilt, band, pieces, details, speed, phase } = orbit;
      rotor.rotation.z = phase + elapsed * speed * 2.8 + cycle.spin * .22;
      frame.rotation.set(tilt[0] + Math.sin(elapsed * .17 + phase) * .15,
        tilt[1] + Math.cos(elapsed * .2 + phase) * .14, tilt[2] + scatter * .35);
      frame.scale.setScalar(1 - charge * .14);
      details.visible = scatter < .025;
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        const twist = scatter * (.75 + p.noise * .5);
        const c = Math.cos(twist), s = Math.sin(twist);
        const stretch = 1 + scatter * (.4 + p.noise * .09);
        transform.position.set((p.x * c - p.y * s) * stretch,
          (p.x * s + p.y * c) * stretch, scatter * (p.noise * 1.9 + Math.sin(i * 2.1 + elapsed * .3) * .35));
        transform.rotation.set(scatter * (1.8 + p.noise), scatter * p.noise * 2.5,
          p.angle + twist + scatter * (p.noise * 1.4));
        transform.scale.setScalar(1 + scatter * .35);
        transform.updateMatrix();
        band.setMatrixAt(i, transform.matrix);
      }
      band.instanceMatrix.needsUpdate = true;
    }
    shards.visible = scatter > .001;
    if (shards.visible) {
      for (let i = 0; i < shardHomes.length; i++) {
        const p = shardHomes[i];
        const radius = .63 + scatter * (1.6 + p.seed * 1.35);
        const angle = scatter * (1.9 + p.seed + elapsed * .06);
        const c = Math.cos(angle), s = Math.sin(angle);
        transform.position.set((p.x * c - p.z * s) * radius,
          p.y * radius + Math.sin(scatter * Math.PI) * Math.sin(p.seed * 26 + elapsed * .7) * .2,
          (p.x * s + p.z * c) * radius);
        transform.rotation.set(p.seed * 6 + scatter * elapsed * .2, p.seed * 8 + scatter * 3, scatter * p.seed * 4);
        const size = Math.min(1, scatter * 7) * (.65 + p.seed * .85);
        transform.scale.set(size * .7, size * (1.1 + p.seed), size * .55);
        transform.updateMatrix();
        shards.setMatrixAt(i, transform.matrix);
      }
      shards.instanceMatrix.needsUpdate = true;
    }
    sparkMaterial.uniforms.uTime.value = elapsed;
    sparkMaterial.uniforms.uScatter.value = scatter;
    sparkMaterial.uniforms.uHeat.value = heat;
    sparkMaterial.uniforms.uDpr.value = renderer.getPixelRatio();
    for (let i = 0; i < waves.length; i++) {
      const progress = (shock - i * .1) / (1 - i * .1);
      const wave = waves[i];
      wave.visible = !fieldActive && progress > 0 && progress < 1;
      wave.scale.setScalar(.7 + Math.max(0, progress) * 5.1);
      wave.material.opacity = wave.visible ? Math.sin(progress * Math.PI) * .34 * (1 - progress) : 0;
    }
    flare.material.opacity = shock > 0 ? Math.sin(shock * Math.PI) * (1 - shock) * .8 : charge * .1;
    flare.visible = !fieldActive;
    flare.scale.x = 6 + scatter * 3;
    let at = 0;
    const shell = 1.04 + scatter * 2.55 - charge * .2;
    for (let lane = 0; lane < 3; lane++) {
      for (let i = 0; i < 128; i++) {
        for (const end of [0, .62]) {
          const a = (i + end) / 128 * Math.PI * 2;
          const r = shell + Math.sin(a * 6 + elapsed * (1 + heat) + lane * 2) * (.055 + heat * .08);
          const y = Math.sin(a) * r;
          const z = Math.sin(a * 3 + elapsed * .8 + lane) * (.13 + scatter * .14);
          const tilt = lane * 1.15 + elapsed * .12;
          coronaPoints[at++] = Math.cos(a) * r;
          coronaPoints[at++] = y * Math.cos(tilt) - z * Math.sin(tilt);
          coronaPoints[at++] = y * Math.sin(tilt) + z * Math.cos(tilt);
        }
      }
    }
    coronaGeometry.attributes.position.needsUpdate = true;
    coronaMaterial.opacity = .22 + heat * .5;
    dust.rotation.y = elapsed * -.028;
    dust.rotation.z = 0.08;
    dust.scale.setScalar(1 + scatter * .28);
    halo.scale.setScalar(6.2 + scatter * 3.2 - charge * .5);
    halo.material.opacity = .30 + heat * .24 + Math.sin(elapsed * .75) * .025;
    innerGlow.scale.setScalar(2.5 + scatter * 2.1);
    innerGlow.material.opacity = .28 + charge * .29 + scatter * .10;
    heartLight.intensity = fieldActive ? 9 : 9 + heat * 9;
    const started = performance.now();
    lensPosition.set(0, 0, 0).project(camera);
    cinematic.render({ time: elapsed, warp, immersive, heat: fieldActive ? 0 : heat, activity: activity.strength, singularity: spacetime, lensX: lensPosition.x * .5 + .5, lensY: lensPosition.y * .5 + .5 });
    if (framesMeasured++ > 80 && framesMeasured < 220) {
      renderCost += (performance.now() - started - renderCost) * .04;
      if (framesMeasured === 219 && renderCost > 28 && cinematic.reduceResolution()) resize();
    }
  }

  function tick(timestamp) {
    frameId = 0;
    if (!canAnimate()) return;
    const minimumInterval = mobileBudget() ? 1000 / 30 : 1000 / 45;
    const deltaMs = timestamp - lastFrame;
    if (deltaMs >= minimumInterval) {
      const remainder = deltaMs % minimumInterval;
      elapsed += Math.min((deltaMs - remainder) / 1000, 0.1);
      lastFrame = timestamp - remainder;
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
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobileBudget() ? 1.25 : 1.6));
    renderer.setSize(width, height, false);
    cinematic.resize(width, height, renderer.getPixelRatio());
    render();
  }

  function onPointerMove(event) {
    if ((immersive && !fieldActive) || event.pointerType === 'touch' || !canAnimate()) return;
    const bounds = host.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  }
  function onPointerLeave() { pointerX = 0; pointerY = 0; }
  function onBurst() {
    const current = elapsed + cycleOffset;
    if (!canAnimate() || sampleCycle(current).bursting) return;
    const target = current + ((BURST_START - current % CYCLE_DURATION + CYCLE_DURATION) % CYCLE_DURATION) + 1e-9;
    spinOffset += sampleCycle(current).spin - sampleCycle(target).spin;
    cycleOffset += target - current;
    render();
  }
  function onMotion(event) {
    if (typeof event.detail?.paused !== 'boolean') return;
    isPaused = event.detail.paused;
    syncAnimation();
  }
  function onWorldView(event) {
    cancelSceneTap();
    hoverLandmark(null);
    immersive = event.detail?.active === true;
    realm = Object.hasOwn(views, event.detail?.realm) ? event.detail.realm : 'overview';
    orbit.x = orbit.y = orbit.zoom = 0;
    pointerX = pointerY = 0;
    if (!immersive) { flightStarted = -100; fieldActive = false; }
    resize();
    syncAnimation();
  }
  function onWorldOrbit(event) {
    flightStarted = -100;
    for (const key of ['x', 'y', 'zoom']) {
      const value = event.detail?.[key];
      if (Number.isFinite(value)) orbit[key] = THREE.MathUtils.clamp(value, key === 'zoom' ? -.5 : -1, 1);
    }
    if (immersive && isPaused && !disposed && !contextLost) render();
  }
  function onWorldLab(event) {
    fieldActive = immersive && event.detail?.active === true;
    if (['sphere', 'knot', 'helix'].includes(event.detail?.form)) fieldForm = event.detail.form;
    cancelSceneTap();
    hoverLandmark(null);
    if (!disposed && !contextLost) render();
  }
  function onActivity(event) {
    if (!['resonance', 'signal', 'forge'].includes(event.detail?.kind)) return;
    activity.kind = event.detail.kind;
    activityTarget = event.detail.active ? THREE.MathUtils.clamp(Number(event.detail.strength) || 0, 0, 1) : 0;
    if (event.detail.active) activityStarted = elapsed;
    if (isPaused && !disposed && !contextLost) render();
  }
  function onFlight(event) {
    flightStarted = event.detail?.active && !isPaused ? elapsed : -100;
    flightDuration = THREE.MathUtils.clamp(Number(event.detail?.duration) || 3.4, 1, 6);
  }
  function onSingularity(event) {
    spacetime = sampleSpacetime(event.detail?.progress, event.detail?.active === true);
    hoverLandmark(null);
    if (isPaused && !disposed && !contextLost) render();
  }
  function onCapture() {
    if (!immersive || disposed || contextLost) return;
    render();
    canvas.toBlob(blob => {
      if (blob) document.dispatchEvent(new CustomEvent('world-capture-ready', { detail: { blob } }));
    }, 'image/png');
  }
  function onContextLost(event) {
    event.preventDefault();
    cancelSceneTap();
    contextLost = true;
    host.dataset.render = 'fallback';
    syncAnimation();
  }
  function onContextRestored() {
    contextLost = false;
    renderer.setClearColor(0x050505, 1);
    regenerateReflections();
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
  document.addEventListener('energy-burst', onBurst);
  document.addEventListener('world-view', onWorldView);
  document.addEventListener('world-orbit', onWorldOrbit);
  document.addEventListener('world-lab', onWorldLab);
  document.addEventListener('world-activity', onActivity);
  document.addEventListener('world-flight', onFlight);
  document.addEventListener('world-capture', onCapture);
  document.addEventListener('world-singularity', onSingularity);
  canvas.addEventListener('pointerdown', onSceneDown);
  canvas.addEventListener('pointermove', onSceneMove);
  canvas.addEventListener('pointerup', onSceneUp);
  canvas.addEventListener('pointercancel', cancelSceneTap);
  canvas.addEventListener('lostpointercapture', cancelSceneTap);
  canvas.addEventListener('pointerleave', leaveScene);
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
    document.removeEventListener('energy-burst', onBurst);
    document.removeEventListener('world-view', onWorldView);
    document.removeEventListener('world-orbit', onWorldOrbit);
    document.removeEventListener('world-lab', onWorldLab);
    document.removeEventListener('world-activity', onActivity);
    document.removeEventListener('world-flight', onFlight);
    document.removeEventListener('world-capture', onCapture);
    document.removeEventListener('world-singularity', onSingularity);
    canvas.removeEventListener('pointerdown', onSceneDown);
    canvas.removeEventListener('pointermove', onSceneMove);
    canvas.removeEventListener('pointerup', onSceneUp);
    canvas.removeEventListener('pointercancel', cancelSceneTap);
    canvas.removeEventListener('lostpointercapture', cancelSceneTap);
    canvas.removeEventListener('pointerleave', leaveScene);
    reducedMotion.removeEventListener('change', syncAnimation);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    window.removeEventListener('pagehide', dispose);
    window.removeEventListener('pageshow', syncAnimation);
    resources.forEach(resource => resource.dispose());
    world.dispose();
    singularity.dispose();
    fieldLab.dispose();
    cinematic.dispose();
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
