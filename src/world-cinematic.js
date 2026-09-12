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
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uWarp: { value: 0 }, uImmersive: { value: 0 }, uGravity: { value: 0 }, uBloom: { value: 0 }, uAspect: { value: 1 }, uLens: { value: new THREE.Vector2(.5, .5) } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime, uWarp, uImmersive, uGravity, uBloom, uAspect;
      uniform vec2 uLens;
      varying vec2 vUv;
      void main(){
        vec2 p=vUv-.5;
        vec2 lens=(vUv-uLens)*vec2(uAspect,1.);
        float radius=length(lens);
        float falloff=exp(-radius*4.5);
        float angle=uGravity*falloff*.24;
        mat2 twist=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
        lens=twist*lens*(1.+uGravity*.24*falloff);
        vec2 uv=uLens+lens/vec2(uAspect,1.);
        vec2 fringe=(uv-uLens)*(.00035+uWarp*.003+uGravity*.002*falloff);
        vec3 c=vec3(texture2D(tDiffuse,clamp(uv+fringe,.001,.999)).r,texture2D(tDiffuse,clamp(uv,.001,.999)).g,texture2D(tDiffuse,clamp(uv-fringe,.001,.999)).b);
        float vignette=1.-smoothstep(.2,.78,length(p))*mix(.1,.32,uImmersive);
        float grain=fract(sin(dot(vUv*1517.+floor(uTime*24.),vec2(12.9898,78.233)))*43758.5453)-.5;
        c=c*vignette+grain*.006;
        c+=vec3(.024)*uBloom*exp(-radius*3.);
        // Keep lens distortion optical and the finished image true neutral chrome.
        c=vec3(dot(max(c,vec3(0.)),vec3(.2126,.7152,.0722)));
        gl_FragColor=vec4(c,1.);
      }
    `,
  });
  for (const pass of [base, bloom, output, optics]) composer.addPass(pass);
  let quality = 1;
  return {
    resize(width, height, dpr) {
      optics.uniforms.uAspect.value = width / height;
      composer.setPixelRatio(Math.min(dpr, mobile ? 1 : 1.25) * quality);
      composer.setSize(width, height);
    },
    render({ time, warp = 0, immersive, heat = 0, activity = 0, singularity, lensX = .5, lensY = .5 }) {
      bloom.strength = .55 + heat * .16 + activity * .15 + warp * .3 + (singularity?.bloom || 0) * .24;
      optics.uniforms.uTime.value = time;
      optics.uniforms.uWarp.value = warp;
      optics.uniforms.uImmersive.value = immersive ? 1 : 0;
      optics.uniforms.uGravity.value = singularity?.collapse || 0;
      optics.uniforms.uBloom.value = singularity?.bloom || 0;
      optics.uniforms.uLens.value.set(lensX, lensY);
      composer.render();
    },
    reduceResolution() { if (quality === 1) { quality = .8; return true; } return false; },
    dispose() { for (const pass of [base, bloom, output, optics]) pass.dispose(); composer.dispose(); },
  };
}
