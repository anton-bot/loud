/**
 * Escape the rings: glowing balls bounce inside nested neon rings. Each ring has a
 * gap and turns, every other ring the other way, faster with the mids. A wall lights
 * up where a ball hits it, with sparks. When a ball slips through the gap of the inner
 * ring, that ring shatters into flying pieces and a new ball is born; when the last
 * ring is gone, a new set of rings grows in. Beats kick the balls; gravity pulls them
 * down (or follows the phone when motion is on).
 */
import { clamp, rnd, TAU } from '../core/math';
import { audio, clock, motion, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { neonStroke } from '../render/neon';
import { fillCircle } from '../render/shapes';
import type { Mode } from './mode';

interface Ring {
  /** Radius as a share of view.min. */
  radius: number;
  /** Where the gap starts (radians) and how wide it is. */
  angle: number;
  gap: number;
  /** Turn speed in radians per second; the sign is the direction. */
  speed: number;
  k: number;
  /** Lit spots where balls hit: angle and time. */
  hits: { angle: number; at: number }[];
  /** 0..1 while the ring grows in. */
  grow: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  k: number;
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  /** Arc length (radians) and radius of the arc piece; 0 for a spark. */
  arc: number;
  radius: number;
  k: number;
  life: number;
}

const RINGS = 6;
const MAX_BALLS = 14;
const SUBSTEPS = 4;
let rings: Ring[] = [];
let balls: Ball[] = [];
let pieces: Piece[] = [];
let generation = 0;

function newRings(): void {
  generation++;
  rings = Array.from({ length: RINGS }, (_, i) => ({
    radius: 0.12 + i * 0.065,
    angle: Math.random() * TAU,
    gap: 0.55 - i * 0.04,
    speed: (0.7 + i * 0.12) * (i % 2 ? -1 : 1),
    k: generation * 0.7 + i * 0.55,
    hits: [],
    grow: -i * 0.12,
  }));
}

function newBall(): Ball {
  const a = Math.random() * TAU;
  const speed = view.min * rnd(0.5, 0.9);
  return {
    x: view.cx,
    y: view.cy,
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    k: Math.random() * 6,
  };
}

/** Breaks the ring into arc pieces that fly outward, turning. */
function shatter(ring: Ring): void {
  const r = ring.radius * view.min;
  const count = 18;
  for (let i = 0; i < count; i++) {
    const a = ring.angle + ring.gap + (i / count) * (TAU - ring.gap);
    const out = view.min * rnd(0.4, 1.1);
    pieces.push({
      x: view.cx + Math.cos(a) * r,
      y: view.cy + Math.sin(a) * r,
      vx: Math.cos(a) * out + rnd(-1, 1) * view.min * 0.15,
      vy: Math.sin(a) * out + rnd(-1, 1) * view.min * 0.15,
      angle: a,
      spin: rnd(-6, 6),
      arc: (TAU - ring.gap) / count,
      radius: r,
      k: ring.k,
      life: 1,
    });
  }
}

function sparks(x: number, y: number, k: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const speed = view.min * rnd(0.2, 0.7);
    pieces.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      angle: 0,
      spin: 0,
      arc: 0,
      radius: 0,
      k,
      life: rnd(0.4, 0.8),
    });
  }
}

/** Is `angle` inside the gap of `ring`? */
function inGap(ring: Ring, angle: number): boolean {
  const from = (((angle - ring.angle) % TAU) + TAU) % TAU;
  return from < ring.gap;
}

function step(dt: number, ballRadius: number): void {
  const { cx, cy, min } = view;
  const gravityX = motion.enabled ? motion.gravityX : 0;
  const gravityY = motion.enabled ? motion.gravityY : 1;
  const gravity = min * 1.1;
  const maxSpeed = min * 2.2;
  for (const ball of balls) {
    ball.vx += gravity * gravityX * dt;
    ball.vy += gravity * gravityY * dt;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > maxSpeed) {
      ball.vx *= maxSpeed / speed;
      ball.vy *= maxSpeed / speed;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const wall = rings[0];
    if (!wall) continue;
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const distance = Math.hypot(dx, dy) || 1;
    const limit = Math.max(ballRadius * 2, wall.radius * min * clamp(wall.grow, 0, 1) - ballRadius);
    if (distance <= limit) continue;
    const angle = Math.atan2(dy, dx);
    // A ring that is still growing in has no gap yet.
    if (wall.grow >= 1 && inGap(wall, angle)) {
      // Out through the gap: the ring shatters, and a new ball is born.
      shatter(wall);
      rings.shift();
      if (balls.length < MAX_BALLS) balls.push(newBall());
      return;
    }
    // Bounce off the wall: mirror the speed along the wall's normal.
    const nx = dx / distance;
    const ny = dy / distance;
    const along = ball.vx * nx + ball.vy * ny;
    if (along > 0) {
      ball.vx -= 2 * along * nx;
      ball.vy -= 2 * along * ny;
      // The turning wall drags the ball a little.
      ball.vx += -ny * wall.speed * min * 0.05;
      ball.vy += nx * wall.speed * min * 0.05;
      wall.hits.push({ angle, at: clock.time });
      if (along > min * 0.3) sparks(ball.x, ball.y, ball.k, 3);
    }
    ball.x = cx + nx * limit;
    ball.y = cy + ny * limit;
  }
}

