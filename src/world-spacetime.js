export const SPACETIME_DURATION = 12;
const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (a, b, value) => { const p = clamp((value - a) / (b - a)); return p * p * (3 - 2 * p); };

// One reversible, continuous timeline drives geometry, optics, and the fallback.
// The controller owns progress so pause and a hidden tab freeze every layer.
export function sampleSpacetime(progress, active = true) {
  const p = clamp(progress);
  const strength = active ? smooth(0, .16, p) * (1 - smooth(.76, 1, p)) : 0;
  const collapse = active ? smooth(.14, .47, p) * (1 - smooth(.56, .84, p)) : 0;
  const bloom = active ? smooth(.51, .61, p) * (1 - smooth(.61, .94, p)) : 0;
  return { progress: p, strength, collapse, bloom,
    phase: p < .18 ? 'gather' : p < .48 ? 'collapse' : p < .58 ? 'hold' : p < .83 ? 'unfold' : 'restore' };
}
