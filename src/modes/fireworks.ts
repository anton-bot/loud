/** Rockets launch on the beat and burst into falling sparks. */
import { clamp, rnd, TAU } from '../core/math';
import { audio, motion, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle } from '../render/shapes';
import type { Mode } from './mode';

interface Rocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  k: number;
  fuse: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  k: number;
  life: number;
}

const rockets: Rocket[] = [];
const sparks: Spark[] = [];

function burst(rocket: Rocket): void {
  const count = 60 + Math.floor(audio.bass * 90);
  const speed = rnd(150, 320) * (1 + audio.bass);
  const ring = Math.random() < 0.4;
  for (let j = 0; j < count; j++) {
    const a = ring ? (j / count) * TAU : Math.random() * TAU;
    const s = ring ? speed : speed * rnd(0.2, 1);
    sparks.push({
      x: rocket.x,
      y: rocket.y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      k: rocket.k + (ring ? 0 : Math.random() * 0.8),
      life: rnd(0.8, 1.6),
    });
  }
  audio.beat = Math.max(audio.beat, 0.7);
}

export const fireworks: Mode = {
  name: 'fireworks',
  fade: 0.12,

  beat() {
    const { width, height } = view;
    const count = 1 + Math.floor(audio.bass * 2.5);
    for (let i = 0; i < count; i++) {
      rockets.push({
        x: rnd(width * 0.15, width * 0.85),
        y: height + 10,
        vx: rnd(-40, 40),
        vy: -rnd(height * 0.9, height * 1.4),
        k: Math.random() * 4,
        fuse: rnd(0.6, 1.1),
      });
    }
  },

  draw(dt) {
    const gravity = view.height * 1.1;
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.vy += gravity * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.fuse -= dt;
      ctx.fillStyle = color(r.k, 1, 85);
      fillCircle(ctx, r.x, r.y, 3);
      // Burst when the fuse is out or at the top of the climb.
      if (r.fuse <= 0 || r.vy > 0) {
        rockets.splice(i, 1);
        burst(r);
      }
    }

    // With motion on, sparks fall toward the real ground.
    const sideways = motion.enabled ? motion.gravityX : 0;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.vy += gravity * 0.35 * dt;
      p.vx += gravity * 0.35 * sideways * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      ctx.fillStyle = color(p.k, clamp(p.life, 0, 1), 70);
      fillCircle(ctx, p.x, p.y, 1.5 + p.life * 2);
    }
    while (sparks.length > 900) sparks.shift();
  },
};
