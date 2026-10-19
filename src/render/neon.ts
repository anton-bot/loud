/** The neon tube look, shared by the neon modes. */
import { color } from './color';

/**
 * Strokes the current path of `ctx` as a neon tube: a wide faint glow, a softer
 * glow, and a thin bright core. `k` is the palette colour, `width` the tube width.
 */
export function neonStroke(
  ctx: CanvasRenderingContext2D,
  k: number,
  width: number,
  alpha: number,
): void {
  ctx.strokeStyle = color(k, alpha * 0.09, 55);
  ctx.lineWidth = width * 4;
  ctx.stroke();
  ctx.strokeStyle = color(k, alpha * 0.4, 65);
  ctx.lineWidth = width * 1.8;
  ctx.stroke();
  ctx.strokeStyle = color(k, alpha, 92);
  ctx.lineWidth = width * 0.6;
  ctx.stroke();
}
