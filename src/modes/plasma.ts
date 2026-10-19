/**
 * Liquid plasma. The classic demo-scene sum of sine waves, with three additions:
 * the space is bent by its own waves first (domain warping), two moving sources send
 * out interfering ripples, and thin dark contour lines cut the colours into bands,
 * like a topographic map. The colours cycle through the palette.
 * Bass: how much the space bends, and the second ripple. Mid: speed. Treble: more
 * contour bands and faster colour cycling. Beat: a jolt of bending and colour.
 */
import { clamp } from '../core/math';
import { audio, clock, scene, view } from '../core/state';
import { ctx } from '../render/canvases';
import { colorRgb } from '../render/color';
import { colorRamp, PixelLayer } from '../render/pixelLayer';
import { quality } from '../render/quality';
import type { Mode } from './mode';

const RAMP_SIZE = 256;
const layer = new PixelLayer();
/** Colour cycling position, 0..1 per palette cycle. */
let cycle = 0;
/** Extra bending after a beat, 1..0. */
let jolt = 0;

export const plasma: Mode = {
  name: 'plasma',
  fade: 1,
  bloom: 0.35,
  blend: 'source-over',
  beatRings: false,
  palettes: ['scriabin', 'acid', 'lava', 'ultraviolet', 'vapor', 'toxic', 'technicolor', 'candy'],

  beat() {
    jolt = 1;
    cycle += 0.12;
  },

  draw(dt) {
    const { width, height } = view;
    const cell = quality.level === 2 ? 4 : 6;
    const w = clamp(Math.round(width / cell), 48, 220);
    const h = Math.max(36, Math.round((w * height) / width));
    layer.setSize(w, h);

    const time = clock.time * (0.5 + audio.mid * 0.9);
    cycle += dt * (0.05 + audio.high * 0.25);
    jolt = Math.max(0, jolt - dt * 2);
    const bend = 0.35 + audio.bass * 0.9 + jolt * 0.8;
    const bands = 4 + audio.high * 5;
    const rippleB = 2 + audio.bass * 2;
    // A plane wave that turns, and two ripple sources that wander.
    const ca = Math.cos(time * 0.21);
    const sa = Math.sin(time * 0.21);
    const s1x = Math.sin(time * 0.37) * 2.2;
    const s1y = Math.cos(time * 0.29) * 1.6;
    const s2x = Math.cos(time * 0.23) * 2.4;
    const s2y = Math.sin(time * 0.41) * 1.4;

    // One full turn of the palette (its colours repeat after `span`).
    const span = scene.palette.rgb ? scene.palette.rgb.length : 9;
    const ramp = colorRamp(RAMP_SIZE, (t) => colorRgb(t * span, 58));
    const pixels = layer.pixels;
    const aspect = w / h;
    let p = 0;
    for (let j = 0; j < h; j++) {
      const y = (j / h - 0.5) * 6;
      for (let i = 0; i < w; i++) {
        const x = (i / w - 0.5) * 6 * aspect;
        const wx = x + bend * Math.sin(y * 1.3 + time);
        const wy = y + bend * Math.cos(x * 1.1 - time * 0.8);
        const field =
          Math.sin(wx * 1.2 + time) +
          Math.sin((wx * ca + wy * sa) * 1.6 - time * 1.3) +
          Math.sin(Math.hypot(wx - s1x, wy - s1y) * 2.4 - time * 2) +
          Math.sin(Math.hypot(wx - s2x, wy - s2y) * rippleB - time * 2.6);
        const n = field * 0.125 + 0.5;
        // Contour lines: dark where the value crosses a band edge.
        const band = n * bands;
        const edge = band - Math.floor(band);
        const shade = 0.45 + 0.55 * Math.min(1, Math.min(edge, 1 - edge) * 6);
        const c = n * 2 + cycle;
        const r = (((c - Math.floor(c)) * (RAMP_SIZE - 1)) | 0) * 3;
        pixels[p] = ramp[r] * shade;
        pixels[p + 1] = ramp[r + 1] * shade;
        pixels[p + 2] = ramp[r + 2] * shade;
        pixels[p + 3] = 255;
        p += 4;
      }
    }
    layer.flush();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer.canvas, 0, 0, width, height);
  },
};
