/** Layered petal rings with beads; the symmetry changes every 8 beats. */
import { TAU } from '../core/math';
import { bandLevel } from '../core/signal';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle, pathPoint } from '../render/shapes';
import type { Mode } from './mode';

const LAYERS = 6;

export const mandala: Mode = {
  name: 'mandala',
  fade: 0.35,
  zoom: 1.004,
  rotate: 0.004,
  palettes: ['scriabin', 'acid', 'ultraviolet', 'vapor', 'toxic', 'void'],

  draw() {
    const { cx, cy, min } = view;
    const time = clock.time;
    const symmetry = 6 + 2 * Math.floor((audio.beats / 8) % 4);
    const baseR = min * 0.46;
    ctx.lineWidth = 1.5 + audio.bass * 2;
    ctx.lineJoin = 'round';
    for (let layer = 0; layer < LAYERS; layer++) {
      const t = layer / LAYERS;
      const r0 = baseR * (1 - t * 0.85) * (0.9 + bandLevel(layer % 3) * 0.35 + audio.beat * 0.1);
      const turn = time * (0.15 + t * 0.5) * (layer % 2 ? 1 : -1);
      const points = symmetry * 24;
      ctx.strokeStyle = color(layer * 0.7, 0.7, 50 + t * 25);
      ctx.fillStyle = color(layer * 0.7 + 2, 0.04 + audio.mid * 0.08, 45);
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * TAU;
        const petal = Math.pow(Math.abs(Math.sin((a * symmetry) / 2)), 1.5 + audio.high * 2);
        const r = r0 * (0.55 + 0.45 * petal) * (1 + 0.08 * Math.sin(a * symmetry * 2 + time * 4));
        pathPoint(ctx, i, cx + Math.cos(a + turn) * r, cy + Math.sin(a + turn) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < symmetry; i++) {
        const a = ((i + 0.5) / symmetry) * TAU + turn;
        ctx.fillStyle = color(layer * 0.7 + 1, 0.9, 85);
        fillCircle(ctx, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, 2 + audio.high * 8 * (1 - t));
      }
    }
  },
};
