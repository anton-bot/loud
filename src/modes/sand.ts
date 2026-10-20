/**
 * Psychedelic sand in 3D: grains pour from three moving spouts onto a square plate and
 * pile up into dunes, drawn as isometric columns. Each grain takes the colour of the
 * moment it fell, so the dunes grow in stripes of colour; a pile steeper than the
 * angle of repose slides, and the slide carries its colour down the slope. Every kick
 * blasts a crater and throws the grains into the air; strong beats glitch the picture
 * (columns jump, slices tear, a colour-split copy shakes). When the plate gets full,
 * the floor sinks.
 */
import { clamp, hash01, rnd } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx, drawStrip, snapshot, takeSnapshot } from '../render/canvases';
import { colorRgb } from '../render/color';
import { quality } from '../render/quality';
import type { Mode } from './mode';

interface Grain {
  x: number;
  z: number;
  /** Height above the plate, in grains. */
  y: number;
  vx: number;
  vy: number;
  vz: number;
  k: number;
}

/** Steepest slope (grains per cell) before the pile slides. */
const REPOSE = 2.2;
const GRAVITY = 140;
const DROP_HEIGHT = 70;
const MAX_GRAINS = 1600;

let n = 0;
let height = new Float32Array(0);
let tone = new Float32Array(0);
let grains: Grain[] = [];
/** 1 after a strong beat, falling: how hard the picture glitches. */
let glitch = 0;

function setUp(size: number): void {
  n = size;
  height = new Float32Array(n * n);
  tone = new Float32Array(n * n);
  grains = [];
}

/** The colour number of grains falling now: it runs through the palette. */
function colourNow(): number {
  return clock.time * 0.9 + audio.beats * 0.35;
}

function pour(dt: number): void {
  const rate = (40 + audio.bass * 120) * dt;
  for (let s = 0; s < 3; s++) {
    const t = clock.time * (0.21 + s * 0.07) + s * 2.1;
    const x = n * (0.5 + 0.32 * Math.sin(t * 1.3));
    const z = n * (0.5 + 0.32 * Math.cos(t * 0.9 + s));
    for (let i = 0; i < rate + Math.random(); i++) {
      if (grains.length >= MAX_GRAINS) return;
      grains.push({
        x: x + rnd(-0.6, 0.6),
        z: z + rnd(-0.6, 0.6),
        y: DROP_HEIGHT,
        vx: 0,
        vy: 0,
        vz: 0,
        k: colourNow() + s * 0.6,
      });
    }
  }
}

function fall(dt: number): void {
  grains = grains.filter((g) => {
    g.vy -= GRAVITY * dt;
    g.x += g.vx * dt;
    g.z += g.vz * dt;
    g.y += g.vy * dt;
    if (g.x < 0 || g.z < 0 || g.x >= n || g.z >= n) return g.y > -20;
    const i = Math.floor(g.z) * n + Math.floor(g.x);
    if (g.y <= height[i]) {
      height[i] += 1;
      tone[i] = g.k;
      return false;
    }
    return true;
  });
}

/** Slopes steeper than the angle of repose slide; the top colour slides with them. */
function slide(): void {
  for (let pass = 0; pass < 2; pass++) {
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const i = z * n + x;
        for (const j of [x + 1 < n ? i + 1 : -1, z + 1 < n ? i + n : -1]) {
          if (j < 0) continue;
          const d = height[i] - height[j];
          if (d > REPOSE) {
            const move = (d - REPOSE) * 0.25;
            height[i] -= move;
            height[j] += move;
            tone[j] = tone[i];
          } else if (-d > REPOSE) {
            const move = (-d - REPOSE) * 0.25;
            height[j] -= move;
            height[i] += move;
            tone[i] = tone[j];
          }
        }
      }
    }
  }
}

/** A crater, and its grains thrown into the air. */
function blast(): void {
  const cx = rnd(0.2, 0.8) * n;
  const cz = rnd(0.2, 0.8) * n;
  const radius = 4 + audio.bass * 4;
  for (let z = Math.max(0, Math.floor(cz - radius)); z < Math.min(n, cz + radius); z++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(n, cx + radius); x++) {
      const d = Math.hypot(x - cx, z - cz);
      if (d >= radius) continue;
      const i = z * n + x;
      const take = Math.min(height[i], (radius - d) * 1.6);
      height[i] -= take;
      for (let k = 0; k < take && grains.length < MAX_GRAINS; k += 1.5) {
        const a = Math.atan2(z - cz, x - cx) + rnd(-0.4, 0.4);
        const out = rnd(4, 16);
        grains.push({
          x: x + 0.5,
          z: z + 0.5,
          y: height[i] + 1,
          vx: Math.cos(a) * out,
          vy: rnd(40, 95),
          vz: Math.sin(a) * out,
          k: tone[i],
        });
      }
    }
  }
}

function rgb(k: number, lightness: number, shade: number): string {
  const [r, g, b] = colorRgb(k, lightness);
  return `rgb(${(r * shade) | 0},${(g * shade) | 0},${(b * shade) | 0})`;
}

