/**
 * A starling murmuration (Craig Reynolds's boids): each bird keeps a little distance
 * from its neighbours, flies the way they fly and stays close to them. Bass pulls the
 * flock tighter, mids make it faster, and each beat sends a falcon through the flock,
 * which splits around it.
 */
import { rnd, TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle } from '../render/shapes';
import { quality } from '../render/quality';
import type { Mode } from './mode';

/** Neighbours count within this distance (px); closer than SPACE they push apart. */
const SIGHT = 46;
const SPACE = 14;
const GROUPS = 3;

let birdX = new Float32Array(0);
let birdY = new Float32Array(0);
let birdVX = new Float32Array(0);
let birdVY = new Float32Array(0);
/** Spatial hash: the first bird in each cell, and the next bird in the same cell. */
let cellFirst = new Int32Array(0);
let cellNext = new Int32Array(0);
let gridCols = 0;
let gridRows = 0;
const falcon = { x: 0, y: 0, vx: 0, vy: 0, life: 0 };

function setUp(count: number): void {
  const { width, height, cx, cy, min } = view;
  birdX = new Float32Array(count);
  birdY = new Float32Array(count);
  birdVX = new Float32Array(count);
  birdVY = new Float32Array(count);
  cellNext = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const r = Math.random() * min * 0.25;
    birdX[i] = cx + Math.cos(a) * r;
    birdY[i] = cy + Math.sin(a) * r;
    birdVX[i] = rnd(-60, 60);
    birdVY[i] = rnd(-60, 60);
  }
  gridCols = Math.ceil(width / SIGHT);
  gridRows = Math.ceil(height / SIGHT);
  cellFirst = new Int32Array(gridCols * gridRows);
}

function cellOf(x: number, y: number): number {
  const c = Math.min(gridCols - 1, Math.max(0, Math.floor(x / SIGHT)));
  const r = Math.min(gridRows - 1, Math.max(0, Math.floor(y / SIGHT)));
  return r * gridCols + c;
}

function hashBirds(): void {
  cellFirst.fill(-1);
  for (let i = 0; i < birdX.length; i++) {
    const cell = cellOf(birdX[i], birdY[i]);
    cellNext[i] = cellFirst[cell];
    cellFirst[cell] = i;
  }
}

function fly(dt: number): void {
  const { width, height } = view;
  const maxSpeed = 110 + audio.mid * 200;
  const cohesion = 0.6 + audio.bass * 2.2;
  const margin = Math.min(width, height) * 0.12;
  // The whole flock is drawn toward a slowly wandering point: it stays one dense, changing ball.
  const time = clock.time;
  const focusX = width / 2 + Math.sin(time * 0.31) * width * 0.22;
  const focusY = height / 2 + Math.cos(time * 0.23) * height * 0.18;
  const pull = 0.9 + audio.bass * 0.8;
  for (let i = 0; i < birdX.length; i++) {
    const x = birdX[i];
    const y = birdY[i];
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    let sumVX = 0;
    let sumVY = 0;
    let pushX = 0;
    let pushY = 0;
    const col = Math.floor(x / SIGHT);
    const row = Math.floor(y / SIGHT);
    for (let r = row - 1; r <= row + 1; r++) {
      if (r < 0 || r >= gridRows) continue;
      for (let c = col - 1; c <= col + 1; c++) {
        if (c < 0 || c >= gridCols) continue;
        for (let j = cellFirst[r * gridCols + c]; j !== -1; j = cellNext[j]) {
          if (j === i) continue;
          const dx = birdX[j] - x;
          const dy = birdY[j] - y;
          const d2 = dx * dx + dy * dy;
          if (d2 > SIGHT * SIGHT) continue;
          count++;
          sumX += dx;
          sumY += dy;
          sumVX += birdVX[j];
          sumVY += birdVY[j];
          if (d2 < SPACE * SPACE && d2 > 0) {
            pushX -= dx / d2;
            pushY -= dy / d2;
          }
        }
      }
    }
    let ax = 0;
    let ay = 0;
    if (count) {
      ax += (sumX / count) * cohesion + (sumVX / count - birdVX[i]) * 1.6 + pushX * 900;
      ay += (sumY / count) * cohesion + (sumVY / count - birdVY[i]) * 1.6 + pushY * 900;
    }
    ax += (focusX - x) * pull;
    ay += (focusY - y) * pull;
    // Turn back before the edges.
    if (x < margin) ax += (margin - x) * 6;
    if (x > width - margin) ax -= (x - width + margin) * 6;
    if (y < margin) ay += (margin - y) * 6;
    if (y > height - margin) ay -= (y - height + margin) * 6;
    // Flee the falcon.
    if (falcon.life > 0) {
      const dx = x - falcon.x;
      const dy = y - falcon.y;
      const d2 = dx * dx + dy * dy;
      const fear = 150 * (1 + audio.bass);
      if (d2 < fear * fear) {
        const d = Math.sqrt(d2) + 1;
        ax += (dx / d) * 2600;
        ay += (dy / d) * 2600;
      }
    }
    // Treble: a nervous flutter.
    ax += (Math.random() - 0.5) * audio.high * 900;
    ay += (Math.random() - 0.5) * audio.high * 900;

    let vx = birdVX[i] + ax * dt;
    let vy = birdVY[i] + ay * dt;
    const speed = Math.hypot(vx, vy);
    const limit = speed > maxSpeed ? maxSpeed / speed : speed < 50 ? 50 / (speed + 1e-3) : 1;
    vx *= limit;
    vy *= limit;
    birdVX[i] = vx;
    birdVY[i] = vy;
    birdX[i] = x + vx * dt;
    birdY[i] = y + vy * dt;
  }
}

