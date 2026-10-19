/**
 * A stop-motion creature cut from paper. Its stacked paper layers keep changing shape
 * and turn against each other; colours flow through the layers, some layers are
 * printed with stripes, a ring of paper petals pulses with the spectrum, and one to
 * five eyes blink on beats.
 */
import { createLayer, setCanvasSize } from '../core/dom';
import { rnd, rndInt, TAU } from '../core/math';
import { bandLevel, spectrumAt } from '../core/signal';
import { audio, clock, scene, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { blobPath, fillCircle } from '../render/shapes';
import type { Mode } from './mode';

const LAYERS = 9;
const PETALS = 12;
/** Tile for the printed stripes. */
const print = createLayer();

let seed = 0;
let eyes = 2;
/** 1 when the eyes are shut; they open again over a fraction of a second. */
let blink = 0;
/** Direction of the colour flow through the layers. */
let flow = 1;

/** Paper printed with stripes in two palette colours. */
function stripes(k: number, period: number): CanvasPattern | string {
  const size = Math.max(4, Math.round(period));
  setCanvasSize(print.canvas, size, size);
  print.ctx.fillStyle = color(k, 1, 55);
  print.ctx.fillRect(0, 0, size, size);
  print.ctx.fillStyle = color(k + 2, 1, 82);
  print.ctx.fillRect(0, 0, size, size * 0.45);
  return ctx.createPattern(print.canvas, 'repeat') ?? color(k, 1, 55);
}

/** A paper blob with its drop shadow, turned by `turn` around its centre. */
function paper(
  x: number,
  y: number,
  r: number,
  turn: number,
  wobble: number,
  shape: number,
  fill: string | CanvasPattern,
): void {
  ctx.fillStyle = scene.palette.light ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.5)';
  ctx.save();
  ctx.translate(x + r * 0.07, y + r * 0.09);
  ctx.rotate(turn);
  blobPath(ctx, 0, 0, r, wobble, shape, 40);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = fill;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  blobPath(ctx, 0, 0, r, wobble, shape, 40);
  ctx.fill();
  ctx.restore();
}

function drawPetals(baseR: number): void {
  const { cx, cy } = view;
  const time = clock.time;
  const ringR = baseR * (1.12 + audio.bass * 0.15);
  for (let p = 0; p < PETALS; p++) {
    const a = (p / PETALS) * TAU + time * 0.35 * flow;
    const v = spectrumAt(p / PETALS, 0.4, 1.4);
    const r = baseR * (0.1 + v * 0.14);
    const shape = seed + p * 3 + time * 1.2;
    paper(
      cx + Math.cos(a) * ringR,
      cy + Math.sin(a) * ringR,
      r,
      a,
      0.35,
      shape,
      color(p * 0.6 + time * 0.3, 1, 60 + v * 25),
    );
  }
}

function drawEyes(x: number, y: number): void {
  const { min } = view;
  const time = clock.time;
  const r = min * 0.028 * (1 + audio.beat * 0.6);
  const open = 1 - blink;
  for (let e = 0; e < eyes; e++) {
    const spread = e - (eyes - 1) / 2;
    const ex = x + spread * r * 2.9;
    const ey = y - r * (1.2 - Math.abs(spread) * 0.35);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, r, Math.max(0.5, r * open), 0, 0, TAU);
    ctx.fill();
    if (open < 0.3) continue;
    const lookX = ex + Math.sin(time * 2 + e) * r * 0.4;
    const lookY = ey + Math.cos(time * 1.3) * r * 0.3 + audio.bass * r * 0.2;
    ctx.fillStyle = color(e * 1.3 - time * 0.5, 1, 50);
    fillCircle(ctx, lookX, lookY, r * 0.55);
    ctx.fillStyle = '#111';
    fillCircle(ctx, lookX, lookY, r * 0.3);
  }
}

export const cutout: Mode = {
  name: 'cutout',
  fade: 1,
  bloom: 0.2,
  blend: 'source-over',
  beatRings: false,
  fps: 12,
  palettes: ['paper', 'cream', 'candy', 'sand', 'mint', 'acid', 'vapor'],

  beat() {
    // A jump in shape; the shapes keep morphing from there.
    seed += rnd(1, 4);
    if (Math.random() < 0.3) eyes = 1 + rndInt(5);
    if (Math.random() < 0.35) blink = 1;
    if (Math.random() < 0.2) flow = -flow;
  },

  draw(dt) {
    const { cx, cy, min } = view;
    const time = clock.time;
    blink = Math.max(0, blink - dt * 5);
    const baseR = min * 0.34;
    drawPetals(baseR);

    // The biggest layer first; each smaller layer is stuck on top of the last.
    let topX = cx;
    let topY = cy;
    for (let i = 0; i < LAYERS; i++) {
      const f = i / LAYERS;
      const breathe = 1 + 0.07 * Math.sin(time * 1.7 + i * 0.9);
      const r =
        baseR * (1 - f * 0.86) * (0.85 + bandLevel(i % 3) * 0.3 + audio.beat * 0.1) * breathe;
      const x = cx + Math.sin(time * 0.7 + i) * min * 0.07 * (1 + audio.mid);
      const y = cy + Math.cos(time * 0.55 + i * 1.3) * min * 0.05;
      const turn = time * (0.15 + f * 0.35) * (i % 2 ? 1 : -1);
      const wobble = 0.2 + audio.bass * 0.3 + 0.08 * Math.sin(time * 0.9 + i);
      // The shape keeps changing; the small random part makes the edges "boil" like stop motion.
      const shape = seed + i * 7 + time * (0.5 + f) + Math.random() * 0.25;
      const k = i * 0.9 - time * 0.5 * flow;
      paper(x, y, r, turn, wobble, shape, i % 3 === 1 ? stripes(k, min * 0.035) : color(k, 1, 55));
      topX = x;
      topY = y;
    }

    drawEyes(topX, topY);
  },
};
