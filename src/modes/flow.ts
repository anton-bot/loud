/** Particles follow a moving flow field and leave long trails. */
import { rnd } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import type { Mode } from './mode';

interface Particle {
  x: number;
  y: number;
  k: number;
}

const particles: Particle[] = [];
/** Phase offset of the field; each beat moves it so the flow changes direction. */
let fieldPhase = 0;

export const flow: Mode = {
  name: 'flow',
  fade: 0.05,

  beat() {
    fieldPhase += rnd(0.5, 2);
  },

  resize() {
    particles.length = 0;
  },

  draw(dt) {
    const { width, height } = view;
    if (!particles.length) {
      for (let i = 0; i < 450; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          k: Math.random() * 4,
        });
      }
    }
    const scale = 0.004 + audio.high * 0.004;
    const step = (40 + audio.mid * 260) * dt;
    const t = clock.time * 0.4 + fieldPhase;
    ctx.lineWidth = 1.2 + audio.bass * 2.5;
    ctx.lineCap = 'round';
    for (const p of particles) {
      const a =
        Math.sin(p.x * scale + t) * 2 +
        Math.cos(p.y * scale * 1.3 - t * 0.8) * 2 +
        Math.sin((p.x + p.y) * scale * 0.5 + t * 0.5);
      const nx = p.x + Math.cos(a) * step;
      const ny = p.y + Math.sin(a) * step;
      ctx.strokeStyle = color(p.k + a * 0.3, 0.8, 60 + audio.high * 20);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      p.x = nx;
      p.y = ny;
      // Off the screen, or now and then anyway: start again at a random place.
      if (p.x < 0 || p.x > width || p.y < 0 || p.y > height || Math.random() < 0.002) {
        p.x = Math.random() * width;
        p.y = Math.random() * height;
      }
    }
  },
};
