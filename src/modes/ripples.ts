/** Ripples spread from five drifting points, as on water. */
import { rnd, rndInt, TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle, strokeCircle } from '../render/shapes';
import type { Mode } from './mode';

interface Source {
  /** Position as a fraction of the screen. */
  x: number;
  y: number;
  k: number;
  phase: number;
}

interface Ripple {
  source: Source;
  r: number;
  width: number;
  k: number;
}

let sources: Source[] = [];
const waves: Ripple[] = [];

function ensureSources(): void {
  if (sources.length) return;
  for (let i = 0; i < 5; i++) {
    sources.push({ x: rnd(0.15, 0.85), y: rnd(0.15, 0.85), k: i, phase: Math.random() * TAU });
  }
}

export const ripples: Mode = {
  name: 'ripples',
  fade: 0.1,

  beat() {
    ensureSources();
    for (const source of sources) {
      if (Math.random() < 0.7) waves.push({ source, r: 0, width: 2 + audio.bass * 8, k: source.k });
    }
  },

  resize() {
    sources = [];
  },

  draw(dt) {
    const { width, height, min } = view;
    ensureSources();
    for (const s of sources) {
      s.x += Math.sin(clock.time * 0.3 + s.phase) * 0.0004;
      s.y += Math.cos(clock.time * 0.25 + s.phase) * 0.0004;
    }
    if (Math.random() < audio.high * 0.6) {
      const source = sources[rndInt(sources.length)];
      waves.push({ source, r: 0, width: 1, k: source.k + 2 });
    }
    const maxR = min * 0.8;
    for (let i = waves.length - 1; i >= 0; i--) {
      const ripple = waves[i];
      ripple.r += dt * (180 + audio.mid * 300);
      if (ripple.r > maxR) {
        waves.splice(i, 1);
        continue;
      }
      const a = 1 - ripple.r / maxR;
      ctx.strokeStyle = color(ripple.k, a * 0.9, 60);
      ctx.lineWidth = ripple.width * (1 + a * 2);
      strokeCircle(ctx, ripple.source.x * width, ripple.source.y * height, ripple.r);
    }
    for (const s of sources) {
      ctx.fillStyle = color(s.k, 0.9, 85);
      fillCircle(ctx, s.x * width, s.y * height, 3 + audio.bass * 10);
    }
  },
};
