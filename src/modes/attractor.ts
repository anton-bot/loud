/**
 * A strange attractor (Peter de Jong and Clifford Pickover maps): one point jumps
 * around by a simple formula, and the places it lands, plotted as a glowing density,
 * draw a smoky shape. The four parameters never rest: they wander in slow waves, the
 * music pushes them, and every 4 beats the shape morphs into another one.
 *
 *   de Jong:   x' = sin(a·y) − cos(b·x)      y' = sin(c·x) − cos(d·y)
 *   Clifford:  x' = sin(a·y) + c·cos(a·x)    y' = sin(b·x) + d·cos(b·y)
 */
import { pick } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { colorRgb } from '../render/color';
import { colorRamp, paintField, PixelLayer } from '../render/pixelLayer';
import { quality } from '../render/quality';
import type { Mode } from './mode';

interface Shape {
  map: 'dejong' | 'clifford';
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Parameter sets that give interesting shapes. */
// prettier-ignore
const SHAPES: readonly Shape[] = [
  { map: 'dejong', a: 1.641, b: 1.902, c: 0.316, d: 1.525 },
  { map: 'dejong', a: 0.97, b: -1.899, c: 1.381, d: -1.506 },
  { map: 'dejong', a: 1.4, b: -2.3, c: 2.4, d: -2.1 },
  { map: 'dejong', a: 2.01, b: -2.53, c: 1.61, d: -0.33 },
  { map: 'dejong', a: -2.7, b: -0.09, c: -0.86, d: -2.2 },
  { map: 'dejong', a: -2.24, b: 0.43, c: -0.65, d: -2.43 },
  { map: 'clifford', a: -1.4, b: 1.6, c: 1.0, d: 0.7 },
  { map: 'clifford', a: 1.1, b: -1.0, c: 1.0, d: 1.5 },
  { map: 'clifford', a: 1.6, b: -0.6, c: -1.2, d: 1.6 },
  { map: 'clifford', a: 1.7, b: 1.7, c: 0.06, d: 1.2 },
  { map: 'clifford', a: -1.7, b: 1.3, c: -0.1, d: -1.2 },
  { map: 'clifford', a: -1.8, b: -2.0, c: -0.5, d: -0.9 },
];

const layer = new PixelLayer();
let gridW = 0;
let gridH = 0;
let density = new Float32Array(0);
let shape: Shape = { ...SHAPES[0] };
let target: Shape = SHAPES[0];
let x = 0.1;
let y = 0.1;
let beats = 0;
/** Rotation of the whole shape (radians). */
let turn = 0;
/** Smoothed centre and half-size of the shape, after rotation, in attractor units. */
const fit = { x: 0, y: 0, half: 2 };
/** Frames in a row with almost nothing lit. */
let collapsed = 0;
/** Recent highest density, for the tone curve. */
let peak = 1;

function setUp(w: number, h: number): void {
  gridW = w;
  gridH = h;
  layer.setSize(w, h);
  density = new Float32Array(w * h);
}

export const attractor: Mode = {
  name: 'attractor',
  fade: 1,
  bloom: 0.9,
  blend: 'source-over',
  beatRings: false,
  palettes: ['void', 'ultraviolet', 'deep sea', 'lava', 'sepia', 'acid', 'ice'],

  beat() {
    if (++beats % 4 !== 0) return;
    target = pick(SHAPES, target);
    // Shapes of the other map cannot morph into each other: jump.
    if (target.map !== shape.map) shape = { ...target };
  },

  resize() {
    gridW = 0;
  },

  draw(dt) {
    const { width, height } = view;
    const w = Math.max(64, Math.min(480, Math.round(width / 2)));
    const h = Math.max(48, Math.round((w * height) / width));
    if (w !== gridW || h !== gridH) setUp(w, h);

    // Morph toward the target, and let the music bend the shape.
    const k = Math.min(1, dt * 1.5);
    shape.a += (target.a - shape.a) * k;
    shape.b += (target.b - shape.b) * k;
    shape.c += (target.c - shape.c) * k;
    shape.d += (target.d - shape.d) * k;
    // Slow waves and the music keep the shape moving between morphs.
    const time = clock.time;
    const a = shape.a + Math.sin(time * 0.23) * 0.12 + audio.bass * 0.25;
    const b = shape.b + Math.sin(time * 0.31 + 1) * 0.1 - audio.mid * 0.2;
    const c = shape.c + Math.sin(time * 0.19 + 2) * 0.1 + audio.high * 0.15;
    const d = shape.d + Math.sin(time * 0.27 + 3) * 0.1;

    const steps = Math.min(3, dt * 60);
    const keep = Math.pow(0.86, steps);
    for (let i = 0; i < density.length; i++) density[i] *= keep;

    // The view follows the shape's real bounds (from the last frame): centred and filling the screen.
    const scale =
      (Math.min(w, h) / 2 / fit.half) * (0.86 + audio.beat * 0.1 + Math.sin(time * 0.5) * 0.04);
    turn += dt * (0.12 + audio.mid * 0.4);
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const points = (quality.level === 2 ? 50000 : 24000) * Math.min(2, steps);
    const dejong = shape.map === 'dejong';
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (let i = 0; i < points; i++) {
      const nx = dejong ? Math.sin(a * y) - Math.cos(b * x) : Math.sin(a * y) + c * Math.cos(a * x);
      const ny = dejong ? Math.sin(c * x) - Math.cos(d * y) : Math.sin(b * x) + d * Math.cos(b * y);
      x = nx;
      y = ny;
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      if (rx < left) left = rx;
      if (rx > right) right = rx;
      if (ry < top) top = ry;
      if (ry > bottom) bottom = ry;
      const px = Math.floor(w / 2 + (rx - fit.x) * scale);
      const py = Math.floor(h / 2 + (ry - fit.y) * scale);
      if (px >= 0 && px < w && py >= 0 && py < h) density[py * w + px] += 1;
    }
    // Grow at once (nothing is cut off), shrink slowly (no jitter).
    const follow = Math.min(1, dt * 8);
    fit.x += ((left + right) / 2 - fit.x) * follow;
    fit.y += ((top + bottom) / 2 - fit.y) * follow;
    const half = Math.max(0.2, Math.max(right - left, bottom - top) / 2);
    fit.half = half > fit.half ? half : fit.half + (half - fit.half) * Math.min(1, dt * 2);

    // Tone curve: logarithmic, scaled to the recent peak.
    let max = 1;
    let lit = 0;
    for (let i = 0; i < density.length; i += 11) {
      if (density[i] > max) max = density[i];
      if (density[i] > 0.5) lit++;
    }
    // Collapsed into a few points (a periodic orbit): jump to another shape.
    collapsed = lit < 40 ? collapsed + 1 : 0;
    if (collapsed > 20) {
      target = pick(SHAPES, target);
      shape = { ...target };
      collapsed = 0;
    }
    peak += (max - peak) * Math.min(1, dt * 2);
    const logPeak = Math.log1p(peak * 1.5);
    const shift = clock.time * 0.04;
    const ramp = colorRamp(256, (t) => colorRgb(t * 2.2 + shift, 3 + t * 97));
    paintField(layer, density, ramp, (v) => Math.log1p(v) / logPeak);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer.canvas, 0, 0, width, height);
  },
};
