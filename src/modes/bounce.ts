/** Shapes jump up on the beat and bounce on the floor. With motion on, gravity follows the phone. */
import { clamp, rnd, rndInt, TAU } from '../core/math';
import { audio, clock, motion, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import type { Mode } from './mode';

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  k: number;
  rot: number;
  spin: number;
  /** 0 circle, 1 square, 2 triangle. */
  shape: number;
  age: number;
}

const LIFETIME = 6;
const bodies: Body[] = [];

function drawBody(b: Body): void {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ctx.fillStyle = color(b.k, Math.min(1, LIFETIME - b.age), 55);
  ctx.beginPath();
  if (b.shape === 0) ctx.arc(0, 0, b.r, 0, TAU);
  else if (b.shape === 1) ctx.rect(-b.r, -b.r, 2 * b.r, 2 * b.r);
  else {
    ctx.moveTo(0, -b.r);
    ctx.lineTo(b.r, b.r);
    ctx.lineTo(-b.r, b.r);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

export const bounce: Mode = {
  name: 'bounce',
  fade: 0.5,
  blend: 'source-over',

  beat() {
    const { width, height, cx, cy } = view;
    const count = 6 + Math.floor(audio.bass * 16);
    for (let i = 0; i < count; i++) {
      bodies.push({
        x: cx + rnd(-width * 0.2, width * 0.2),
        y: cy,
        vx: rnd(-1, 1) * width * 0.8,
        vy: -rnd(0.4, 1.2) * height * 1.2,
        r: rnd(8, 26) * (1 + audio.bass),
        k: Math.random() * 4,
        rot: Math.random() * TAU,
        spin: rnd(-6, 6),
        shape: rndInt(3),
        age: 0,
      });
    }
  },

  draw(dt) {
    const { width, height } = view;
    const gravity = height * 2.2;
    const gravityX = motion.enabled ? motion.gravityX : 0;
    const gravityY = motion.enabled ? Math.max(0.15, motion.gravityY) : 1;
    // Treble drops small pieces from the top.
    if (Math.random() < audio.high * 0.35) {
      bodies.push({
        x: Math.random() * width,
        y: -20,
        vx: rnd(-80, 80),
        vy: 0,
        r: rnd(5, 12),
        k: Math.random() * 4,
        rot: 0,
        spin: rnd(-8, 8),
        shape: rndInt(3),
        age: 0,
      });
    }
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      b.vy += gravity * gravityY * dt;
      b.vx += gravity * gravityX * dt + Math.sin(clock.time) * audio.high * 400 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      b.age += dt;
      if (b.y > height - b.r) {
        b.y = height - b.r;
        b.vy *= -0.65;
        b.vx *= 0.9;
        if (Math.abs(b.vy) < 40) b.vy = 0;
      }
      if (b.x < b.r || b.x > width - b.r) {
        b.vx *= -0.8;
        b.x = clamp(b.x, b.r, width - b.r);
      }
      if (b.age > LIFETIME) {
        bodies.splice(i, 1);
        continue;
      }
      drawBody(b);
    }
    while (bodies.length > 220) bodies.shift();
  },
};
