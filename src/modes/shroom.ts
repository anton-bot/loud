/** Five spotted mushrooms bob and lean in front of pulsing rings. */
import { rnd, rndInt, TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { background, color } from '../render/color';
import { pathPoint } from '../render/shapes';
import type { Mode } from './mode';

interface Mushroom {
  /** Position and size as fractions of the screen. */
  x: number;
  base: number;
  height: number;
  /** Cap width relative to the height. */
  capWidth: number;
  k: number;
  phase: number;
  /** Spots on the cap: [x, y, radius], relative to the cap. */
  spots: [number, number, number][];
}

let mushrooms: Mushroom[] = [];

function plant(): void {
  mushrooms = [];
  for (let i = 0; i < 5; i++) {
    mushrooms.push({
      x: rnd(0.12, 0.88),
      base: rnd(0.75, 0.95),
      height: rnd(0.18, 0.42),
      capWidth: rnd(0.5, 1),
      k: rndInt(4),
      phase: Math.random() * TAU,
      spots: Array.from({ length: 6 }, () => [rnd(-0.8, 0.8), rnd(0.1, 0.7), rnd(0.06, 0.16)]),
    });
  }
  // Short ones first, so the tall ones are drawn in front.
  mushrooms.sort((a, b) => a.height - b.height);
}

function drawMushroom(s: Mushroom): void {
  const { width, height, min } = view;
  const time = clock.time;
  const bob = Math.sin(time * 1.5 + s.phase) * 0.02;
  const h = s.height * height * (1 + audio.bass * 0.25 + bob);
  const cw = h * s.capWidth * 0.9 * (1 + audio.beat * 0.15);
  const lean = Math.sin(time * 0.8 + s.phase) * 0.15 * (1 + audio.mid);
  ctx.save();
  ctx.translate(s.x * width, s.base * height);
  ctx.rotate(lean * 0.3);

  // Stem.
  ctx.fillStyle = color(s.k + 1, 1, 85);
  ctx.beginPath();
  ctx.moveTo(-cw * 0.18, 0);
  ctx.quadraticCurveTo(-cw * 0.25 + lean * h * 0.5, -h * 0.5, -cw * 0.14 + lean * h, -h * 0.65);
  ctx.lineTo(cw * 0.14 + lean * h, -h * 0.65);
  ctx.quadraticCurveTo(cw * 0.25 + lean * h * 0.5, -h * 0.5, cw * 0.18, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = background(1);
  ctx.lineWidth = Math.max(2, min * 0.008);
  ctx.stroke();

  // Cap.
  ctx.translate(lean * h, -h * 0.65);
  ctx.fillStyle = color(s.k, 1, 50);
  ctx.beginPath();
  ctx.ellipse(0, 0, cw, h * 0.42, 0, Math.PI, TAU);
  ctx.lineTo(cw, 0);
  ctx.quadraticCurveTo(0, h * 0.12, -cw, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  for (const [sx, sy, sr] of s.spots) {
    const r = sr * cw * (1 + audio.high * 0.8 + audio.beat * 0.3);
    ctx.fillStyle = color(s.k + 2, 1, 90);
    ctx.beginPath();
    ctx.ellipse(sx * cw, -sy * h * 0.42, r, r * 0.8, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export const shroom: Mode = {
  name: 'shroom',
  fade: 1,
  bloom: 0.2,
  blend: 'source-over',
  beatRings: false,
  palettes: ['mushroom', 'candy', 'acid', 'forest', 'peach'],

  resize() {
    mushrooms = [];
  },

  draw() {
    const { cx, cy, min } = view;
    const time = clock.time;
    if (!mushrooms.length) plant();

    ctx.lineWidth = min * 0.02;
    for (let i = 1; i <= 10; i++) {
      const r = i * min * 0.09 * (1 + audio.bass * 0.15) + Math.sin(time * 2 + i) * min * 0.01;
      ctx.strokeStyle = color(i * 0.4 + time * 0.3, 0.25 + audio.mid * 0.3, 60);
      ctx.beginPath();
      for (let a = 0; a <= 64; a++) {
        const angle = (a / 64) * TAU;
        const rr = r * (1 + 0.06 * Math.sin(angle * 6 + time * 3 + i));
        pathPoint(ctx, a, cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr);
      }
      ctx.closePath();
      ctx.stroke();
    }

    for (const mushroom of mushrooms) drawMushroom(mushroom);
  },
};
