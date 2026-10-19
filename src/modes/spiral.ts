/** Three spiral arms of dots; each dot grows with its part of the spectrum. */
import { TAU } from '../core/math';
import { spectrumAt } from '../core/signal';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle } from '../render/shapes';
import type { Mode } from './mode';

const ARMS = 3;
const DOTS = 220;

export const spiral: Mode = {
  name: 'spiral',
  fade: 0.2,
  zoom: 1.003,
  rotate: 0.004,

  draw() {
    const { cx, cy, min } = view;
    const turn = clock.time * (0.3 + audio.mid);
    for (let arm = 0; arm < ARMS; arm++) {
      for (let i = 0; i < DOTS; i++) {
        const t = i / DOTS;
        const v = spectrumAt(t, 0.4);
        const a = turn + (arm * TAU) / ARMS + t * TAU * 2.2;
        const r = min * 0.02 + t * min * 0.55 * (1 + audio.bass * 0.15) + v * min * 0.06;
        ctx.fillStyle = color(arm + t * 2, 0.6 + v * 0.4, 50 + v * 40);
        fillCircle(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1 + v * v * 9 + audio.beat * 2);
      }
    }
  },
};
