/**
 * A torus knot as one glowing neon tube, turning in 3D. The tube is drawn in depth bands,
 * far to near: thin and dim at the back, thick and bright in front. A pulse of light runs
 * along it. On beats it morphs into another (p, q) knot, and halfway through the morph
 * the old and new knots tangle into strange in-between shapes.
 *
 * Torus knot (p, q): r = 2 + cos(qφ), x = r·cos(pφ), y = r·sin(pφ), z = −1.5·sin(qφ).
 */
import { pick } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { neonStroke } from '../render/neon';
import { quality } from '../render/quality';
import type { Mode } from './mode';

type Knot = readonly [p: number, q: number];
type Vec3 = [number, number, number];

// prettier-ignore
const KNOTS: readonly Knot[] = [
  [2, 3], [3, 2], [2, 5], [3, 4], [3, 5], [5, 2], [4, 3], [5, 3], [3, 7], [2, 7], [5, 4],
];
const BANDS = 6;
/** Length of the light pulse, in samples. */
const PULSE = 14;

let from: Knot = KNOTS[0];
let to: Knot = KNOTS[0];
/** Morph progress from `from` to `to`, 0..1. */
let morph = 1;
const angles = { x: 0.5, y: 0.2, z: 0 };

function knotPoint([p, q]: Knot, phi: number, out: Vec3): void {
  const r = 2 + Math.cos(q * phi);
  out[0] = (r * Math.cos(p * phi)) / 3;
  out[1] = (r * Math.sin(p * phi)) / 3;
  // Deeper than a plain torus knot, so it still looks 3D when seen from the side.
  out[2] = (-Math.sin(q * phi) * 1.5) / 3;
}

export const neonKnot: Mode = {
  name: 'neon-knot',
  fade: 0.3,
  zoom: 1.004,
  beatRings: false,
  palettes: ['neon', 'void', 'ultraviolet', 'vapor', 'deep sea', 'acid', 'lava'],

  beat() {
    if (morph >= 1 && Math.random() < 0.5) {
      from = to;
      to = pick(KNOTS, to);
      morph = 0;
    }
  },

  draw(dt) {
    const { cx, cy, min } = view;
    const time = clock.time;
    const samples = quality.level === 2 ? 420 : 280;
    morph = Math.min(1, morph + dt * 1.2);
    const blend = morph * morph * (3 - 2 * morph);
    const spin = dt * (0.25 + audio.mid * 0.9);
    angles.x += spin * 0.35;
    angles.y += spin;
    angles.z += spin * 0.3;
    const cosX = Math.cos(angles.x);
    const sinX = Math.sin(angles.x);
    const cosY = Math.cos(angles.y);
    const sinY = Math.sin(angles.y);
    const cosZ = Math.cos(angles.z);
    const sinZ = Math.sin(angles.z);
    const size = min * 0.5 * (1 + audio.bass * 0.12 + audio.beat * 0.05);

    // Project every sample: screen x, y and depth (−1 far … 1 near).
    const xs = new Float32Array(samples + 1);
    const ys = new Float32Array(samples + 1);
    const zs = new Float32Array(samples + 1);
    const a: Vec3 = [0, 0, 0];
    const b: Vec3 = [0, 0, 0];
    for (let s = 0; s <= samples; s++) {
      const phi = (s / samples) * Math.PI * 2;
      knotPoint(from, phi, a);
      knotPoint(to, phi, b);
      const x = a[0] + (b[0] - a[0]) * blend;
      const y = a[1] + (b[1] - a[1]) * blend;
      const z = a[2] + (b[2] - a[2]) * blend;
      const y1 = y * cosX - z * sinX;
      const z1 = y * sinX + z * cosX;
      const x2 = x * cosY + z1 * sinY;
      const z2 = -x * sinY + z1 * cosY;
      const x3 = x2 * cosZ - y1 * sinZ;
      const y3 = x2 * sinZ + y1 * cosZ;
      const perspective = 2.6 / (2.6 - z2);
      xs[s] = cx + x3 * size * perspective;
      ys[s] = cy + y3 * size * perspective;
      zs[s] = z2;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let band = 0; band < BANDS; band++) {
      ctx.beginPath();
      for (let s = 0; s < samples; s++) {
        const depth = (zs[s] + zs[s + 1]) / 2;
        const inBand = Math.min(BANDS - 1, Math.max(0, Math.floor(((depth + 1) / 2) * BANDS)));
        if (inBand !== band) continue;
        ctx.moveTo(xs[s], ys[s]);
        ctx.lineTo(xs[s + 1], ys[s + 1]);
      }
      const near = band / (BANDS - 1);
      neonStroke(ctx, band * 0.4 + time * 0.1, 1 + near * 2.2 + audio.bass * 1.5, 0.3 + near * 0.7);
    }

    // The pulse of light running along the tube.
    const head = Math.floor(((time * 0.25 * (1 + audio.mid)) % 1) * samples);
    ctx.beginPath();
    for (let n = 0; n < PULSE; n++) {
      const s = (head + n) % samples;
      if (n === 0) ctx.moveTo(xs[s], ys[s]);
      else ctx.lineTo(xs[s], ys[s]);
    }
    neonStroke(ctx, 3 + time * 0.1, 3 + audio.beat * 3, 1);
  },
};
