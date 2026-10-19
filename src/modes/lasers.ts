/**
 * Laser show in fog. The beams are drawn on a half-size layer and then masked by a
 * fog layer, so a beam shows only where it passes through smoke.
 */
import { createLayer } from '../core/dom';
import { rnd, rndInt, TAU } from '../core/math';
import { waveAt } from '../core/signal';
import { audio, clock, scene, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle, pathPoint } from '../render/shapes';
import type { Mode } from './mode';

interface Puff {
  /** Position and radius as fractions of the layer. */
  x: number;
  y: number;
  r: number;
  alpha: number;
  vx: number;
  vy: number;
  phase: number;
}

interface Emitter {
  /** Position as a fraction of the screen. */
  x: number;
  y: number;
  /** Rest angle, sweep amplitude and sweep speed. */
  base: number;
  amp: number;
  speed: number;
  phase: number;
  /** Beams in the fan. */
  fan: number;
  k: number;
  on: boolean;
}

const fog = createLayer();
const beams = createLayer();
let layerWidth = 0;
let layerHeight = 0;
let puffs: Puff[] = [];
let emitters: Emitter[] = [];

function setUp(w: number, h: number): void {
  for (const layer of [fog, beams]) {
    layer.canvas.width = w;
    layer.canvas.height = h;
  }
  layerWidth = w;
  layerHeight = h;
  puffs = [];
  for (let i = 0; i < 34; i++) {
    puffs.push({
      x: Math.random(),
      y: Math.random(),
      r: rnd(0.07, 0.26),
      alpha: rnd(0.35, 0.9),
      vx: rnd(-0.02, 0.02),
      vy: rnd(-0.01, 0.01),
      phase: Math.random() * TAU,
    });
  }
  // A row of emitters along the top, and one at the bottom centre.
  emitters = [];
  const count = view.width > view.height ? 7 : 5;
  for (let i = 0; i < count; i++) {
    emitters.push({
      x: (i + 0.5) / count,
      y: 0,
      base: Math.PI / 2 + ((i + 0.5) / count - 0.5) * 0.6,
      amp: rnd(0.3, 0.8),
      speed: rnd(0.4, 1.2),
      phase: Math.random() * TAU,
      fan: 1 + rndInt(4),
      k: Math.random() * 4,
      on: true,
    });
  }
  emitters.push({
    x: 0.5,
    y: 1,
    base: -Math.PI / 2,
    amp: 1,
    speed: 0.7,
    phase: 0,
    fan: 3,
    k: 2,
    on: true,
  });
}

function emitterAngle(e: Emitter): number {
  return (
    e.base + Math.sin(clock.time * e.speed * (1 + audio.mid) + e.phase) * e.amp * (0.5 + audio.mid)
  );
}

/** Paints the fog puffs (white, or black on light palettes) on the fog layer. */
function drawFog(dt: number): void {
  const f = fog.ctx;
  const w = layerWidth;
  const h = layerHeight;
  const ink = scene.palette.light ? '0,0,0' : '255,255,255';
  f.globalCompositeOperation = 'source-over';
  f.clearRect(0, 0, w, h);
  for (const p of puffs) {
    p.x += p.vx * dt * (1 + audio.mid);
    p.y += p.vy * dt;
    // Wrap around with some margin, so puffs drift in from off-screen.
    if (p.x < -0.4) p.x += 1.8;
    if (p.x > 1.4) p.x -= 1.8;
    if (p.y < -0.4) p.y += 1.8;
    if (p.y > 1.4) p.y -= 1.8;
    const r = p.r * Math.min(w, h) * (1 + audio.bass * 0.25 + 0.1 * Math.sin(clock.time + p.phase));
    const x = p.x * w;
    const y = p.y * h;
    const a = p.alpha * (0.6 + audio.bass * 0.4);
    const puff = f.createRadialGradient(x, y, 0, x, y, r);
    puff.addColorStop(0, `rgba(${ink},${a})`);
    puff.addColorStop(1, `rgba(${ink},0)`);
    f.fillStyle = puff;
    fillCircle(f, x, y, r);
  }
}

