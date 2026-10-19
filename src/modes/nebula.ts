/** Particles burst out of a glowing core and swirl with the treble. */
import { TAU } from '../core/math';
import { audio, motion, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle } from '../render/shapes';
import type { Mode } from './mode';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  k: number;
  r: number;
}

const MAX_PARTICLES = 420;
const particles: Particle[] = [];

function spawn(count: number, speed: number, spread: number): void {
  for (let n = 0; n < count; n++) {
    const angle = Math.random() * TAU;
    const v = speed * (0.4 + Math.random());
    particles.push({
      x: view.cx,
      y: view.cy,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: 1,
      decay: 0.35 + Math.random() * 0.5,
      k: (Math.random() - 0.5) * spread,
      r: 2 + Math.random() * 4,
    });
  }
  while (particles.length > MAX_PARTICLES) particles.shift();
}

export const nebula: Mode = {
  name: 'nebula',
  fade: 0.14,

  beat() {
    spawn(40 + Math.floor(audio.bass * 80), 250 + audio.bass * 400, 3);
  },

  draw(dt) {
    const { width, height, cx, cy } = view;
    spawn(Math.floor(1 + audio.mid * 6), 60 + audio.mid * 200, 1.5);
    const swirl = audio.high * 1.2;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const dx = p.x - cx;
      const dy = p.y - cy;
      p.vx += -dy * swirl * dt + (motion.enabled ? motion.tiltX * 500 * dt : 0);
      p.vy += dx * swirl * dt + (motion.enabled ? motion.tiltY * 500 * dt : 0);
      p.x += p.vx * dt * (1 + audio.bass * 2);
      p.y += p.vy * dt * (1 + audio.bass * 2);
      p.vx *= 0.995;
      p.vy *= 0.995;
      p.life -= p.decay * dt;
      if (p.life <= 0 || p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) {
        particles.splice(i, 1);
        continue;
      }
      ctx.fillStyle = color(p.k, p.life * 0.9, 55 + audio.high * 20);
      fillCircle(ctx, p.x, p.y, p.r * (0.5 + p.life) * (1 + audio.beat * 0.8));
    }

    const coreR = 40 + audio.bass * 140 + audio.beat * 60;
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    core.addColorStop(0, color(1, 0.9, 85));
    core.addColorStop(0.4, color(0, 0.5, 55));
    core.addColorStop(1, color(0, 0, 55));
    ctx.fillStyle = core;
    fillCircle(ctx, cx, cy, coreR);
  },
};
