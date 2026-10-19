/**
 * Psychedelic sunburst. Two sets of rays turn in opposite directions and twist into
 * spirals with liquid, wavy edges. The second set is blended with "difference", so
 * where the sets cross they make op-art interference. Colours flow along each ray,
 * inverting rings ripple outward, the last frame zooms and turns behind it all
 * (tunnel echoes), and a flower pulses in the middle.
 * Bass: twist and ray width. Mid: spin. Treble: wobble. Beat: new ray counts,
 * sometimes a new twist direction or colour flow.
 */
import { rndInt, TAU } from '../core/math';
import { audio, clock, scene, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { pathPoint } from '../render/shapes';
import type { Mode } from './mode';

interface RaySet {
  count: number;
  /** Turns from the centre to the edge (radians): the spiral. */
  twist: number;
  /** Spin direction and speed factor. */
  spin: number;
  angle: number;
  /** Palette colour offset. */
  k: number;
}

/** Points along each ray edge. */
const SEGMENTS = 28;
const outer: RaySet = { count: 18, twist: 1.3, spin: 1, angle: 0, k: 0 };
const inner: RaySet = { count: 12, twist: -1.8, spin: -1.5, angle: 0, k: 2 };
/** Direction of the colour flow along the rays: 1 outward, −1 inward. */
let flow = 1;

/** One set of twisted, wavy rays, each filled with colours that flow along it. */
function drawRaySet(set: RaySet, radius: number, width: number, wobble: number): void {
  const { cx, cy } = view;
  const time = clock.time;
  const slot = TAU / set.count;
  const twist = set.twist * (1 + audio.bass * 0.6 + Math.sin(time * 0.4) * 0.3);
  for (let i = 0; i < set.count; i++) {
    const base = set.angle + i * slot;
    const fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    for (let s = 0; s <= 4; s++) {
      fill.addColorStop(s / 4, color(set.k + i * 0.5 + s * 0.7 - time * 0.6 * flow, 1, 45 + s * 8));
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    // Out along one edge and back along the other; the ray widens toward the edge.
    for (let j = 0; j <= SEGMENTS; j++) {
      const t = j / SEGMENTS;
      const a = base + twist * t + wobble * Math.sin(t * 9 - time * 3 + i);
      pathPoint(ctx, j, cx + Math.cos(a) * t * radius, cy + Math.sin(a) * t * radius);
    }
    for (let j = SEGMENTS; j >= 0; j--) {
      const t = j / SEGMENTS;
      const a =
        base +
        twist * t +
        wobble * Math.sin(t * 9 - time * 3 + i + 0.8) +
        slot * width * (0.3 + 0.7 * t);
      ctx.lineTo(cx + Math.cos(a) * t * radius, cy + Math.sin(a) * t * radius);
    }
    ctx.closePath();
    ctx.fill();
  }
}

/** White rings blended with "difference": they invert the colours as they ripple out. */
function drawInvertingRings(radius: number): void {
  const { cx, cy } = view;
  const rings = 5;
  const travel = clock.time * (0.12 + audio.mid * 0.25) * flow;
  ctx.globalCompositeOperation = 'difference';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = radius * (0.025 + audio.bass * 0.05);
  ctx.beginPath();
  for (let i = 0; i < rings; i++) {
    const r = ((((i / rings + travel) % 1) + 1) % 1) * radius;
    ctx.moveTo(cx + r, cy);
    ctx.arc(cx, cy, r, 0, TAU);
  }
  ctx.stroke();
}

/** A pulsing flower in the middle, with as many petals as the inner rays. */
function drawFlower(): void {
  const { cx, cy, min } = view;
  const time = clock.time;
  const petals = inner.count / 2;
  const R = min * (0.09 + audio.bass * 0.09 + audio.beat * 0.04);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  glow.addColorStop(0, color(3 - time * 0.6 * flow, 1, 95));
  glow.addColorStop(0.6, color(1 - time * 0.6 * flow, 1, 70));
  glow.addColorStop(1, color(2 - time * 0.6 * flow, 0.9, 50));
  ctx.fillStyle = glow;
  ctx.beginPath();
  for (let j = 0; j <= 96; j++) {
    const a = (j / 96) * TAU - inner.angle;
    const r = R * (0.55 + 0.45 * Math.pow(Math.abs(Math.cos((a * petals) / 2)), 0.6));
    pathPoint(ctx, j, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

export const rays: Mode = {
  name: 'rays',
  fade: 0.6,
  zoom: 1.015,
  rotate: 0.004,
  bloom: 0.4,
  blend: 'source-over',
  beatRings: false,
  palettes: ['acid', 'vapor', 'ultraviolet', 'neon', 'candy', 'technicolor', 'toxic'],

  beat() {
    if (Math.random() < 0.5) {
      outer.count = 8 + 2 * rndInt(10);
      inner.count = 6 + 2 * rndInt(8);
    }
    if (Math.random() < 0.3) outer.twist = -outer.twist;
    if (Math.random() < 0.3) inner.twist = -inner.twist;
    if (Math.random() < 0.25) flow = -flow;
    outer.k += 1;
  },

  draw(dt) {
    const { cx, cy, min } = view;
    const spin = dt * (0.25 + audio.mid * 1.2);
    outer.angle += spin * outer.spin;
    inner.angle += spin * inner.spin;
    const far = Math.hypot(cx, cy) * 1.1;
    const width = 0.45 + audio.bass * 0.3;
    const wobble = 0.05 + audio.high * 0.25;

    drawRaySet(outer, far, width, wobble);
    ctx.globalCompositeOperation = scene.palette.light ? 'exclusion' : 'difference';
    drawRaySet(inner, min * (0.55 + audio.bass * 0.25), width * 0.9, wobble * 1.4);
    drawInvertingRings(far);
    ctx.globalCompositeOperation = 'source-over';
    drawFlower();
  },
};
