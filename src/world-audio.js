const PALETTES = {
  overview: { notes: [82.41, 123.47, 164.81], air: 540, pulse: 329.63 },
  energy: { notes: [98, 146.83, 196], air: 760, pulse: 392 },
  intelligence: { notes: [110, 164.81, 220], air: 1050, pulse: 659.25 },
  industry: { notes: [65.41, 98, 130.81], air: 320, pulse: 261.63 },
  dimension: { notes: [73.42, 146.83, 220], air: 1180, pulse: 880 },
};
const clamp = value => Math.max(0, Math.min(1, value));
const intensity = value => Number.isFinite(value) ? clamp(value)
  : ({ charging: .55, release: 1, burst: 1, suspended: .35, reforming: .2 })[value] || 0;

// Instantiate freely, but call setEnabled(true) directly from the sound button's
// click handler: no context, sources, or audio work exist before that gesture.
export function createWorldAudio() {
  const page = typeof document === 'undefined' ? null : document;
  const state = { realm: 'overview', activity: 0, paused: false, active: false };
  let context, graph, enabled = false, disposed = false, generation = 0;
  let suspendTimer, resumeTask, resumeBlocked = false, lastPulse = -Infinity;
  let appliedActivity = -1, appliedRealm, lastActivityTime = -Infinity;

  const audible = () => enabled && !disposed && state.active && !state.paused && !page?.hidden;
  function ramp(param, value, seconds = .35) {
    const now = context.currentTime;
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else {
      const current = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(current, now);
    }
    param.linearRampToValueAtTime(value, now + seconds);
  }

  function buildGraph() {
    const nodes = [], sources = [];
    const keep = node => { nodes.push(node); return node; };
    const gain = value => { const node = keep(context.createGain()); node.gain.value = value; return node; };
    const oscillator = (frequency, type = 'sine') => {
      const node = keep(context.createOscillator());
      node.type = type;
      node.frequency.value = frequency;
      sources.push(node);
      return node;
    };
    // Save the graph before allocation finishes so a failed browser allocation
    // can still release every node already made.
    graph = { nodes, sources };
    const master = gain(0), mix = gain(1);
    const highpass = keep(context.createBiquadFilter());
    highpass.type = 'highpass';
    highpass.frequency.value = 38;
    const lowpass = keep(context.createBiquadFilter());
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2200;
    lowpass.Q.value = .4;
    mix.connect(highpass).connect(lowpass).connect(master).connect(context.destination);
    graph.master = master;

    const voices = PALETTES[state.realm].notes.map((frequency, index) => {
      const voice = oscillator(frequency, index === 0 ? 'triangle' : 'sine');
      voice.detune.value = [-3, 2, 4][index];
      const level = gain([.17, .14, .065][index]);
      voice.connect(level);
      if (context.createStereoPanner) {
        const pan = keep(context.createStereoPanner());
        pan.pan.value = [-.28, .32, 0][index];
        level.connect(pan).connect(mix);
      } else level.connect(mix);
      const drift = oscillator(.037 + index * .017), depth = gain(2.1);
      drift.connect(depth).connect(voice.detune);
      const swell = oscillator(.061 + index * .009), swellDepth = gain(.018);
      swell.connect(swellDepth).connect(level.gain);
      return voice;
    });

    // A short, softly coloured loop. Both ends taper to zero to keep its seam
    // inaudible; the slow filter/gain oscillators provide the evolving breath.
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 4), context.sampleRate);
    const data = buffer.getChannelData(0), edge = Math.ceil(context.sampleRate * .035);
    let brown = 0;
    for (let i = 0; i < data.length; i++) {
      brown = (brown + (Math.random() * 2 - 1) * .02) / 1.02;
      const fade = Math.min(1, i / edge, (data.length - 1 - i) / edge);
      data[i] = brown * 3.5 * fade;
    }
    const noise = keep(context.createBufferSource());
    noise.buffer = buffer;
    noise.loop = true;
    sources.push(noise);
    const air = keep(context.createBiquadFilter());
    air.type = 'bandpass';
    air.frequency.value = PALETTES[state.realm].air;
    air.Q.value = .55;
    const breath = gain(.11), breathLfo = oscillator(.085), breathDepth = gain(.038);
    const airLfo = oscillator(.041), airDepth = gain(110);
    noise.connect(air).connect(breath).connect(mix);
    breathLfo.connect(breathDepth).connect(breath.gain);
    airLfo.connect(airDepth).connect(air.frequency);

    const pulse = oscillator(PALETTES[state.realm].pulse), pulseGain = gain(0);
    pulse.connect(pulseGain).connect(mix);
    // A restrained stereo echo adds space without an impulse asset or reverb
    // worklet. Its feedback is low and the entire tail shares the master fade.
    for (const [delayTime, position] of [[.27, -.48], [.39, .48]]) {
      const delay = keep(context.createDelay(1)), feedback = gain(.16), wet = gain(.12);
      delay.delayTime.value = delayTime;
      pulseGain.connect(delay);
      delay.connect(feedback).connect(delay);
      delay.connect(wet);
      if (context.createStereoPanner) {
        const pan = keep(context.createStereoPanner());
        pan.pan.value = position;
        wet.connect(pan).connect(mix);
      } else wet.connect(mix);
    }
    Object.assign(graph, { voices, air, breath, pulse, pulseGain });
    for (const source of sources) source.start();
  }

  function tune() {
    if (!graph?.voices || context.state === 'closed') return;
    const palette = PALETTES[state.realm], now = context.currentTime;
    if (appliedRealm !== state.realm) {
      graph.voices.forEach((voice, index) => ramp(voice.frequency, palette.notes[index], 1.1));
      ramp(graph.pulse.frequency, palette.pulse, .35);
      appliedRealm = state.realm;
      appliedActivity = -1;
    }
    // update() can be fed from a render loop; avoid filling the audio timeline
    // with redundant automation at the display's frame rate.
    if (appliedActivity < 0 || (Math.abs(appliedActivity - state.activity) >= .045 && now - lastActivityTime >= .08)) {
      ramp(graph.air.frequency, palette.air + state.activity * 380, .4);
      ramp(graph.breath.gain, .11 + state.activity * .035, .4);
      appliedActivity = state.activity;
      lastActivityTime = now;
    }
  }

  function releasePulse() {
    if (!audible() || context?.state !== 'running' || context.currentTime - lastPulse < 1.4) return;
    const now = context.currentTime, envelope = graph.pulseGain.gain;
    lastPulse = now;
    ramp(envelope, .075, .07);
    envelope.exponentialRampToValueAtTime(.0001, now + .85);
    envelope.linearRampToValueAtTime(0, now + .95);
  }

  function hush() {
    clearTimeout(suspendTimer);
    if (!context || context.state === 'closed' || !graph?.master) return;
    const fade = page?.hidden ? .08 : .22;
    ramp(graph.master.gain, 0, fade);
    if (graph.pulseGain) ramp(graph.pulseGain.gain, 0, Math.min(.08, fade));
    if (context.state === 'running') {
      suspendTimer = setTimeout(() => {
        if (!audible() && context?.state === 'running') {
          context.suspend().then(() => { if (audible()) sync(); }).catch(() => {});
        }
      }, (fade + .04) * 1000);
    }
  }

  function resume() {
    if (context.state === 'running') return Promise.resolve(true);
    if (context.state === 'closed' || resumeBlocked) return Promise.resolve(false);
    if (resumeTask) return resumeTask;
    // Browsers may leave a denied resume pending instead of rejecting it.
    // Bound that case, keep the graph silent, and require another sound click.
    let timeout, resumed;
    try { resumed = context.resume(); } catch { resumeBlocked = true; return Promise.resolve(false); }
    resumeTask = Promise.race([
      Promise.resolve(resumed).then(() => context.state === 'running'),
      new Promise(resolve => { timeout = setTimeout(() => resolve(false), 1800); }),
    ]).catch(() => false).then(success => {
      clearTimeout(timeout);
      resumeTask = null;
      if (!success) resumeBlocked = true;
      if (audible() && success) {
        tune();
        ramp(graph.master.gain, .12, .6);
      } else hush();
      return success;
    });
    return resumeTask;
  }

  function sync() {
    if (!context || disposed || !graph?.master) return;
    if (!audible()) { hush(); return; }
    clearTimeout(suspendTimer);
    if (context.state === 'running') {
      tune();
      ramp(graph.master.gain, .12, .45);
    } else if (!resumeBlocked) void resume();
  }

  async function setEnabled(value) {
    if (disposed) return false;
    const request = ++generation;
    if (!value) { enabled = false; sync(); return false; }
    // This supplements the public API's gesture contract in supporting browsers.
    // A background update cannot manufacture consent, even on permissive hosts.
    if (globalThis.navigator?.userActivation && !navigator.userActivation.isActive) return enabled;
    resumeBlocked = false;
    try {
      if (!context) {
        const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Audio) return false;
        context = new Audio({ latencyHint: 'playback' });
        buildGraph();
      }
      enabled = true;
      const success = await resume();
      if (disposed || request !== generation) return false;
      if (!success) enabled = false;
      sync();
      return enabled;
    } catch {
      enabled = false;
      for (const source of graph?.sources || []) { try { source.stop(); } catch {} }
      for (const node of graph?.nodes || []) node.disconnect();
      if (context && context.state !== 'closed') void context.close().catch(() => {});
      context = undefined;
      graph = undefined;
      appliedRealm = undefined;
      return false;
    }
  }

  function update(next = {}) {
    if (disposed) return;
    const before = { ...state };
    if (Object.hasOwn(PALETTES, next.realm)) state.realm = next.realm;
    if (next.activity !== undefined) state.activity = intensity(next.activity);
    if (next.paused !== undefined) state.paused = Boolean(next.paused);
    if (next.active !== undefined) state.active = Boolean(next.active);
    if (before.active !== state.active || before.paused !== state.paused) sync();
    else if (audible() && context?.state === 'running') tune();
    if (state.activity > 0 && before.activity === 0) releasePulse();
  }

  const onVisibility = () => sync();
  page?.addEventListener('visibilitychange', onVisibility);

  function dispose() {
    if (disposed) return;
    disposed = true;
    enabled = false;
    generation++;
    page?.removeEventListener('visibilitychange', onVisibility);
    clearTimeout(suspendTimer);
    if (!context) return;
    const cleanup = () => {
      for (const source of graph?.sources || []) { try { source.stop(); } catch {} }
      for (const node of graph?.nodes || []) node.disconnect();
      if (context.state !== 'closed') void context.close().catch(() => {});
    };
    if (context.state === 'running' && graph?.master) {
      ramp(graph.master.gain, 0, .04);
      setTimeout(cleanup, 60);
    } else cleanup();
  }

  return { setEnabled, update, dispose };
}
