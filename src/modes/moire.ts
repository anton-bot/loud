/** Moiré: two sets of rings and a line grid interfere. */
import { TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import type { Mode } from './mode';

const RINGS = 44;

export const moire: Mode = {
  name: 'moire',
  fade: 1,
  palettes: ['mono', 'acid', 'noir', 'void', 'ice'],

  draw() {
    const { width, height, cx, cy, min } = view;
    const time = clock.time;
    const spacing = min * 0.022 * (1 + audio.mid * 0.5);
    ctx.lineWidth = spacing * 0.5;
    const centres = [
      { x: cx + Math.sin(time * 0.5) * min * 0.15, y: cy + Math.cos(time * 0.4) * min * 0.1, k: 0 },
      {
        x: cx - Math.sin(time * 0.6) * min * 0.15 * (1 + audio.bass),
        y: cy - Math.cos(time * 0.35) * min * 0.12,
        k: 2,
      },
    ];
    for (const c of centres) {
      ctx.strokeStyle = color(c.k, 0.7, 60);
      ctx.beginPath();
      for (let i = 1; i <= RINGS; i++) {
        const r = i * spacing * (1 + audio.beat * 0.05);
        ctx.moveTo(c.x + r, c.y);
        ctx.arc(c.x, c.y, r, 0, TAU);
      }
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.2 + audio.high);
    ctx.strokeStyle = color(1, 0.5, 70);
    ctx.lineWidth = spacing * 0.4;
    ctx.beginPath();
    const diagonal = Math.hypot(width, height);
    for (let x = -diagonal / 2; x < diagonal / 2; x += spacing * 2.1) {
      ctx.moveTo(x, -diagonal / 2);
      ctx.lineTo(x, diagonal / 2);
    }
    ctx.stroke();
    ctx.restore();
  },
};
