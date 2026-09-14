import { sampleCycle, CYCLE_DURATION, BURST_START } from './energy-cycle.js';
import { sampleSpacetime } from './world-spacetime.js';
import { createFieldCoordinates, createFieldColors } from './world-field-lab.js';
import { TESSERACT_VERTICES, TESSERACT_EDGES, createTesseractCoordinates, createTesseractFaces, createTesseractColors, projectTesseract, sampleFoldPulse } from './dimension-math.js';

// A real geometry renderer for small screens. Every shard has a permanent home:
// the same continuous displacement carries it out into space and back again.
const host = document.getElementById('energyScene');
const canvas = document.getElementById('energyCanvas');

if (host && canvas) initializeMobileEnergy(host, canvas);

function initializeMobileEnergy(host, canvas) {
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;
  const rings = [
    { radius: 1.09, tilt: [1.07, 0.13, -0.38], speed: 0.073, color: [220, 195, 145] },
    { radius: 0.94, tilt: [0.15, 1.12, 0.31], speed: -0.095, color: [167, 223, 207] },
    { radius: 0.79, tilt: [0.81, -0.57, 0.73], speed: 0.112, color: [231, 206, 156] },
  ];
  let seed = 73129;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const rgba = (color, alpha) => `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  const rotate = (point, rx, ry, rz) => {
    const sx = Math.sin(rx), cx = Math.cos(rx);
    const sy = Math.sin(ry), cy = Math.cos(ry);
    const sz = Math.sin(rz), cz = Math.cos(rz);
    const y = point.y * cx - point.z * sx;
    const z = point.y * sx + point.z * cx;
    const x = point.x * cy + z * sy;
    const zz = -point.x * sy + z * cy;
    return { x: x * cz - y * sz, y: x * sz + y * cz, z: zz };
  };
  const orbitPoint = (ring, angle, radius = ring.radius) => rotate(
    { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 }, ...ring.tilt,
  );

  const arcs = rings.flatMap((ring, ringIndex) => Array.from({ length: 24 }, (_, i) => {
    const angle = i / 24 * TAU;
    const center = orbitPoint(ring, angle + TAU / 48);
    return {
      ring, ringIndex, angle, center,
      kick: 0.6 + random() * 0.65,
      twist: [random() * 4 - 2, random() * 4 - 2, random() * 4 - 2],
      drift: { x: (random() - 0.5) * 0.35, y: (random() - 0.5) * 0.35, z: (random() - 0.5) * 0.9 },
    };
  }));

  // The nucleus is an actual tessellated sphere, rather than an image of one.
  const facets = [];
  const spherePoint = (lat, lon) => ({
    x: 0.255 * Math.sin(lat) * Math.cos(lon),
    y: 0.255 * Math.cos(lat),
    z: 0.255 * Math.sin(lat) * Math.sin(lon),
  });
  function addFacet(vertices) {
    const center = { x: 0, y: 0, z: 0 };
    for (const point of vertices) {
      center.x += point.x / 3;
      center.y += point.y / 3;
      center.z += point.z / 3;
    }
    facets.push({
      vertices, center, kick: 2.8 + random() * 2.7,
      twist: [random() * 5 - 2.5, random() * 5 - 2.5, random() * 5 - 2.5],
      light: 0.65 + random() * 0.3,
    });
  }
  for (let row = 0; row < 7; row++) {
    for (let column = 0; column < 12; column++) {
      const a = spherePoint(row / 7 * Math.PI, column / 12 * TAU);
      const b = spherePoint((row + 1) / 7 * Math.PI, column / 12 * TAU);
      const c = spherePoint((row + 1) / 7 * Math.PI, (column + 1) / 12 * TAU);
      const d = spherePoint(row / 7 * Math.PI, (column + 1) / 12 * TAU);
      if (row > 0) addFacet([a, b, d]);
      if (row < 6) addFacet([b, c, d]);
    }
  }

  const particles = Array.from({ length: 174 }, (_, i) => ({
    ring: rings[i % 3],
    angle: random() * TAU,
    radius: i < 108 ? 1 : 0.3 + random() * 0.84,
    speed: 0.05 + random() * 0.13,
    kick: 0.45 + random() * 1.1,
    lift: random() * 1.8 - 0.9,
    size: i % 23 === 0 ? 2.2 : 0.4 + random() * 0.9,
    seed: random() * TAU,
  }));

  function makeGlow(color) {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const painter = sprite.getContext('2d');
    const gradient = painter.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,249,229,.92)');
    gradient.addColorStop(0.11, rgba(color, 0.64));
    gradient.addColorStop(0.36, rgba(color, 0.12));
    gradient.addColorStop(1, rgba(color, 0));
    painter.fillStyle = gradient;
    painter.fillRect(0, 0, 64, 64);
    return sprite;
  }
  const warmGlow = makeGlow([247, 207, 132]);
  const coolGlow = makeGlow([149, 228, 212]);
  const furnaceGlow = makeGlow([255, 132, 49]);
  const smokeSprite = document.createElement('canvas');
  smokeSprite.width = smokeSprite.height = 64;
  const smokePainter = smokeSprite.getContext('2d');
  const smokeGradient = smokePainter.createRadialGradient(32, 32, 0, 32, 32, 32);
  smokeGradient.addColorStop(0, 'rgba(121,133,130,.35)');
  smokeGradient.addColorStop(0.45, 'rgba(72,94,96,.18)');
  smokeGradient.addColorStop(1, 'rgba(49,77,82,0)');
  smokePainter.fillStyle = smokeGradient;
  smokePainter.fillRect(0, 0, 64, 64);

  // All districts share a real perspective camera. Realm navigation changes
  // its point of interest, rather than swapping one flat illustration for another.
  const realmViews = {
    overview: { x: 0, y: 0.22, z: -0.4, scale: 0.125, retreat: 0.12 },
    energy: { x: 0, y: 0.12, z: 0, scale: 0.37, retreat: 1.35 },
    intelligence: { x: -2.85, y: 0.05, z: -0.55, scale: 0.385, retreat: 0 },
    industry: { x: 2.8, y: 0.38, z: -0.6, scale: 0.39, retreat: 0 },
  };
  const heroView = { x: 0, y: 0.13, z: 0, scale: 0.335, retreat: 1.6 };
  let worldActive = host.dataset.world === 'true';
  let realm = Object.hasOwn(realmViews, host.dataset.realm) ? host.dataset.realm : 'overview';
  let viewTarget = { ...(worldActive ? realmViews[realm] : heroView), world: worldActive ? 1 : 0 };
  const view = { ...viewTarget };
  const orbit = { x: 0, y: 0, zoom: 0 };
  const orbitTarget = { ...orbit };
  const finiteClamp = (value, min, max) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0;
  const activities = Object.fromEntries(['resonance', 'signal', 'forge'].map(kind => [
    kind, { active: false, strength: 0, target: 0, time: 0 },
  ]));
  const flight = { active: false, progress: 0, duration: 3.4 };
  const fraction = value => value - Math.floor(value);
  function advanceActivities(delta) {
    for (const activity of Object.values(activities)) {
      activity.strength += (activity.target - activity.strength) * 0.14;
      if (activity.active || activity.strength > 0.001) activity.time += delta;
    }
    if (flight.active) {
      flight.progress = Math.min(1, flight.progress + delta / flight.duration);
      if (flight.progress === 1) flight.active = false;
    }
  }
  function moveCamera(immediately = false) {
    const ease = immediately ? 1 : 0.12;
    for (const key of Object.keys(view)) view[key] += (viewTarget[key] - view[key]) * ease;
    for (const key of Object.keys(orbit)) orbit[key] += (orbitTarget[key] - orbit[key]) * ease;
  }

  const stars = Array.from({ length: 138 }, () => ({
    x: random() * 1.4 - 0.7, y: random() * 1.4 - 0.8,
    depth: 9 + random() * 23, size: 0.4 + random() * 1.2,
    phase: random() * TAU,
  }));
  const dust = Array.from({ length: 52 }, () => ({
    x: random() * 10 - 5, y: random() * 4.1 - 2.8, z: random() * 6 - 3.2,
    phase: random() * TAU, size: 0.3 + random() * 0.9,
  }));
  const plume = Array.from({ length: 28 }, (_, index) => ({
    chimney: index % 2, phase: random(), drift: random() * 2 - 1,
    size: 0.08 + random() * 0.12, speed: 0.12 + random() * 0.1,
  }));
  const skyline = Array.from({ length: 22 }, (_, index) => ({
    x: (index - 10.5) * 0.72, z: -5.5 - random() * 3,
    height: 0.4 + random() * 1.85, width: 0.15 + random() * 0.35,
    depth: 0.18 + random() * 0.4,
  }));
  const industryTowers = [
    { x: -0.56, z: -0.3, height: 1.23, width: 0.28, depth: 0.32 },
    { x: -0.09, z: -0.1, height: 2.02, width: 0.32, depth: 0.34 },
    { x: 0.45, z: 0.05, height: 0.95, width: 0.42, depth: 0.46 },
    { x: -0.25, z: 0.5, height: 0.59, width: 0.51, depth: 0.35 },
    { x: 0.61, z: -0.56, height: 1.43, width: 0.24, depth: 0.28 },
    { x: -0.61, z: 0.43, height: 0.71, width: 0.22, depth: 0.3 },
  ];
  const intelligenceNodes = Array.from({ length: 24 }, (_, index) => {
    const latitude = Math.acos(1 - 2 * (index + 0.5) / 24);
    const longitude = index * 2.399963;
    return {
      x: Math.sin(latitude) * Math.cos(longitude) * 0.86,
      y: Math.cos(latitude) * 0.91,
      z: Math.sin(latitude) * Math.sin(longitude) * 0.74,
    };
  });
  const intelligenceLinks = [];
  for (let a = 0; a < intelligenceNodes.length; a++) {
    for (let b = a + 1; b < intelligenceNodes.length; b++) {
      const p = intelligenceNodes[a], q = intelligenceNodes[b];
      if (Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < 0.91) intelligenceLinks.push([a, b]);
    }
  }

  let width = 1, height = 1, pixelRatio = 1;
  let elapsed = 0, frame = 0, previous = 0;
  let cycleOffset = 0, spinOffset = 0;
  let inView = true, disposed = false;
  let paused = document.body.classList.contains('motion-paused');
  let lastPhase = '';
  let spacetime = sampleSpacetime(0, false);
  const canAnimate = () => !disposed && !paused && !document.hidden && (inView || worldActive);

  // The lightweight lab uses the same physical parameterization as WebGL.
  // Blending shape weights keeps an interrupted morph continuous without
  // copying hundreds of coordinates or allocating buffers on every frame.
  const fieldCount = 720;
  const fieldCoordinates = createFieldCoordinates(fieldCount);
  const fieldColors = createFieldColors(fieldCoordinates);
  const tesseractCoordinates = createTesseractCoordinates(fieldCount);
  const tesseractPoints = new Float32Array(fieldCount * 3);
  fieldColors.tesseract = createTesseractColors(tesseractCoordinates);
  const tesseractVertices = new Float32Array(16 * 3);
  const tesseractScreen = new Float32Array(16 * 4);
  const tesseractFaces = createTesseractFaces();
  const tesseractFacePoints = new Float32Array(144 * 3);
  const tesseractFaceScreen = new Float32Array(144 * 3);
  const tesseractFaceColors = createTesseractColors(tesseractFaces.coordinates);
  const tesseractFaceOrder = Array.from({ length: 48 }, (_, index) => index);
  const tesseractFaceDepth = (a, b) => tesseractFaceScreen[a * 9 + 2] - tesseractFaceScreen[b * 9 + 2];
  // Canvas consumes sRGB values; WebGL keeps the same palette in linear RGB.
  for (const values of [...Object.values(fieldColors), tesseractFaceColors]) {
    for (let index = 0; index < values.length; index++) {
      const linear = values[index];
      values[index] = Math.round(255 * (linear <= .0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - .055));
    }
  }
  const fieldColor = new Float32Array(3);
  const fieldGlow = [coolGlow, warmGlow, makeGlow([178, 119, 247]), coolGlow];
  const fieldForms = ['sphere', 'knot', 'helix', 'tesseract'];
  let fieldActive = worldActive && host.dataset.lab === 'true';
  let fieldTarget = Math.max(0, fieldForms.indexOf(host.dataset.labForm));
  let fieldStarted = 0, fieldMorphing = false;
  let fieldFold = finiteClamp(Number(host.dataset.labFold ?? .18), 0, 1);
  let fieldPulseStarted = -Infinity;
  const fieldWeights = new Float64Array(fieldForms.map((_, index) => index === fieldTarget ? 1 : 0));
  const fieldFrom = new Float64Array(fieldWeights);
  const fieldProjection = new Float32Array(fieldCount * 4);
  const fieldOrder = Array.from({ length: fieldCount }, (_, index) => index);
  const fieldDepth = (a, b) => fieldProjection[a * 4 + 2] - fieldProjection[b * 4 + 2];

  function sampleField() {
    if (!fieldMorphing) return;
    const progress = finiteClamp((elapsed - fieldStarted) / 1.4, 0, 1);
    const eased = progress ** 3 * (10 + progress * (-15 + progress * 6));
    for (let index = 0; index < 4; index++) {
      fieldWeights[index] = fieldFrom[index] + ((index === fieldTarget ? 1 : 0) - fieldFrom[index]) * eased;
    }
    if (progress === 1) fieldMorphing = false;
  }

  function renderField() {
    sampleField();
    const foldPulse = sampleFoldPulse(elapsed - fieldPulseStarted);
    const portrait = width < height;
    const centerX = width * .5, centerY = height * (portrait ? .38 : .47);
    const unit = Math.min(width, height) * .164 * (1 + orbit.zoom * .3);
    context.fillStyle = '#060b10';
    context.fillRect(0, 0, width, height);
    const auraSize = Math.min(width, height) * .78;
    for (let form = 0; form < 4; form++) {
      context.globalAlpha = (.09 + Math.abs(foldPulse) * .04) * fieldWeights[form];
      if (fieldWeights[form] > .001) context.drawImage(fieldGlow[form], centerX - auraSize, centerY - auraSize, auraSize * 2, auraSize * 2);
    }
    context.globalAlpha = 1;

    // Sparse stationary reference marks make orbital depth easy to read.
    context.strokeStyle = 'rgba(133,184,192,.07)';
    context.lineWidth = .6;
    context.beginPath();
    const gridY = centerY + unit * 2.9;
    for (let index = -5; index <= 5; index++) {
      context.moveTo(centerX + index * unit * .55, gridY - unit * .25);
      context.lineTo(centerX + index * unit * 1.5, gridY + unit * .9);
    }
    for (const offset of [0, .2, .48, .85]) {
      context.moveTo(centerX - unit * 5, gridY + unit * offset);
      context.lineTo(centerX + unit * 5, gridY + unit * offset);
    }
    context.stroke();
    for (let index = 0; index < stars.length; index += 3) {
      const star = stars[index];
      const x = width * (.5 + star.x) + orbit.x * 7 / star.depth;
      const y = height * (.5 + star.y) + orbit.y * 7 / star.depth;
      context.fillStyle = rgba([187, 213, 231], .13 + .08 * Math.sin(elapsed * .12 + star.phase));
      context.fillRect(x, y, .75, .75);
    }

    const rx = -.13 + orbit.y * .8 + Math.sin(elapsed * .11) * .07;
    const ry = elapsed * .085 + orbit.x * 1.8;
    const rz = .1;
    const sx = Math.sin(rx), cx = Math.cos(rx), sy = Math.sin(ry), cy = Math.cos(ry), sz = Math.sin(rz), cz = Math.cos(rz);
    const sphere = fieldCoordinates.sphere, knot = fieldCoordinates.knot, helix = fieldCoordinates.helix;
    if (fieldWeights[3] > 0) projectTesseract(tesseractCoordinates, tesseractPoints, elapsed, fieldFold, foldPulse);
    for (let index = 0; index < fieldCount; index++) {
      const source = index * 3, at = index * 4;
      const x = sphere[source] * fieldWeights[0] + knot[source] * fieldWeights[1] + helix[source] * fieldWeights[2] + tesseractPoints[source] * fieldWeights[3];
      const y = sphere[source + 1] * fieldWeights[0] + knot[source + 1] * fieldWeights[1] + helix[source + 1] * fieldWeights[2] + tesseractPoints[source + 1] * fieldWeights[3];
      const z = sphere[source + 2] * fieldWeights[0] + knot[source + 2] * fieldWeights[1] + helix[source + 2] * fieldWeights[2] + tesseractPoints[source + 2] * fieldWeights[3];
      const ay = y * cx - z * sx, az = y * sx + z * cx;
      const bx = x * cy + az * sy, bz = -x * sy + az * cy;
      const perspective = 7 / Math.max(2.5, 7 - bz);
      fieldProjection[at] = centerX + (bx * cz - ay * sz) * unit * perspective;
      fieldProjection[at + 1] = centerY - (bx * sz + ay * cz) * unit * perspective;
      fieldProjection[at + 2] = bz;
      fieldProjection[at + 3] = perspective;
    }
    if (fieldWeights[3] > .001) {
      projectTesseract(TESSERACT_VERTICES, tesseractVertices, elapsed, fieldFold, foldPulse);
      projectTesseract(tesseractFaces.coordinates, tesseractFacePoints, elapsed, fieldFold, foldPulse);
      for (let index = 0; index < 160; index++) {
        const isFace = index >= 16;
        const local = isFace ? index - 16 : index;
        const points = isFace ? tesseractFacePoints : tesseractVertices;
        const target = isFace ? tesseractFaceScreen : tesseractScreen;
        const source = local * 3, at = local * (isFace ? 3 : 4);
        const x = points[source], y = points[source + 1], z = points[source + 2];
        const ay = y * cx - z * sx, az = y * sx + z * cx;
        const bx = x * cy + az * sy, bz = -x * sy + az * cy;
        const perspective = 7 / Math.max(2.5, 7 - bz);
        target[at] = centerX + (bx * cz - ay * sz) * unit * perspective;
        target[at + 1] = centerY - (bx * sz + ay * cz) * unit * perspective;
        target[at + 2] = bz;
        if (!isFace) target[at + 3] = perspective;
      }
      tesseractFaceOrder.sort(tesseractFaceDepth);
      for (let order = 0; order < 48; order++) {
        const face = tesseractFaceOrder[order], at = face * 9;
        for (let channel = 0; channel < 3; channel++) fieldColor[channel] = tesseractFaceColors[at + channel];
        context.fillStyle = rgba(fieldColor, fieldWeights[3] ** 2 * (.018 + Math.abs(foldPulse) * .018));
        context.beginPath();
        context.moveTo(tesseractFaceScreen[at], tesseractFaceScreen[at + 1]);
        context.lineTo(tesseractFaceScreen[at + 3], tesseractFaceScreen[at + 4]);
        context.lineTo(tesseractFaceScreen[at + 6], tesseractFaceScreen[at + 7]);
        context.closePath(); context.fill();
      }
      for (let edge = 0; edge < 32; edge++) {
        const a = TESSERACT_EDGES[edge * 2], b = TESSERACT_EDGES[edge * 2 + 1];
        const bridge = (a ^ b) === 8;
        const tint = bridge ? '255,196,100' : a & 8 ? '177,120,255' : '110,226,247';
        const alpha = fieldWeights[3] * (.32 + Math.abs(foldPulse) * .16);
        context.strokeStyle = `rgba(${tint},${alpha})`;
        context.lineWidth = .75 + fieldWeights[3] * .25;
        context.beginPath();
        context.moveTo(tesseractScreen[a * 4], tesseractScreen[a * 4 + 1]);
        context.lineTo(tesseractScreen[b * 4], tesseractScreen[b * 4 + 1]);
        context.stroke();
        const travel = fraction(elapsed * .13 + edge * .137);
        const x = tesseractScreen[a * 4] * (1 - travel) + tesseractScreen[b * 4] * travel;
        const y = tesseractScreen[a * 4 + 1] * (1 - travel) + tesseractScreen[b * 4 + 1] * travel;
        context.globalAlpha = fieldWeights[3] * (.5 + Math.abs(foldPulse) * .25);
        const glow = bridge ? warmGlow : a & 8 ? fieldGlow[2] : coolGlow;
        context.drawImage(glow, x - 4, y - 4, 8, 8);
      }
      context.globalAlpha = 1;
    }
    const middle = Math.floor(fieldCount / 2) * 3;
    for (let channel = 0; channel < 3; channel++) {
      fieldColor[channel] = fieldColors.sphere[middle + channel] * fieldWeights[0] + fieldColors.knot[middle + channel] * fieldWeights[1] + fieldColors.helix[middle + channel] * fieldWeights[2] + fieldColors.tesseract[middle + channel] * fieldWeights[3];
    }
    context.strokeStyle = rgba(fieldColor, .13 * (1 - fieldWeights[3]));
    context.lineWidth = .55;
    context.beginPath();
    const lineEnd = fieldWeights[2] > .01 ? Math.floor(fieldCount * .82) : fieldCount;
    for (let lane = 0; lane < 12; lane++) {
      for (let index = lane; index < lineEnd; index += 12) {
        const at = index * 4;
        if (index === lane) context.moveTo(fieldProjection[at], fieldProjection[at + 1]);
        else context.lineTo(fieldProjection[at], fieldProjection[at + 1]);
      }
    }
    context.stroke();
    fieldOrder.sort(fieldDepth);
    for (let order = 0; order < fieldCount; order++) {
      const index = fieldOrder[order], at = index * 4;
      const depth = finiteClamp((fieldProjection[at + 2] + 2.6) / 5.2, 0, 1);
      const pulse = Math.max(0, Math.sin(index * 2.17 + elapsed * .47)) ** 18;
      const radius = (.48 + (index % 7) * .055) * fieldProjection[at + 3];
      const colorOffset = index * 3;
      for (let channel = 0; channel < 3; channel++) {
        fieldColor[channel] = fieldColors.sphere[colorOffset + channel] * fieldWeights[0] + fieldColors.knot[colorOffset + channel] * fieldWeights[1] + fieldColors.helix[colorOffset + channel] * fieldWeights[2] + fieldColors.tesseract[colorOffset + channel] * fieldWeights[3];
      }
      context.fillStyle = rgba(fieldColor, .3 + depth * .55 + pulse * .13);
      context.beginPath();
      context.arc(fieldProjection[at], fieldProjection[at + 1], radius, 0, TAU);
      context.fill();
      if (index % 31 === 0) {
        const size = (3.5 + pulse * 5) * fieldProjection[at + 3];
        for (let form = 0; form < 4; form++) {
          context.globalAlpha = (.18 + pulse * .32) * fieldWeights[form];
          if (fieldWeights[form] > .001) context.drawImage(fieldGlow[form], fieldProjection[at] - size, fieldProjection[at + 1] - size, size * 2, size * 2);
        }
      }
      context.globalAlpha = 1;
    }
  }

  function render() {
    const cycle = sampleCycle(elapsed + cycleOffset);
    cycle.spin += spinOffset;
    const { scatter, charge, shock } = cycle;
    const resonance = activities.resonance.strength;
    const signalStrength = activities.signal.strength;
    const forge = activities.forge.strength;
    const heat = Math.min(1, cycle.heat + resonance * 0.65);
    const arrival = flight.active ? Math.sin(flight.progress * Math.PI) : 0;
    if (lastPhase !== cycle.phase) {
      lastPhase = cycle.phase;
      host.dataset.phase = cycle.phase;
      document.dispatchEvent(new CustomEvent('energy-phase', {
        detail: { phase: cycle.phase, bursting: cycle.bursting },
      }));
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (worldActive && fieldActive) { renderField(); return; }
    const unit = Math.min(width, height) * view.scale * (1 + orbit.zoom * 0.35) / (1 + scatter * view.retreat) * (1 - spacetime.collapse * .83 + spacetime.bloom * .05);
    const screenCenterX = width * (0.5 + (width > 760 ? 0.13 * (1 - view.world) : 0));
    const screenCenterY = height * (0.44 + view.world * 0.015);
    const globalY = Math.sin(elapsed * 0.065) * 0.065 + orbit.x * 0.58;
    const globalZ = Math.sin(elapsed * 0.055) * 0.013;
    const globalX = 0.12 + Math.sin(elapsed * 0.045) * 0.025 + orbit.y * 0.19;
    const project = point => {
      const rotated = rotate({ x: point.x - view.x, y: point.y - view.y, z: point.z - view.z }, globalX, globalY, globalZ);
      const perspective = 6 / Math.max(0.9, 6 - rotated.z);
      return {
        x: screenCenterX + rotated.x * unit * perspective,
        y: screenCenterY + rotated.y * unit * perspective,
        z: rotated.z,
        scale: perspective,
      };
    };
    const origin = project({ x: 0, y: 0, z: 0 });
    const centerX = origin.x;
    const centerY = origin.y;
    const path = (points, close = false) => {
      context.beginPath();
      for (let i = 0; i < points.length; i++) {
        if (i === 0) context.moveTo(points[i].x, points[i].y);
        else context.lineTo(points[i].x, points[i].y);
      }
      if (close) context.closePath();
    };
    const paintQueue = [];

    const teal = [117, 210, 202];
    const bronze = [226, 177, 111];
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, 'rgba(4,10,15,.96)');
    sky.addColorStop(0.52, 'rgba(5,19,21,.85)');
    sky.addColorStop(1, 'rgba(5,12,13,.97)');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);
    const atmosphere = Math.max(width, height) * 0.85;
    context.globalAlpha = 0.17 + arrival * 0.1;
    context.drawImage(coolGlow, width * 0.36 - atmosphere, height * 0.28 - atmosphere, atmosphere * 2, atmosphere * 2);
    context.globalAlpha = 1;

    // Stars live at different camera depths, so orbiting produces real parallax.
    const starUnit = Math.min(width, height) * 0.23;
    for (const star of stars) {
      const distance = 1 + star.depth / 6;
      const point = project({
        x: star.x * width / starUnit * distance,
        y: star.y * height / starUnit * distance,
        z: -star.depth,
      });
      if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) continue;
      const alpha = 0.22 + (Math.sin(elapsed * 0.19 + star.phase) + 1) * 0.14;
      if (arrival > 0.01) {
        const dx = point.x - screenCenterX, dy = point.y - screenCenterY;
        const stretch = arrival * (0.045 + 0.18 / distance);
        context.beginPath();
        context.moveTo(point.x - dx * stretch, point.y - dy * stretch);
        context.lineTo(point.x, point.y);
        context.strokeStyle = rgba(teal, alpha * arrival * 0.72);
        context.lineWidth = star.size * 0.6;
        context.stroke();
      }
      context.fillStyle = rgba(star.phase > Math.PI ? teal : [242, 229, 200], alpha);
      context.fillRect(point.x, point.y, star.size, star.size);
      if (star.size > 1.5) {
        context.globalAlpha = 0.22;
        context.drawImage(coolGlow, point.x - 5, point.y - 5, 10, 10);
        context.globalAlpha = 1;
      }
    }

    function worldLine(vertices, color, alpha, lineWidth = 0.7, depthSorted = false, depthOverride) {
      const points = vertices.map(project);
      const draw = () => {
        path(points);
        context.strokeStyle = rgba(color, alpha);
        context.lineWidth = lineWidth;
        context.stroke();
      };
      if (depthSorted) paintQueue.push({ z: depthOverride ?? points.reduce((sum, p) => sum + p.z, 0) / points.length, paint: draw });
      else draw();
    }
    function worldFace(vertices, fill, edge, alpha, edgeAlpha = 0.3) {
      const points = vertices.map(project);
      if (points.every(p => p.x < -40) || points.every(p => p.x > width + 40)
          || points.every(p => p.y < -40) || points.every(p => p.y > height + 40)) return;
      paintQueue.push({
        z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
        paint() {
          path(points, true);
          context.fillStyle = rgba(fill, alpha);
          context.fill();
          context.strokeStyle = rgba(edge, edgeAlpha);
          context.lineWidth = 0.7;
          context.stroke();
        },
      });
    }
    function floorRing(x, z, radius, elevation, color, opacity, filled = false) {
      const points = Array.from({ length: 65 }, (_, i) => {
        const angle = i / 64 * TAU;
        return project({ x: x + Math.cos(angle) * radius, y: elevation, z: z + Math.sin(angle) * radius });
      });
      path(points, true);
      if (filled) {
        context.fillStyle = 'rgba(9,24,27,.88)';
        context.fill();
      }
      context.strokeStyle = rgba(color, opacity);
      context.lineWidth = filled ? 1.2 : 0.7;
      context.stroke();
    }
    function tower(x, z, building, color, distant = false) {
      const halfWidth = building.width / 2, halfDepth = building.depth / 2;
      const bottom = 1.5, top = bottom - building.height;
      const points = [
        { x: x - halfWidth, y: bottom, z: z - halfDepth },
        { x: x + halfWidth, y: bottom, z: z - halfDepth },
        { x: x + halfWidth, y: bottom, z: z + halfDepth },
        { x: x - halfWidth, y: bottom, z: z + halfDepth },
        { x: x - halfWidth, y: top, z: z - halfDepth },
        { x: x + halfWidth, y: top, z: z - halfDepth },
        { x: x + halfWidth, y: top, z: z + halfDepth },
        { x: x - halfWidth, y: top, z: z + halfDepth },
      ];
      const faceColors = distant ? [[9, 18, 22], [8, 19, 22], [11, 24, 27]]
        : color === bronze ? [[31, 31, 28], [21, 24, 24], [43, 40, 31]]
          : [[18, 38, 40], [12, 26, 32], [24, 51, 51]];
      const faces = [
        { indices: [0, 1, 5, 4], tone: 1 }, { indices: [1, 2, 6, 5], tone: 1 },
        { indices: [0, 3, 7, 4], tone: 1 }, { indices: [3, 2, 6, 7], tone: 0 },
        { indices: [4, 5, 6, 7], tone: 2 },
      ];
      faces.forEach(face => {
        worldFace(face.indices.map(i => points[i]), faceColors[face.tone], color, distant ? 0.83 : 0.98, distant ? 0.11 : 0.48);
      });
      if (!distant) {
        const frontDepth = [3, 2, 6, 7].reduce((sum, index) => sum + project(points[index]).z, 0) / 4;
        for (let level = 0.25; level < building.height; level += 0.29) {
          const y = bottom - level;
          worldLine([
            { x: x - halfWidth * 0.72, y, z: z + halfDepth + 0.003 },
            { x: x + halfWidth * 0.72, y, z: z + halfDepth + 0.003 },
          ], color, 0.45 + (color === bronze ? forge * 0.28 : signalStrength * 0.15)
            + Math.sin(elapsed * 0.3 + level * 6 + x) * 0.11, 0.85, true, frontDepth + 0.002);
        }
      }
    }

    // A floor with vanishing lines establishes scale all the way to the horizon.
    const floor = [
      { x: -20, y: 1.57, z: -20 }, { x: 20, y: 1.57, z: -20 },
      { x: 12, y: 1.57, z: 4 }, { x: -12, y: 1.57, z: 4 },
    ].map(project);
    path(floor, true);
    context.fillStyle = 'rgba(4,17,19,.72)';
    context.fill();
    for (let x = -9; x <= 9; x++) {
      worldLine([{ x, y: 1.55, z: -12 }, { x, y: 1.55, z: 3.7 }], teal, 0.1, 0.65);
    }
    for (let z = -11; z <= 3; z++) {
      worldLine([{ x: -10, y: 1.55, z }, { x: 10, y: 1.55, z }], teal, 0.04 + (z + 11) / 14 * 0.09, 0.65);
    }
    for (const building of skyline) tower(building.x, building.z, building, teal, true);

    // A segmented, architectural portal sits behind the observatory district.
    const portalCenter = { x: 0, y: -0.45, z: -2.65 };
    const portalPoint = (angle, radius) => ({
      x: portalCenter.x + Math.cos(angle) * radius,
      y: portalCenter.y + Math.sin(angle) * radius,
      z: portalCenter.z,
    });
    for (let segment = 0; segment < 48; segment++) {
      const start = segment / 48 * TAU;
      const end = start + TAU / 48 * 0.95;
      if (Math.sin(start) > 0.84) continue;
      const color = segment % 6 === 0 ? bronze : teal;
      worldFace([
        portalPoint(start, 2.44), portalPoint(end, 2.44),
        portalPoint(end, 2.29), portalPoint(start, 2.29),
      ], [18, 39, 40], color, 0.83, 0.24 + heat * 0.1);
      worldLine([portalPoint(start, 2.47), portalPoint(start, segment % 4 === 0 ? 2.62 : 2.53)], color, 0.28, 0.7, true);
    }
    worldLine([
      { x: -2.06, y: 1.5, z: -2.66 }, { x: -2.06, y: 0.82, z: -2.66 },
      { x: -1.94, y: 0.72, z: -2.66 },
    ], teal, 0.25, 1, true);
    worldLine([
      { x: 2.06, y: 1.5, z: -2.66 }, { x: 2.06, y: 0.82, z: -2.66 },
      { x: 1.94, y: 0.72, z: -2.66 },
    ], teal, 0.25, 1, true);

    floorRing(0, 0, 1.61, 1.51, bronze, 0.27, true);
    floorRing(0, 0, 1.46, 1.47, teal, 0.52);
    floorRing(0, 0, 1.3, 1.44, bronze, 0.47, true);
    floorRing(0, 0, 0.9, 1.43, bronze, 0.15 + charge * 0.15);
    for (let index = 0; index < 24; index++) {
      const angle = index / 24 * TAU;
      worldLine([
        { x: Math.cos(angle) * 1.33, y: 1.44, z: Math.sin(angle) * 1.33 },
        { x: Math.cos(angle) * 1.43, y: 1.44, z: Math.sin(angle) * 1.43 },
      ], bronze, index % 3 === 0 ? 0.65 : 0.23, 0.7);
    }

    // Resonance travels through the dais and forms standing waves in the air.
    if (resonance > 0.002) {
      for (let wave = 0; wave < 4; wave++) {
        const progress = fraction(activities.resonance.time * 0.21 + wave / 4);
        floorRing(0, 0, 0.28 + progress * 2.65, 1.41 - wave * 0.003,
          wave % 2 ? teal : bronze, resonance * Math.sin(progress * Math.PI) * 0.48);
      }
      for (let wave = 0; wave < 3; wave++) {
        const points = Array.from({ length: 49 }, (_, index) => {
          const angle = index / 48 * TAU;
          const radius = 0.68 + wave * 0.2 + Math.sin(angle * 6 - activities.resonance.time * 2.1) * 0.055 * resonance;
          return rotate({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 },
            wave * 0.73, wave * 0.62, activities.resonance.time * 0.06);
        });
        worldLine(points, wave === 1 ? teal : bronze, resonance * 0.38, 0.9, true);
      }
    }

    // Lit conduits join the three districts, with signals moving over the floor.
    for (const direction of [-1, 1]) {
      const color = direction < 0 ? teal : bronze;
      const vertices = [
        { x: direction * 1.45, y: 1.44, z: 0.3 },
        { x: direction * 1.9, y: 1.44, z: 0.3 },
        { x: direction * 2.3, y: 1.44, z: -0.15 },
        { x: direction * 2.85, y: 1.44, z: -0.15 },
      ];
      worldLine(vertices, color, 0.48, 1.1);
      const progress = (elapsed * 0.22 + (direction > 0 ? 0.5 : 0)) % 1;
      const part = Math.min(2, Math.floor(progress * 3));
      const a = vertices[part], b = vertices[part + 1], mix = progress * 3 - part;
      const signal = project({ x: a.x + (b.x - a.x) * mix, y: 1.44, z: a.z + (b.z - a.z) * mix });
      context.globalAlpha = 0.5;
      context.drawImage(direction < 0 ? coolGlow : warmGlow, signal.x - 7, signal.y - 7, 14, 14);
      context.globalAlpha = 1;
    }

    floorRing(-2.85, -0.55, 1.02, 1.49, teal, 0.35, true);
    floorRing(-2.85, -0.55, 0.88, 1.45, teal, 0.52);
    for (const x of [-0.59, 0.59]) {
      for (const z of [-0.38, 0.38]) {
        tower(-2.85 + x, -0.55 + z, { width: 0.13, depth: 0.17, height: 0.53 }, teal);
      }
    }
    const nodePositions = intelligenceNodes.map(node => {
      const turned = rotate(node, 0, elapsed * 0.115, 0);
      const spread = 1 + signalStrength * 0.09;
      return { x: -2.85 + turned.x * spread, y: turned.y * spread + 0.15, z: -0.55 + turned.z * spread };
    });
    intelligenceLinks.forEach(([a, b], index) => {
      const intensity = 0.18 + signalStrength * 0.15 + (Math.sin(elapsed * 0.7 - index * 0.3) + 1) * 0.075;
      worldLine([nodePositions[a], nodePositions[b]], teal, intensity, 0.7, true);
      if (signalStrength > 0.002 && index % 3 === 0) {
        const start = nodePositions[a], end = nodePositions[b];
        const progress = fraction(activities.signal.time * 0.56 + index * 0.618);
        const along = t => ({
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
          z: start.z + (end.z - start.z) * t,
        });
        const head = project(along(progress));
        worldLine([along(Math.max(0, progress - 0.17)), along(progress)], [177, 255, 243], signalStrength * 0.86, 1.25, true);
        paintQueue.push({ z: head.z + 0.001, paint() {
          const size = Math.max(5, unit * 0.09 * head.scale);
          context.globalAlpha = signalStrength * 0.88;
          context.drawImage(coolGlow, head.x - size, head.y - size, size * 2, size * 2);
          context.fillStyle = '#d7fff7';
          context.fillRect(head.x - 1, head.y - 1, 2, 2);
          context.globalAlpha = 1;
        } });
      }
    });
    for (let index = 0; index < nodePositions.length; index++) {
      const point = project(nodePositions[index]);
      const size = Math.max(1.2, unit * 0.019 * point.scale) * (1 + signalStrength * 0.24);
      paintQueue.push({
        z: point.z,
        paint() {
          const glow = size * 5;
          context.globalAlpha = 0.65 + signalStrength * 0.25;
          context.drawImage(coolGlow, point.x - glow, point.y - glow, glow * 2, glow * 2);
          context.globalAlpha = 1;
          context.fillStyle = '#bff9ed';
          context.fillRect(point.x - size / 2, point.y - size / 2, size, size);
        },
      });
    }
    const crystal = [
      { x: 0, y: -0.42, z: 0 }, { x: 0, y: 0.42, z: 0 },
      { x: -0.25, y: 0, z: 0 }, { x: 0, y: 0, z: -0.25 },
      { x: 0.25, y: 0, z: 0 }, { x: 0, y: 0, z: 0.25 },
    ].map(point => {
      const rotated = rotate(point, 0, elapsed * 0.22, 0.12);
      return { x: rotated.x - 2.85, y: rotated.y + 0.15, z: rotated.z - 0.55 };
    });
    for (let index = 2; index < 6; index++) {
      const next = index === 5 ? 2 : index + 1;
      worldFace([crystal[0], crystal[index], crystal[next]], [53, 108 + signalStrength * 47, 109 + signalStrength * 41], teal, 0.68, 0.72);
      worldFace([crystal[1], crystal[next], crystal[index]], [16, 44, 51], teal, 0.9, 0.5);
    }

    floorRing(2.8, -0.6, 1.05, 1.49, bronze, 0.32, true);
    floorRing(2.8, -0.6, 0.94, 1.45, bronze, 0.59);
    for (const building of industryTowers) {
      const x = 2.8 + building.x, z = -0.6 + building.z;
      tower(x, z, building, bronze);
      const top = 1.5 - building.height;
      worldLine([{ x, y: top, z }, { x, y: top - 0.2, z }], bronze, 0.76, 1, true);
      const beacon = project({ x, y: top - 0.2, z });
      paintQueue.push({
        z: beacon.z,
        paint() {
          context.globalAlpha = 0.44 + Math.sin(elapsed * 0.6 + x) * 0.09;
          const size = Math.max(8, unit * 0.15 * beacon.scale);
          context.drawImage(warmGlow, beacon.x - size / 2, beacon.y - size / 2, size, size);
          context.globalAlpha = 1;
        },
      });
    }
    worldLine([
      { x: 2.25, y: 0.85, z: -0.9 }, { x: 2.25, y: 0.25, z: -0.9 },
      { x: 3.36, y: 0.25, z: -0.9 }, { x: 3.36, y: 0.8, z: -0.9 },
    ], bronze, 0.57, 1.2, true);

    // The foundry has a physical furnace, a working belt and buoyant exhaust.
    const ember = [255, 153, 67];
    worldFace([
      { x: 2.1, y: 1.26, z: 0.32 }, { x: 3.65, y: 1.26, z: 0.32 },
      { x: 3.65, y: 1.26, z: 0.57 }, { x: 2.1, y: 1.26, z: 0.57 },
    ], [19, 28, 28], bronze, 1, 0.65);
    worldFace([
      { x: 2.1, y: 1.26, z: 0.57 }, { x: 3.65, y: 1.26, z: 0.57 },
      { x: 3.65, y: 1.37, z: 0.57 }, { x: 2.1, y: 1.37, z: 0.57 },
    ], [26, 31, 28], bronze, 1, 0.45);
    for (let roller = 0; roller < 12; roller++) {
      const x = 2.14 + roller * 0.13;
      worldLine([{ x, y: 1.255, z: 0.34 }, { x, y: 1.255, z: 0.55 }], bronze, 0.33, 0.7, true);
    }
    for (const x of [2.18, 2.86, 3.57]) {
      worldLine([{ x, y: 1.35, z: 0.53 }, { x, y: 1.51, z: 0.53 }], bronze, 0.65, 1.5, true);
    }
    for (let ingot = 0; ingot < 5; ingot++) {
      const progress = fraction(ingot / 5 + activities.forge.time * 0.15);
      const x = 2.17 + progress * 1.35;
      const hot = forge * (1 - progress * 0.65);
      const color = [61 + hot * 181, 55 + hot * 87, 36 + hot * 17];
      worldFace([
        { x, y: 1.18, z: 0.39 }, { x: x + 0.12, y: 1.18, z: 0.39 },
        { x: x + 0.12, y: 1.18, z: 0.51 }, { x, y: 1.18, z: 0.51 },
      ], color, bronze, 1, 0.7);
      worldFace([
        { x, y: 1.18, z: 0.51 }, { x: x + 0.12, y: 1.18, z: 0.51 },
        { x: x + 0.12, y: 1.25, z: 0.51 }, { x, y: 1.25, z: 0.51 },
      ], color, bronze, 1, 0.4);
    }
    const furnace = [
      { x: 2.24, y: 1.25, z: 0.295 }, { x: 2.24, y: 0.84, z: 0.295 },
      { x: 2.33, y: 0.74, z: 0.295 }, { x: 2.67, y: 0.74, z: 0.295 },
      { x: 2.76, y: 0.84, z: 0.295 }, { x: 2.76, y: 1.25, z: 0.295 },
    ];
    worldFace(furnace, [31, 31, 26], bronze, 1, 0.75);
    const mouth = [
      { x: 2.32, y: 1.22, z: 0.3 }, { x: 2.32, y: 0.92, z: 0.3 },
      { x: 2.39, y: 0.85, z: 0.3 }, { x: 2.61, y: 0.85, z: 0.3 },
      { x: 2.68, y: 0.92, z: 0.3 }, { x: 2.68, y: 1.22, z: 0.3 },
    ];
    const furnaceDepth = furnace.map(project).reduce((sum, point) => sum + point.z, 0) / furnace.length;
    // The inset follows its facade's paint depth, even when looking down at it.
    paintQueue.push({ z: furnaceDepth + 0.002, paint() {
      path(mouth.map(project), true);
      context.fillStyle = rgba([24 + forge * 192, 20 + forge * 82, 14 + forge * 19], 1);
      context.fill();
      context.strokeStyle = rgba(ember, 0.28 + forge * 0.65);
      context.lineWidth = 0.8;
      context.stroke();
      if (forge > 0.002) {
        const point = project({ x: 2.5, y: 1.065, z: 0.31 });
        const size = unit * point.scale * 0.4;
        context.globalAlpha = forge * 0.68;
        context.drawImage(furnaceGlow, point.x - size, point.y - size, size * 2, size * 2);
        context.globalAlpha = 1;
      }
    } });
    if (forge > 0.002) {
      for (const particle of plume) {
        const chimney = industryTowers[particle.chimney ? 4 : 1];
        const age = fraction(activities.forge.time * particle.speed + particle.phase);
        const rise = age * (1.05 + forge * 0.5);
        const point = project({
          x: 2.8 + chimney.x + particle.drift * rise * 0.26 + Math.sin(age * 5 + particle.phase * TAU) * rise * 0.08,
          y: 1.5 - chimney.height - 0.12 - rise,
          z: -0.6 + chimney.z + age * 0.15,
        });
        const opacity = forge * Math.sin(age * Math.PI);
        const size = Math.max(4, unit * point.scale * particle.size * (0.5 + age * 2.4));
        paintQueue.push({ z: point.z, paint() {
          context.globalAlpha = opacity * 0.88;
          context.drawImage(smokeSprite, point.x - size, point.y - size, size * 2, size * 2);
          if (particle.phase > 0.6) {
            const glow = size * (0.12 + (1 - age) * 0.13);
            context.globalAlpha = opacity * (1 - age) * 0.85;
            context.drawImage(furnaceGlow, point.x - glow, point.y - glow, glow * 2, glow * 2);
          }
          context.globalAlpha = 1;
        } });
      }
    }

    // Foreground motes provide depth without adding another full-screen layer.
    for (const particle of dust) {
      const point = project({
        x: particle.x + Math.sin(elapsed * 0.08 + particle.phase) * 0.16,
        y: particle.y + Math.sin(elapsed * 0.06 + particle.phase * 2) * 0.11,
        z: particle.z,
      });
      if (point.x < -15 || point.x > width + 15 || point.y < -15 || point.y > height + 15) continue;
      paintQueue.push({ z: point.z, paint() {
        const opacity = 0.045 + (Math.sin(elapsed * 0.24 + particle.phase) + 1) * 0.028 + arrival * 0.12;
        const size = Math.min(2.5, particle.size * point.scale);
        context.globalAlpha = opacity;
        if (particle.size > 1) {
          const glow = size * 5;
          context.drawImage(particle.phase > Math.PI ? warmGlow : coolGlow,
            point.x - glow, point.y - glow, glow * 2, glow * 2);
        }
        context.fillStyle = '#d1e4d8';
        context.fillRect(point.x, point.y, size, size);
        if (arrival > 0.01) {
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(point.x - (point.x - screenCenterX) * arrival * 0.08,
            point.y - (point.y - screenCenterY) * arrival * 0.08);
          context.strokeStyle = '#9bdad0';
          context.lineWidth = size * 0.5;
          context.stroke();
        }
        context.globalAlpha = 1;
      } });
    }

    // Soft volumetric aura is deliberately slow and never strobes.
    const haloSize = unit * origin.scale * (1.65 + charge * 0.2 + scatter * 0.72);
    context.globalAlpha = 0.37 + heat * 0.17;
    context.drawImage(warmGlow, centerX - haloSize, centerY - haloSize, haloSize * 2, haloSize * 2);
    context.globalAlpha = 1;
    for (let ribbon = 0; ribbon < 3; ribbon++) {
      const points = [];
      for (let i = 0; i <= 72; i++) {
        const angle = i / 72 * TAU;
        const radius = 1.18 + ribbon * 0.07 + Math.sin(angle * 3 + elapsed * 0.28 + ribbon) * 0.025;
        const point = rotate({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: 0 },
          0.79 + ribbon * 0.6, 0.13 + ribbon * 0.42, elapsed * 0.025 + ribbon * 1.1);
        points.push(project(point));
      }
      path(points);
      context.strokeStyle = rgba(ribbon === 1 ? rings[1].color : rings[0].color, 0.08 + heat * 0.045);
      context.lineWidth = 0.6;
      context.stroke();
    }

    if (shock > 0 && shock < 1) {
      const opacity = Math.sin(shock * Math.PI) * 0.34;
      for (let wave = 0; wave < 2; wave++) {
        const radius = unit * (0.38 + shock * 2.5 - wave * 0.16);
        if (radius <= 0) continue;
        context.beginPath();
        context.ellipse(centerX, centerY, radius, radius * (wave ? 0.68 : 0.38), -0.24, 0, TAU);
        context.strokeStyle = rgba(wave ? rings[1].color : rings[0].color, opacity * (wave ? 0.58 : 1));
        context.lineWidth = wave ? 0.7 : 1.2;
        context.stroke();
      }
    }

    for (const arc of arcs) {
      const spin = elapsed * arc.ring.speed + cycle.spin * (arc.ringIndex % 2 ? -1 : 1);
      const arcCenter = rotate(arc.center, 0, 0, spin);
      const localDisplacement = scatter * arc.kick;
      const offset = {
        x: arcCenter.x * localDisplacement + arc.drift.x * scatter,
        y: arcCenter.y * localDisplacement + arc.drift.y * scatter,
        z: arcCenter.z * localDisplacement + arc.drift.z * scatter,
      };
      const transform = point => {
        const rotated = rotate(point, 0, 0, spin);
        const relative = rotate({
          x: rotated.x - arcCenter.x, y: rotated.y - arcCenter.y, z: rotated.z - arcCenter.z,
        }, ...arc.twist.map(value => value * scatter));
        return project({
          x: (arcCenter.x + relative.x) * (1 - charge * 0.07) + offset.x,
          y: (arcCenter.y + relative.y) * (1 - charge * 0.07) + offset.y,
          z: (arcCenter.z + relative.z) * (1 - charge * 0.07) + offset.z,
        });
      };
      const outer = [], inner = [];
      for (let i = 0; i <= 6; i++) {
        const angle = arc.angle + (i / 6 * 0.995 + 0.0025) * TAU / 24;
        outer.push(transform(orbitPoint(arc.ring, angle, arc.ring.radius + 0.009)));
        inner.push(transform(orbitPoint(arc.ring, angle, arc.ring.radius - 0.009)));
      }
      const ticks = [];
      for (let i = 1; i <= 2; i++) {
        const angle = arc.angle + i / 3 * TAU / 24;
        ticks.push([
          transform(orbitPoint(arc.ring, angle, arc.ring.radius + 0.014)),
          transform(orbitPoint(arc.ring, angle, arc.ring.radius + (i === 1 ? 0.036 : 0.028))),
        ]);
      }
      paintQueue.push({
        z: outer[3].z,
        paint() {
          const light = 0.36 + (Math.sin(arc.angle + spin - 0.9) + 1) * 0.2 + heat * 0.12;
          path([...outer, ...inner.slice().reverse()], true);
          context.fillStyle = rgba(arc.ring.color, light);
          context.fill();
          path(outer);
          context.strokeStyle = rgba(arc.ring.color, Math.min(0.95, light + 0.25));
          context.lineWidth = 0.7 + heat * 0.4;
          context.stroke();
          for (const tick of ticks) {
            path(tick);
            context.strokeStyle = rgba(arc.ring.color, 0.27 + heat * 0.2);
            context.lineWidth = 0.55;
            context.stroke();
          }
        },
      });
    }

    const coreSize = unit * origin.scale * 0.255 * (1 - charge * 0.12);
    if (scatter < 0.99) {
      paintQueue.push({
        z: origin.z,
        paint() {
          context.globalAlpha = (1 - scatter) ** 1.7;
          const glowSize = coreSize * (3.7 + charge * 1.5);
          context.drawImage(warmGlow, centerX - glowSize, centerY - glowSize, glowSize * 2, glowSize * 2);
          const gradient = context.createRadialGradient(
            centerX - coreSize * 0.31, centerY - coreSize * 0.34, coreSize * 0.03,
            centerX, centerY, coreSize,
          );
          gradient.addColorStop(0, '#fff9df');
          gradient.addColorStop(0.48, '#efdfb3');
          gradient.addColorStop(0.88, '#c3ad75');
          gradient.addColorStop(1, '#e6dbb7');
          context.fillStyle = gradient;
          context.beginPath();
          context.arc(centerX, centerY, coreSize, 0, TAU);
          context.fill();
          context.globalAlpha = 1;
        },
      });
    }

    for (const facet of facets) {
      const spin = elapsed * 0.075 + cycle.spin * 0.2;
      const center = rotate(facet.center, 0, spin, 0);
      const points = facet.vertices.map(vertex => {
        const base = rotate(vertex, 0, spin, 0);
        const local = rotate({ x: base.x - center.x, y: base.y - center.y, z: base.z - center.z },
          ...facet.twist.map(value => value * scatter));
        const expand = 1 + scatter * facet.kick;
        const shrink = 1 - charge * 0.12;
        return project({
          x: (center.x * expand + local.x) * shrink,
          y: (center.y * expand + local.y) * shrink,
          z: (center.z * expand + local.z) * shrink,
        });
      });
      const z = (points[0].z + points[1].z + points[2].z) / 3;
      if (z < origin.z && scatter < 0.025) continue;
      paintQueue.push({
        z,
        paint() {
          path(points, true);
          const facing = Math.min(1, Math.max(0, (z - origin.z) / (0.255 * (1 + scatter * 4)) * 0.5 + 0.5));
          const brightness = facet.light * (0.64 + facing * 0.36);
          const color = [Math.round(247 * brightness), Math.round(229 * brightness), Math.round(179 * brightness)];
          context.fillStyle = rgba(color, 0.12 + scatter * 0.81);
          context.fill();
          context.strokeStyle = rgba([255, 241, 196], (0.075 + heat * 0.12 + scatter * 0.25) * facing);
          context.lineWidth = 0.45 + scatter * 0.25;
          context.stroke();
        },
      });
    }

    for (const particle of particles) {
      const angle = particle.angle + elapsed * particle.speed + cycle.spin * 0.5;
      const pointAt = (trail = 0) => {
        const base = orbitPoint(particle.ring, angle - trail, particle.ring.radius * particle.radius);
        const swirl = scatter * Math.sin(elapsed * 0.7 + particle.seed) * 0.1;
        return project({
          x: base.x * (1 + scatter * particle.kick) + Math.cos(angle) * swirl,
          y: base.y * (1 + scatter * particle.kick) + Math.sin(angle) * swirl,
          z: base.z * (1 + scatter * particle.kick) + particle.lift * scatter,
        });
      };
      const point = pointAt();
      const tail = pointAt(0.026 + heat * 0.06);
      paintQueue.push({
        z: point.z,
        paint() {
          const opacity = 0.38 + 0.25 * (Math.sin(elapsed * 0.6 + particle.seed) + 1) / 2 + heat * 0.24;
          if (particle.size > 0.85 || heat > 0.2) {
            context.beginPath();
            context.moveTo(tail.x, tail.y);
            context.lineTo(point.x, point.y);
            context.strokeStyle = rgba(particle.ring.color, opacity * 0.3);
            context.lineWidth = 0.65;
            context.stroke();
          }
          const size = particle.size * point.scale * (1 + heat * 0.35);
          context.globalAlpha = opacity;
          if (particle.size > 1.18 || heat > 0.6) {
            const extent = size * 7;
            context.drawImage(particle.ring === rings[1] ? coolGlow : warmGlow,
              point.x - extent, point.y - extent, extent * 2, extent * 2);
          }
          context.fillStyle = '#fff4d5';
          context.beginPath();
          context.arc(point.x, point.y, size * 0.62, 0, TAU);
          context.fill();
          context.globalAlpha = 1;
        },
      });
    }

    paintQueue.sort((a, b) => a.z - b.z);
    for (const item of paintQueue) item.paint();
    if (spacetime.strength > .001) {
      const extent = Math.min(width, height) * (.3 - spacetime.collapse * .16 + spacetime.bloom * .19);
      context.save();
      context.translate(centerX, centerY);
      context.rotate(-.24 + spacetime.collapse * .3);
      context.globalCompositeOperation = 'lighter';
      for (let lane = 0; lane < 16; lane++) {
        const radius = extent * (.9 + lane * .016);
        const phase = elapsed * (.14 + lane * .006) + lane * 2.4;
        context.beginPath();
        context.ellipse(0, 0, radius, radius * (.32 + lane * .002), 0, phase, phase + Math.PI * 1.15);
        context.strokeStyle = rgba(lane % 3 ? bronze : teal, spacetime.strength * (.14 + spacetime.collapse * .25));
        context.lineWidth = lane % 4 ? .7 : 1.6;
        context.stroke();
      }
      context.globalCompositeOperation = 'source-over';
      if (spacetime.collapse > .6) {
        context.beginPath(); context.arc(0, 0, extent * .22 * spacetime.collapse, 0, TAU);
        context.fillStyle = '#020607'; context.fill();
      }
      context.restore();
    }
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
  }
  function tick(now) {
    frame = 0;
    if (!canAnimate()) return;
    if (!previous) previous = now;
    const delta = now - previous;
    // Retain fractional frame time; never speed up after returning to the page.
    if (delta >= 1000 / 30) {
      const remainder = delta % (1000 / 30);
      const step = Math.min((delta - remainder) / 1000, 0.075);
      elapsed += step;
      previous = now - remainder;
      advanceActivities(step);
      moveCamera();
      render();
    }
    frame = requestAnimationFrame(tick);
  }
  function updatePlayback() {
    if (canAnimate()) {
      if (!frame) frame = requestAnimationFrame(tick);
    } else stop();
  }
  function resize() {
    if (disposed) return;
    const bounds = host.getBoundingClientRect();
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    render();
  }
  function onMotion(event) {
    if (typeof event.detail?.paused === 'boolean') paused = event.detail.paused;
    updatePlayback();
  }
  function onBurst() {
    const current = elapsed + cycleOffset;
    if (!canAnimate() || sampleCycle(current).phase !== 'orbit') return;
    // Advance the effect clock without disturbing the sculpture's pose or drift.
    // A tiny epsilon keeps floating-point modulo from landing before charging.
    const target = current + (BURST_START - current % CYCLE_DURATION + CYCLE_DURATION) % CYCLE_DURATION + 1e-9;
    spinOffset += sampleCycle(current).spin - sampleCycle(target).spin;
    cycleOffset += target - current;
    render();
  }
  function onWorldView(event) {
    if (disposed) return;
    if (typeof event.detail?.active === 'boolean') worldActive = event.detail.active;
    if (Object.hasOwn(realmViews, event.detail?.realm)) realm = event.detail.realm;
    viewTarget = { ...(worldActive ? realmViews[realm] : heroView), world: worldActive ? 1 : 0 };
    if (!worldActive) {
      fieldActive = false;
      fieldPulseStarted = -Infinity;
      Object.assign(orbitTarget, { x: 0, y: 0, zoom: 0 });
    }
    if (!canAnimate()) moveCamera(true);
    render();
    updatePlayback();
  }
  function onWorldOrbit(event) {
    if (disposed) return;
    if (typeof event.detail?.x === 'number') orbitTarget.x = finiteClamp(event.detail.x, -1, 1);
    if (typeof event.detail?.y === 'number') orbitTarget.y = finiteClamp(event.detail.y, -1, 1);
    if (typeof event.detail?.zoom === 'number') orbitTarget.zoom = finiteClamp(event.detail.zoom, -0.5, 1);
    if (!canAnimate()) moveCamera(true);
    render();
    updatePlayback();
  }
  function onWorldActivity(event) {
    if (disposed || !Object.hasOwn(activities, event.detail?.kind)) return;
    const activity = activities[event.detail.kind];
    const active = event.detail.active === true;
    if (active && !activity.active) activity.time = 0;
    activity.active = active;
    activity.target = active ? finiteClamp(event.detail.strength, 0, 1) : 0;
    // A manual input produces a complete still frame when motion is paused.
    if (!canAnimate()) activity.strength = activity.target;
    render();
    updatePlayback();
  }
  function onWorldFlight(event) {
    if (disposed) return;
    flight.active = event.detail?.active === true;
    flight.progress = finiteClamp(event.detail?.progress, 0, 1);
    if (Number.isFinite(event.detail?.duration)) flight.duration = finiteClamp(event.detail.duration, 0.2, 30);
    render();
    updatePlayback();
  }
  function onWorldCapture() {
    if (disposed || !worldActive) return;
    render();
    canvas.toBlob(blob => {
      if (!disposed && blob) document.dispatchEvent(new CustomEvent('world-capture-ready', { detail: { blob } }));
    }, 'image/png');
  }
  function onWorldLab(event) {
    if (disposed) return;
    sampleField();
    if (event.detail?.active !== true || event.detail?.form !== fieldForms[fieldTarget]) fieldPulseStarted = -Infinity;
    fieldActive = worldActive && event.detail?.active === true;
    const next = fieldForms.indexOf(event.detail?.form);
    if (next >= 0 && (next !== fieldTarget || paused)) {
      fieldFrom.set(fieldWeights);
      fieldTarget = next;
      fieldStarted = elapsed;
      fieldMorphing = !paused;
      if (paused) for (let index = 0; index < 4; index++) fieldWeights[index] = index === next ? 1 : 0;
    }
    render();
    updatePlayback();
  }
  function onWorldLabFold(event) {
    if (disposed || !Number.isFinite(event.detail?.value)) return;
    fieldFold = finiteClamp(event.detail.value, 0, 1);
    fieldPulseStarted = -Infinity;
    if (paused) {
      fieldMorphing = false;
      for (let index = 0; index < 4; index++) fieldWeights[index] = index === fieldTarget ? 1 : 0;
    }
    if (worldActive && fieldActive) render();
  }
  function onWorldLabPulse(event) {
    if (disposed) return;
    if (event.detail?.active === true) {
      if (!worldActive || !fieldActive || fieldForms[fieldTarget] !== 'tesseract' || paused) return;
      fieldPulseStarted = elapsed;
    } else fieldPulseStarted = -Infinity;
    if (worldActive && fieldActive) render();
  }
  function onSingularity(event) {
    spacetime = sampleSpacetime(event.detail?.progress, event.detail?.active === true);
    if (paused && !disposed) render();
  }
  function onPageHide(event) {
    stop();
    if (!event.persisted) dispose();
  }
  function onPageShow() {
    resize();
    updatePlayback();
  }
  function dispose() {
    disposed = true;
    stop();
    intersection.disconnect();
    sizeObserver.disconnect();
    document.removeEventListener('visibilitychange', updatePlayback);
    document.removeEventListener('experience-motion', onMotion);
    document.removeEventListener('energy-burst', onBurst);
    document.removeEventListener('world-view', onWorldView);
    document.removeEventListener('world-orbit', onWorldOrbit);
    document.removeEventListener('world-activity', onWorldActivity);
    document.removeEventListener('world-flight', onWorldFlight);
    document.removeEventListener('world-capture', onWorldCapture);
    document.removeEventListener('world-lab', onWorldLab);
    document.removeEventListener('world-lab-fold', onWorldLabFold);
    document.removeEventListener('world-lab-pulse', onWorldLabPulse);
    document.removeEventListener('world-singularity', onSingularity);
    motion.removeEventListener('change', updatePlayback);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
  }

  const intersection = new IntersectionObserver(entries => {
    inView = entries[0]?.isIntersecting ?? false;
    updatePlayback();
  }, { rootMargin: '40px' });
  const sizeObserver = new ResizeObserver(resize);
  intersection.observe(host);
  sizeObserver.observe(host);
  document.addEventListener('visibilitychange', updatePlayback);
  document.addEventListener('experience-motion', onMotion);
  document.addEventListener('energy-burst', onBurst);
  document.addEventListener('world-view', onWorldView);
  document.addEventListener('world-orbit', onWorldOrbit);
  document.addEventListener('world-activity', onWorldActivity);
  document.addEventListener('world-flight', onWorldFlight);
  document.addEventListener('world-capture', onWorldCapture);
  document.addEventListener('world-lab', onWorldLab);
  document.addEventListener('world-lab-fold', onWorldLabFold);
  document.addEventListener('world-lab-pulse', onWorldLabPulse);
  document.addEventListener('world-singularity', onSingularity);
  motion.addEventListener('change', updatePlayback);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  resize();
  host.dataset.render = 'canvas';
  updatePlayback();
}
