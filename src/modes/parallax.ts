/**
 * Tilt to look: the screen is a window into a tunnel of neon frames with shapes
 * floating at each depth. Tilt the phone (with Motion on) or move the mouse, and the
 * near layers move less than the far ones, like a hologram card. Without either, the
 * view sways slowly by itself. The bass flies you forward; beats thicken the lines.
 */
import { hash01, TAU } from '../core/math';
import { audio, clock, motion, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { neonStroke } from '../render/neon';
import type { Mode } from './mode';

const LAYERS = 16;
/** Depth between two layers. */
const GAP = 0.55;

const look = { x: 0, y: 0 };
const pointer = { x: 0, y: 0, at: -1e9 };
let travel = 0;

addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  pointer.x = (e.clientX / view.width) * 2 - 1;
  pointer.y = (e.clientY / view.height) * 2 - 1;
  pointer.at = clock.time;
});

/** A small neon shape: 0 triangle, 1 diamond, 2 circle. */
function shapePath(kind: number, x: number, y: number, r: number, turn: number): void {
  ctx.beginPath();
  if (kind === 2) {
    ctx.arc(x, y, r, 0, TAU);
    return;
  }
  const corners = kind === 0 ? 3 : 4;
  for (let i = 0; i <= corners; i++) {
    const a = turn + (i / corners) * TAU;
    if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
}

export const parallax: Mode = {
  name: 'parallax',
  fade: 0.5,
  beatRings: false,
  palettes: ['neon', 'vapor', 'ultraviolet', 'deep sea', 'technicolor', 'void'],

  draw(dt) {
    const { width, height, cx, cy, min } = view;
    const time = clock.time;
    // Where the viewer looks from: the phone tilt, else the mouse, else a slow sway.
    let tx = Math.sin(time * 0.5) * 0.7;
    let ty = Math.sin(time * 0.37 + 1) * 0.5;
    if (motion.enabled) {
      tx = motion.tiltX * 1.6;
      ty = motion.tiltY * 1.6;
    } else if (time - pointer.at < 4) {
      tx = pointer.x;
      ty = pointer.y;
    }
    look.x += (tx - look.x) * Math.min(1, dt * 5);
    look.y += (ty - look.y) * Math.min(1, dt * 5);
    travel += dt * 0.6 * (1 + audio.bass * 0.8);
    const phase = travel % GAP;
    const base = Math.floor(travel / GAP);
    ctx.lineJoin = 'round';

    // The far end: a glow where the tunnel vanishes.
    const far = 1 / (1 + LAYERS * GAP);
    const gx = cx - look.x * width * 0.35 * (1 - far);
    const gy = cy - look.y * height * 0.35 * (1 - far);
    const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, min * 0.3);
    glow.addColorStop(0, color(base * 0.3, 0.5 + audio.bass * 0.3, 70));
    glow.addColorStop(1, color(base * 0.3, 0, 40));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (let k = LAYERS - 1; k >= 0; k--) {
      const z = 1 + k * GAP - phase;
      const s = 1 / z;
      const ox = cx - look.x * width * 0.35 * (1 - s);
      const oy = cy - look.y * height * 0.35 * (1 - s);
      const id = k + base;
      const alpha = Math.min(1, s * 1.8) * Math.min(1, (LAYERS - k) / 3);
      const w = width * 0.92 * s;
      const h = height * 0.92 * s;
      ctx.beginPath();
      ctx.roundRect(ox - w / 2, oy - h / 2, w, h, min * 0.04 * s);
      neonStroke(
        ctx,
        id * 0.5 + time * 0.1,
        Math.max(0.6, min * 0.006 * s * (1 + audio.beat)),
        alpha,
      );
      // Shapes floating at this depth.
      for (let j = 0; j < 3; j++) {
        const hx = (hash01(id * 3.1 + j) - 0.5) * w * 0.8;
        const hy = (hash01(id * 7.7 + j) - 0.5) * h * 0.8;
        const r = min * 0.035 * s * (1 + audio.bass * 0.4);
        shapePath(Math.floor(hash01(id + j * 13) * 3), ox + hx, oy + hy, r, time * (j - 1) + id);
        neonStroke(ctx, id * 0.5 + j + 2, Math.max(0.5, min * 0.004 * s), alpha);
      }
    }
  },
};
