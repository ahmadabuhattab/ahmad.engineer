import { createWorldLife } from './world-life.js';

// The observatory is one owned scene layer: no assets, render loop, or globals.
// Its landmarks share the camera targets used by the surrounding experience.
export function createWorldEnvironment(THREE, scene) {
  const world = new THREE.Group();
  world.name = 'Observatory world';
  scene.add(world);
  const resources = new Set();
  const keep = resource => { resources.add(resource); return resource; };
  const matrix = new THREE.Matrix4();
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const gold = new THREE.Color('#c6a575');
  const ice = new THREE.Color('#8ccbc3');
  const uniforms = {
    uTime: { value: 0 },
    uScatter: { value: 0 },
    uCharge: { value: 0 },
    uImmersive: { value: 0 },
    uRealm: { value: new THREE.Vector3(1, 0, 0) },
    uActivity: { value: new THREE.Vector3() },
    uActivityProgress: { value: 0 },
    uWarp: { value: 0 },
  };
  const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  let seed = 82341;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const surfaceVertex = `
    varying vec2 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = uv;
      vec4 localPosition = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        localPosition = instanceMatrix * localPosition;
      #endif
      vec4 worldPosition = modelMatrix * localPosition;
      vWorld = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;
  const shader = (fragmentShader, options = {}) => keep(new THREE.ShaderMaterial({
    uniforms,
    vertexShader: surfaceVertex,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    ...options,
  }));

  // Fine, anti-aliased survey lines disappear into the distance. The floor
  // carries the three destinations and responds to the core's actual burst.
  const floorMaterial = shader(`
    uniform float uTime;
    uniform float uScatter;
    uniform float uCharge;
    uniform float uImmersive;
    uniform vec3 uRealm;
    uniform vec3 uActivity;
    uniform float uActivityProgress;
    uniform float uWarp;
    varying vec3 vWorld;
    float line(float coordinate, float width) {
      float distanceToLine = abs(fract(coordinate - .5) - .5);
      return 1. - smoothstep(0., max(fwidth(coordinate) * width, .0005), distanceToLine);
    }
    float ring(float radius, float target, float width) {
      return 1. - smoothstep(width, width + max(fwidth(radius), .006), abs(radius - target));
    }
    float segment(vec2 p, vec2 a, vec2 b) {
      vec2 direction = b - a;
      float along = clamp(dot(p - a, direction) / dot(direction, direction), 0., 1.);
      return length(p - a - direction * along);
    }
    void main() {
      vec2 p = vWorld.xz;
      float radius = length(p);
      float distanceFade = 1. - smoothstep(15., 58., length(cameraPosition - vWorld));
      float edgeFade = 1. - smoothstep(27., 44., radius);
      float minorGrid = max(line(p.x * 1.25, .55), line(p.y * 1.25, .55));
      float majorGrid = max(line(p.x / 4., .85), line(p.y / 4., .85));
      vec3 teal = vec3(.11, .29, .24);
      vec3 warm = vec3(.65, .40, .16);
      vec3 color = vec3(.003, .011, .009);
      float foreground = mix(.55 + smoothstep(-5., 3., p.x) * .45, 1., uImmersive);
      color += teal * (minorGrid * .035 + majorGrid * .09) * distanceFade * foreground;
      float radialMarks = ring(radius, 3.10, .012) + ring(radius, 3.37, .008)
        + ring(radius, 6.25, .009) * .33 + ring(radius, 10., .010) * .2;
      float azimuth = atan(p.y, p.x);
      float degreeMarks = pow(max(0., cos(azimuth * 96.)), 24.)
        * smoothstep(2.97, 3.04, radius) * (1. - smoothstep(3.14, 3.23, radius));
      color += warm * (radialMarks * .40 + degreeMarks * .42);
      float energyRadius = 3.5 + uScatter * 15.;
      float shock = exp(-pow((radius - energyRadius) / (.05 + uScatter * .10), 2.));
      float echo = exp(-pow((radius - energyRadius * .82) / .025, 2.));
      color += warm * (shock + echo * .35) * uScatter * 1.1;
      float resonanceRadius = 2.8 + uActivityProgress * 20.;
      float resonanceRing = exp(-pow((radius - resonanceRadius) / .075, 2.));
      color += warm * resonanceRing * uActivity.x * 1.8;
      color += warm * exp(-radius * .24) * (uCharge * .075 + uScatter * .045);
      float sweep = pow(max(0., cos(azimuth - uTime * .075)), 80.);
      color += teal * sweep * exp(-abs(radius - 4.5) * .6) * .06;
      float mind = length(p - vec2(-8., -4.));
      float forge = length(p - vec2(8., -5.));
      float mindSignal = ring(mind, 2.33, .015) + ring(mind, 2.52, .008) * .5;
      float forgeSignal = ring(forge, 2.43, .015) + ring(forge, 2.63, .008) * .5;
      float mindPath = 1. - smoothstep(.009, .031, segment(p, vec2(-2.5, -1.2), vec2(-6.1, -3.1)));
      float forgePath = 1. - smoothstep(.009, .031, segment(p, vec2(2.6, -1.5), vec2(6., -3.8)));
      color += vec3(.20, .60, .55) * (mindSignal + mindPath * .3) * (.28 + uRealm.y * .55);
      color += warm * (forgeSignal + forgePath * .3) * (.31 + uRealm.z * .55);
      vec2 mindTravel = mix(vec2(-2.5, -1.2), vec2(-6.1, -3.1), fract(uTime * .13 + uActivityProgress * uActivity.y));
      vec2 forgeTravel = mix(vec2(2.6, -1.5), vec2(6., -3.8), fract(uTime * .12 + uActivityProgress * uActivity.z));
      color += vec3(.18, .7, .56) * exp(-length(p - mindTravel) * 9.) * (.14 + uActivity.y * 1.4);
      color += warm * exp(-length(p - forgeTravel) * 9.) * (.13 + uActivity.z * 1.3);
      color += teal * majorGrid * uWarp * .08;
      color += vec3(.014, .029, .024) * exp(-radius * .22) * (.5 + uImmersive * .5);
      gl_FragColor = vec4(color * distanceFade, edgeFade * .97);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `, { depthWrite: true });
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(90, 90)), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.2;
  floor.renderOrder = -2;
  world.add(floor);

  // Merge the stationary plinths into one draw. Geometry remains genuinely
  // three-dimensional when the camera travels between destinations.
  function mergeGeometry(parts) {
    const positions = [], normals = [], uvs = [];
    for (const { geometry, position } of parts) {
      const expanded = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      expanded.translate(...position);
      positions.push(...expanded.attributes.position.array);
      normals.push(...expanded.attributes.normal.array);
      uvs.push(...expanded.attributes.uv.array);
      expanded.dispose();
      geometry.dispose();
    }
    const geometry = keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeBoundingSphere();
    return geometry;
  }
  const plinthParts = [];
  const ringPlacements = [];
  const bases = [
    { x: 0, z: 0, radius: 2.65 },
    { x: -8, z: -4, radius: 2.03 },
    { x: 8, z: -5, radius: 2.13 },
  ];
  bases.forEach(({ x, z, radius }) => {
    [-3.125, -2.985, -2.825].forEach((y, tier) => {
      const r = radius - tier * .145;
      plinthParts.push({ geometry: new THREE.CylinderGeometry(r - .035, r, .09, 72), position: [x, y, z] });
      ringPlacements.push({ x, y: y + .045, z, radius: r - .015, tilt: -Math.PI / 2 });
    });
  });
  const plinthMaterial = keep(new THREE.MeshStandardMaterial({
    color: '#10241f', metalness: .76, roughness: .36,
    emissive: '#09211a', emissiveIntensity: .2,
  }));
  world.add(new THREE.Mesh(mergeGeometry(plinthParts), plinthMaterial));

  const etchingMaterial = shader(`
    uniform float uTime;
    uniform float uCharge;
    uniform float uScatter;
    uniform vec3 uRealm;
    varying vec3 vWorld;
    void main() {
      bool mind = vWorld.x < -4.;
      bool forge = vWorld.x > 4.;
      vec2 origin = mind ? vec2(-8., -4.) : forge ? vec2(8., -5.) : vec2(0.);
      vec2 p = vWorld.xz - origin;
      float r = length(p);
      float limit = mind ? 1.64 : forge ? 1.74 : 2.25;
      if (r > limit) discard;
      float angle = atan(p.y, p.x);
      float circles = 1. - smoothstep(.0, max(fwidth(r) * .75, .003), abs(fract(r * 2. - .5) - .5));
      float marks = pow(max(0., cos(angle * 48.)), 36.) * smoothstep(limit - .17, limit - .12, r);
      float crosshair = (1. - smoothstep(.004, .011, min(abs(p.x), abs(p.y)))) * smoothstep(.12, .2, r);
      float center = exp(-r * r * 1.7);
      float focus = mind ? uRealm.y : forge ? uRealm.z : uRealm.x;
      vec3 tint = mind ? vec3(.13, .42, .35) : vec3(.46, .28, .10);
      float energy = mind || forge ? .0 : uCharge * .23 + uScatter * .16;
      vec3 light = tint * (circles * .09 + marks * .45 + crosshair * .10 + center * (.06 + energy));
      gl_FragColor = vec4(light * (.55 + focus * .45), .78);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `, { blending: THREE.AdditiveBlending });
  const etchings = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(6, 6)), etchingMaterial, bases.length);
  bases.forEach(({ x, z }, i) => {
    transform.position.set(x, -2.778, z);
    transform.rotation.set(-Math.PI / 2, 0, 0);
    transform.scale.setScalar(1);
    transform.updateMatrix();
    etchings.setMatrixAt(i, transform.matrix);
  });
  world.add(etchings);

  const trimMaterial = keep(new THREE.MeshBasicMaterial({
    color: gold, transparent: true, opacity: .6, toneMapped: false,
  }));
  const torusGeometry = keep(new THREE.TorusGeometry(1, .0026, 5, 128));
  // The same small-section rail serves the dais, gateway, and satellite halos.
  ringPlacements.push(
    { x: 0, y: 1.35, z: -6.10, radius: 4.82, tilt: 0 },
    { x: 0, y: 1.35, z: -6.10, radius: 5.18, tilt: 0 },
    { x: 0, y: 1.35, z: -6.16, radius: 5.35, tilt: 0 },
  );
  const trim = new THREE.InstancedMesh(torusGeometry, trimMaterial, ringPlacements.length);
  ringPlacements.forEach((p, i) => {
    transform.position.set(p.x, p.y, p.z);
    transform.rotation.set(p.tilt, 0, 0);
    transform.scale.setScalar(p.radius);
    transform.updateMatrix();
    trim.setMatrixAt(i, transform.matrix);
  });
  world.add(trim);

  // An incomplete, indexed gate reads as a monumental physical instrument.
  const portal = new THREE.Group();
  portal.position.set(0, 1.35, -6.2);
  world.add(portal);
  const segmentCount = 72;
  const arc = Math.PI * 2 / segmentCount * .73;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 5.11, -arc / 2, arc / 2, false);
  shape.lineTo(Math.cos(arc / 2) * 4.91, Math.sin(arc / 2) * 4.91);
  shape.absarc(0, 0, 4.91, arc / 2, -arc / 2, true);
  shape.closePath();
  const segmentGeometry = keep(new THREE.ExtrudeGeometry(shape, {
    depth: .18, steps: 1, bevelEnabled: true, bevelThickness: .018,
    bevelSize: .018, bevelSegments: 1, curveSegments: 8,
  }));
  const portalMaterial = keep(new THREE.MeshStandardMaterial({
    color: '#768478', metalness: .83, roughness: .30,
    emissive: '#285747', emissiveIntensity: .2,
  }));
  const segments = new THREE.InstancedMesh(segmentGeometry, portalMaterial, segmentCount);
  for (let i = 0; i < segmentCount; i++) {
    matrix.makeRotationZ(i * Math.PI * 2 / segmentCount);
    segments.setMatrixAt(i, matrix);
    segments.setColorAt(i, color.set(i % 9 === 0 ? '#c7a77c' : i % 3 === 0 ? '#91b4a6' : '#718477'));
  }
  portal.add(segments);

  const portalMarks = [];
  for (let i = 0; i < 144; i++) {
    const angle = i / 144 * Math.PI * 2;
    const start = i % 12 === 0 ? 5.40 : 5.39;
    const end = start + (i % 12 === 0 ? .22 : i % 3 === 0 ? .09 : .035);
    portalMarks.push(Math.cos(angle) * start, Math.sin(angle) * start, 0,
      Math.cos(angle) * end, Math.sin(angle) * end, 0);
  }
  const portalMarkGeometry = keep(new THREE.BufferGeometry());
  portalMarkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(portalMarks, 3));
  const portalMarkMaterial = keep(new THREE.LineBasicMaterial({ color: '#a6c7b5', transparent: true, opacity: .37 }));
  portal.add(new THREE.LineSegments(portalMarkGeometry, portalMarkMaterial));

  const veilMaterial = shader(`
    uniform float uTime;
    uniform float uScatter;
    uniform float uCharge;
    uniform vec3 uActivity;
    varying vec2 vUv;
    void main() {
      vec2 p = (vUv - .5) * 2.;
      float r = length(p);
      float edge = exp(-pow((r - .825) / .022, 2.));
      float inner = exp(-pow((r - .79) / .055, 2.));
      float a = atan(p.y, p.x);
      float streaks = pow(.5 + .5 * sin(a * 18. + sin(a * 7. - uTime * .06)), 8.);
      float wisps = streaks * exp(-pow((r - .72) / .14, 2.));
      float center = exp(-dot(p * vec2(1.0, 1.4), p * vec2(1.0, 1.4)) * 3.7);
      vec3 color = vec3(.06, .19, .15) * (inner * .15 + wisps * .07 + center * .025);
      color += vec3(.45, .63, .48) * edge * (.26 + uCharge * .3 + uScatter * .16 + uActivity.x * .45);
      gl_FragColor = vec4(color, min(1., edge * .6 + inner * .3 + wisps * .12 + center * .2));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `, { blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const veil = new THREE.Mesh(keep(new THREE.PlaneGeometry(12, 12)), veilMaterial);
  veil.position.z = -.12;
  portal.add(veil);

  // Dark architecture uses its own distance haze; no shared scene fog is changed.
  const architectureMaterial = keep(new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vColor;
      void main() {
        vUv = uv;
        vec4 p = vec4(position, 1.);
        vec3 n = normal;
        vColor = vec3(1.);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          n = mat3(instanceMatrix) * n;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #endif
        vWorld = (modelMatrix * p).xyz;
        vNormal = normalize(mat3(modelMatrix) * n);
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.);
      }
    `,
    fragmentShader: `
      uniform float uCharge;
      uniform float uScatter;
      uniform float uImmersive;
      uniform vec3 uRealm;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec3 vColor;
      void main() {
        float depth = length(cameraPosition - vWorld);
        float backdrop = smoothstep(10., 14., -vWorld.z);
        float haze = 1. - exp(-depth * depth * mix(.00012, .0015, backdrop));
        haze = clamp(haze + backdrop * (1. - smoothstep(-3.2, 4., vWorld.y)) * .16, 0., .98);
        float key = max(0., dot(normalize(vNormal), normalize(vec3(-.4, .8, .9))));
        float rim = pow(1. - abs(dot(normalize(vNormal), normalize(cameraPosition - vWorld))), 3.);
        float forge = exp(-length(vWorld.xz - vec2(8., -5.)) * .28);
        vec3 shade = vColor * (.07 + key * .37) + vec3(.028, .07, .06) * rim;
        float edgeDistance = min(min(vUv.x, 1. - vUv.x), min(vUv.y, 1. - vUv.y));
        float machining = 1. - smoothstep(.0, .015, edgeDistance);
        shade += vec3(.035, .080, .059) * machining * (.22 + key * .2);
        shade += vec3(.12, .07, .02) * forge * (uRealm.z * .22 + uCharge * .1 + uScatter * .08);
        // Fog recedes toward the site's dark emerald, instead of making the
        // furthest architecture brighter than the foreground landmarks.
        shade = mix(shade, vec3(.004, .013, .009), haze);
        float copySide = 1. - smoothstep(-8., 2., vWorld.x);
        float presence = 1. - backdrop * (.52 + haze * .20);
        presence *= 1. - backdrop * copySide * (1. - uImmersive) * .60;
        gl_FragColor = vec4(shade, presence);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: true,
  }));
  const architecture = [];
  const facadeLights = [];
  function building(x, z, width, height, depth, tint, windows = true) {
    architecture.push({ x, y: -3.19 + height / 2, z, width, height, depth, tint });
    if (!windows) return;
    const floors = Math.floor(height / .72);
    for (let level = 1; level < floors; level++) {
      for (let column = 0; column < 2; column++) {
        if (random() > .64) continue;
        facadeLights.push({ x: x + (column ? .23 : -.23) * width,
          y: -3.1 + level * .72, z: z + depth / 2 + .006,
          height: random() > .85 ? .28 : .095, tint: random() > .3 ? '#427b68' : '#b99a60' });
      }
    }
  }
  const silhouettes = [5.8, 8.7, 6.2, 11.2, 7.4, 9.1, 5.3, 7.9];
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 8; i++) {
      building(side * (6.8 + i * 2.85), -14.5 - (i % 3) * 2.1,
        .75 + (i % 3) * .24, silhouettes[(i + (side + 1)) % silhouettes.length], 1.10 + (i % 2) * .45, '#24473b');
    }
    for (let i = 0; i < 10; i++) {
      building(side * (4.4 + i * 3.85), -29.5 - (i % 4) * 2.5,
        1.1 + (i % 3) * .35, 8. + silhouettes[(i + 3) % silhouettes.length] * .85, 1.9, '#183d31');
    }
  }

  // The industry landmark is a compact architectural machine, with staggered
  // towers, open gantries, cooling stacks, and a suspended amber energy column.
  const forgeBuildings = [
    [-1.12, -.55, .58, 3.55, .65], [.12, -.55, .73, 4.8, .67],
    [1.02, .24, .60, 3.2, .74], [-.65, .8, .86, 1.15, .8],
    [.40, .82, .72, 1.42, .55], [-1.0, .25, .32, 2.38, .34],
  ];
  for (const [x, z, w, h, d] of forgeBuildings) building(8 + x, -5 + z, w, h, d, '#416051', false);
  for (const y of [-1.50, -.75, .02, .80]) {
    architecture.push({ x: 8.12, y, z: -5.55, width: .9, height: .09, depth: .82, tint: '#8c886b' });
  }
  for (const x of [6.78, 9.22]) {
    architecture.push({ x, y: -1.23, z: -4.35, width: .10, height: 3.8, depth: .10, tint: '#56796a' });
  }
  architecture.push({ x: 8, y: .66, z: -4.35, width: 2.54, height: .16, depth: .15, tint: '#658373' });
  const boxGeometry = keep(new THREE.BoxGeometry(1, 1, 1));
  const monoliths = new THREE.InstancedMesh(boxGeometry, architectureMaterial, architecture.length);
  architecture.forEach((p, i) => {
    transform.position.set(p.x, p.y, p.z);
    transform.rotation.set(0, 0, 0);
    transform.scale.set(p.width, p.height, p.depth);
    transform.updateMatrix();
    monoliths.setMatrixAt(i, transform.matrix);
    monoliths.setColorAt(i, color.set(p.tint));
  });
  world.add(monoliths);

  const windowMaterial = keep(new THREE.ShaderMaterial({
    uniforms,
    vertexShader: architectureMaterial.vertexShader,
    fragmentShader: `
      uniform float uImmersive;
      varying vec3 vWorld;
      varying vec3 vColor;
      void main() {
        float depthFade = 1. - smoothstep(18., 75., length(cameraPosition - vWorld));
        float copySide = 1. - smoothstep(-8., 2., vWorld.x);
        float heroFade = 1. - (1. - uImmersive) * (.22 + copySide * .55);
        gl_FragColor = vec4(vColor, depthFade * heroFade * .54);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false,
  }));
  const windows = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(1, 1)), windowMaterial, facadeLights.length);
  windows.renderOrder = 1;
  facadeLights.forEach((p, i) => {
    transform.position.set(p.x, p.y, p.z);
    transform.rotation.set(0, 0, 0);
    transform.scale.set(.07, p.height, 1);
    transform.updateMatrix();
    windows.setMatrixAt(i, transform.matrix);
    windows.setColorAt(i, color.set(p.tint));
  });
  world.add(windows);

  const forge = new THREE.Group();
  forge.position.set(8, 0, -5);
  world.add(forge);
  const forgeMetal = keep(new THREE.MeshStandardMaterial({
    color: '#768879', metalness: .77, roughness: .32,
    emissive: '#684020', emissiveIntensity: .12,
  }));
  const stacks = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(.13, .16, 1, 12)), forgeMetal, 4);
  [[-.6, -.88, -.72, 3.65], [.80, -1.18, -.87, 3.08], [-1.48, -1.30, -.12, 2.82], [1.37, -1.6, .43, 2.18]].forEach(([x, y, z, h], i) => {
    transform.position.set(x, y, z);
    transform.scale.set(1, h, 1);
    transform.rotation.set(0, 0, 0);
    transform.updateMatrix();
    stacks.setMatrixAt(i, transform.matrix);
  });
  forge.add(stacks);
  const forgeLines = [];
  const addLine = (points, a, b) => points.push(...a, ...b);
  for (const x of [-1.22, 1.22]) {
    for (let i = 0; i < 5; i++) {
      const y = -2.7 + i * .62;
      addLine(forgeLines, [x - .10, y, .64], [x + .10, y + .55, .64]);
      addLine(forgeLines, [x + .10, y, .64], [x - .10, y + .55, .64]);
    }
  }
  for (const y of [-1.5, -.75, 0, .75]) addLine(forgeLines, [-.3, y, -.18], [.55, y, -.18]);
  for (const [x, z, w, h, d] of forgeBuildings) {
    const face = z + d / 2 + .008;
    const low = -3.19, high = low + h;
    addLine(forgeLines, [x - w / 2, low + .14, face], [x - w / 2, high, face]);
    addLine(forgeLines, [x - w / 2, high, face], [x + w / 2, high, face]);
    for (let y = low + .34; y < high - .20; y += .34) {
      addLine(forgeLines, [x - w * .29, y, face], [x + w * .29, y, face]);
    }
  }
  addLine(forgeLines, [-1.22, .65, .64], [-1.22, .93, -.7]);
  addLine(forgeLines, [1.22, .65, .64], [1.22, .93, -.7]);
  addLine(forgeLines, [-1.22, .93, -.7], [1.22, .93, -.7]);
  const forgeLineGeometry = keep(new THREE.BufferGeometry());
  forgeLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(forgeLines, 3));
  const forgeLineMaterial = keep(new THREE.LineBasicMaterial({ color: '#d5b581', transparent: true, opacity: .65 }));
  forge.add(new THREE.LineSegments(forgeLineGeometry, forgeLineMaterial));
  const pipeRoutes = [
    [[-1.36, -2.75, .25], [-1.36, -1.8, .25], [-.82, -1.48, .60], [-.22, -1.48, .60]],
    [[1.32, -2.75, -.55], [1.32, -.65, -.55], [.82, -.35, -.22], [.35, -.35, -.22]],
    [[-.59, .78, -.70], [-.59, 1.18, -.70], [.03, 1.45, -.55], [.13, .94, -.24]],
    [[-.88, -2.7, 1.05], [-.88, -2.1, 1.05], [.45, -1.98, .95], [.72, -2.55, .95]],
  ];
  const pipes = pipeRoutes.map(points => ({
    geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 24, .052, 7, false),
    position: [0, 0, 0],
  }));
  forge.add(new THREE.Mesh(mergeGeometry(pipes), forgeMetal));
  const forgeGlowMaterial = shader(`
    uniform float uTime;
    uniform float uCharge;
    uniform vec3 uRealm;
    uniform vec3 uActivity;
    uniform float uActivityProgress;
    varying vec2 vUv;
    void main() {
      float ends = smoothstep(0., .18, vUv.y) * (1. - smoothstep(.85, 1., vUv.y));
      float bars = pow(max(0., cos(vUv.x * 6.283185 * 12.)), 20.);
      float scan = pow(max(0., sin(vUv.y * 26. - uTime * 1.4 - uActivityProgress * uActivity.z * 22.)), 18.);
      float illumination = (.22 + bars * .5 + scan * .55) * ends;
      vec3 color = vec3(.94, .42, .09) * (.40 + uRealm.z * .42 + uCharge * .15 + uActivity.z * .95);
      gl_FragColor = vec4(color, illumination * (.48 + uActivity.z * .35));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `, { blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true });
  const forgeColumn = new THREE.Mesh(keep(new THREE.CylinderGeometry(.33, .33, 2.48, 32, 1, true)), forgeGlowMaterial);
  forgeColumn.position.set(.08, -1.16, .30);
  forge.add(forgeColumn);

  // Intelligence is a rotating, connected crystal rather than loose particles.
  // Its 42 nodes and 120 edges all derive from the same geodesic structure.
  const mind = new THREE.Group();
  mind.position.set(-8, -.02, -4);
  world.add(mind);
  const lattice = new THREE.IcosahedronGeometry(1.79, 1);
  const vertices = lattice.attributes.position.array;
  const nodes = [];
  const nodeIndex = new Map();
  const edges = new Set();
  for (let i = 0; i < vertices.length; i += 9) {
    const triangle = [];
    for (let j = 0; j < 3; j++) {
      const offset = i + j * 3;
      const vertex = [vertices[offset], vertices[offset + 1], vertices[offset + 2]];
      const key = vertex.map(value => value.toFixed(4)).join(',');
      if (!nodeIndex.has(key)) { nodeIndex.set(key, nodes.length); nodes.push(vertex); }
      triangle.push(nodeIndex.get(key));
    }
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      edges.add(a < b ? `${a}/${b}` : `${b}/${a}`);
    }
  }
  lattice.dispose();
  const mindLinePositions = [];
  for (const edge of edges) {
    const [a, b] = edge.split('/').map(Number);
    mindLinePositions.push(...nodes[a], ...nodes[b]);
  }
  const mindLineGeometry = keep(new THREE.BufferGeometry());
  mindLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(mindLinePositions, 3));
  const mindLineMaterial = keep(new THREE.LineBasicMaterial({ color: '#94d9ce', transparent: true, opacity: .37 }));
  mind.add(new THREE.LineSegments(mindLineGeometry, mindLineMaterial));
  const mindNodeMaterial = keep(new THREE.MeshBasicMaterial({ color: '#c8ede1', toneMapped: false }));
  const nodeGeometry = keep(new THREE.IcosahedronGeometry(.065, 0));
  const nodeMeshes = new THREE.InstancedMesh(nodeGeometry, mindNodeMaterial, nodes.length);
  nodes.forEach((p, i) => {
    transform.position.set(...p);
    transform.scale.setScalar(i % 5 === 0 ? 1.5 : .72);
    transform.rotation.set(0, 0, 0);
    transform.updateMatrix();
    nodeMeshes.setMatrixAt(i, transform.matrix);
    nodeMeshes.setColorAt(i, color.copy(i % 7 === 0 ? gold : ice));
  });
  mind.add(nodeMeshes);
  const mindCoreMaterial = keep(new THREE.MeshStandardMaterial({
    color: '#679982', metalness: .72, roughness: .16,
    emissive: '#205f4b', emissiveIntensity: .45,
    flatShading: true,
  }));
  const mindCore = new THREE.Mesh(keep(new THREE.OctahedronGeometry(.73, 0)), mindCoreMaterial);
  mindCore.scale.y = 1.45;
  mind.add(mindCore);
  const cageSource = new THREE.OctahedronGeometry(.92, 0);
  const mindCage = new THREE.LineSegments(keep(new THREE.EdgesGeometry(cageSource)),
    keep(new THREE.LineBasicMaterial({ color: '#c2d6b0', transparent: true, opacity: .48 })));
  cageSource.dispose();
  mindCage.scale.y = 1.45;
  mind.add(mindCage);
  const mindHalo = new THREE.Mesh(keep(new THREE.TorusGeometry(2.05, .007, 5, 112)),
    keep(new THREE.MeshBasicMaterial({ color: '#78b7aa', transparent: true, opacity: .52, toneMapped: false })));
  mindHalo.rotation.x = 1.15;
  mindHalo.rotation.y = .25;
  mind.add(mindHalo);

  // Hand-placed atmosphere, far behind the architecture. The few-octave field
  // is evaluated on one surface and never needs a postprocessing framebuffer.
  const skyMaterial = shader(`
    uniform float uTime;
    uniform float uImmersive;
    uniform vec3 uActivity;
    uniform float uWarp;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
    }
    void main() {
      vec2 p = vUv;
      float drift = uTime * .001;
      vec2 current = vec2(noise(p * 5. + drift), noise(p * 6. - drift + 17.));
      float field = noise(p * 8. + current * 1.1 + drift) * .63 + noise(p * 19. + current * .8 - drift) * .27 + noise(p * 41.) * .10;
      float band = exp(-pow((p.y - .40 - p.x * .13 + field * .10) / .105, 2.));
      float filament = pow(1. - abs(sin(field * 13. + p.x * 5. - p.y * 8.)), 12.) * band;
      float glow = exp(-dot((p - vec2(.51, .40)) * vec2(3.1, 4.5), (p - vec2(.51, .40)) * vec2(3.1, 4.5)));
      float edge = smoothstep(0., .13, p.x) * (1. - smoothstep(.84, 1., p.x))
        * smoothstep(0., .12, p.y) * (1. - smoothstep(.80, 1., p.y));
      vec3 color = vec3(.018, .061, .045) * (band * field + glow * .30);
      color += vec3(.035, .035, .018) * band * pow(field, 3.);
      color += vec3(.015, .047, .031) * filament * (.34 + uWarp * .25);
      color += vec3(.014, .030, .016) * glow * (uActivity.x * .4 + uActivity.y * .25 + uActivity.z * .2);
      gl_FragColor = vec4(color * (.70 + uImmersive * .30), edge * .77);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `);
  const sky = new THREE.Mesh(keep(new THREE.PlaneGeometry(130, 72)), skyMaterial);
  sky.position.set(0, 20, -62);
  sky.renderOrder = -10;
  world.add(sky);

  const starPositions = [], starSizes = [], starPhases = [], starColors = [];
  for (let i = 0; i < 540; i++) {
    starPositions.push((random() - .5) * 116, 2.5 + Math.pow(random(), .82) * 42, -16 - random() * 48);
    starSizes.push(.48 + Math.pow(random(), 3) * 1.45);
    starPhases.push(random() * Math.PI * 2);
    color.set(random() > .26 ? '#92baa7' : '#dac096');
    starColors.push(color.r, color.g, color.b);
  }
  const starGeometry = keep(new THREE.BufferGeometry());
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(starSizes, 1));
  starGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(starPhases, 1));
  starGeometry.setAttribute('aColor', new THREE.Float32BufferAttribute(starColors, 3));
  const starMaterial = keep(new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * p;
        gl_PointSize = clamp(aSize * (1. + 32. / max(1., -p.z)), .6, 4.);
        vColor = aColor;
        vAlpha = .24 + .14 * sin(uTime * .17 + aPhase);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - .5) * 2.;
        float alpha = (1. - smoothstep(.05, 1., d)) * vAlpha;
        gl_FragColor = vec4(vColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  world.add(new THREE.Points(starGeometry, starMaterial));

  const life = createWorldLife(THREE, world, uniforms, { mind, nodes, edges, forge });

  let disposed = false;
  let previousTime = 0;
  const targetRealm = new THREE.Vector3();
  function update({ time = 0, scatter = 0, charge = 0, realm = 'energy', immersive = false, activity = null, warp = 0, collapse = 0, bloom = 0 } = {}) {
    if (disposed) return;
    const clock = Number.isFinite(time) ? Math.max(0, time) : 0;
    world.scale.setScalar(1 - clamp(collapse) * .83 + clamp(bloom) * .05);
    world.rotation.y = clamp(collapse) * .38;
    const dt = Math.min(.1, Math.max(1 / 120, clock - previousTime));
    previousTime = clock;
    const ease = 1 - Math.exp(-dt * 5);
    uniforms.uTime.value = clock;
    uniforms.uScatter.value = clamp(scatter);
    uniforms.uCharge.value = clamp(charge);
    const strength = clamp(activity?.strength);
    uniforms.uActivity.value.set(activity?.kind === 'resonance' ? strength : 0,
      activity?.kind === 'signal' ? strength : 0, activity?.kind === 'forge' ? strength : 0);
    uniforms.uActivityProgress.value = clamp(activity?.progress);
    uniforms.uWarp.value = clamp(warp);
    const immersion = typeof immersive === 'number' ? clamp(immersive) : immersive ? 1 : 0;
    uniforms.uImmersive.value += (immersion - uniforms.uImmersive.value) * ease;
    targetRealm.set(realm === 'energy' ? 1 : .18, realm === 'intelligence' ? 1 : .12, realm === 'industry' ? 1 : .12);
    uniforms.uRealm.value.lerp(targetRealm, ease);
    mind.rotation.y = clock * .065;
    portal.rotation.z = clock * .024;
    mind.rotation.z = Math.sin(clock * .09) * .055;
    mindCore.rotation.y = -clock * .14;
    mindCage.rotation.y = clock * .06 + .35;
    mindLineMaterial.opacity = .24 + uniforms.uRealm.value.y * .24;
    mindCoreMaterial.emissiveIntensity = .45 + uniforms.uRealm.value.y * .55 + uniforms.uActivity.value.y * 1.2;
    forgeLineMaterial.opacity = .42 + uniforms.uRealm.value.z * .3 + uniforms.uActivity.value.z * .2;
    forgeMetal.emissiveIntensity = .08 + uniforms.uRealm.value.z * .18 + uniforms.uActivity.value.z * .65;
    portalMaterial.emissiveIntensity = .16 + uniforms.uCharge.value * .5 + uniforms.uScatter.value * .28 + uniforms.uActivity.value.x * .65;
    portalMarkMaterial.opacity = .30 + uniforms.uCharge.value * .28 + uniforms.uActivity.value.x * .35;
    trimMaterial.opacity = .48 + uniforms.uCharge.value * .2 + uniforms.uActivity.value.x * .15;
    life.update(clock);
  }

  update();
  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      life.dispose();
      world.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      world.removeFromParent();
      for (const resource of resources) resource.dispose();
      resources.clear();
      world.clear();
    },
  };
}
