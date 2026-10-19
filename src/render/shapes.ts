/** Path and drawing helpers shared by the modes and effects. */
import { TAU } from '../core/math';

type Ctx = CanvasRenderingContext2D;

/** Adds point number `i` of a line: point 0 starts the line, the others extend it. */
export function pathPoint(ctx: Ctx, i: number, x: number, y: number): void {
  if (i === 0) ctx.moveTo(x, y);
  else ctx.lineTo(x, y);
}

export function fillCircle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function strokeCircle(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}

/** Filled pie slice from (x, y) between the angles a0 and a1. */
export function fillWedge(ctx: Ctx, x: number, y: number, r: number, a0: number, a1: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r, a0, a1);
  ctx.closePath();
  ctx.fill();
}

/** Starts a closed regular polygon around the origin, first corner on the +x axis. */
export function polygonPath(ctx: Ctx, sides: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU;
    pathPoint(ctx, i, Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

/** Starts a closed 5-point star around the origin. `inner` is the inner radius as a fraction of `r`. */
export function starPath(ctx: Ctx, r: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = (i / 10) * TAU;
    pathPoint(ctx, i, Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

/**
 * Starts a closed wobbly blob. `wobble` 0 is a circle; `seed` sets the shape; more
 * `points` give a smoother edge.
 */
export function blobPath(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  wobble: number,
  seed: number,
  points = 20,
): void {
  ctx.beginPath();
  const n = points;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const rr =
      r *
      (1 +
        wobble *
          (Math.sin(a * 3 + seed) * 0.35 +
            Math.sin(a * 7 + seed * 2) * 0.2 +
            Math.sin(a * 11 + seed * 3) * 0.1));
    pathPoint(ctx, i, x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** Fills the area with `count` random square specks of side `size` (film grain, dust, dither). */
export function speckle(
  ctx: Ctx,
  count: number,
  width: number,
  height: number,
  size: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < count; i++)
    ctx.rect(Math.random() * width, Math.random() * height, size, size);
  ctx.fill();
}

/** Darkens (or tints) the edges: clear inside `inner`, `edge` colour at `outer`. */
export function vignette(
  ctx: Ctx,
  x: number,
  y: number,
  inner: number,
  outer: number,
  edge: string,
  width: number,
  height: number,
): void {
  const gradient = ctx.createRadialGradient(x, y, inner, x, y, outer);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, edge);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
