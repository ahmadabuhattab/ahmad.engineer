const TAU = Math.PI * 2;
const MORPH_SECONDS = 1.4;
const EMPTY = Object.freeze({});
const FORMS = Object.freeze({ sphere: 0, knot: 1, helix: 2 });
const finite = value => Number.isFinite(value) ? value : 0;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// One parameterization keeps corresponding particles on continuous strands.
// The sphere's contour ribbons become the knot's filaments and the helix's rails.
function writePoint(sphere, knot, helix, offset, t, lane, lanes, trace = false, coilTime = t) {
  const angle = t * TAU;
  const longitude = angle + lane * .025;
  const latitude = ((lane + .5) / lanes - .5) * Math.PI * .96;
  const flow = Math.sin(angle * 3 + lane * .33) * .115 * Math.cos(latitude);
  const radius = 2.22 + (trace ? 0 : Math.sin(angle * 37 + lane * 4.1) * .022);
  if (trace) {
    // Quiet meridians complement the particle latitude ribbons.
    const azimuth = lane / lanes * Math.PI;
    sphere[offset] = Math.sin(angle) * Math.cos(azimuth) * radius;
    sphere[offset + 1] = Math.cos(angle) * radius;
    sphere[offset + 2] = Math.sin(angle) * Math.sin(azimuth) * radius;
  } else {
    sphere[offset] = Math.cos(latitude + flow) * Math.cos(longitude) * radius;
    sphere[offset + 1] = Math.sin(latitude + flow) * radius;
    sphere[offset + 2] = Math.cos(latitude + flow) * Math.sin(longitude) * radius;
  }

  // A (2, 3) torus knot with an orthogonal tube frame, computed without Three.
  const radial = 1.5 + .52 * Math.cos(angle * 3);
  const radialDerivative = -1.56 * Math.sin(angle * 3);
  const cosine = Math.cos(angle * 2), sine = Math.sin(angle * 2);
  let tx = radialDerivative * cosine - radial * sine * 2;
  let ty = 1.56 * Math.cos(angle * 3);
  let tz = radialDerivative * sine + radial * cosine * 2;
  const tangentLength = Math.hypot(tx, ty, tz);
  tx /= tangentLength; ty /= tangentLength; tz /= tangentLength;
  const projection = cosine * tx + sine * tz;
  let nx = cosine - projection * tx, ny = -projection * ty, nz = sine - projection * tz;
  const normalLength = Math.hypot(nx, ny, nz);
  nx /= normalLength; ny /= normalLength; nz /= normalLength;
  const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
  const section = lane / lanes * TAU;
  const tube = trace ? .126 : .12 + Math.sin(angle * 29 + lane) * .014;
  const across = Math.cos(section) * tube, around = Math.sin(section) * tube;
  const kx = radial * cosine + nx * across + bx * around;
  const ky = .52 * Math.sin(angle * 3) + ny * across + by * around;
  const kz = radial * sine + nz * across + bz * around;
  knot[offset] = kx;
  knot[offset + 1] = ky * .8253356 - kz * .5646425;
  knot[offset + 2] = ky * .5646425 + kz * .8253356;

  const side = lane % 2;
  const coil = coilTime * TAU * 2.2 + side * Math.PI;
  const railAngle = Math.floor(lane / 2) / Math.ceil(lanes / 2) * TAU;
  const coilRadius = .94 + Math.cos(railAngle) * .065;
  const hx = Math.cos(coil) * coilRadius;
  const hy = (coilTime - .5) * 4.1 + Math.sin(railAngle) * .065;
  helix[offset] = hx * .9800666 + hy * .1986693;
  helix[offset + 1] = hy * .9800666 - hx * .1986693;
  helix[offset + 2] = Math.sin(coil) * coilRadius;
}

