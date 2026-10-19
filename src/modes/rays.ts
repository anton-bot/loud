/** Sunburst: rotating ray wedges, a counter-rotating inner star and a bright core. */
import { rndInt, TAU } from '../core/math';
import { audio, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle, fillWedge } from '../render/shapes';
import type { Mode } from './mode';

let rayCount = 16;
let angle = 0;

export const rays: Mode = {
  name: 'rays',
  fade: 1,
  bloom: 0.25,
  blend: 'source-over',

  beat() {
    if (Math.random() < 0.4) rayCount = 8 + 2 * rndInt(12);
  },

  draw(dt) {
    const { cx, cy, min } = view;
    angle += dt * (0.2 + audio.mid * 1.5) * (rayCount % 4 ? 1 : -1);

    const outerR = Math.hypot(cx, cy) * 1.05;
    for (let i = 0; i < rayCount; i++) {
      const a0 = angle + (i / rayCount) * TAU;
      ctx.fillStyle = color(i % 2 ? 1 : 0, 1, 50 + (i % 2) * 15);
      fillWedge(ctx, cx, cy, outerR, a0, a0 + (TAU / rayCount) * (0.5 + audio.bass * 0.4));
    }

    const innerCount = Math.max(6, rayCount / 2);
    const innerR = min * (0.25 + audio.bass * 0.2);
    for (let i = 0; i < innerCount; i++) {
      const a0 = -angle * 1.5 + (i / innerCount) * TAU;
      ctx.fillStyle = color(2 + (i % 2), 1, 65);
      fillWedge(ctx, cx, cy, innerR, a0, a0 + (TAU / innerCount) * 0.5);
    }

    ctx.fillStyle = color(3, 1, 90);
    fillCircle(ctx, cx, cy, min * (0.05 + audio.bass * 0.08));
  },
};