export const sand: Mode = {
  name: 'sand',
  fade: 1,
  bloom: 0.6,
  blend: 'source-over',
  beatRings: false,
  palettes: ['void', 'technicolor', 'acid', 'neon', 'vapor', 'lava', 'ultraviolet'],

  beat() {
    blast();
    if (audio.bass > 0.55) glitch = 1;
  },

  resize() {
    // The plate does not depend on the screen size.
  },

  draw(dt) {
    const size = quality.level === 2 ? 48 : 38;
    if (n !== size) setUp(size);
    const step = Math.min(dt, 1 / 30);
    pour(step);
    fall(step);
    slide();
    // A full plate: the floor sinks.
    let total = 0;
    for (let i = 0; i < height.length; i++) total += height[i];
    if (total / height.length > 14)
      for (let i = 0; i < height.length; i++) height[i] = Math.max(0, height[i] - step * 6);
    glitch = Math.max(0, glitch - step * 3);

    const { width, height: screenH, cx, cy } = view;
    const t = clock.time;
    const sky = ctx.createLinearGradient(0, 0, 0, screenH);
    sky.addColorStop(0, rgb(t * 0.2 + 2, 12, 1));
    sky.addColorStop(1, '#030206');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, screenH);

    // Isometric plate: half a tile across and down, and the height of one grain.
    const tw = Math.min(width * 0.92, screenH * 1.5) / (2 * n);
    const th = tw * 0.5;
    const hu = tw * 0.22;
    const y0 = cy - n * th + screenH * 0.06;
    const h = height;
    // The plate: a glowing outline and a faint grid.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgb(t * 0.3, 45, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let g = 0; g <= n; g += 4) {
      ctx.moveTo(cx + g * tw, y0 + g * th - th);
      ctx.lineTo(cx + (g - n) * tw, y0 + (g + n) * th - th);
      ctx.moveTo(cx - g * tw, y0 + g * th - th);
      ctx.lineTo(cx + (n - g) * tw, y0 + (g + n) * th - th);
    }
    ctx.stroke();
    ctx.restore();
    for (let s = 0; s < 2 * n - 1; s++) {
      for (let i = Math.max(0, s - n + 1); i <= Math.min(n - 1, s); i++) {
        const j = s - i;
        const c = j * n + i;
        const v = h[c];
        const jump =
          glitch > 0.2 ? (hash01(c * 1.7 + Math.floor(t * 20)) - 0.5) * glitch * th * 6 : 0;
        const X = cx + (i - j) * tw;
        const Y = y0 + (i + j) * th - v * hu + jump;
        // Stripes of light and dark with height: strata.
        const band = 0.82 + 0.18 * Math.sin(v * 0.9 + tone[c]);
        const k = tone[c];
        // Front faces down to the next column (or the plate).
        const right = i + 1 < n ? h[c + 1] : 0;
        const left = j + 1 < n ? h[c + n] : 0;
        if (v > left) {
          const d = (v - left) * hu;
          ctx.fillStyle = rgb(k, 48, 0.62 * band);
          ctx.beginPath();
          ctx.moveTo(X - tw, Y);
          ctx.lineTo(X, Y + th);
          ctx.lineTo(X, Y + th + d);
          ctx.lineTo(X - tw, Y + d);
          ctx.fill();
        }
        if (v > right) {
          const d = (v - right) * hu;
          ctx.fillStyle = rgb(k, 56, 0.82 * band);
          ctx.beginPath();
          ctx.moveTo(X + tw, Y);
          ctx.lineTo(X, Y + th);
          ctx.lineTo(X, Y + th + d);
          ctx.lineTo(X + tw, Y + d);
          ctx.fill();
        }
        ctx.fillStyle = v < 0.3 ? '#100e1a' : rgb(k, 66 + clamp(v, 0, 20), band);
        ctx.beginPath();
        ctx.moveTo(X, Y - th);
        ctx.lineTo(X + tw + 0.5, Y);
        ctx.lineTo(X, Y + th + 0.5);
        ctx.lineTo(X - tw - 0.5, Y);
        ctx.fill();
      }
    }

    // Grains in the air: bright streaks.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, tw * 0.25);
    for (const g of grains) {
      const X = cx + (g.x - g.z) * tw;
      const Y = y0 + (g.x + g.z) * th - g.y * hu;
      ctx.strokeStyle = rgb(g.k, 75, 1);
      ctx.beginPath();
      ctx.moveTo(X, Y);
      ctx.lineTo(X - g.vx * tw * 0.02, Y + g.vy * hu * 0.03);
      ctx.stroke();
    }
    ctx.restore();

    // Glitch: torn slices and a colour-split copy.
    if (glitch > 0.3) {
      takeSnapshot();
      for (let i = 0; i < 5; i++) {
        const y = Math.random() * screenH;
        drawStrip(snapshot, y, rnd(4, 40), (Math.random() - 0.5) * width * 0.15 * glitch, y);
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 * glitch;
      const off = tw * 1.5 * glitch;
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, off, 0, width, screenH);
      ctx.drawImage(
        snapshot,
        0,
        0,
        snapshot.width,
        snapshot.height,
        -off,
        off * 0.4,
        width,
        screenH,
      );
      ctx.restore();
    }
  },
};
