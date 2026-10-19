/**
 * Fluid ink: real fluid physics (Jos Stam's "stable fluids"). Each kick fires a jet of
 * ink in the palette's colours from an edge; the jets crash into each other and curl
 * into vortices, and the ink stays and mixes. The mids stir the whole tank; the bass
 * gives the jets force.
 *
 * Each frame: add forces, make the flow incompressible (projection), move the flow
 * along itself (advection), project again, then move the ink along the flow.
 */
import { rnd } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { colorRgb } from '../render/color';
import { PixelLayer } from '../render/pixelLayer';
import { quality } from '../render/quality';
import type { Mode } from './mode';

interface Jet {
  x: number;
  y: number;
  dx: number;
  dy: number;
  rgb: readonly number[];
  life: number;
}

const PRESSURE_STEPS = 20;
const layer = new PixelLayer();
let nx = 0;
let ny = 0;
let u = new Float32Array(0);
let v = new Float32Array(0);
let u0 = new Float32Array(0);
let v0 = new Float32Array(0);
let pressure = new Float32Array(0);
let divergence = new Float32Array(0);
let ink: Float32Array[] = [];
let scratch = new Float32Array(0);
let jets: Jet[] = [];
let beats = 0;
let lastJet = -1e9;

function setUp(width: number, height: number): void {
  nx = width;
  ny = height;
  const n = nx * ny;
  u = new Float32Array(n);
  v = new Float32Array(n);
  u0 = new Float32Array(n);
  v0 = new Float32Array(n);
  pressure = new Float32Array(n);
  divergence = new Float32Array(n);
  ink = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  scratch = new Float32Array(n);
  layer.setSize(nx, ny);
}

/** Moves `src` along the flow (u0, v0) into `dst`: each cell takes what was `k` steps upstream. */
function advect(dst: Float32Array, src: Float32Array, k: number): void {
  for (let y = 1; y < ny - 1; y++) {
    for (let x = 1; x < nx - 1; x++) {
      const i = x + y * nx;
      const px = Math.max(0.5, Math.min(nx - 1.5, x - k * u0[i]));
      const py = Math.max(0.5, Math.min(ny - 1.5, y - k * v0[i]));
      const x0 = Math.floor(px);
      const y0 = Math.floor(py);
      const fx = px - x0;
      const fy = py - y0;
      const a = x0 + y0 * nx;
      dst[i] =
        (src[a] * (1 - fx) + src[a + 1] * fx) * (1 - fy) +
        (src[a + nx] * (1 - fx) + src[a + nx + 1] * fx) * fy;
    }
  }
}

/** Removes the part of the flow that would squeeze or stretch the fluid. */
function project(): void {
  for (let y = 1; y < ny - 1; y++) {
    for (let x = 1; x < nx - 1; x++) {
      const i = x + y * nx;
      divergence[i] = -0.5 * (u[i + 1] - u[i - 1] + v[i + nx] - v[i - nx]);
      pressure[i] = 0;
    }
  }
  for (let k = 0; k < PRESSURE_STEPS; k++) {
    for (let y = 1; y < ny - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const i = x + y * nx;
        pressure[i] =
          (divergence[i] +
            pressure[i - 1] +
            pressure[i + 1] +
            pressure[i - nx] +
            pressure[i + nx]) /
          4;
      }
    }
  }
  for (let y = 1; y < ny - 1; y++) {
    for (let x = 1; x < nx - 1; x++) {
      const i = x + y * nx;
      u[i] -= 0.5 * (pressure[i + 1] - pressure[i - 1]);
      v[i] -= 0.5 * (pressure[i + nx] - pressure[i - nx]);
    }
  }
}

/** Fires a jet of ink from the next edge. */
function fireJet(): void {
  if (!nx) return;
  lastJet = clock.time;
  const side = beats++ % 4;
  const along = rnd(0.25, 0.75);
  const tilt = rnd(-0.35, 0.35);
  const jet: Jet =
    side === 0
      ? { x: 3, y: ny * along, dx: 1, dy: tilt, rgb: [], life: 0 }
      : side === 1
        ? { x: nx - 4, y: ny * along, dx: -1, dy: tilt, rgb: [], life: 0 }
        : side === 2
          ? { x: nx * along, y: 3, dx: tilt, dy: 1, rgb: [], life: 0 }
          : { x: nx * along, y: ny - 4, dx: tilt, dy: -1, rgb: [], life: 0 };
  jet.rgb = colorRgb(beats * 0.9, 60).map((c) => c / 255);
  jet.life = 0.25 + audio.bass * 0.15;
  jets.push(jet);
}

export const inkMode: Mode = {
  name: 'ink',
  fade: 1,
  bloom: 0.5,
  blend: 'source-over',
  beatRings: false,
  palettes: ['scriabin', 'technicolor', 'vapor', 'lava', 'deep sea', 'candy', 'acid', 'sunset'],

  beat() {
    fireJet();
  },

  resize() {
    nx = 0;
  },

  draw(dt) {
    const { width, height } = view;
    const w = quality.level === 2 ? 128 : 96;
    const h = Math.max(24, Math.round((w * height) / width));
    if (w !== nx || h !== ny) setUp(w, h);
    // In silence, a slow jet now and then.
    if (clock.time - lastJet > 1.6) fireJet();
    const k = Math.min(dt, 1 / 30) * 60;

    // Jets: set the flow and pour ink in a small disc.
    const force = 1.6 * (0.7 + audio.bass * 0.7);
    for (const jet of jets) {
      for (let oy = -2; oy <= 2; oy++) {
        for (let ox = -2; ox <= 2; ox++) {
          if (ox * ox + oy * oy > 5) continue;
          const x = Math.round(jet.x + ox);
          const y = Math.round(jet.y + oy);
          if (x < 1 || y < 1 || x > nx - 2 || y > ny - 2) continue;
          const i = x + y * nx;
          u[i] = jet.dx * force;
          v[i] = jet.dy * force;
          for (let c = 0; c < 3; c++) ink[c][i] = Math.max(ink[c][i], jet.rgb[c] * 1.3);
        }
      }
      jet.life -= dt;
    }
    jets = jets.filter((jet) => jet.life > 0);

    // The mids stir the tank around its centre; the flow slowly loses speed.
    const stir = 0.00015 * audio.mid;
    for (let y = 1; y < ny - 1; y++) {
      for (let x = 1; x < nx - 1; x++) {
        const i = x + y * nx;
        u[i] = (u[i] - (y - ny / 2) * stir) * 0.997;
        v[i] = (v[i] + (x - nx / 2) * stir) * 0.997;
      }
    }

    project();
    u0.set(u);
    v0.set(v);
    advect(u, u0, k);
    advect(v, v0, k);
    project();
    u0.set(u);
    v0.set(v);
    const keep = Math.pow(0.997, k);
    for (const channel of ink) {
      scratch.set(channel);
      advect(channel, scratch, k);
      for (let i = 0; i < channel.length; i++) channel[i] *= keep;
    }

    const out = layer.pixels;
    for (let i = 0, p = 0; i < nx * ny; i++, p += 4) {
      out[p] = ink[0][i] * 255;
      out[p + 1] = ink[1][i] * 255;
      out[p + 2] = ink[2][i] * 255;
      out[p + 3] = 255;
    }
    layer.flush();
    ctx.imageSmoothingEnabled = true;
    // Leave out the border cells, which the solver does not move.
    ctx.drawImage(layer.canvas, 1, 1, nx - 2, ny - 2, 0, 0, width, height);
  },
};