export const bounce: Mode = {
  name: 'bounce',
  fade: 0.28,
  beatRings: false,
  palettes: ['neon', 'vapor', 'ultraviolet', 'technicolor', 'acid', 'void', 'lava'],

  beat() {
    for (const ball of balls) {
      const a = Math.random() * TAU;
      const kick = view.min * (0.25 + audio.bass * 0.45);
      ball.vx += Math.cos(a) * kick;
      ball.vy += Math.sin(a) * kick - view.min * 0.2;
    }
    for (const ring of rings) ring.hits.push({ angle: ring.angle + Math.PI, at: clock.time });
  },

  resize() {
    rings = [];
    balls = [];
    pieces = [];
  },

  draw(dt) {
    const { cx, cy, min } = view;
    if (!rings.length) {
      newRings();
      balls = balls.length ? balls.slice(0, 2) : [newBall()];
      for (const ball of balls) Object.assign(ball, newBall(), { k: ball.k });
    }
    const ballRadius = min * 0.018;
    const sub = Math.min(dt, 1 / 30) / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) step(sub, ballRadius);

    // The rings, each with its gap; a lit glow where balls hit it.
    ctx.lineCap = 'round';
    rings.forEach((ring, i) => {
      ring.grow = Math.min(1, ring.grow + dt * 1.5);
      ring.angle += ring.speed * dt * (0.6 + audio.mid * 1.4);
      if (ring.grow <= 0) return;
      const wobble = 1 + Math.sin(clock.time * 9 + i) * audio.high * 0.01;
      const r = ring.radius * min * ring.grow * wobble;
      const width = min * (0.006 + (i === 0 ? 0.004 : 0)) * (1 + audio.beat * 0.6);
      ctx.beginPath();
      ctx.arc(cx, cy, r, ring.angle + ring.gap, ring.angle + TAU);
      neonStroke(ctx, ring.k + clock.time * 0.15, width, i === 0 ? 1 : 0.55);
      ring.hits = ring.hits.filter((hit) => clock.time - hit.at < 0.35);
      for (const hit of ring.hits) {
        const glow = 1 - (clock.time - hit.at) / 0.35;
        ctx.beginPath();
        ctx.arc(cx, cy, r, hit.angle - 0.25, hit.angle + 0.25);
        neonStroke(ctx, ring.k + 2, width * (1 + glow * 2), glow);
      }
    });

    // Flying ring pieces and sparks.
    pieces = pieces.filter((p) => (p.life -= dt * 0.9) > 0);
    for (const p of pieces) {
      p.vy += min * 0.8 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      ctx.beginPath();
      if (p.arc) {
        // A piece of the ring keeps its curve while it turns.
        const ox = Math.cos(p.angle) * p.radius;
        const oy = Math.sin(p.angle) * p.radius;
        ctx.arc(p.x - ox, p.y - oy, p.radius, p.angle - p.arc / 2, p.angle + p.arc / 2);
        neonStroke(ctx, p.k, min * 0.006, p.life);
      } else {
        ctx.fillStyle = color(p.k, p.life, 85);
        fillCircle(ctx, p.x, p.y, min * 0.004 * (1 + p.life));
      }
    }

    // The balls: a glow and a bright core.
    for (const ball of balls) {
      const k = ball.k + clock.time * 0.3;
      ctx.fillStyle = color(k, 0.25, 60);
      fillCircle(ctx, ball.x, ball.y, ballRadius * (2 + audio.beat));
      ctx.fillStyle = color(k, 1, 88);
      fillCircle(ctx, ball.x, ball.y, ballRadius);
    }
  },
};
