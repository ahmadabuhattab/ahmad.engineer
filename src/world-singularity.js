/**
 * A procedural gravitational field for the observatory's existing nucleus.
 *
 * createWorldSingularity(THREE, scene) returns { update, dispose }.
 * update({ time, immersive, realm, scatter, charge,
 *   singularity: { strength, collapse, bloom, progress }, pointer: { x, y } })
 * accepts seconds and normalized effect values. Time is supplied by the caller:
 * a paused scene remains a complete, deterministic still frame. No clock,
 * listeners, textures, downloads, or frame-time geometry allocations are used.
 * Six batched draws at peak; the eclipse and polar jets sleep between events.
 */
export function createWorldSingularity(THREE, scene) {
  const small = typeof matchMedia === 'function' && matchMedia('(max-width: 760px)').matches;
  const group = new THREE.Group();
  group.name = 'Observatory gravitational field';
  scene.add(group);
  const resources = [];
  const keep = resource => { resources.push(resource); return resource; };
  const empty = Object.freeze({});
  const finite = value => Number.isFinite(value) ? value : 0;
  const unit = value => Math.max(0, Math.min(1, finite(value)));
  let disposed = false;
  let seed = 90173;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const uniforms = {
    uTime: { value: 0 }, uVisibility: { value: 0.4 },
    uStrength: { value: 0 }, uCollapse: { value: 0 },
    uBloom: { value: 0 }, uProgress: { value: 0 },
    uHeat: { value: 0 }, uPointer: { value: new THREE.Vector2() },
    uPointScale: { value: small ? 230 : 360 },
  };
  const common = `
    uniform float uTime, uVisibility, uStrength, uCollapse, uBloom, uProgress, uHeat;
    uniform vec2 uPointer;
    const float TAU = 6.28318530718;
    mat2 turn(float angle) {
      float s = sin(angle), c = cos(angle);
      return mat2(c, s, -s, c);
    }
    vec3 incline(vec3 p) {
      p.yz = turn(.31 + uPointer.y * .055) * p.yz;
      p.xy = turn(-.23 + uPointer.x * .045) * p.xy;
      return p;
    }
    vec3 fieldColor(float cool) {
      return mix(vec3(1., .52, .16), vec3(.12, .78, .65), cool);
    }
  `;
  const output = `
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  `;
  function material(vertexShader, fragmentShader, options = empty) {
    return keep(new THREE.ShaderMaterial({
      uniforms, vertexShader: common + vertexShader, fragmentShader: common + fragmentShader,
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      ...options,
    }));
  }
  function add(object) {
    // Vertex shaders move the field well beyond its parameter-space bounds.
    object.frustumCulled = false;
    group.add(object);
    return object;
  }

  // Seven narrow streams are real, inclined surfaces, with gaps between them.
  // Their breadth stays small: the nucleus and original armillary stay legible.
  const bands = 7, bandSegments = small ? 128 : 192;
  const bandParameters = new Float32Array(bands * (bandSegments + 1) * 2 * 3);
  const bandIndices = new Uint16Array(bands * bandSegments * 6);
  let vertex = 0, index = 0;
  for (let band = 0; band < bands; band++) {
    const first = vertex / 3;
    for (let segment = 0; segment <= bandSegments; segment++) {
      for (const edge of [-1, 1]) {
        bandParameters[vertex++] = segment / bandSegments * Math.PI * 2;
        bandParameters[vertex++] = edge;
        bandParameters[vertex++] = band;
      }
      if (segment < bandSegments) {
        const base = first + segment * 2;
        bandIndices[index++] = base; bandIndices[index++] = base + 1; bandIndices[index++] = base + 2;
        bandIndices[index++] = base + 1; bandIndices[index++] = base + 3; bandIndices[index++] = base + 2;
      }
    }
  }
  const bandGeometry = keep(new THREE.BufferGeometry());
  bandGeometry.setAttribute('position', new THREE.BufferAttribute(bandParameters, 3));
  bandGeometry.setIndex(new THREE.BufferAttribute(bandIndices, 1));
  const accretion = add(new THREE.Mesh(bandGeometry, material(`
    varying float vEdge, vAngle, vBand;
    void main() {
      float band = position.z;
      float angle = position.x + uTime * (.055 + .11 / (1. + band)) + band * .38;
      angle += uCollapse * (1.9 + band * .17) - uBloom * .65;
      float radius = 1.05 + band * .34 + sin(angle * 3. + band * 1.7) * .045;
      radius = mix(radius, .77 + band * .046, uCollapse);
      radius += uBloom * (1.1 + band * .41);
      float breadth = (.045 + band * .008) * (1. + uStrength * 1.15);
      radius += position.y * breadth;
      vec3 p = vec3(cos(angle) * radius,
        sin(angle * 2. + band) * (.035 + uStrength * .075), sin(angle) * radius);
      p.y += uBloom * sin(angle * 3. + band * .35) * .34;
      p = incline(p);
      vEdge = position.y; vAngle = angle; vBand = band;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
    }
  `, `
    varying float vEdge, vAngle, vBand;
    void main() {
      float thread = exp(-vEdge * vEdge * 22.);
      float veil = exp(-vEdge * vEdge * 3.5) * .19;
      float travel = .38 + .62 * pow(max(0., .5 + .5 * sin(vAngle * 2. - uTime * .55 + vBand)), 5.);
      float opening = smoothstep(-.94, -.52, sin(vAngle + vBand * .7));
      float alpha = (thread + veil) * travel * opening * uVisibility;
      alpha *= (.20 + uStrength * .65 + uHeat * .08) * (1. - uBloom * .38);
      vec3 color = fieldColor(smoothstep(3.7, 6., vBand) * .78);
      color = mix(color, vec3(1., .92, .71), thread * .35);
      gl_FragColor = vec4(color * (1. + uStrength * 1.4), alpha);
      ${output}
    }
  `)));
  accretion.name = 'Inclined accretion streams';

  // Long orbital field lines curve through several planes, rather than flying
  // away as unrelated streaks. Bright knots travel continuously along each line.
  const strands = small ? 12 : 18, strandSegments = small ? 88 : 128;
  const strandParameters = new Float32Array(strands * strandSegments * 6);
  vertex = 0;
  for (let strand = 0; strand < strands; strand++) {
    for (let segment = 0; segment < strandSegments; segment++) {
      for (let end = 0; end < 2; end++) {
        strandParameters[vertex++] = (segment + end) / strandSegments;
        strandParameters[vertex++] = strand;
        strandParameters[vertex++] = random();
      }
    }
  }
  const filamentGeometry = keep(new THREE.BufferGeometry());
  filamentGeometry.setAttribute('position', new THREE.BufferAttribute(strandParameters, 3));
  const filaments = add(new THREE.LineSegments(filamentGeometry, material(`
    varying float vAlong, vStrand;
    void main() {
      float strand = position.y;
      float angle = position.x * TAU + strand * 1.913 + uTime * (.018 + mod(strand, 3.) * .005);
      angle += uCollapse * 1.7 - uBloom * .55;
      float radius = 3.15 + mod(strand, 6.) * .38;
      radius = mix(radius, .96 + mod(strand, 4.) * .085, uCollapse);
      radius += uBloom * (1.7 + mod(strand, 5.) * .38);
      vec3 p = vec3(cos(angle) * radius, sin(angle) * radius, sin(angle * 2. + strand) * .15);
      p.yz = turn(strand * .417 + .4) * p.yz;
      p.xz = turn(strand * .193 + uTime * .009) * p.xz;
      p.y += uBloom * sin(angle + strand) * .42;
      vAlong = position.x; vStrand = strand;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(incline(p), 1.);
    }
  `, `
    varying float vAlong, vStrand;
    void main() {
      float arc = pow(max(0., sin(vAlong * 3.14159265)), .7);
      float flow = pow(max(0., .5 + .5 * sin(vAlong * TAU * 2. - uTime * .48 + vStrand * 1.7)), 12.);
      float alpha = arc * (.045 + flow * .14 + uStrength * (.11 + flow * .65));
      alpha *= uVisibility * (1. - uBloom * .23);
      gl_FragColor = vec4(fieldColor(step(2.5, mod(vStrand, 4.))) * (1. + flow * uStrength), alpha);
      ${output}
    }
  `)));
  filaments.name = 'Gravitational field filaments';

  const count = small ? 1100 : 2600;
  const particleParameters = new Float32Array(count * 3);
  const particleSeeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const ambient = i >= count * .82;
    particleParameters[i * 3] = ambient ? 7.2 + random() * 9 : .96 + Math.pow(random(), .8) * 4.8;
    particleParameters[i * 3 + 1] = random() * Math.PI * 2;
    particleParameters[i * 3 + 2] = (random() - .5) * (ambient ? 8 : .25);
    particleSeeds[i * 3] = random();
    particleSeeds[i * 3 + 1] = random();
    particleSeeds[i * 3 + 2] = ambient ? 1 : 0;
  }
  const particleGeometry = keep(new THREE.BufferGeometry());
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particleParameters, 3));
  particleGeometry.setAttribute('aSeed', new THREE.BufferAttribute(particleSeeds, 3));
  const dust = add(new THREE.Points(particleGeometry, material(`
    attribute vec3 aSeed;
    uniform float uPointScale;
    varying float vAlpha, vCool, vSpark;
    void main() {
      float ambient = aSeed.z;
      float angle = position.y + uTime * (.036 + .11 / position.x) * (1. - ambient * .8);
      angle += uCollapse * (2.4 + position.x * .35) * (1. - ambient * .75);
      float radius = mix(position.x, .69 + aSeed.x * .32, uCollapse * (1. - ambient * .8));
      radius += uBloom * (1. + aSeed.x * 7.5) * (1. - ambient * .75);
      angle += uBloom * (aSeed.x - .5) * .85;
      float height = position.z * (1. - uCollapse * .7);
      height += sin(angle * 3. + aSeed.x * TAU) * uBloom * (.22 + aSeed.y * 1.65);
      vec3 p = incline(vec3(cos(angle) * radius, height, sin(angle) * radius));
      p.y += sin(uTime * .055 + aSeed.x * TAU) * ambient * .12;
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      vSpark = smoothstep(.93, 1., aSeed.y);
      vCool = smoothstep(.55, .91, aSeed.x);
      vAlpha = (.18 + aSeed.y * .4) * (.6 + .4 * sin(aSeed.x * TAU + uTime * .16));
      vAlpha *= uVisibility * (.38 + uStrength * 1.05) * (1. - ambient * .55);
      vAlpha *= 1. - smoothstep(.68, 1., uBloom) * .55;
      gl_PointSize = clamp(uPointScale * (.055 + vSpark * .12 + uStrength * .065) / max(.5, -mv.z), 1., 21.);
      gl_Position = projectionMatrix * mv;
    }
  `, `
    varying float vAlpha, vCool, vSpark;
    void main() {
      vec2 p = gl_PointCoord * 2. - 1.;
      float radius = dot(p, p);
      if (radius > 1.) discard;
      float core = exp(-radius * 9.);
      float glow = exp(-radius * 3.7) * .23;
      float edge = max(0., 1. - radius);
      float rays = (exp(-p.x * p.x * 130.) + exp(-p.y * p.y * 130.))
        * edge * edge * vSpark * .11;
      vec3 color = mix(fieldColor(vCool), vec3(1., .96, .78), core * .65);
      gl_FragColor = vec4(color * (1. + vSpark * .65 + uStrength * .8), (core + glow + rays) * vAlpha);
      ${output}
    }
  `)));
  dust.name = 'Structured accretion dust';

  // Two narrow, braided polar outflows announce the release without becoming
  // opaque cones. Both directions share one mesh and the disk's inclination.
  const jetSegments = small ? 40 : 64, jetSides = 12;
  const jetParameters = new Float32Array(2 * (jetSegments + 1) * (jetSides + 1) * 3);
  const jetIndices = new Uint16Array(2 * jetSegments * jetSides * 6);
  vertex = 0; index = 0;
  for (let jet = 0; jet < 2; jet++) {
    const first = vertex / 3;
    for (let step = 0; step <= jetSegments; step++) {
      for (let side = 0; side <= jetSides; side++) {
        jetParameters[vertex++] = step / jetSegments;
        jetParameters[vertex++] = side / jetSides * Math.PI * 2;
        jetParameters[vertex++] = jet ? -1 : 1;
        if (step < jetSegments && side < jetSides) {
          const base = first + step * (jetSides + 1) + side;
          jetIndices[index++] = base; jetIndices[index++] = base + 1; jetIndices[index++] = base + jetSides + 1;
          jetIndices[index++] = base + 1; jetIndices[index++] = base + jetSides + 2; jetIndices[index++] = base + jetSides + 1;
        }
      }
    }
  }
  const jetGeometry = keep(new THREE.BufferGeometry());
  jetGeometry.setAttribute('position', new THREE.BufferAttribute(jetParameters, 3));
  jetGeometry.setIndex(new THREE.BufferAttribute(jetIndices, 1));
  const jets = add(new THREE.Mesh(jetGeometry, material(`
    varying float vLength, vAngle;
    void main() {
      float along = position.x;
      float angle = position.y + along * 7. - uTime * .55;
      float length = .9 + along * (1.2 + uCollapse * 1.9 + uBloom * 7.4);
      float radius = .045 + pow(max(0., along), 1.3) * (.12 + uBloom * .48);
      vec3 p = vec3(cos(angle) * radius, length * position.z, sin(angle) * radius);
      p.x += sin(along * 5. - uTime * .16) * along * .13;
      vLength = along; vAngle = position.y;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(incline(p), 1.);
    }
  `, `
    varying float vLength, vAngle;
    void main() {
      float threads = pow(max(0., .5 + .5 * sin(vAngle * 3. + vLength * 8. - uTime * .7)), 7.);
      float envelope = pow(max(0., 1. - vLength), 1.6) * smoothstep(0., .07, vLength);
      float phase = uStrength * (.28 * uCollapse + 1.15 * uBloom);
      float alpha = envelope * (.075 + threads * .68) * phase * uVisibility;
      gl_FragColor = vec4(mix(vec3(1., .61, .24), vec3(.2, .82, .69), vLength) * 1.65, alpha);
      ${output}
    }
  `)));
  jets.name = 'Braided polar outflows';
  jets.visible = false;

  // A camera-facing annulus reads as a gravitational lens from every realm.
  // Its center is genuinely empty, so it never replaces the original sculpture.
  const lensGeometry = keep(new THREE.PlaneGeometry(2, 2));
  const lens = add(new THREE.Mesh(lensGeometry, material(`
    varying vec2 vLens;
    void main() {
      vLens = position.xy;
      float radius = 1.01 + uBloom * 4.8;
      vec4 center = modelViewMatrix * vec4(0., 0., 0., 1.);
      center.xy += position.xy * radius;
      gl_Position = projectionMatrix * center;
    }
  `, `
    varying vec2 vLens;
    void main() {
      float radius = length(vLens);
      // GLSL pow has an undefined result for a negative base, even for 2.0.
      // Multiplication keeps the inner half of the lens finite through bloom.
      float ringDistance = (radius - .82) / (.009 + uCollapse * .009);
      float haloDistance = (radius - .82) / .063;
      float ring = exp(-ringDistance * ringDistance);
      float halo = exp(-haloDistance * haloDistance) * .09;
      float angle = atan(vLens.y, vLens.x);
      float sweep = pow(max(0., .5 + .5 * cos(angle - uTime * .25 - uProgress * TAU)), 5.);
      float alpha = (ring + halo) * (.18 + sweep * .82) * uVisibility;
      alpha *= (.035 + uStrength * .75) * (1. - uBloom * .56);
      if (alpha < .001) discard;
      gl_FragColor = vec4(mix(vec3(.44, .84, .77), vec3(1., .88, .57), sweep) * (1. + uStrength), alpha);
      ${output}
    }
  `)));
  lens.name = 'Sweeping gravitational lens';

  const horizonGeometry = keep(new THREE.SphereGeometry(.735, small ? 28 : 40, small ? 18 : 24));
  const horizon = add(new THREE.Mesh(horizonGeometry, material(`
    varying vec3 vNormal, vView;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `, `
    varying vec3 vNormal, vView;
    void main() {
      float edge = pow(max(0., 1. - abs(dot(normalize(vNormal), normalize(vView)))), 5.);
      float alpha = smoothstep(.56, .98, uCollapse) * uStrength;
      vec3 color = vec3(.001, .003, .004) + vec3(.86, .53, .2) * edge * .5;
      gl_FragColor = vec4(color, alpha);
      ${output}
    }
  `, { blending: THREE.NormalBlending, side: THREE.FrontSide })));
  horizon.name = 'Transient event horizon';
  horizon.renderOrder = 2;
  horizon.visible = false;

  function update(state = empty) {
    if (disposed) return;
    const event = state.singularity || empty;
    const pointer = state.pointer || empty;
    const strength = unit(event.strength);
    const collapse = unit(event.collapse);
    const bloom = unit(event.bloom);
    uniforms.uTime.value = finite(state.time);
    uniforms.uStrength.value = strength;
    uniforms.uCollapse.value = collapse * strength;
    uniforms.uBloom.value = bloom * strength;
    uniforms.uProgress.value = unit(event.progress);
    uniforms.uHeat.value = Math.min(1, unit(state.charge) * .7 + unit(state.scatter) * .45);
    const district = state.realm === 'intelligence' || state.realm === 'industry' ? .72 : 1;
    uniforms.uVisibility.value = (state.immersive ? .95 : .48) * district;
    uniforms.uPointer.value.set(Math.max(-1, Math.min(1, finite(pointer.x))), Math.max(-1, Math.min(1, finite(pointer.y))));
    jets.visible = strength > .01 && (collapse > .1 || bloom > .01);
    horizon.visible = strength > .01 && collapse * strength > .56;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    for (const resource of resources) resource.dispose();
    group.clear();
    resources.length = 0;
  }
  return { update, dispose };
}
