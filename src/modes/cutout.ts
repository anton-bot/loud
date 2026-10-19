/** Stop-motion paper cut-out creature: stacked blobs with drop shadows and two eyes. */
import { bandLevel } from '../core/signal';
import { audio, clock, scene, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { blobPath, fillCircle } from '../render/shapes';
import type { Mode } from './mode';

const LAYERS = 7;
let seed = 0;

export const cutout: Mode = {
  name: 'cutout',
  fade: 1,
  bloom: 0.15,
  blend: 'source-over',
  beatRings: false,
  fps: 10,
  palettes: ['paper', 'cream', 'candy', 'sand', 'mint'],

  beat() {
    seed = Math.random() * 100;
  },

  draw() {
    const { cx, cy, min } = view;
    const time = clock.time;
    const baseR = min * 0.42;
    for (let i = LAYERS - 1; i >= 0; i--) {
      const t = i / LAYERS;
      const r = baseR * (1 - t * 0.8) * (0.85 + bandLevel(i % 3) * 0.4 + audio.beat * 0.1);
      const x = cx + Math.sin(time * 0.7 + i) * min * 0.08 * (1 + audio.mid);
      const y = cy + Math.cos(time * 0.5 + i * 1.3) * min * 0.06;
      // A little random seed change per frame makes the edges "boil" like stop motion.
      const layerSeed = seed + i * 7 + Math.random() * 0.3;
      ctx.fillStyle = scene.palette.light ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.5)';
      blobPath(ctx, x + r * 0.08, y + r * 0.1, r, 0.25, layerSeed);
      ctx.fill();
      ctx.fillStyle = color(i * 0.9, 1, 55);
      blobPath(ctx, x, y, r, 0.25, layerSeed);
      ctx.fill();
    }

    const eyeR = min * 0.03 * (1 + audio.beat);
    const eyeX = cx - eyeR * 1.6;
    const eyeY = cy - eyeR;
    for (const dx of [0, eyeR * 3.2]) {
      ctx.fillStyle = '#fff';
      fillCircle(ctx, eyeX + dx, eyeY, eyeR);
      ctx.fillStyle = '#111';
      fillCircle(
        ctx,
        eyeX + dx + Math.sin(time * 2) * eyeR * 0.4,
        eyeY + audio.bass * eyeR * 0.4,
        eyeR * 0.45,
      );
    }
  },
};
