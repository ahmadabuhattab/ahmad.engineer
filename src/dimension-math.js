const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// The 16 vertices and 32 edges of a unit four-dimensional cube. Each edge
// changes exactly one coordinate; no decorative diagonals are introduced.
export const TESSERACT_VERTICES = new Float32Array(16 * 4);
const edgeIndices = [];
for (let vertex = 0; vertex < 16; vertex++) {
  for (let axis = 0; axis < 4; axis++) {
    TESSERACT_VERTICES[vertex * 4 + axis] = vertex & (1 << axis) ? 1 : -1;
    if (!(vertex & (1 << axis))) edgeIndices.push(vertex, vertex | (1 << axis));
  }
}
export const TESSERACT_EDGES = new Uint8Array(edgeIndices);

export function createTesseractCoordinates(count) {
  if (!Number.isInteger(count) || count < 0) throw new RangeError('Particle count must be a nonnegative integer.');
  const coordinates = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) {
    const edge = index % 32;
    const samples = Math.ceil((count - edge) / 32);
    const progress = (Math.floor(index / 32) + .5) / samples;
    const from = TESSERACT_EDGES[edge * 2] * 4;
    const to = TESSERACT_EDGES[edge * 2 + 1] * 4;
    for (let axis = 0; axis < 4; axis++) {
      coordinates[index * 4 + axis] = TESSERACT_VERTICES[from + axis] * (1 - progress) + TESSERACT_VERTICES[to + axis] * progress;
    }
  }
  return coordinates;
}

// Four XY squares and four ZW squares cover every edge once. Closed circuits
// fit the existing eight Field Lab trails without connecting unrelated edges.
export function createTesseractTraces(segments) {
  if (!Number.isInteger(segments) || segments < 4 || segments % 4) throw new RangeError('Trace segments must be a positive multiple of four.');
  const coordinates = new Float32Array(8 * (segments + 1) * 4);
  for (let track = 0; track < 8; track++) {
    for (let segment = 0; segment <= segments; segment++) {
      const progress = segment / segments * 4;
      const edge = Math.min(3, Math.floor(progress));
      const t = progress - edge;
      const a = edge === 0 ? -1 + t * 2 : edge === 1 ? 1 : edge === 2 ? 1 - t * 2 : -1;
      const b = edge === 0 ? -1 : edge === 1 ? -1 + t * 2 : edge === 2 ? 1 : 1 - t * 2;
      const offset = (track * (segments + 1) + segment) * 4;
      const fixedA = track % 2 ? 1 : -1;
      const fixedB = Math.floor(track % 4 / 2) ? 1 : -1;
      coordinates[offset] = track < 4 ? a : fixedA;
      coordinates[offset + 1] = track < 4 ? b : fixedB;
      coordinates[offset + 2] = track < 4 ? fixedA : a;
      coordinates[offset + 3] = track < 4 ? fixedB : b;
    }
  }
  return coordinates;
}

/** Twenty-four real square faces, emitted as two triangles each. */
export function createTesseractFaces() {
  const coordinates = new Float32Array(24 * 6 * 4);
  const uv = new Float32Array(24 * 6 * 2);
  const corners = [0, 1, 2, 0, 2, 3];
  let vertex = 0;
  for (let axisA = 0; axisA < 4; axisA++) {
    for (let axisB = axisA + 1; axisB < 4; axisB++) {
      const fixed = [];
      for (let axis = 0; axis < 4; axis++) if (axis !== axisA && axis !== axisB) fixed.push(axis);
      for (let side = 0; side < 4; side++) {
        for (const corner of corners) {
          const u = corner === 1 || corner === 2 ? 1 : 0;
          const v = corner >= 2 ? 1 : 0;
          coordinates[vertex * 4 + axisA] = u * 2 - 1;
          coordinates[vertex * 4 + axisB] = v * 2 - 1;
          coordinates[vertex * 4 + fixed[0]] = side & 1 ? 1 : -1;
          coordinates[vertex * 4 + fixed[1]] = side & 2 ? 1 : -1;
          uv[vertex * 2] = u; uv[vertex * 2 + 1] = v;
          vertex++;
        }
      }
    }
  }
  return { coordinates, uv };
}

/** Cyan/violet W layers with amber along the fourth-axis connections. Linear RGB. */
export function createTesseractColors(coordinates) {
  const colors = new Float32Array(coordinates.length / 4 * 3);
  const cyan = [.12, .88, 1.], violet = [.64, .29, 1.], gold = [1., .65, .20];
  for (let source = 0, target = 0; source < coordinates.length; source += 4, target += 3) {
    const w = coordinates[source + 3];
    const layer = (w + 1) * .5;
    const bridge = (1 - Math.abs(w)) ** .55;
    for (let channel = 0; channel < 3; channel++) {
      const base = cyan[channel] + (violet[channel] - cyan[channel]) * layer;
      colors[target + channel] = base + (gold[channel] - base) * bridge;
    }
  }
  return colors;
}

/** Signed compression/release, returning exactly to the unmodified pose in 3.2s. */
export function sampleFoldPulse(age) {
  if (!Number.isFinite(age) || age <= 0 || age >= 3.2) return 0;
  const t = age / 3.2;
  if (t < .3) return -(Math.sin(t / .3 * Math.PI) ** 2);
  return Math.sin((t - .3) / .7 * Math.PI) ** 2;
}

/** Fill a caller-owned XYZ buffer with true XW/YW rotation and 4D perspective. */
export function projectTesseract(source, target, time = 0, fold = .18, pulse = 0) {
  const clock = Number.isFinite(time) ? time : 0;
  const angle = clamp(Number.isFinite(fold) ? fold : .18, 0, 1) * TAU;
  const kick = clamp(Number.isFinite(pulse) ? pulse : 0, -1, 1);
  const xw = clock * .16 + angle + kick * .42;
  const yw = .38 + Math.sin(clock * .12) * .35 + angle * .3 - kick * .65;
  const sx = Math.sin(xw), cx = Math.cos(xw), sy = Math.sin(yw), cy = Math.cos(yw);
  const scale = .88 * (1 + kick * .18);
  for (let input = 0, output = 0; input < source.length; input += 4, output += 3) {
    const x = source[input] * cx - source[input + 3] * sx;
    const w = source[input] * sx + source[input + 3] * cx;
    const y = source[input + 1] * cy - w * sy;
    const rotatedW = source[input + 1] * sy + w * cy;
    const perspective = 3.6 / Math.max(1.5, 3.6 - rotatedW) * scale;
    target[output] = x * perspective;
    target[output + 1] = y * perspective;
    target[output + 2] = source[input + 2] * perspective;
  }
  return target;
}

// Matches projectTesseract exactly; every renderer uses the same bounded math.
export const TESSERACT_GLSL = `
  vec3 projectTesseract4(vec4 p, float time, float fold, float pulse) {
    float angle = clamp(fold, 0., 1.) * 6.283185307179586;
    float kick = clamp(pulse, -1., 1.);
    float xw = time * .16 + angle + kick * .42;
    float yw = .38 + sin(time * .12) * .35 + angle * .3 - kick * .65;
    float x = p.x * cos(xw) - p.w * sin(xw);
    float w = p.x * sin(xw) + p.w * cos(xw);
    float y = p.y * cos(yw) - w * sin(yw);
    float rotatedW = p.y * sin(yw) + w * cos(yw);
    float perspective = 3.6 / max(1.5, 3.6 - rotatedW) * .88 * (1. + kick * .18);
    return vec3(x, y, p.z) * perspective;
  }
`;
