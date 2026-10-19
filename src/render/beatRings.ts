/** Rings that grow out of the centre on each beat, drawn over most modes. */
import { audio, view } from '../core/state';
import { ctx } from './canvases';
import { color } from './color';
import { strokeCircle } from './shapes';

interface Ring {
  r: number;
  k: number;
  width: number;
}

const rings: Ring[] = [];

export function addBeatRing(): void {
  rings.push({ r: 0, k: Math.random() * 4, width: 2 + audio.bass * 10 });
}

export function drawBeatRings(dt: number): void {
  const { cx, cy } = view;
  const maxR = Math.hypot(cx, cy);
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i];
    ring.r += dt * (600 + audio.bass * 600);
    if (ring.r > maxR) {
      rings.splice(i, 1);
      continue;
    }
    const a = 1 - ring.r / maxR;
    ctx.strokeStyle = color(ring.k, a * 0.6, 70);
    ctx.lineWidth = ring.width * (1 + a);
    strokeCircle(ctx, cx, cy, ring.r);
  }
}
