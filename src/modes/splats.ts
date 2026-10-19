/** Paint splats with droplets land on the beat and slowly cover the canvas. */
import { rnd, TAU } from '../core/math';
import { audio, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { blobPath } from '../render/shapes';
import type { Mode } from './mode';

interface Splat {
  x: number;
  y: number;
  r: number;
  k: number;
  seed: number;
  /** Growth: starts below 1 and the splat is done at 1. */
  t: number;
}

const blobs: Splat[] = [];

export const splats: Mode = {
  name: 'splats',
  fade: 0.015,
  beatRings: false,
  palettes: ['paper', 'cream', 'sand', 'candy', 'mint', 'chalk'],

  beat() {
    const { width, height, min } = view;
    const count = 1 + Math.floor(audio.bass * 3);
    for (let i = 0; i < count; i++) {
      const x = rnd(width * 0.1, width * 0.9);
      const y = rnd(height * 0.1, height * 0.9);
      const r = min * (0.06 + audio.bass * 0.22) * rnd(0.6, 1.2);
      const k = Math.random() * 4;
      blobs.push({ x, y, r, k, seed: Math.random() * 100, t: 0 });
      for (let d = 0; d < 8; d++) {
        const a = Math.random() * TAU;
        const distance = r * rnd(1, 2.2);
        blobs.push({
          x: x + Math.cos(a) * distance,
          y: y + Math.sin(a) * distance,
          r: r * rnd(0.05, 0.2),
          k,
          seed: Math.random() * 100,
          t: 0.2,
        });
      }
    }
  },

  draw(dt) {
    const { width, height } = view;
    if (Math.random() < audio.high * 0.5) {
      blobs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: rnd(2, 8) * (1 + audio.high * 3),
        k: Math.random() * 4,
        seed: Math.random() * 100,
        t: 0.3,
      });
    }
    for (let i = blobs.length - 1; i >= 0; i--) {
      const s = blobs[i];
      s.t += dt * 3;
      const grown = Math.min(1, s.t);
      ctx.fillStyle = color(s.k, 0.85, 50);
      blobPath(ctx, s.x, s.y, s.r * (0.2 + 0.8 * Math.sin((grown * Math.PI) / 2)), 0.9, s.seed);
      ctx.fill();
      if (grown >= 1) blobs.splice(i, 1);
    }
  },
};
