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

  let width = 1, height = 1, pixelRatio = 1;
  let elapsed = 0, frame = 0, previous = 0;
  let cycleOffset = 0, spinOffset = 0;
  let inView = true, disposed = false;
  let paused = document.body.classList.contains('motion-paused');
  let lastPhase = '';
  const canAnimate = () => !disposed && !paused && !document.hidden && inView;

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
    const unit = Math.min(width, height) * 0.385 / (1 + scatter * 1.6);
    const centerX = width * 0.5;
    const centerY = height * 0.49;
    const globalY = Math.sin(elapsed * 0.15) * 0.21;
    const globalZ = Math.sin(elapsed * 0.11) * 0.09;
    const globalX = Math.sin(elapsed * 0.08) * 0.12;
    const project = point => {
      const rotated = rotate(point, globalX, globalY, globalZ);
      const perspective = 4.6 / (4.6 - rotated.z);
      return {
        x: centerX + rotated.x * unit * perspective,
        y: centerY + rotated.y * unit * perspective,
        z: rotated.z,
        scale: perspective,
      };
    };
    const path = (points, close = false) => {
      context.beginPath();
      for (let i = 0; i < points.length; i++) {
        if (i === 0) context.moveTo(points[i].x, points[i].y);
        else context.lineTo(points[i].x, points[i].y);
      }
      if (close) context.closePath();
    };
    const paintQueue = [];

    // Soft volumetric aura is deliberately slow and never strobes.
    const haloSize = unit * (1.65 + charge * 0.2 + scatter * 0.72);
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

    const coreSize = unit * 0.255 * (1 - charge * 0.12);
    if (scatter < 0.99) {
      paintQueue.push({
        z: 0,
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
      if (z < 0 && scatter < 0.025) continue;
      paintQueue.push({
        z,
        paint() {
          path(points, true);
          const facing = Math.min(1, Math.max(0, z / (0.255 * (1 + scatter * 4)) * 0.5 + 0.5));
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
  motion.addEventListener('change', updatePlayback);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  resize();
  host.dataset.render = 'canvas';
  updatePlayback();
}
