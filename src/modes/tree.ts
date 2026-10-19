/** A recursive tree that sways with the mids and blossoms with the treble. */
import { hash01 } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle } from '../render/shapes';
import type { Mode } from './mode';

/** Upper limit of branches per frame. */
const MAX_BRANCHES = 1200;
let treeSeed = 1;

export const tree: Mode = {
  name: 'tree',
  fade: 0.3,
  palettes: ['forest', 'mushroom', 'paper', 'toxic'],

  beat() {
    if (Math.random() < 0.3) treeSeed = Math.random() * 1000;
  },

  draw() {
    const { width, height, cx, min } = view;
    const time = clock.time;
    const depth = width > height ? 9 : 8;
    const sway = Math.sin(time * 1.2) * 0.15 * (0.5 + audio.mid);
    const spread = 0.35 + audio.mid * 0.35 + Math.sin(time * 0.3) * 0.1;
    let branches = 0;
    ctx.lineCap = 'round';

    function branch(
      x: number,
      y: number,
      length: number,
      angle: number,
      d: number,
      seed: number,
    ): void {
      if (d <= 0 || branches++ > MAX_BRANCHES) return;
      const x2 = x + Math.cos(angle) * length;
      const y2 = y + Math.sin(angle) * length;
      ctx.strokeStyle = color(d * 0.45 + time * 0.2, 0.9, 45 + (depth - d) * 5);
      ctx.lineWidth = Math.max(1, d * d * 0.25 * (1 + audio.bass * 0.5));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (d <= 2) {
        ctx.fillStyle = color(3 + time * 0.2, 0.9, 80);
        fillCircle(ctx, x2, y2, 2 + audio.high * 6);
      }
      const r1 = hash01(seed * 12.9898);
      const r2 = hash01(seed * 78.233);
      branch(
        x2,
        y2,
        length * (0.62 + r1 * 0.14),
        angle - spread * (0.7 + r2 * 0.6) + sway,
        d - 1,
        seed * 1.7 + 1,
      );
      branch(
        x2,
        y2,
        length * (0.62 + r2 * 0.14),
        angle + spread * (0.7 + r1 * 0.6) + sway,
        d - 1,
        seed * 2.3 + 2,
      );
      if (d > 5 && r1 > 0.6) branch(x2, y2, length * 0.5, angle + sway * 2, d - 2, seed * 3.1 + 3);
    }

    branch(cx, height, min * 0.22 * (1 + audio.bass * 0.2), -Math.PI / 2, depth, treeSeed);
  },
};
