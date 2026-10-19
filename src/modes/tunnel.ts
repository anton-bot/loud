/** Polygon rings fly toward the viewer; sparks stream along the spokes. */
import { rndInt, TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle, pathPoint } from '../render/shapes';
import type { Mode } from './mode';

interface Ring {
  /** Distance travelled: 0 at the vanishing point, 1.2 off the screen. */
  s: number;
  k: number;
  sides: number;
  rot: number;
  width: number;
  dir: number;
}

const rings: Ring[] = [];

export const tunnel: Mode = {
  name: 'tunnel',
  fade: 0.07,
  zoom: 1.025,
  rotate: 0.003,

  beat() {
    rings.push({
      s: 0.02,
      k: Math.random() * 4,
      sides: 3 + rndInt(5),
      rot: Math.random() * 6.28,
      width: 2 + audio.bass * 8,
      dir: Math.random() < 0.5 ? 1 : -1,
    });
  },

  draw(dt) {
    const { width, height, cx, cy } = view;
    if (Math.random() < audio.mid * 0.35) {
      rings.push({
        s: 0.02,
        k: 2 + Math.random() * 2,
        sides: 4 + rndInt(4),
        rot: clock.time,
        width: 1.5,
        dir: 1,
      });
    }
    const far = Math.max(width, height) * 0.8;
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      ring.s += dt * (0.35 + audio.bass * 1.2 + audio.beat * 0.5) * (0.2 + ring.s * 1.5);
      ring.rot += dt * 0.6 * ring.dir;
      if (ring.s > 1.2) {
        rings.splice(i, 1);
        continue;
      }
      const r = ring.s * far;
      ctx.strokeStyle = color(ring.k + ring.s * 1.5, (1 - ring.s / 1.2) * 0.9, 60);
      ctx.lineWidth = ring.width * (1 + ring.s * 3);
      ctx.beginPath();
      for (let k = 0; k <= ring.sides; k++) {
        const a = ring.rot + (k / ring.sides) * TAU;
        pathPoint(ctx, k, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.stroke();
    }

    const spokes = 14;
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * TAU + clock.time * 0.3;
      const d = (clock.time * 260 + k * 137) % far;
      ctx.fillStyle = color(k * 0.5, 0.4 + audio.high * 0.6, 75);
      fillCircle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + audio.high * 5 * (d / far));
    }
    ctx.fillStyle = color(4.5, 0.25, 70);
    fillCircle(ctx, cx, cy, 10 + audio.bass * 60);
  },
};
