/**
 * Slime mold (Physarum), after Jeff Jones's agent model (2010): thousands of agents
 * smell the trail in front of them, turn toward the strongest scent and lay more
 * trail. The trail spreads and fades, and the agents build living networks.
 * Bass: speed and scent strength. Mid: how wide they smell. Treble: how sharply they
 * turn. Beat: a burst of spores somewhere on the screen.
 */
import { rnd, TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { colorRgb } from '../render/color';
import { colorRamp, paintField, PixelLayer } from '../render/pixelLayer';
import { quality } from '../render/quality';
import type { Mode } from './mode';

const layer = new PixelLayer();
let gridW = 0;
let gridH = 0;
let trail = new Float32Array(0);
let spread = new Float32Array(0);
/** Agent positions (grid cells) and headings (radians). */
let agentX = new Float32Array(0);
let agentY = new Float32Array(0);
let heading = new Float32Array(0);

function setUp(w: number, h: number): void {
  gridW = w;
  gridH = h;
  layer.setSize(w, h);
  trail = new Float32Array(w * h);
  spread = new Float32Array(w * h);
  const count = Math.round(Math.min(quality.level === 2 ? 14000 : 8000, w * h * 0.25));
  agentX = new Float32Array(count);
  agentY = new Float32Array(count);
  heading = new Float32Array(count);
  // Start on a ring, facing inward: the first network forms where they meet.
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const r = Math.min(w, h) * rnd(0.2, 0.4);
    agentX[i] = w / 2 + Math.cos(a) * r;
    agentY[i] = h / 2 + Math.sin(a) * r;
    heading[i] = a + Math.PI;
  }
}

/** Trail strength at `distance` cells from (x, y) in direction `angle`; the grid wraps. */
function smell(x: number, y: number, angle: number, distance: number): number {
  let ix = Math.floor(x + Math.cos(angle) * distance) % gridW;
  let iy = Math.floor(y + Math.sin(angle) * distance) % gridH;
  if (ix < 0) ix += gridW;
  if (iy < 0) iy += gridH;
  return trail[iy * gridW + ix];
}

function moveAgents(steps: number): void {
  const sensorAngle = 0.35 + audio.mid * 0.5;
  const sensorDistance = 5 + audio.bass * 7;
  const turn = (0.25 + audio.high * 0.45) * steps;
  const speed = (0.7 + audio.bass * 1.8) * steps;
  const deposit = (0.6 + audio.bass * 1.2) * steps;
  for (let i = 0; i < agentX.length; i++) {
    const x = agentX[i];
    const y = agentY[i];
    let a = heading[i];
    const front = smell(x, y, a, sensorDistance);
    const left = smell(x, y, a - sensorAngle, sensorDistance);
    const right = smell(x, y, a + sensorAngle, sensorDistance);
    if (front < left && front < right) a += Math.random() < 0.5 ? turn : -turn;
    else if (left > right && left > front) a -= turn;
    else if (right > left && right > front) a += turn;
    let nx = (x + Math.cos(a) * speed) % gridW;
    let ny = (y + Math.sin(a) * speed) % gridH;
    if (nx < 0) nx += gridW;
    if (ny < 0) ny += gridH;
    agentX[i] = nx;
    agentY[i] = ny;
    heading[i] = a;
    trail[(ny | 0) * gridW + (nx | 0)] += deposit;
  }
}

/** The trail spreads to the four neighbours and fades. */
function diffuse(steps: number): void {
  const w = gridW;
  const h = gridH;
  const keep = Math.pow(0.9, steps) / 8;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const up = ((y + h - 1) % h) * w;
    const down = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const left = x === 0 ? w - 1 : x - 1;
      const right = x === w - 1 ? 0 : x + 1;
      spread[row + x] =
        (trail[row + x] * 4 +
          trail[row + left] +
          trail[row + right] +
          trail[up + x] +
          trail[down + x]) *
        keep;
    }
  }
  [trail, spread] = [spread, trail];
}

export const slime: Mode = {
  name: 'slime',
  fade: 1,
  bloom: 0.7,
  blend: 'source-over',
  beatRings: false,
  palettes: ['toxic', 'phosphor', 'acid', 'deep sea', 'forest', 'lava', 'void'],

  beat() {
    if (!agentX.length) return;
    // Spores: some agents jump to one spot and spread out from it in all directions.
    const x = Math.random() * gridW;
    const y = Math.random() * gridH;
    const count = Math.floor(agentX.length * (0.04 + audio.bass * 0.1));
    for (let n = 0; n < count; n++) {
      const i = Math.floor(Math.random() * agentX.length);
      const a = Math.random() * TAU;
      agentX[i] = x;
      agentY[i] = y;
      heading[i] = a;
    }
  },

  resize() {
    gridW = 0;
  },

  draw(dt) {
    const { width, height } = view;
    const cell = quality.level === 2 ? 3 : 4;
    const w = Math.max(32, Math.min(360, Math.round(width / cell)));
    const h = Math.max(24, Math.round((w * height) / width));
    if (w !== gridW || h !== gridH) setUp(w, h);

    const steps = Math.min(3, dt * 60);
    moveAgents(steps);
    diffuse(steps);

    const shift = clock.time * 0.05;
    const ramp = colorRamp(256, (t) => colorRgb(t * 2.5 + shift, 6 + t * 92));
    paintField(layer, trail, ramp, (v) => 1 - Math.exp(-v * 0.3));
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer.canvas, 0, 0, width, height);
  },
};
