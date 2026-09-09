import { sampleCycle, CYCLE_DURATION, BURST_START } from './energy-cycle.js';

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
  const canAnimate = () => !disposed && !paused && !document.hidden && (inView || worldActive);

  function render() {
    const cycle = sampleCycle(elapsed + cycleOffset);
    cycle.spin += spinOffset;
    const { scatter, charge, heat, shock } = cycle;
    if (lastPhase !== cycle.phase) {
      lastPhase = cycle.phase;
      host.dataset.phase = cycle.phase;
      document.dispatchEvent(new CustomEvent('energy-phase', {
        detail: { phase: cycle.phase, bursting: cycle.bursting },
      }));
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    const unit = Math.min(width, height) * view.scale * (1 + orbit.zoom * 0.35) / (1 + scatter * view.retreat);
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
    context.globalAlpha = 0.17;
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
          ], color, 0.45 + Math.sin(elapsed * 0.3 + level * 6 + x) * 0.11, 0.85, true, frontDepth + 0.002);
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
      return { x: -2.85 + turned.x, y: turned.y + 0.15, z: -0.55 + turned.z };
    });
    intelligenceLinks.forEach(([a, b], index) => {
      const intensity = 0.18 + (Math.sin(elapsed * 0.7 - index * 0.3) + 1) * 0.075;
      worldLine([nodePositions[a], nodePositions[b]], teal, intensity, 0.7, true);
    });
    for (let index = 0; index < nodePositions.length; index++) {
      const point = project(nodePositions[index]);
      const size = Math.max(1.2, unit * 0.019 * point.scale);
      paintQueue.push({
        z: point.z,
        paint() {
          const glow = size * 5;
          context.globalAlpha = 0.65;
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
      worldFace([crystal[0], crystal[index], crystal[next]], [53, 108, 109], teal, 0.68, 0.72);
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
      elapsed += Math.min((delta - remainder) / 1000, 0.075);
      previous = now - remainder;
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
    if (!worldActive) Object.assign(orbitTarget, { x: 0, y: 0, zoom: 0 });
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
  motion.addEventListener('change', updatePlayback);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  resize();
  host.dataset.render = 'canvas';
  updatePlayback();
}
