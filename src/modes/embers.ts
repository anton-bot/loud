/** A glowing coal bed: sparks rise on the beat and heat shimmer bends the air above. */
import { clamp, rnd, rndInt, TAU } from '../core/math';
import { audio, clock, scene, view } from '../core/state';
import { ctx, drawStrip, snapshot, takeSnapshot } from '../render/canvases';
import { color } from '../render/color';
import { blobPath, fillCircle } from '../render/shapes';
import type { Mode } from './mode';

interface Coal {
  /** Position as a fraction of the screen. */
  x: number;
  y: number;
  r: number;
  seed: number;
  phase: number;
  /** Glow pulse speed. */
  speed: number;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  /** Start heat; above 1 burns white-hot for a while. */
  heat: number;
  k: number;
}

let coals: Coal[] = [];
const sparks: Ember[] = [];

function lightCoals(): void {
  coals = [];
  const count = view.width > view.height ? 34 : 22;
  for (let i = 0; i < count; i++) {
    coals.push({
      x: (i + Math.random()) / count,
      y: rnd(0.82, 0.97),
      r: view.min * rnd(0.035, 0.07),
      seed: Math.random() * 100,
      phase: Math.random() * TAU,
      speed: rnd(1, 3),
    });
  }
}

function randomCoal(): Coal {
  return coals[rndInt(coals.length)];
}

/** How bright a coal glows now, 0..max. */
function glow(c: Coal, max: number): number {
  return clamp(
    0.35 + 0.35 * Math.sin(clock.time * c.speed + c.phase) + audio.bass * 0.5 + audio.beat * 0.4,
    0,
    max,
  );
}

export const embers: Mode = {
  name: 'zeds-embers',
  fade: 0.22,
  blend: 'source-over',
  beatRings: false,
  palettes: ['lava', 'lava', 'sunset', 'wine', 'hazard', 'mushroom', 'void'],

  beat() {
    if (!coals.length) lightCoals();
    const { width, height } = view;
    const count = 20 + Math.floor(audio.bass * 50);
    for (let i = 0; i < count; i++) {
      const c = randomCoal();
      sparks.push({
        x: c.x * width + rnd(-c.r, c.r),
        y: c.y * height - c.r * 0.5,
        vx: rnd(-120, 120),
        vy: -rnd(250, 700) * (1 + audio.bass * 0.5),
        life: rnd(0.4, 1.2),
        age: 0,
        size: rnd(1.5, 3.5),
        heat: 1.3,
        k: Math.random() * 0.8,
      });
    }
  },

  resize() {
    coals = [];
  },

  draw(dt) {
    const { width, height } = view;
    const time = clock.time;
    const light = scene.palette.light;
    if (!coals.length) lightCoals();

    // Heat shimmer: the last frame rises and wobbles in thin strips.
    takeSnapshot();
    ctx.globalCompositeOperation = 'source-over';
    const strip = 10;
    const t = time * 6;
    for (let y = 0; y < height; y += strip) {
      const dx =
        Math.sin(y * 0.05 + t) * 1.2 * (1 + audio.bass) + Math.sin(y * 0.013 - t * 0.4) * 0.8;
      drawStrip(snapshot, y, strip, dx, y - 1.4 - audio.bass * 1.5);
    }

    // Warm light over the bottom of the screen.
    ctx.globalCompositeOperation = light ? 'multiply' : 'lighter';
    const warmth = ctx.createLinearGradient(0, height * 0.7, 0, height);
    warmth.addColorStop(0, color(0, 0, 40));
    warmth.addColorStop(1, color(0, 0.012 + audio.bass * 0.02, 45));
    ctx.fillStyle = warmth;
    ctx.fillRect(0, height * 0.7, width, height * 0.3);

    // A steady trickle of slower sparks.
    const trickle = Math.floor(1 + audio.mid * 5 + audio.high * 3);
    for (let i = 0; i < trickle; i++) {
      const c = randomCoal();
      sparks.push({
        x: c.x * width + rnd(-c.r, c.r),
        y: c.y * height - c.r * 0.3,
        vx: rnd(-30, 30),
        vy: -rnd(40, 140),
        life: rnd(1.5, 4),
        age: 0,
        size: rnd(1, 3),
        heat: rnd(0.6, 1),
        k: Math.random() * 0.8,
      });
    }
    while (sparks.length > 600) sparks.shift();

    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age > p.life) {
        sparks.splice(i, 1);
        continue;
      }
      p.vy -= (60 + audio.mid * 80) * dt;
      p.vx += Math.sin(time * 3 + p.y * 0.02 + p.x * 0.01) * 90 * dt;
      p.vx *= 0.985;
      p.vy *= 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const heat = p.heat * (1 - p.age / p.life);
      const flicker = 0.75 + 0.25 * Math.sin(time * 30 + p.x);
      if (heat <= 0) continue;
      ctx.fillStyle = color(
        p.k,
        Math.min(1, Math.sqrt(heat)) * flicker,
        25 + Math.min(1, heat) * 65,
      );
      fillCircle(ctx, p.x, p.y, p.size * (0.4 + heat));
    }

    // Glow around each coal.
    for (const c of coals) {
      const x = c.x * width;
      const y = c.y * height;
      const g = glow(c, 1.2);
      const halo = ctx.createRadialGradient(x, y, 0, x, y, c.r * 2.2);
      halo.addColorStop(0, color(0.3, g * 0.06, 70));
      halo.addColorStop(1, color(0.3, 0, 50));
      ctx.fillStyle = halo;
      fillCircle(ctx, x, y, c.r * 2.2);
    }

    // The coals: dark lumps with glowing cracks.
    ctx.globalCompositeOperation = 'source-over';
    for (const c of coals) {
      const x = c.x * width;
      const y = c.y * height;
      const g = glow(c, 1);
      ctx.fillStyle = light ? 'rgba(40,20,14,0.9)' : 'rgba(18,7,4,0.95)';
      blobPath(ctx, x, y, c.r, 0.35, c.seed);
      ctx.fill();
      ctx.strokeStyle = color(0.2, g, 80);
      ctx.lineWidth = 1.5 + g * 1.5;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = c.seed + k * 2.1;
        const r0 = c.r * 0.2;
        const r1 = c.r * 0.85;
        ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
        ctx.lineTo(x + Math.cos(a + 0.4) * r1, y + Math.sin(a + 0.4) * r1);
      }
      ctx.stroke();
    }
  },
};
