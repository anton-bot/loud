/** Spirograph (hypotrochoid) curves in three layers; the gear sizes change on beats. */
import { rnd, TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { pathPoint } from '../render/shapes';
import type { Mode } from './mode';

/** Inner gear radius (as a fraction of the outer one) and pen distance. */
let gear = 0.25;
let pen = 0.5;

export const spiro: Mode = {
  name: 'spiro',
  fade: 0.15,
  zoom: 1.002,
  rotate: 0.003,

  beat() {
    if (Math.random() < 0.4) {
      gear = rnd(0.12, 0.45);
      pen = rnd(0.2, 0.9);
    }
  },

  draw() {
    const { cx, cy, min } = view;
    const time = clock.time;
    const R = min * 0.42;
    const k = gear;
    const l = pen;
    const points = 700;
    const t0 = time * (0.5 + audio.mid * 2);
    ctx.lineWidth = 1.5 + audio.bass * 2;
    ctx.lineJoin = 'round';
    for (let layer = 0; layer < 3; layer++) {
      ctx.strokeStyle = color(layer * 1.3 + time * 0.2, 0.8, 60 + layer * 10);
      ctx.beginPath();
      const phase = t0 + layer * 2.1;
      const size = R * (1 - layer * 0.25) * (1 + audio.bass * 0.15);
      for (let i = 0; i <= points; i++) {
        const t = (i / points) * TAU * 6;
        const x = (1 - k) * Math.cos(t + phase) + l * k * Math.cos(((1 - k) / k) * t + phase);
        const y = (1 - k) * Math.sin(t + phase) - l * k * Math.sin(((1 - k) / k) * t + phase);
        pathPoint(ctx, i, cx + x * size, cy + y * size);
      }
      ctx.stroke();
    }
  },
};