/** Deterministic, centered coordinates usable by either WebGL or Canvas2D. */
export function createFieldCoordinates(count) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('Particle count must be a nonnegative integer.');
  const sphere = new Float32Array(count * 3);
  const knot = new Float32Array(count * 3);
  const helix = new Float32Array(count * 3);
  const lanes = 12, steps = Math.ceil(count / lanes);
  const rungStart = Math.floor(count * .82), rungs = 21;
  const railSteps = Math.max(1, Math.ceil(rungStart / lanes));
  const rungSteps = Math.max(1, Math.ceil((count - rungStart) / rungs) - 1);
  for (let index = 0; index < count; index++) {
    const offset = index * 3;
    writePoint(sphere, knot, helix, offset, (Math.floor(index / lanes) + .5) / steps, index % lanes, lanes, false, (Math.floor(index / lanes) + .5) / railSteps);
    if (index >= rungStart) {
      // Discrete base pairs make the double helix legible from every angle.
      const rungIndex = index - rungStart;
      const t = (rungIndex % rungs + .5) / rungs;
      const across = (Math.floor(rungIndex / rungs) / rungSteps * 2 - 1) * .94;
      const angle = t * TAU * 2.2;
      const hx = Math.cos(angle) * across, hy = (t - .5) * 4.1;
      helix[offset] = hx * .9800666 + hy * .1986693;
      helix[offset + 1] = hy * .9800666 - hx * .1986693;
      helix[offset + 2] = Math.sin(angle) * across;
    }
  }
  return { sphere, knot, helix };
}

/**
 * A monochrome field in three draws. The caller supplies time and visibility.
 * No animation loop, listeners, external assets, or per-frame allocations.
 */
