/**
 * A plasma globe. Jagged lightning arcs, redrawn every frame, run from a glowing core to
 * the glass, with short side branches; their ends wander over the glass. Loud mids pull
 * the arcs to one spot, as when a finger touches the globe. On a beat the arcs break out
 * of the globe to the edges of the screen.
 * Bass: more and thicker arcs. Treble: rougher lightning.
 */
import { clamp, rnd, TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { neonStroke } from '../render/neon';
import { fillCircle, strokeCircle } from '../render/shapes';
import type { Mode } from './mode';

interface Arc {
  angle: number;
  /** Wander speed of the end on the glass (radians per second). */
  drift: number;
  k: number;
}

type Point = [number, number];

const MAX_ARCS = 16;
let arcs: Arc[] = [];
/** After a beat, 1..0: the arcs break out of the globe. */
let discharge = 0;
/** Where the "finger" touches the glass. */
let finger = 0;

/** A lightning path from a to b: midpoint displacement, `levels` times. */
function lightning(a: Point, b: Point, roughness: number, levels: number): Point[] {
  let points: Point[] = [a, b];
  let jag = roughness;
  for (let level = 0; level < levels; level++) {
    const next: Point[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const length = Math.hypot(x1 - x0, y1 - y0);
      const offset = (Math.random() - 0.5) * length * jag;
      // Move the midpoint sideways, across the segment.
      next.push([
        (x0 + x1) / 2 + (-(y1 - y0) / (length || 1)) * offset,
        (y0 + y1) / 2 + ((x1 - x0) / (length || 1)) * offset,
      ]);
      next.push(points[i]);
    }
    points = next;
    jag *= 0.6;
  }
  return points;
}

function trace(points: Point[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
}

function angleTo(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export const neonTesla: Mode = {
  name: 'neon-tesla',
  fade: 0.3,
  beatRings: false,
  palettes: ['ultraviolet', 'deep sea', 'void', 'vapor', 'neon', 'noir', 'acid'],

  beat() {
    discharge = 1;
    for (const arc of arcs) arc.drift = rnd(-0.8, 0.8);
  },

  draw(dt) {
    const { cx, cy, min } = view;
    const time = clock.time;
    discharge = Math.max(0, discharge - dt * 4);
    const globeR = min * 0.44;
    const coreR = min * (0.05 + audio.bass * 0.03);
    const count = Math.min(MAX_ARCS, Math.round(5 + audio.bass * 7 + discharge * 4));
    while (arcs.length < count)
      arcs.push({ angle: Math.random() * TAU, drift: rnd(-0.6, 0.6), k: Math.random() * 4 });
    finger += dt * (0.3 + Math.sin(time * 0.37) * 0.4);
    const roughness = 0.35 + audio.high * 0.25;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < count; i++) {
      const arc = arcs[i];
      arc.drift = clamp(arc.drift + rnd(-1, 1) * dt * 3, -0.8, 0.8);
      arc.angle += arc.drift * dt;
      // A finger on the glass pulls the arcs together.
      if (audio.mid > 0.6) arc.angle += angleTo(arc.angle, finger) * dt * (audio.mid - 0.6) * 6;
      const cos = Math.cos(arc.angle);
      const sin = Math.sin(arc.angle);
      const breakOut = discharge > 0.05 && i % 2 === 0;
      const reach = breakOut ? Math.hypot(cx, cy) * 1.05 : globeR;
      const start: Point = [cx + cos * coreR, cy + sin * coreR];
      const end: Point = [cx + cos * reach, cy + sin * reach];
      const bolt = lightning(start, end, roughness, 5);
      trace(bolt);
      const width = 1.1 + audio.bass * 1.5 + (breakOut ? discharge * 2 : 0);
      neonStroke(ctx, arc.k + time * 0.2, width, 0.65 + 0.35 * Math.random());
      // Two short side branches.
      for (let b = 0; b < 2; b++) {
        const from = bolt[8 + Math.floor(Math.random() * (bolt.length - 12))];
        const side = arc.angle + rnd(-0.9, 0.9);
        const length = reach * rnd(0.12, 0.25);
        trace(
          lightning(
            from,
            [from[0] + Math.cos(side) * length, from[1] + Math.sin(side) * length],
            roughness,
            3,
          ),
        );
        neonStroke(ctx, arc.k + time * 0.2, width * 0.5, 0.5);
      }
      // Hot spot where the arc touches the glass.
      ctx.fillStyle = color(arc.k, 0.8, 92);
      fillCircle(ctx, end[0], end[1], 2 + audio.bass * 3);
    }

    // The glass, and the core.
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = color(4, 0.18 + discharge * 0.2, 70);
    strokeCircle(ctx, cx, cy, globeR);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.4);
    core.addColorStop(0, color(1, 1, 97));
    core.addColorStop(0.4, color(0, 0.8, 70));
    core.addColorStop(1, color(0, 0, 50));
    ctx.fillStyle = core;
    fillCircle(ctx, cx, cy, coreR * 2.4);
  },
};
