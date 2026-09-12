// Secondary systems share the observatory clock. Nothing here owns a timer,
// texture, network request, or camera; every position can be reconstructed.
export function createWorldLife(THREE, world, uniforms, { mind, nodes, edges, forge }) {
  const layer = new THREE.Group();
  layer.name = 'Living observatory systems';
  world.add(layer);
  const resources = new Set();
  const keep = resource => { resources.add(resource); return resource; };
  const pose = new THREE.Object3D();
  const point = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  const color = new THREE.Color();
  let seed = 42783;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const tau = Math.PI * 2;

  function merge(parts) {
    const positions = [], normals = [], uv = [];
    for (const { geometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } of parts) {
      const expanded = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      expanded.rotateX(rx); expanded.rotateY(ry); expanded.rotateZ(rz); expanded.translate(x, y, z);
      positions.push(...expanded.attributes.position.array);
      normals.push(...expanded.attributes.normal.array);
      uv.push(...expanded.attributes.uv.array);
      expanded.dispose(); geometry.dispose();
    }
    const result = keep(new THREE.BufferGeometry());
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    result.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    result.computeBoundingSphere();
    return result;
  }

  // A fractured architectural belt sits behind the destinations. Its orderly
  // arc and slow suspension make it read as part of the place, not confetti.
  const fragments = Array.from({ length: 20 }, (_, i) => {
    const angle = -.12 - i / 19 * (Math.PI - .24);
    const radius = 11.3 + random() * 4.3;
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius - 3.5,
      y: 2.1 + random() * 4.2, angle, phase: random() * tau,
      width: .4 + random() * .95, depth: .4 + random() * .65, height: .28 + random() * .62 };
  });
  const fragmentGeometry = keep(new THREE.DodecahedronGeometry(1, 0));
  const fragmentMaterial = keep(new THREE.MeshStandardMaterial({
    color: '#363636', metalness: .74, roughness: .4,
    emissive: '#1e1e1e', emissiveIntensity: .1, flatShading: true,
  }));
  const stone = new THREE.InstancedMesh(fragmentGeometry, fragmentMaterial, fragments.length);
  const stoneEdges = new THREE.InstancedMesh(fragmentGeometry,
    keep(new THREE.MeshBasicMaterial({ color: '#b2b2b2', wireframe: true, transparent: true, opacity: .025 })), fragments.length);
  stone.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Both surfaces use identical poses, including during transit.
  stoneEdges.instanceMatrix = stone.instanceMatrix;
  stone.frustumCulled = stoneEdges.frustumCulled = false;
  layer.add(stone, stoneEdges);

  // The service vehicles have physical wings, a sensor barrel, and twin ring
  // drives. One instanced draw handles airborne scouts and portal carriages.
  const serviceGeometry = merge([
    { geometry: new THREE.OctahedronGeometry(.19, 0), ry: Math.PI / 4 },
    { geometry: new THREE.BoxGeometry(.62, .045, .16), z: -.025 },
    { geometry: new THREE.CylinderGeometry(.065, .08, .24, 10), rx: Math.PI / 2, z: .12 },
    { geometry: new THREE.TorusGeometry(.105, .021, 5, 16), x: -.23, rx: Math.PI / 2 },
    { geometry: new THREE.TorusGeometry(.105, .021, 5, 16), x: .23, rx: Math.PI / 2 },
  ]);
  const serviceMaterial = keep(new THREE.MeshStandardMaterial({
    color: '#a1a1a1', metalness: .92, roughness: .2,
    emissive: '#343434', emissiveIntensity: .32,
  }));
  const scoutCount = 5, carriageCount = 8;
  const vehicles = new THREE.InstancedMesh(serviceGeometry, serviceMaterial, scoutCount + carriageCount);
  vehicles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  vehicles.frustumCulled = false;
  layer.add(vehicles);

  // Each scout surveys a different connected system. Sampling the same curve
  // in the past draws a trail without accumulating frame-dependent history.
  function scoutPosition(index, time, target) {
    const a = time * (.065 + index * .007) + index * 1.41;
    if (index === 0) return target.set(Math.cos(a) * 6.6, 1.4 + Math.sin(a * 1.8) * .9, -3. + Math.sin(a) * 4.4);
    if (index === 1) return target.set(-8 + Math.cos(a) * 3.0, 2.35 + Math.sin(a * 1.6) * .6, -4 + Math.sin(a) * 2.5);
    if (index === 2) return target.set(8 + Math.cos(a) * 3.2, 3.1 + Math.sin(a * 1.7) * .45, -5 + Math.sin(a) * 2.6);
    if (index === 3) return target.set(Math.cos(a) * 10.5, 4.55 + Math.sin(a * 1.3) * 1.1, -8 + Math.sin(a) * 3.0);
    return target.set(Math.cos(a) * 8.3, -.9 + Math.sin(a * 2.1) * .48, -5 + Math.sin(a) * 5.1);
  }
  const trailSegments = 42;
  const trailPositions = new Float32Array(scoutCount * trailSegments * 2 * 3);
  const trailAges = [], trailColors = [];
  for (let scout = 0; scout < scoutCount; scout++) {
    color.set(scout === 2 ? '#bcbcbc' : '#c9c9c9');
    for (let i = 0; i < trailSegments; i++) {
      for (const end of [0, 1]) {
        trailAges.push((i + end) / trailSegments);
        trailColors.push(color.r, color.g, color.b);
      }
    }
  }
  const trailGeometry = keep(new THREE.BufferGeometry());
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setAttribute('aAge', new THREE.Float32BufferAttribute(trailAges, 1));
  trailGeometry.setAttribute('aColor', new THREE.Float32BufferAttribute(trailColors, 3));
  const trailMaterial = keep(new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute float aAge; attribute vec3 aColor;
      varying float vAge; varying vec3 vColor;
      void main() {
        vAge = aAge; vColor = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      uniform float uImmersive; uniform float uWarp;
      varying float vAge; varying vec3 vColor;
      void main() {
        float alpha = pow(1. - vAge, 2.0) * (.35 + uImmersive * .38 + uWarp * .22);
        gl_FragColor = vec4(vColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const trails = new THREE.LineSegments(trailGeometry, trailMaterial);
  trails.frustumCulled = false;
  layer.add(trails);

  // Textureless sensor lights provide the bright core and soft optical halo.
  const beaconPositions = new Float32Array((scoutCount + carriageCount) * 3);
  const beaconGeometry = keep(new THREE.BufferGeometry());
  beaconGeometry.setAttribute('position', new THREE.BufferAttribute(beaconPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const beaconColors = [], beaconSizes = [];
  for (let i = 0; i < scoutCount + carriageCount; i++) {
    color.set(i === 2 || i >= scoutCount ? '#dddddd' : '#e8e8e8');
    beaconColors.push(color.r, color.g, color.b);
    beaconSizes.push(i < scoutCount ? 1.0 : .65);
  }
  beaconGeometry.setAttribute('aColor', new THREE.Float32BufferAttribute(beaconColors, 3));
  beaconGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(beaconSizes, 1));
  const beaconMaterial = keep(new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute vec3 aColor; attribute float aSize;
      varying vec3 vColor;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.);
        vColor = aColor;
        gl_Position = projectionMatrix * p;
        gl_PointSize = clamp(aSize * 235. / max(1., -p.z), 3., 42.);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.;
        float glow = exp(-r * r * 5.5) * .28 + exp(-r * r * 85.);
        gl_FragColor = vec4(vColor, glow * (1. - smoothstep(.65, 1., r)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const beacons = new THREE.Points(beaconGeometry, beaconMaterial);
  beacons.frustumCulled = false;
  layer.add(beacons);

  // Packets follow actual neural edges and inherit the crystal's rotation.
  const starts = [], ends = [], phases = [];
  const connections = [...edges];
  for (let i = 0; i < connections.length; i++) {
    if (i % 2) continue;
    const [a, b] = connections[i].split('/').map(Number);
    starts.push(...nodes[a]); ends.push(...nodes[b]); phases.push(random());
  }
  const packetGeometry = keep(new THREE.BufferGeometry());
  packetGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starts, 3));
  packetGeometry.setAttribute('aEnd', new THREE.Float32BufferAttribute(ends, 3));
  packetGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  const packetMaterial = keep(new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime; uniform vec3 uActivity; uniform float uActivityProgress;
      attribute vec3 aEnd; attribute float aPhase;
      varying float vStrength;
      void main() {
        float cycle = fract(uTime * .28 + aPhase + uActivityProgress * 3. * step(.00001, uActivity.y));
        vec3 local = mix(position, aEnd, cycle);
        vec4 p = modelViewMatrix * vec4(local, 1.);
        gl_Position = projectionMatrix * p;
        gl_PointSize = clamp((.55 + uActivity.y * .45) * 135. / max(1., -p.z), 2., 24.);
        vStrength = (.36 + uActivity.y * .64) * (.65 + sin(cycle * 3.14159) * .35);
      }
    `,
    fragmentShader: `
      varying float vStrength;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.;
        float halo = exp(-r * r * 7.) * .42 + exp(-r * r * 48.);
        gl_FragColor = vec4(vec3(.78), halo * vStrength * (1. - smoothstep(.7, 1., r)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const packets = new THREE.Points(packetGeometry, packetMaterial);
  packets.frustumCulled = false;
  mind.add(packets);

  // A working line in front of the forge: rollers, support rails, and a train
  // of hot slabs. Its motion and furnace light accelerate during ignition.
  const conveyorParts = [
    { geometry: new THREE.BoxGeometry(2.7, .065, .07), y: -2.62, z: 1.38 },
    { geometry: new THREE.BoxGeometry(2.7, .065, .07), y: -2.62, z: 1.85 },
  ];
  for (let i = 0; i < 15; i++) conveyorParts.push({
    geometry: new THREE.CylinderGeometry(.055, .055, .50, 10),
    x: -1.24 + i * .177, y: -2.59, z: 1.615, rx: Math.PI / 2,
  });
  for (const x of [-1.08, 1.08]) conveyorParts.push({
    geometry: new THREE.BoxGeometry(.085, .24, .54), x, y: -2.76, z: 1.615,
  });
  const conveyorMaterial = keep(new THREE.MeshStandardMaterial({ color: '#808080', metalness: .9, roughness: .24 }));
  const conveyor = new THREE.Mesh(merge(conveyorParts), conveyorMaterial);
  forge.add(conveyor);
  const slabMaterial = keep(new THREE.MeshStandardMaterial({
    color: '#666666', roughness: .31, metalness: .78,
    emissive: '#8f8f8f', emissiveIntensity: .65,
  }));
  const hotSlabs = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(.29, .055, .34)), slabMaterial, 5);
  hotSlabs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  hotSlabs.frustumCulled = false;
  forge.add(hotSlabs);
  const furnaceLight = new THREE.PointLight('#ffffff', 1.5, 7, 2);
  furnaceLight.position.set(.08, -1.4, 1.25);
  forge.add(furnaceLight);

  // Steam is emitted from the actual cooling-stack outlets. Furnace embers
  // share the draw, with a separate ballistic trajectory and shorter lifetime.
  const origins = [], particleTypes = [], particleSeeds = [], particlePhases = [];
  for (let i = 0; i < 150; i++) {
    const steam = i < 92;
    origins.push(...(steam ? i % 2 ? [-.60, .95, -.72] : [.80, .36, -.87] : [.08, -1.7, .62]));
    particleTypes.push(steam ? 0 : 1);
    particleSeeds.push(random()); particlePhases.push(random());
  }
  const plumeGeometry = keep(new THREE.BufferGeometry());
  plumeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(origins, 3));
  plumeGeometry.setAttribute('aType', new THREE.Float32BufferAttribute(particleTypes, 1));
  plumeGeometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(particleSeeds, 1));
  plumeGeometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(particlePhases, 1));
  const plumeMaterial = keep(new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime; uniform vec3 uActivity;
      attribute float aType; attribute float aSeed; attribute float aPhase;
      varying float vLife; varying float vType; varying float vStrength;
      void main() {
        float power = uActivity.z;
        float life = fract(uTime * (aType < .5 ? .115 : .37) + aPhase);
        vec3 local = position;
        if (aType < .5) {
          local.y += life * (2.2 + power * .85);
          local.x += sin(aSeed * 25. + uTime * .18) * life * .38 + life * .40;
          local.z += cos(aSeed * 19. + uTime * .1) * life * .29;
        } else {
          float angle = aSeed * 62.83;
          local.x += cos(angle) * life * (.5 + power * .95);
          local.z += sin(angle) * life * (.38 + power * .65);
          local.y += life * (2.3 + power * 2.0) - life * life * 3.0;
        }
        vec4 p = modelViewMatrix * vec4(local, 1.);
        gl_Position = projectionMatrix * p;
        float size = aType < .5 ? (.19 + life * .92) * 295. : 27. + aSeed * 17.;
        gl_PointSize = clamp(size / max(1., -p.z), 1., 64.);
        vLife = life; vType = aType;
        vStrength = aType < .5 ? .037 + power * .028 : (.07 + power * .85) * step(aSeed, .22 + power * .78);
      }
    `,
    fragmentShader: `
      varying float vLife; varying float vType; varying float vStrength;
      void main() {
        float r = length(gl_PointCoord - .5) * 2.;
        float shape = pow(max(0., 1. - r * r), vType < .5 ? 2.7 : 1.6);
        float envelope = sin(vLife * 3.14159);
        vec3 tint = vType < .5 ? vec3(.49) : vec3(.70);
        gl_FragColor = vec4(tint, shape * envelope * vStrength);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const plumes = new THREE.Points(plumeGeometry, plumeMaterial);
  plumes.frustumCulled = false;
  forge.add(plumes);

  // Soft billboard auras are rendered at real landmark depths. This gives the
  // effects an optical shoulder without a bloom pass or full-screen wash.
  const auraGeometry = keep(new THREE.PlaneGeometry(1, 1));
  auraGeometry.setAttribute('aRealm', new THREE.InstancedBufferAttribute(new Float32Array([0, 1, 2]), 1));
  const auraMaterial = keep(new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute float aRealm;
      varying vec2 vUv; varying float vRealm;
      void main() {
        vUv = uv; vRealm = aRealm;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
        center.xy += position.xy * vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: `
      uniform vec3 uActivity; uniform float uCharge; uniform float uScatter;
      varying vec2 vUv; varying float vRealm;
      void main() {
        vec2 p = (vUv - .5) * 2.;
        float r = length(p);
        float selected = vRealm < .5 ? uActivity.x : vRealm < 1.5 ? uActivity.y : uActivity.z;
        vec3 tint = vRealm < .5 ? vec3(.34) : vRealm < 1.5 ? vec3(.29) : vec3(.31);
        float corePower = vRealm < .5 ? uCharge * .09 + uScatter * .055 : 0.;
        float field = exp(-r * r * 4.4) * (.026 + selected * .16 + corePower);
        field += exp(-r * r * 24.) * selected * .04;
        gl_FragColor = vec4(tint, field * (1. - smoothstep(.7, 1., r)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  const auras = new THREE.InstancedMesh(auraGeometry, auraMaterial, 3);
  [[0, 0, -.18, 7.4, 7.4], [-8, -.02, -4.12, 6.2, 6.2], [8.1, -1.05, -4.8, 5., 6.4]].forEach(([x, y, z, w, h], i) => {
    pose.position.set(x, y, z); pose.rotation.set(0, 0, 0); pose.scale.set(w, h, 1); pose.updateMatrix();
    auras.setMatrixAt(i, pose.matrix);
  });
  auras.frustumCulled = false;
  layer.add(auras);

  let disposed = false;
  function update(time) {
    if (disposed) return;
    const resonance = uniforms.uActivity.value.x;
    const ignition = uniforms.uActivity.value.z;
    const warp = uniforms.uWarp.value;
    fragments.forEach((fragment, i) => {
      pose.position.set(fragment.x + Math.sin(time * .08 + fragment.phase) * .18,
        fragment.y + Math.sin(time * .13 + fragment.phase) * .28 + resonance * .35,
        fragment.z + Math.cos(time * .065 + fragment.phase) * .2);
      pose.rotation.set(Math.sin(time * .04 + fragment.phase) * .23, fragment.angle + time * .012, Math.sin(fragment.phase + time * .035) * .17);
      pose.scale.set(fragment.width, fragment.height, fragment.depth);
      pose.updateMatrix(); stone.setMatrixAt(i, pose.matrix);
    });
    stone.instanceMatrix.needsUpdate = true;
    stoneEdges.material.opacity = .09 + uniforms.uImmersive.value * .1 + resonance * .13;
    fragmentMaterial.emissiveIntensity = .15 + resonance * .32;
    let trailIndex = 0;
    for (let i = 0; i < scoutCount; i++) {
      scoutPosition(i, time, point); scoutPosition(i, time + .03, ahead);
      pose.position.copy(point); pose.lookAt(ahead); pose.scale.setScalar(i === 3 ? .85 : 1);
      pose.updateMatrix(); vehicles.setMatrixAt(i, pose.matrix);
      beaconPositions.set([point.x, point.y + .035, point.z], i * 3);
      for (let j = 0; j < trailSegments; j++) {
        for (const end of [0, 1]) {
          scoutPosition(i, time - (j + end) / trailSegments * (1.8 + warp * 3), point);
          trailPositions[trailIndex++] = point.x;
          trailPositions[trailIndex++] = point.y + .035;
          trailPositions[trailIndex++] = point.z;
        }
      }
    }
    for (let i = 0; i < carriageCount; i++) {
      const angle = i / carriageCount * tau - time * .046;
      const radius = 5.39 + (i % 2) * .08;
      pose.position.set(Math.cos(angle) * radius, 1.35 + Math.sin(angle) * radius, -6.02);
      pose.rotation.set(0, 0, angle - Math.PI / 2);
      pose.scale.set(.75, .75, .75);
      pose.updateMatrix(); vehicles.setMatrixAt(scoutCount + i, pose.matrix);
      beaconPositions.set([pose.position.x, pose.position.y, -5.86], (scoutCount + i) * 3);
    }
    vehicles.instanceMatrix.needsUpdate = true;
    trailGeometry.attributes.position.needsUpdate = true;
    beaconGeometry.attributes.position.needsUpdate = true;
    for (let i = 0; i < 5; i++) {
      const ignitionTravel = ignition > 0 ? uniforms.uActivityProgress.value * 2.5 : 0;
      const travel = ((time * .15 + i * .5 + ignitionTravel) % 2.5 + 2.5) % 2.5;
      pose.position.set(-1.25 + travel, -2.50, 1.615);
      pose.rotation.set(0, 0, 0); pose.scale.setScalar(1); pose.updateMatrix();
      hotSlabs.setMatrixAt(i, pose.matrix);
    }
    hotSlabs.instanceMatrix.needsUpdate = true;
    slabMaterial.emissiveIntensity = .48 + ignition * 2.5;
    furnaceLight.intensity = 1.25 + ignition * 6.25 + Math.sin(time * 4.3) * .10;
    serviceMaterial.emissiveIntensity = .24 + resonance * .45 + warp * .3;
  }
  update(0);

  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      layer.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      hotSlabs.dispose();
      for (const object of [layer, packets, conveyor, hotSlabs, furnaceLight, plumes]) object.removeFromParent();
      for (const resource of resources) resource.dispose();
      resources.clear(); layer.clear();
    },
  };
}
