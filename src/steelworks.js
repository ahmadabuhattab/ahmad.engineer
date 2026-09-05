import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// A small, fully modeled steelworks. No remote assets or render service needed.
export function createSteelworks(mount, onContextLost) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  mount.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, .1, 60);
  const world = new THREE.Group();
  scene.add(world);
  const envScene = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(envScene, .05);
  scene.environment = environment.texture;
  scene.environmentIntensity = .75;
  envScene.dispose();
  pmrem.dispose();

  const materials = {
    steel: new THREE.MeshStandardMaterial({ color: 0x819bae, metalness: .84, roughness: .28 }),
    light: new THREE.MeshStandardMaterial({ color: 0xc0d2d8, metalness: .8, roughness: .24 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x172637, metalness: .8, roughness: .4 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x3b5970, metalness: .72, roughness: .34 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd8a15f, metalness: .78, roughness: .27 }),
    floor: new THREE.MeshStandardMaterial({ color: 0x102233, metalness: .88, roughness: .26 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x7ccfff, emissive: 0x35a4f3, emissiveIntensity: 2.2, metalness: .3, roughness: .25 }),
    hot: new THREE.MeshStandardMaterial({ color: 0xffcf89, emissive: 0xff6b16, emissiveIntensity: 3.2, roughness: .5 }),
    red: new THREE.MeshBasicMaterial({ color: 0xff7054 }),
  };
  const geometries = new Set();
  const keep = g => { geometries.add(g); return g; };
  const boxGeometry = keep(new THREE.BoxGeometry(1, 1, 1));
  const cylGeometry = keep(new THREE.CylinderGeometry(1, 1, 1, 24));
  const sphereGeometry = keep(new THREE.SphereGeometry(1, 16, 12));
  const mesh = (geometry, material, x, y, z, parent = world) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };
  const box = (w, h, d, x, y, z, material = materials.steel, parent = world) => {
    const object = mesh(boxGeometry, material, x, y, z, parent);
    object.scale.set(w, h, d);
    return object;
  };
  const cylinder = (radius, height, x, y, z, material = materials.steel, parent = world) => {
    const object = mesh(cylGeometry, material, x, y, z, parent);
    object.scale.set(radius, height, radius);
    return object;
  };
  const ring = (radius, thickness, x, y, z, material = materials.light, arc = Math.PI * 2, parent = world) => {
    const object = mesh(keep(new THREE.TorusGeometry(radius, thickness, 8, 64, arc)), material, x, y, z, parent);
    object.rotation.x = Math.PI / 2;
    return object;
  };
  const beam = (a, b, radius = .025, material = materials.light, parent = world) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const delta = end.clone().sub(start);
    const object = cylinder(radius, delta.length(), 0, 0, 0, material, parent);
    object.position.copy(start.add(end).multiplyScalar(.5));
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return object;
  };
  const pipe = (points, radius, material = materials.steel) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    return mesh(keep(new THREE.TubeGeometry(curve, 24, radius, 8, false)), material, 0, 0, 0);
  };

  scene.add(new THREE.HemisphereLight(0xbce7ff, 0x2f241b, 2));
  const key = new THREE.DirectionalLight(0xd9f2ff, 4);
  key.position.set(-3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6caeff, 3);
  rim.position.set(4, 3, -4); scene.add(rim);
  const furnaceLight = new THREE.PointLight(0xff8437, 5, 6, 2);
  furnaceLight.position.set(-.3, .7, 1.2); world.add(furnaceLight);

  // Machined display plinth, with a luminous rotating perimeter.
  cylinder(2.22, .16, 0, -.07, 0, materials.dark);
  cylinder(2.17, .05, 0, .035, 0, materials.floor);
  ring(2.19, .013, 0, .023, 0, materials.cyan);
  ring(2.05, .012, 0, .067, 0, materials.steel);
  const orbit = ring(2.31, .012, 0, -.1, 0, materials.cyan, Math.PI * 1.35);
  for (let i = 0; i < 48; i++) {
    const angle = i / 48 * Math.PI * 2;
    const mark = box(.018, .008, i % 4 === 0 ? .09 : .04, Math.sin(angle) * 2.11, .066, Math.cos(angle) * 2.11, materials.light);
    mark.rotation.y = angle;
  }

  // Blast furnace: segmented pressure vessel, jacket rings and service deck.
  const fx = -.65, fz = -.15;
  for (const x of [-.38, .38]) for (const z of [-.36, .36]) {
    box(.1, 1.1, .1, fx + x, .61, fz + z, materials.dark);
    box(.2, .06, .2, fx + x, .1, fz + z, materials.light);
  }
  cylinder(.48, 1.2, fx, 1.13, fz, materials.steel);
  mesh(keep(new THREE.CylinderGeometry(.3, .48, .45, 24)), materials.light, fx, 1.95, fz);
  cylinder(.25, .25, fx, 2.3, fz, materials.dark);
  mesh(keep(new THREE.ConeGeometry(.27, .2, 24)), materials.light, fx, 2.53, fz);
  for (const y of [.58, .78, 1.2, 1.64, 1.8]) ring(.491, .025, fx, y, fz, materials.light);
  cylinder(.68, .055, fx, 1.78, fz, materials.dark);
  ring(.66, .014, fx, 1.96, fz, materials.brass);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    cylinder(.012, .18, fx + Math.cos(a) * .65, 1.87, fz + Math.sin(a) * .65, materials.brass);
    box(.035, .48, .035, fx + Math.cos(a) * .49, 1.1, fz + Math.sin(a) * .49, materials.light);
  }
  // Furnace mouth and the curved stream of liquid steel.
  const mouth = cylinder(.16, .15, fx, .55, fz + .47, materials.dark);
  mouth.rotation.x = Math.PI / 2;
  const mouthLight = cylinder(.105, .012, fx, .55, fz + .55, materials.hot);
  mouthLight.rotation.x = Math.PI / 2;
  const pour = pipe([[fx,.55,fz+.57],[fx,.48,.62],[fx,.25,.94]], .031, materials.hot);
  box(.23, .065, .72, fx, .19, .85, materials.dark);
  box(.16, .016, .67, fx, .23, .86, materials.hot);

  // Tall exhaust stacks, collars, red obstruction lamps, and curved ductwork.
  const stacks = [[-1.35, -.9, 2.75, .115], [.08, -.94, 2.2, .14]];
  for (const [x, z, height, radius] of stacks) {
    cylinder(radius * 1.7, .22, x, .17, z, materials.dark);
    cylinder(radius, height, x, height / 2 + .16, z, materials.light);
    for (let k = 1; k < 5; k++) ring(radius * 1.04, .018, x, height * k / 5, z, materials.dark);
    cylinder(radius * 1.15, .06, x, height + .16, z, materials.dark);
    cylinder(.03, .035, x + radius, height + .205, z, materials.red);
  }
  pipe([[fx,2.38,fz],[fx,2.6,-.3],[.05,2.62,-.35],[.45,2.1,-.5],[.45,.65,-.5]], .09);
  pipe([[-1.35,.7,-.9],[-1.35,.8,-.5],[-1.1,.8,-.15]], .085, materials.roof);

  // Corrugated mill building, saw-tooth roof, windows and service pipes.
  box(1.22, .82, 1.18, .75, .49, -.72, materials.roof);
  for (let i = 0; i < 15; i++) {
    box(.013, .8, .025, .17 + i * .084, .49, -.11, materials.steel);
  }
  for (let i = 0; i < 3; i++) {
    const roof = box(.43, .055, 1.25, .33 + i * .41, .94, -.72, materials.light);
    roof.rotation.z = .2;
    box(.3, .085, .02, .32 + i * .41, .78, -.103, materials.cyan);
  }
  box(.45, .38, .025, 1, .3, -.108, materials.dark);
  box(.36, .31, .03, 1, .285, -.086, materials.hot);
  for (let i = 0; i < 5; i++) box(.013, .3, .04, .86 + i * .07, .285, -.061, materials.dark);
  for (let i = 0; i < 3; i++) pipe([[1.45,.15,-1.15+i*.23],[1.45,.55,-1.15+i*.23],[1.22,.55,-1.15+i*.23]], .033);

  // Gantry, truss members, suspended ladle, and visible hoist cables.
  const gz = .55;
  for (const x of [.3, 1.6]) {
    box(.065, 2.05, .085, x, 1.08, gz, materials.brass);
    box(.27, .06, .25, x, .1, gz, materials.dark);
  }
  box(1.55, .12, .12, .96, 2.13, gz, materials.brass);
  box(1.55, .04, .13, .96, 2.36, gz, materials.light);
  for (let i = 0; i < 6; i++) beam([.2+i*.25,2.14,gz],[.325+i*.25,2.36,gz], .015, materials.brass);
  const trolley = new THREE.Group();
  trolley.position.set(1.04, 2.1, gz); world.add(trolley);
  box(.25, .14, .23, 0, 0, 0, materials.dark, trolley);
  for (const x of [-.12,.12]) beam([x,-.05,0],[x,-.85,0], .008, materials.light, trolley);
  const ladle = mesh(keep(new THREE.CylinderGeometry(.29,.21,.37,24,1,true)), materials.light, 0, -.99, 0, trolley);
  ring(.29, .028, 0, -.806, 0, materials.brass, Math.PI * 2, trolley);
  cylinder(.266, .012, 0, -.82, 0, materials.hot, trolley);
  ladle.material.side = THREE.DoubleSide;

  // The rolling line, with a travelling slab and spinning rollers.
  const rollers = [];
  for (const z of [1,1.55]) box(2.45,.15,.065,0,.21,z,materials.dark);
  for (let i = 0; i < 12; i++) {
    const roller = cylinder(.068,.64,-1.13+i*.205,.3,1.275,materials.light);
    roller.rotation.x = Math.PI/2;
    rollers.push(roller);
  }
  const slab = box(1.02, .065, .39, -.25, .41, 1.27, materials.hot);
  for (let i = 0; i < 4; i++) {
    box(.5,.035,.13,1.3,.16+i*.04,-1.5,materials.light);
  }

  // Thin emissive rings and an additive glow sell the miniature's scale.
  const glowMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { strength: { value: .65 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv; uniform float strength; void main(){float d=length((vUv-.5)*2.); float a=pow(max(0.,1.-d),3.)*strength; gl_FragColor=vec4(1.,.3,.065,a);}',
  });
  const glow = mesh(keep(new THREE.PlaneGeometry(2.8, 1.8)), glowMaterial, -.25, .36, 1.05);
  glow.rotation.x = -Math.PI / 2;

  // One draw call each for deterministic sparks and soft rising steam.
  const sparkCount = 100;
  const sparkArray = new Float32Array(sparkCount * 3);
  const sparkSeeds = Array.from({ length: sparkCount }, (_, i) => {
    const n = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
  });
  const sparkGeometry = keep(new THREE.BufferGeometry());
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkArray, 3));
  const sparkMaterial = new THREE.PointsMaterial({ color: 0xffb96c, size: .025, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial);
  sparks.frustumCulled = false; world.add(sparks);
  const steamCount = 28;
  const steamArray = new Float32Array(steamCount * 3);
  const steamAlpha = new Float32Array(steamCount);
  const steamSize = new Float32Array(steamCount);
  const steamGeometry = keep(new THREE.BufferGeometry());
  steamGeometry.setAttribute('position', new THREE.BufferAttribute(steamArray, 3));
  steamGeometry.setAttribute('alpha', new THREE.BufferAttribute(steamAlpha, 1));
  steamGeometry.setAttribute('size', new THREE.BufferAttribute(steamSize, 1));
  const steamMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { pixelRatio: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float alpha; attribute float size; varying float vAlpha; uniform float pixelRatio;
      void main(){vAlpha=alpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=size*pixelRatio*(150./-mv.z);}`,
    fragmentShader: `varying float vAlpha; void main(){float r=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-r*r),3.)*vAlpha;gl_FragColor=vec4(.64,.78,.87,a);}`,
  });
  const steam = new THREE.Points(steamGeometry, steamMaterial);
  steam.frustumCulled = false; world.add(steam);

  let disposed = false;
  let power = 0;
  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, mount.clientWidth), height = Math.max(1, mount.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(mount);

  const render = ({ time = 0, x = 0, y = 0, energy = 0, orbit: rotation = 0, still = false } = {}) => {
    if (disposed) return;
    power = energy;
    const t = still ? 1.8 : time;
    const azimuth = .56 + rotation + x * .12;
    const distance = 8.8 - power * .65;
    camera.position.set(Math.sin(azimuth) * distance, 5.5 + y * .32, Math.cos(azimuth) * distance);
    camera.lookAt(0, 1.12 + power * .12, 0);
    world.position.y = power * .13 + Math.sin(t * .8) * .035;
    world.rotation.y = Math.sin(t * .25) * .08;
    orbit.rotation.z = t * .16;
    trolley.position.x = 1.01 + Math.sin(t * .46) * .16;
    trolley.rotation.z = Math.sin(t * 1.25) * (.025 + power * .025);
    slab.position.x = ((t * (.2 + power * .25)) % 1.2) - .65;
    rollers.forEach(roller => { roller.rotation.y = t * (1 + power); });
    const flicker = Math.sin(t * 5) * .1 + Math.sin(t * 7.3) * .06;
    materials.hot.emissiveIntensity = 2.1 + power * 2 + flicker;
    furnaceLight.intensity = 4 + power * 5 + flicker;
    glowMaterial.uniforms.strength.value = .45 + power * .55;
    pour.scale.x = 1 + Math.sin(t * 8) * .06;
    for (let i = 0; i < sparkCount; i++) {
      const seed = sparkSeeds[i];
      const life = (t * (.22 + seed * .22 + power * .18) + i / sparkCount) % 1;
      const angle = i * 2.39996;
      const spread = life * (.25 + power * 1.6);
      sparkArray[i*3] = -.63 + Math.sin(angle) * spread + Math.sin(t + i) * .035;
      sparkArray[i*3+1] = .35 + Math.sin(life * Math.PI * .8) * (.65 + seed * 1.3 + power);
      sparkArray[i*3+2] = .85 + Math.cos(angle) * spread;
    }
    sparkGeometry.attributes.position.needsUpdate = true;
    sparkMaterial.opacity = .45 + power * .5;
    sparkMaterial.size = .018 + power * .012;
    for (let i = 0; i < steamCount; i++) {
      const s = stacks[i % 2];
      const life = (t * .095 + i / (steamCount / 2)) % 1;
      steamArray[i*3] = s[0] + Math.sin(i * 3 + t * .3) * life * .18 + life * .55;
      steamArray[i*3+1] = s[2] + .16 + life * 1.6;
      steamArray[i*3+2] = s[1] + Math.cos(i) * life * .13;
      steamAlpha[i] = Math.sin(life * Math.PI) * (.1 + power * .07);
      steamSize[i] = .35 + life * .95;
    }
    for (const attr of Object.values(steamGeometry.attributes)) attr.needsUpdate = true;
    renderer.render(scene, camera);
  };
  const lost = event => { event.preventDefault(); onContextLost(); };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  render({ still: true });

  return {
    render,
    dispose() {
      if (disposed) return;
      disposed = true;
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      for (const geometry of geometries) geometry.dispose();
      for (const material of [...Object.values(materials), sparkMaterial, steamMaterial, glowMaterial]) material.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
