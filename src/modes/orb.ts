/** A glowing core fires pixelated laser bolts and shock rings, snapped to a coarse grid. */
import { rnd, TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle } from '../render/shapes';
import type { Mode } from './mode';

interface Bolt {
  angle: number;
  /** Distance of the bolt's head from the centre. */
  head: number;
  length: number;
  speed: number;
  k: number;
  /** Thickness in grid cells. */
  cells: number;
}

interface ShockRing {
  r: number;
  k: number;
}

const bolts: Bolt[] = [];
const shockRings: ShockRing[] = [];

function fire(count: number, spread: number): void {
  const { min } = view;
  const base = Math.random() * TAU;
  for (let i = 0; i < count; i++) {
    const angle = base + (i / count) * TAU + rnd(-spread, spread);
    bolts.push({
      angle,
      head: 0,
      length: min * rnd(0.08, 0.25),
      speed: min * rnd(0.9, 1.8) * (1 + audio.bass * 0.5),
      k: Math.random() * 4,
      cells: Math.random() < 0.25 ? 2 : 1,
    });
  }
  while (bolts.length > 140) bolts.shift();
}

export const orb: Mode = {
  name: 'zeds-orb',
  fade: 0.35,
  beatRings: false,
  palettes: ['void', 'neon', 'acid', 'deep sea', 'ultraviolet', 'phosphor', 'hazard', 'lava'],

  beat() {
    fire(6 + Math.floor(audio.bass * 10), 0.15);
    shockRings.push({ r: view.min * 0.12, k: Math.random() * 4 });
  },

  draw(dt) {
    const { cx, cy, min } = view;
    const time = clock.time;
    const grid = Math.max(6, Math.round(min / 44));
    const coreR = min * (0.12 + audio.bass * 0.08 + audio.beat * 0.05);
    const maxR = Math.hypot(cx, cy) + min * 0.3;
    if (Math.random() < audio.high * 0.5 + audio.mid * 0.15) fire(1, Math.PI);

    /** Fills the grid cell under (x, y), `cells` cells wide. */
    const cell = (x: number, y: number, cells: number): void => {
      const ix = Math.floor(x / grid);
      const iy = Math.floor(y / grid);
      const size = grid * cells;
      ctx.fillRect(
        ix * grid - ((cells - 1) * grid) / 2,
        iy * grid - ((cells - 1) * grid) / 2,
        size - 1,
        size - 1,
      );
    };

    for (let i = shockRings.length - 1; i >= 0; i--) {
      const ring = shockRings[i];
      ring.r += dt * min * 1.4;
      if (ring.r > maxR) {
        shockRings.splice(i, 1);
        continue;
      }
      const count = Math.floor((ring.r / grid) * 1.5);
      ctx.fillStyle = color(ring.k, 1 - ring.r / maxR, 75);
      for (let j = 0; j < count; j++) {
        const a = (j / count) * TAU;
        cell(cx + Math.cos(a) * ring.r, cy + Math.sin(a) * ring.r, 1);
      }
    }

    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.head += b.speed * dt;
      if (b.head - b.length > maxR) {
        bolts.splice(i, 1);
        continue;
      }
      const cos = Math.cos(b.angle);
      const sin = Math.sin(b.angle);
      const tail = Math.max(coreR * 0.9, b.head - b.length);
      let lastCell = -1;
      for (let d = tail; d <= b.head; d += grid * 0.6) {
        const x = cx + cos * d;
        const y = cy + sin * d;
        const key = Math.floor(x / grid) * 100000 + Math.floor(y / grid);
        if (key === lastCell) continue;
        lastCell = key;
        // Dim at the tail, white-hot at the head.
        const t = (d - tail) / Math.max(1, b.head - tail);
        ctx.fillStyle = t > 0.85 ? color(b.k, 1, 95) : color(b.k, 0.35 + t * 0.6, 55 + t * 20);
        cell(x, y, b.cells);
      }
    }

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 1.6);
    core.addColorStop(0, color(1, 1, 96));
    core.addColorStop(0.35, color(0, 0.85, 65));
    core.addColorStop(0.7, color(2, 0.25, 50));
    core.addColorStop(1, color(2, 0, 50));
    ctx.fillStyle = core;
    fillCircle(ctx, cx, cy, coreR * 1.6);

    // Spinning arcs around the core.
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const r = coreR * (0.45 + k * 0.14);
      const a0 = time * (1.2 + k * 0.5) * (k % 2 ? 1 : -1) + k;
      ctx.strokeStyle = color(k + 1, 0.7, 85);
      ctx.lineWidth = 2 + audio.high * 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a0 + 1.2 + audio.mid * 2);
      ctx.stroke();
    }

    // Orbiting pixels.
    for (let k = 0; k < 12; k++) {
      const a = time * (0.8 + k * 0.13) + k;
      const r = coreR * (1.25 + 0.35 * Math.sin(time * 2 + k));
      ctx.fillStyle = color(k * 0.4, 0.8, 80);
      cell(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1);
    }
  },
};
