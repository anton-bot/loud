/**
 * Reaction-diffusion (the Gray-Scott model, with Karl Sims's constants): two chemicals
 * spread at different speeds and one eats the other. Depending on the feed and kill
 * rates they grow coral, spots that divide, or worms. The rates move from one pattern
 * to the next over time; bass feeds the growth, and each beat drops new chemical.
 */
import { clamp, rnd, rndInt } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { colorRgb } from '../render/color';
import { colorRamp, paintField, PixelLayer } from '../render/pixelLayer';
import { quality } from '../render/quality';
import type { Mode } from './mode';

/** Feed and kill rates of some well-known patterns. */
const PATTERNS = [
  { name: 'coral', feed: 0.0545, kill: 0.062 },
  { name: 'mitosis', feed: 0.0367, kill: 0.0649 },
  { name: 'worms', feed: 0.029, kill: 0.057 },
  { name: 'holes', feed: 0.039, kill: 0.058 },
  { name: 'spots', feed: 0.03, kill: 0.062 },
] as const;
const DIFFUSION_A = 1.0;
const DIFFUSION_B = 0.5;

const layer = new PixelLayer();
let gridW = 0;
let gridH = 0;
let a = new Float32Array(0);
let b = new Float32Array(0);
let nextA = new Float32Array(0);
let nextB = new Float32Array(0);
let feed: number = PATTERNS[0].feed;
let kill: number = PATTERNS[0].kill;
let target = 0;
let beatsInPattern = 0;

/** Drops chemical B in a disc. */
function drop(cx: number, cy: number, r: number): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const ix = (((cx + x) % gridW) + gridW) % gridW;
      const iy = (((cy + y) % gridH) + gridH) % gridH;
      b[iy * gridW + ix] = 1;
      a[iy * gridW + ix] = 0.5;
    }
  }
}

function setUp(w: number, h: number): void {
  gridW = w;
  gridH = h;
  layer.setSize(w, h);
  a = new Float32Array(w * h).fill(1);
  b = new Float32Array(w * h);
  nextA = new Float32Array(w * h);
  nextB = new Float32Array(w * h);
  for (let i = 0; i < 12; i++) drop(rndInt(w), rndInt(h), 2 + rndInt(4));
}

/** One step of the simulation on the wrapping grid (3×3 Laplacian: 0.2 sides, 0.05 corners). */
function react(f: number, k: number): void {
  const w = gridW;
  const h = gridH;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const up = ((y + h - 1) % h) * w;
    const down = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const l = x === 0 ? w - 1 : x - 1;
      const r = x === w - 1 ? 0 : x + 1;
      const i = row + x;
      const av = a[i];
      const bv = b[i];
      const lapA =
        (a[row + l] + a[row + r] + a[up + x] + a[down + x]) * 0.2 +
        (a[up + l] + a[up + r] + a[down + l] + a[down + r]) * 0.05 -
        av;
      const lapB =
        (b[row + l] + b[row + r] + b[up + x] + b[down + x]) * 0.2 +
        (b[up + l] + b[up + r] + b[down + l] + b[down + r]) * 0.05 -
        bv;
      const reaction = av * bv * bv;
      nextA[i] = clamp(av + DIFFUSION_A * lapA - reaction + f * (1 - av), 0, 1);
      nextB[i] = clamp(bv + DIFFUSION_B * lapB + reaction - (k + f) * bv, 0, 1);
    }
  }
  [a, nextA] = [nextA, a];
  [b, nextB] = [nextB, b];
}

export const coral: Mode = {
  name: 'coral',
  fade: 1,
  bloom: 0.45,
  blend: 'source-over',
  beatRings: false,
  palettes: ['deep sea', 'lava', 'paper', 'mint', 'ultraviolet', 'sunset', 'candy'],

  beat() {
    if (!gridW) return;
    const count = 1 + Math.floor(audio.bass * 2.5);
    for (let i = 0; i < count; i++)
      drop(rndInt(gridW), rndInt(gridH), Math.round(rnd(2, 4 + audio.bass * 4)));
    // Every 16 beats, start moving toward the next pattern.
    if (++beatsInPattern >= 16) {
      beatsInPattern = 0;
      target = (target + 1) % PATTERNS.length;
    }
  },

  resize() {
    gridW = 0;
  },

  draw(dt) {
    const { width, height } = view;
    const cell = quality.level === 2 ? 5 : 6;
    const w = Math.max(32, Math.min(170, Math.round(width / cell)));
    const h = Math.max(24, Math.round((w * height) / width));
    if (w !== gridW || h !== gridH) setUp(w, h);

    // Glide toward the target pattern, so that one pattern grows out of the last.
    const goal = PATTERNS[target];
    feed += (goal.feed - feed) * Math.min(1, dt * 0.4);
    kill += (goal.kill - kill) * Math.min(1, dt * 0.4);
    const f = feed + audio.bass * 0.006;
    const iterations = Math.round((quality.level === 2 ? 8 : 5) * Math.min(2, dt * 60));
    for (let n = 0; n < iterations; n++) react(f, kill);
    // Some rates can starve the pattern: seed it again when almost nothing is left.
    let total = 0;
    for (let i = 0; i < b.length; i += 7) total += b[i];
    if (total < b.length / 7 / 500) drop(rndInt(gridW), rndInt(gridH), 4);

    const shift = clock.time * 0.04;
    const ramp = colorRamp(256, (t) => colorRgb(t * 3 + shift, 6 + t * 88));
    paintField(layer, b, ramp, (v) => v * 3.2);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer.canvas, 0, 0, width, height);
  },
};
