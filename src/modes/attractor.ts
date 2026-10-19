/**
 * A strange attractor (Peter de Jong and Clifford Pickover maps): one point jumps
 * around by a simple formula, and the places it lands, plotted as a glowing density,
 * draw a smoky shape. The music bends the four parameters a little all the time;
 * every 8 beats the shape morphs into another one.
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
/** Recent highest density, for the tone curve. */
let peak = 1;

function setUp(w: number, h: number): void {
  gridW = w;
  gridH = h;
  layer.setSize(w, h);
  density = new Float32Array(w * h);
}

/** Half the width of the area that the shape fills. */
function extent(s: Shape): number {
  return s.map === 'dejong' ? 2.1 : 1.05 + Math.max(Math.abs(s.c), Math.abs(s.d));
}

export const attractor: Mode = {
  name: 'attractor',
  fade: 1,
  bloom: 0.9,
  blend: 'source-over',
  beatRings: false,
  palettes: ['void', 'ultraviolet', 'deep sea', 'lava', 'sepia', 'acid', 'ice'],

  beat() {
    if (++beats % 8 !== 0) return;
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
    const k = Math.min(1, dt * 0.8);
    shape.a += (target.a - shape.a) * k;
    shape.b += (target.b - shape.b) * k;
    shape.c += (target.c - shape.c) * k;
    shape.d += (target.d - shape.d) * k;
    const a = shape.a + audio.bass * 0.12;
    const b = shape.b - audio.mid * 0.1;
    const c = shape.c + audio.high * 0.08;
    const d = shape.d + Math.sin(clock.time * 0.3) * 0.05;

    const steps = Math.min(3, dt * 60);
    const keep = Math.pow(0.86, steps);
    for (let i = 0; i < density.length; i++) density[i] *= keep;

    const scale = (Math.min(w, h) / 2 / extent(shape)) * (0.92 + audio.beat * 0.05);
    const turn = clock.time * 0.03;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const points = (quality.level === 2 ? 50000 : 24000) * Math.min(2, steps);
    const dejong = shape.map === 'dejong';
    for (let i = 0; i < points; i++) {
      const nx = dejong ? Math.sin(a * y) - Math.cos(b * x) : Math.sin(a * y) + c * Math.cos(a * x);
      const ny = dejong ? Math.sin(c * x) - Math.cos(d * y) : Math.sin(b * x) + d * Math.cos(b * y);
      x = nx;
      y = ny;
      const px = Math.floor(w / 2 + (x * cos - y * sin) * scale);
      const py = Math.floor(h / 2 + (x * sin + y * cos) * scale);
      if (px >= 0 && px < w && py >= 0 && py < h) density[py * w + px] += 1;
    }

    // Tone curve: logarithmic, scaled to the recent peak.
    let max = 1;
    for (let i = 0; i < density.length; i += 11) if (density[i] > max) max = density[i];
    peak += (max - peak) * Math.min(1, dt * 2);
    const logPeak = Math.log1p(peak * 1.5);
    const shift = clock.time * 0.04;
    const ramp = colorRamp(256, (t) => colorRgb(t * 2.2 + shift, 3 + t * 97));
    paintField(layer, density, ramp, (v) => Math.log1p(v) / logPeak);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer.canvas, 0, 0, width, height);
  },
};