export function createWorldFieldLab(THREE, scene, { mobile = false } = EMPTY) {
  const group = new THREE.Group();
  group.name = 'Monochrome particle field';
  group.visible = false;
  scene.add(group);
  const resources = [];
  const keep = resource => { resources.push(resource); return resource; };
  const count = mobile ? 2200 : 5000;
  const coordinates = createFieldCoordinates(count);
  const weights = new THREE.Vector3(1, 0, 0);
  const fromWeights = new Float64Array([1, 0, 0]);
  const uniforms = {
    uTime: { value: 0 }, uWeights: { value: weights },
    uPointer: { value: new THREE.Vector2() },
    uPointScale: { value: mobile ? 15 : 18 },
  };
  const vertexShader = `
    attribute vec3 aKnot, aHelix;
    attribute float aSeed;
    uniform vec3 uWeights;
    uniform vec2 uPointer;
    uniform float uTime, uPointScale;
    varying float vSeed, vPulse;
    void main() {
      vec3 p = position * uWeights.x + aKnot * uWeights.y + aHelix * uWeights.z;
      float transition = 1. - dot(uWeights, uWeights);
      float wave = sin(p.y * 2.4 + p.x * .7 + uTime * .55);
      p += p / max(length(p), .001) * wave * (.014 + transition * .065);
      vec2 delta = p.xy - uPointer * 2.4;
      float influence = exp(-dot(delta, delta) * 1.15);
      p.xy += delta * influence * .045;
      p.z += influence * .11;
      vec4 view = modelViewMatrix * vec4(p, 1.);
      gl_Position = projectionMatrix * view;
      gl_PointSize = clamp((.95 + aSeed * .7) * uPointScale / max(4., -view.z), .85, 3.2);
      vSeed = aSeed;
      vPulse = pow(max(0., sin(aSeed * 39. + uTime * .47)), 18.);
    }
  `;
  const output = `
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  `;
  const material = fragmentShader => keep(new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader, transparent: true,
    depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  function geometryFor(data) {
    const geometry = keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(data.sphere, 3));
    geometry.setAttribute('aKnot', new THREE.BufferAttribute(data.knot, 3));
    geometry.setAttribute('aHelix', new THREE.BufferAttribute(data.helix, 3));
    const seeds = new Float32Array(data.sphere.length / 3);
    for (let index = 0; index < seeds.length; index++) seeds[index] = (Math.imul(index + 1, 1597334677) >>> 0) / 4294967296;
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return geometry;
  }
  function add(object, order) {
    object.frustumCulled = false;
    object.renderOrder = order;
    group.add(object);
  }
  const pointGeometry = geometryFor(coordinates);
  add(new THREE.Points(pointGeometry, material(`
    varying float vSeed, vPulse;
    void main() {
      float radius = dot(gl_PointCoord - .5, gl_PointCoord - .5) * 4.;
      if (radius > 1.) discard;
      float alpha = (1. - smoothstep(.05, 1., radius)) * (.6 + vSeed * .34);
      gl_FragColor = vec4(vec3(.82 + vPulse * .5), alpha);
      ${output}
    }
  `)), 1);

  const tracks = 8, segments = mobile ? 80 : 128;
  const traceCount = tracks * (segments + 1);
  const traceCoordinates = { sphere: new Float32Array(traceCount * 3), knot: new Float32Array(traceCount * 3), helix: new Float32Array(traceCount * 3) };
  const indices = new Uint16Array(tracks * segments * 2);
  for (let track = 0; track < tracks; track++) {
    for (let segment = 0; segment <= segments; segment++) {
      const index = track * (segments + 1) + segment;
      writePoint(traceCoordinates.sphere, traceCoordinates.knot, traceCoordinates.helix, index * 3, segment / segments, track, tracks, true);
      if (segment < segments) {
        const edge = (track * segments + segment) * 2;
        indices[edge] = index; indices[edge + 1] = index + 1;
      }
    }
  }
  const traceGeometry = geometryFor(traceCoordinates);
  traceGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  add(new THREE.LineSegments(traceGeometry, material(`
    varying float vSeed, vPulse;
    void main() {
      gl_FragColor = vec4(vec3(.86), .075 + vPulse * .07);
      ${output}
    }
  `)), 0);

  // Sparse diffraction glints sit on real particles, with no texture or sprites.
  const glintGeometry = keep(new THREE.BufferGeometry());
  for (const key of ['position', 'aKnot', 'aHelix', 'aSeed']) glintGeometry.setAttribute(key, pointGeometry.getAttribute(key));
  const glintIndices = new Uint16Array(Math.ceil(count / 31));
  for (let index = 0; index < glintIndices.length; index++) glintIndices[index] = index * 31;
  glintGeometry.setIndex(new THREE.BufferAttribute(glintIndices, 1));
  const glintMaterial = material(`
    varying float vSeed, vPulse;
    void main() {
      vec2 point = (gl_PointCoord - .5) * 2.;
      float radius = dot(point, point);
      if (radius > 1.) discard;
      float halo = exp(-radius * 5.);
      float cross = exp(-abs(point.x) * 22.) + exp(-abs(point.y) * 22.);
      float alpha = (halo * .15 + cross * .08) * (.2 + vPulse * .8) * (1. - radius);
      gl_FragColor = vec4(vec3(1.), alpha);
      ${output}
    }
  `);
  glintMaterial.vertexShader = vertexShader.replace('vSeed = aSeed;', 'gl_PointSize = min(gl_PointSize * 3.2, 9.); vSeed = aSeed;');
  add(new THREE.Points(glintGeometry, glintMaterial), 2);

  let disposed = false, target = 0, morphStart = 0, lastTime = 0, morphing = false;
  function sampleWeights(time) {
    if (!morphing) return;
    const progress = clamp((time - morphStart) / MORPH_SECONDS, 0, 1);
    const eased = progress * progress * progress * (10 + progress * (-15 + progress * 6));
    weights.set(
      fromWeights[0] + ((target === 0 ? 1 : 0) - fromWeights[0]) * eased,
      fromWeights[1] + ((target === 1 ? 1 : 0) - fromWeights[1]) * eased,
      fromWeights[2] + ((target === 2 ? 1 : 0) - fromWeights[2]) * eased,
    );
    if (progress === 1) morphing = false;
  }
  return {
    update(state = EMPTY) {
      if (disposed) return;
      const time = finite(state.time);
      if (time < lastTime && morphing) morphStart += time - lastTime;
      lastTime = time;
      sampleWeights(time);
      const next = Object.hasOwn(FORMS, state.form) ? FORMS[state.form] : 0;
      const pausedEntry = state.paused && state.active === true && !group.visible;
      if (next !== target || pausedEntry) {
        fromWeights[0] = weights.x; fromWeights[1] = weights.y; fromWeights[2] = weights.z;
        target = next;
        morphStart = time;
        morphing = !state.paused;
        if (state.paused) weights.set(next === 0 ? 1 : 0, next === 1 ? 1 : 0, next === 2 ? 1 : 0);
      }
      uniforms.uTime.value = time;
      uniforms.uPointer.value.set(clamp(finite(state.pointer?.x), -1, 1), clamp(finite(state.pointer?.y), -1, 1));
      group.rotation.set(-.13 + Math.sin(time * .11) * .07, time * .085, .1);
      group.visible = state.active === true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      for (const resource of resources) resource.dispose();
      group.clear();
    },
  };
}