export const murmur: Mode = {
  name: 'murmur',
  fade: 0.3,
  blend: 'source-over',
  beatRings: false,
  palettes: ['sunset', 'peach', 'sand', 'paper', 'ice', 'slate', 'wine', 'cream'],

  beat() {
    if (!birdX.length || falcon.life > 0.4) return;
    // The falcon dives from a random edge through the middle of the flock.
    const { width, height } = view;
    let mx = 0;
    let my = 0;
    for (let i = 0; i < birdX.length; i++) {
      mx += birdX[i];
      my += birdY[i];
    }
    mx /= birdX.length;
    my /= birdX.length;
    const a = Math.random() * TAU;
    falcon.x = mx + Math.cos(a) * Math.max(width, height) * 0.6;
    falcon.y = my + Math.sin(a) * Math.max(width, height) * 0.6;
    const d = Math.hypot(mx - falcon.x, my - falcon.y) + 1;
    const speed = 700 + audio.bass * 500;
    falcon.vx = ((mx - falcon.x) / d) * speed;
    falcon.vy = ((my - falcon.y) / d) * speed;
    falcon.life = 1.6;
  },

  resize() {
    birdX = new Float32Array(0);
  },

  draw(dt) {
    const count = quality.level === 2 ? 600 : 350;
    if (birdX.length !== count) setUp(count);
    const step = Math.min(dt, 1 / 30);
    hashBirds();
    fly(step);
    if (falcon.life > 0) {
      falcon.life -= dt;
      falcon.x += falcon.vx * dt;
      falcon.y += falcon.vy * dt;
    }

    // Each bird is a short streak along its flight.
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, view.min / 300) * (1 + audio.beat * 0.4);
    for (let g = 0; g < GROUPS; g++) {
      ctx.strokeStyle = color(g * 0.8, 0.95, 68 + audio.high * 20);
      ctx.beginPath();
      for (let i = g; i < birdX.length; i += GROUPS) {
        ctx.moveTo(birdX[i], birdY[i]);
        ctx.lineTo(birdX[i] - birdVX[i] * 0.014, birdY[i] - birdVY[i] * 0.014);
      }
      ctx.stroke();
    }
    if (falcon.life > 0) {
      ctx.fillStyle = color(3, Math.min(1, falcon.life), 90);
      fillCircle(ctx, falcon.x, falcon.y, 3 + audio.bass * 3);
    }
  },
};
