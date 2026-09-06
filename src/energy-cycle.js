export const CYCLE_DURATION = 15;
export const BURST_START = 2.6;

const clamp = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, t) => {
  const x = clamp((t - a) / (b - a));
  return clamp(x * x * x * (x * (x * 6 - 15) + 10));
};

// One continuous clock drives both renderers. The exact home positions are
// recovered before the next cycle; no accumulated particle integration drift.
export function sampleCycle(elapsed) {
  const time = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
  const turns = Math.floor(time / CYCLE_DURATION);
  const t = time - turns * CYCLE_DURATION;
  const phase = t < 2.6 || t >= 11.8 ? 'orbit'
    : t < 4 ? 'charging'
    : t < 5.7 ? 'release'
    : t < 7.2 ? 'suspended' : 'reforming';
  const charge = smooth(2.6, 4, t) * (1 - smooth(4, 4.8, t));
  const scatter = smooth(4, 5.7, t) * (1 - smooth(7.2, 11.8, t));
  const shock = t > 4 && t < 6.6 ? (t - 4) / 2.6 : 0;
  const heat = clamp(charge * 0.75 + scatter * 0.85);
  const spin = time * 0.18 + (turns + smooth(2.6, 11.8, t)) * Math.PI * 2;
  return { phase, charge, scatter, shock, heat, spin, bursting: phase !== 'orbit' };
}