/** Draws the beams and a waveform on the beam layer, then keeps them only inside the fog. */
function drawBeams(fanWidth: number): void {
  const b = beams.ctx;
  const w = layerWidth;
  const h = layerHeight;
  b.globalCompositeOperation = 'source-over';
  b.clearRect(0, 0, w, h);
  b.globalCompositeOperation = 'lighter';
  b.lineCap = 'round';
  const length = Math.hypot(w, h) * 1.2;
  for (const e of emitters) {
    if (!e.on) continue;
    const x0 = e.x * w;
    const y0 = e.y * h;
    const a0 = emitterAngle(e);
    for (let k = 0; k < e.fan; k++) {
      const a = a0 + (k - (e.fan - 1) / 2) * fanWidth;
      const x1 = x0 + Math.cos(a) * length;
      const y1 = y0 + Math.sin(a) * length;
      // A wide soft glow, then a thin bright core.
      b.strokeStyle = color(e.k + k * 0.3, 0.15, 60);
      b.lineWidth = 9 * (1 + audio.bass * 0.6);
      b.beginPath();
      b.moveTo(x0, y0);
      b.lineTo(x1, y1);
      b.stroke();
      b.strokeStyle = color(e.k + k * 0.3, 0.45, 75);
      b.lineWidth = 3;
      b.beginPath();
      b.moveTo(x0, y0);
      b.lineTo(x1, y1);
      b.stroke();
    }
  }
  b.strokeStyle = color(1, 0.9, 85);
  b.lineWidth = 2;
  b.beginPath();
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    pathPoint(b, i, t * w, h * 0.55 + waveAt(t) * h * 0.2 * (0.5 + audio.mid));
  }
  b.stroke();
  b.globalCompositeOperation = 'destination-in';
  b.drawImage(fog.canvas, 0, 0);
}

export const lasers: Mode = {
  name: 'zeds-lasers',
  fade: 0.55,
  blend: 'source-over',
  beatRings: false,
  palettes: ['void', 'neon', 'deep sea', 'ultraviolet', 'acid', 'noir', 'slate'],

  beat() {
    for (const e of emitters) {
      if (Math.random() < 0.5) {
        e.k = Math.random() * 4;
        e.fan = 1 + rndInt(5);
        e.phase += rnd(-1, 1);
      }
      e.on = Math.random() < 0.9;
    }
    for (const p of puffs) if (Math.random() < 0.2) p.alpha = rnd(0.3, 0.8);
  },

  draw(dt) {
    const { width, height } = view;
    const light = scene.palette.light;
    const w = Math.max(64, Math.round(width / 2));
    const h = Math.max(64, Math.round(height / 2));
    if (layerWidth !== w || layerHeight !== h) setUp(w, h);
    const fanWidth = 0.06 + audio.high * 0.12;
    drawFog(dt);
    drawBeams(fanWidth);

    // Fog, then the masked beams.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = light ? 0.22 : 0.11;
    ctx.drawImage(fog.canvas, 0, 0, width, height);
    ctx.globalCompositeOperation = light ? 'multiply' : 'lighter';
    ctx.globalAlpha = 1;
    ctx.drawImage(beams.canvas, 0, 0, width, height);

    // Faint full-length beams at full resolution, so the beams stay sharp.
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1;
    const length = Math.hypot(width, height) * 1.2;
    for (const e of emitters) {
      if (!e.on) continue;
      const x0 = e.x * width;
      const y0 = e.y * height;
      const a0 = emitterAngle(e);
      for (let k = 0; k < e.fan; k++) {
        const a = a0 + (k - (e.fan - 1) / 2) * fanWidth;
        ctx.strokeStyle = color(e.k + k * 0.3, 1, 85);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + Math.cos(a) * length, y0 + Math.sin(a) * length);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    for (const e of emitters) {
      ctx.fillStyle = color(e.k, 1, 95);
      fillCircle(ctx, e.x * width, e.y * height, 3 + audio.beat * 4);
    }
  },
};
