import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// A bounded HDR pipeline. Bloom works on progressively smaller textures;
// the final optical treatment is one full-screen pass, independent of the DOM.
export function createWorldCinematic(renderer, scene, camera, mobile) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType, samples: mobile ? 0 : Math.min(2, renderer.capabilities.maxSamples),
  });
  const composer = new EffectComposer(renderer, target);
  const base = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .65, .65, .8);
  const output = new OutputPass();
  const optics = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uWarp: { value: 0 }, uImmersive: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime, uWarp, uImmersive;
      varying vec2 vUv;
      void main(){
        vec2 p=vUv-.5;
        vec2 fringe=p*(.00035+uWarp*.005);
        vec3 c=vec3(texture2D(tDiffuse,vUv+fringe).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-fringe).b);
        float vignette=1.-smoothstep(.2,.78,length(p))*mix(.1,.32,uImmersive);
        float grain=fract(sin(dot(vUv*1517.+floor(uTime*24.),vec2(12.9898,78.233)))*43758.5453)-.5;
        c=c*vignette+grain*.008;
        gl_FragColor=vec4(c,1.);
      }
    `,
  });
  for (const pass of [base, bloom, output, optics]) composer.addPass(pass);
  let quality = 1;
  return {
    resize(width, height, dpr) {
      composer.setPixelRatio(Math.min(dpr, mobile ? 1 : 1.25) * quality);
      composer.setSize(width, height);
    },
    render({ time, warp = 0, immersive, heat = 0, activity = 0 }) {
      bloom.strength = .55 + heat * .16 + activity * .15 + warp * .3;
      optics.uniforms.uTime.value = time;
      optics.uniforms.uWarp.value = warp;
      optics.uniforms.uImmersive.value = immersive ? 1 : 0;
      composer.render();
    },
    reduceResolution() { if (quality === 1) { quality = .8; return true; } return false; },
    dispose() { for (const pass of [base, bloom, output, optics]) pass.dispose(); composer.dispose(); },
  };
}
