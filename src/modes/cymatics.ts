/**
 * Cymatics: sand on a vibrating plate (Chladni figures). The plate vibrates in a
 * standing wave; grains on the moving parts are thrown around and grains on the
 * still lines (the nodes) stay, so the sand draws the wave's pattern.
 * The pitch of the music picks the pattern on each beat (higher sound, finer
 * pattern), and the loudness shakes the plate.
 *
 * Free-edge plate: u(x, y) = cos(nπx)·cos(mπy) − cos(mπx)·cos(nπy), x and y in −1..1.
 */
import { rnd } from '../core/math';
import { audio, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { quality } from '../render/quality';
import type { Mode } from './mode';

/** Mode pairs (n, m), from simple to fine. */
// prettier-ignore
const PATTERNS: readonly (readonly [number, number])[] = [
  [1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [1, 5], [3, 5],
  [4, 5], [2, 7], [3, 7], [5, 6], [4, 7], [5, 8], [6, 7], [7, 9],
];
const GROUPS = 3;

let grainX = new Float32Array(0);
let grainY = new Float32Array(0);
let n = 1;
let m = 2;
/** Smoothed pitch of the music, 0..1. */
let pitch = 0.2;

function scatter(count: number): void {
  grainX = new Float32Array(count);
  grainY = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    grainX[i] = rnd(-1, 1);
    grainY[i] = rnd(-1, 1);
  }
}

/** Spectral centroid of the lower spectrum, 0..1. */
function measurePitch(): number {
  const freq = audio.freq;
  const top = Math.min(freq.length, 256);
  let weighted = 0;
  let total = 0;
  for (let i = 2; i < top; i++) {
    weighted += i * freq[i];
    total += freq[i];
  }
  return total > 0 ? weighted / total / top : 0;
}

export const cymatics: Mode = {
  name: 'cymatics',
  fade: 0.4,
  bloom: 0.5,
  blend: 'source-over',
  beatRings: false,
  palettes: ['void', 'sand', 'paper', 'mono', 'blueprint', 'chalk', 'sepia'],

  beat() {
    // Higher pitch, finer pattern; a little chance keeps it from repeating.
    const index = Math.round(pitch * 2.5 * (PATTERNS.length - 1) + rnd(-1.5, 1.5));
    const [a, b] = PATTERNS[Math.max(0, Math.min(PATTERNS.length - 1, index))];
    [n, m] = Math.random() < 0.5 ? [a, b] : [b, a];
  },

  draw(dt) {
    const { cx, cy, min } = view;
    const count = quality.level === 2 ? 7000 : 4000;
    if (grainX.length !== count) scatter(count);
    pitch += (measurePitch() - pitch) * Math.min(1, dt * 2);

    const steps = Math.min(3, dt * 60);
    const kn = n * Math.PI;
    const km = m * Math.PI;
    // How hard the plate shakes, and how fast the grains slide toward the still lines.
    const shake = (0.004 + audio.bass * 0.03 + audio.beat * 0.05) * steps;
    const slide = (0.012 / (n + m)) * steps;
    for (let i = 0; i < grainX.length; i++) {
      let x = grainX[i];
      let y = grainY[i];
      const cnx = Math.cos(kn * x);
      const cny = Math.cos(kn * y);
      const cmx = Math.cos(km * x);
      const cmy = Math.cos(km * y);
      const u = cnx * cmy - cmx * cny;
      // Gradient of u; a step along −u·∇u moves the grain to where u is 0.
      const dudx = -kn * Math.sin(kn * x) * cmy + km * Math.sin(km * x) * cny;
      const dudy = -km * cnx * Math.sin(km * y) + kn * cmx * Math.sin(kn * y);
      const kick = Math.abs(u) * shake;
      x += -u * dudx * slide + (Math.random() - 0.5) * kick;
      y += -u * dudy * slide + (Math.random() - 0.5) * kick;
      grainX[i] = x < -1 ? -1 : x > 1 ? 1 : x;
      grainY[i] = y < -1 ? -1 : y > 1 ? 1 : y;
    }

    const half = min * 0.44;
    ctx.strokeStyle = color(3, 0.25, 60);
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - half - 6, cy - half - 6, half * 2 + 12, half * 2 + 12);
    const size = Math.max(1.2, min / 500);
    for (let g = 0; g < GROUPS; g++) {
      ctx.fillStyle = color(g * 1.3, 0.9, 72 + audio.high * 20);
      ctx.beginPath();
      for (let i = g; i < grainX.length; i += GROUPS) {
        ctx.rect(cx + grainX[i] * half, cy + grainY[i] * half, size, size);
      }
      ctx.fill();
    }
  },
};
