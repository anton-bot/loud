/**
 * Data as a picture, after Ryoji Ikeda's "test pattern": stacked bands of barcodes,
 * binary digits, spectrum bitmaps and waveforms, scrolling past at high speed in
 * black and white. Every band reads its own part of the spectrum.
 *
 * The screen is cut into panels (whole, halves or quarters, sometimes tilted and
 * turning), and each panel scrolls its bands its own way: sideways, up or down.
 * Beats re-cut and reverse bands, and now and then re-cut the panels. On top of that:
 *   glitch  strips and blocks of the picture jump sideways, up and down (treble, beats)
 *   melt    on some beats the picture is frozen, tinted, and drips down in columns of
 *           different speeds, sagging and stretching, while the live picture goes on
 * A strong beat inverts the picture (at most about once a second).
 */
import { context2d } from '../core/dom';
import { clamp, hash01, pick, rnd } from '../core/math';
import { spectrumAt, waveAt } from '../core/signal';
import { audio, clock, scene, view } from '../core/state';
import { ctx, sceneCanvas, snapshot, takeSnapshot } from '../render/canvases';
import { background, color } from '../render/color';
import { pathPoint } from '../render/shapes';
import { MONOSPACE } from './fonts';
import type { Mode } from './mode';

type Kind = 'barcode' | 'binary' | 'bitmap' | 'wave' | 'blank';
/** Barcodes are the main material; a kind can repeat to make it more likely. */
// prettier-ignore
const KINDS: readonly Kind[] = ['barcode', 'barcode', 'barcode', 'barcode', 'binary', 'binary', 'bitmap', 'bitmap', 'wave', 'blank'];
type Layout = 'rows' | 'columns' | 'halves' | 'stack' | 'quarters' | 'tilt';
const LAYOUTS: readonly Layout[] = [
  'rows',
  'rows',
  'columns',
  'halves',
  'stack',
  'quarters',
  'tilt',
];
/** Seconds between two inversions: flashes stay slow (photosensitivity). */
const INVERT_GAP_S = 0.9;
const MELT_COLUMNS = 96;
const MELT_S = 3.2;

interface Band {
  kind: Kind;
  /** Part of the spectrum that this band reads, 0..1. */
  bin: number;
  /** Scroll speed in screen widths per second; the sign is the direction. */
  speed: number;
  /** Scroll position in pixels. */
  offset: number;
  seed: number;
  /** Bar width multiplier for barcodes. */
  bar: number;
}

interface Panel {
  /** The panel's rectangle on the screen. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Direction of the bands (radians), and how fast it turns. */
  angle: number;
  spin: number;
  bands: Band[];
}

/** One glitch: a strip or block of the picture, drawn moved. */
interface Cut {
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
}

let panels: Panel[] = [];
let layout: Layout = 'rows';
let beats = 0;
let lastInvert = -1;
/** 1 after a beat, then falls: how wild the glitches are. */
let glitch = 0;
let cuts: Cut[] = [];
/** Colour strip of the current glitch (y, height), or none. */
let stripe: [number, number] | null = null;
let nextCut = 0;

/** The frozen picture that melts, and the drop and speed of each of its columns. */
const frozen = document.createElement('canvas');
const frozenCtx = context2d(frozen);
let meltAge = -1;
const drops = new Float32Array(MELT_COLUMNS);
const dropSpeeds = new Float32Array(MELT_COLUMNS);
const weights = new Float32Array(MELT_COLUMNS);

function newBand(index: number, count: number): Band {
  return {
    kind: pick(KINDS),
    bin: (index + 0.5) / count,
    speed: rnd(0.3, 2.2) * (Math.random() < 0.5 ? 1 : -1),
    offset: 0,
    seed: Math.random() * 1000,
    bar: 1 + Math.floor(Math.random() * 3),
  };
}

/** Length and thickness of the turned box that covers the panel. */
function span(panel: Panel): [number, number] {
  const cos = Math.abs(Math.cos(panel.angle));
  const sin = Math.abs(Math.sin(panel.angle));
  return [panel.w * cos + panel.h * sin, panel.w * sin + panel.h * cos];
}

function newPanel(x: number, y: number, w: number, h: number, angle: number, spin = 0): Panel {
  const panel: Panel = { x, y, w, h, angle, spin, bands: [] };
  const count = clamp(Math.round(span(panel)[1] / 46), 5, 18);
  panel.bands = Array.from({ length: count }, (_, i) => newBand(i, count));
  return panel;
}

function makePanels(kind: Layout): Panel[] {
  const { width: w, height: h } = view;
  const down = Math.PI / 2;
  const a = Math.random() < 0.5 ? 0 : down;
  switch (kind) {
    case 'rows':
      return [newPanel(0, 0, w, h, 0)];
    case 'columns':
      return [newPanel(0, 0, w, h, down)];
    case 'halves':
      return [newPanel(0, 0, w / 2, h, a), newPanel(w / 2, 0, w / 2, h, down - a)];
    case 'stack':
      return [newPanel(0, 0, w, h / 2, a), newPanel(0, h / 2, w, h / 2, down - a)];
    case 'quarters':
      // A checkerboard of across and down.
      return [0, 1, 2, 3].map((i) =>
        newPanel(
          (i % 2) * (w / 2),
          (i >> 1) * (h / 2),
          w / 2,
          h / 2,
          (i + (i >> 1)) % 2 ? down : 0,
        ),
      );
    case 'tilt':
      return [newPanel(0, 0, w, h, rnd(-0.6, 0.6), rnd(-0.15, 0.15))];
  }
}

function drawBarcode(band: Band, length: number, y: number, h: number, level: number): void {
  const barWidth = Math.max(2, Math.round(view.min / 220)) * band.bar;
  const start = Math.floor(band.offset / barWidth);
  const shift = band.offset - start * barWidth;
  const columns = Math.ceil(length / barWidth) + 1;
  const density = 0.3 + level * 0.55;
  ctx.beginPath();
  for (let c = 0; c < columns; c++) {
    if (hash01((start + c) * 0.731 + band.seed) < density)
      ctx.rect(c * barWidth - shift, y, barWidth, h);
  }
  ctx.fill();
}

function drawBinary(band: Band, length: number, y: number, h: number): void {
  const freq = audio.freq;
  const size = Math.max(8, Math.floor(h * 0.62));
  const charWidth = size * 0.62;
  const count = Math.ceil(length / charWidth) + 1;
  const first = Math.floor(band.offset / charWidth);
  const base = Math.floor(band.bin * freq.length * 0.5);
  let text = '';
  for (let c = 0; c < count; c++) {
    const n = first + c;
    const byte = freq[(base + Math.floor(n / 8) + freq.length * 64) % freq.length];
    text += (byte >> (7 - (((n % 8) + 8) % 8))) & 1;
  }
  ctx.font = `${size}px ${MONOSPACE}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, -(band.offset - first * charWidth), y + h / 2);
}

/** Three rows of cells: one cell per spectrum bin, lit when the bin is loud. */
function drawBitmap(band: Band, length: number, y: number, h: number): void {
  const freq = audio.freq;
  const cell = h / 3;
  const columns = Math.ceil(length / cell) + 1;
  const first = Math.floor(band.offset / cell);
  const shift = band.offset - first * cell;
  ctx.beginPath();
  for (let row = 0; row < 3; row++) {
    for (let c = 0; c < columns; c++) {
      const bin = Math.abs((first + c) * 3 + row) % (freq.length >> 1);
      if (freq[bin] > 100) ctx.rect(c * cell - shift + 1, y + row * cell + 1, cell - 2, cell - 2);
    }
  }
  ctx.fill();
}

function drawWave(length: number, y: number, h: number): void {
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 160; i++) {
    const t = i / 160;
    pathPoint(ctx, i, t * length, y + h / 2 + waveAt(t) * h * 0.45);
  }
  ctx.stroke();
  // Ticks, as on a measuring instrument.
  ctx.beginPath();
  for (let x = 0; x < length; x += 8) {
    const tick = 2 + Math.abs(waveAt(x / length)) * h * 0.4;
    ctx.rect(x, y + h - tick, 1, tick);
  }
  ctx.fill();
}

function drawPanel(panel: Panel, ink: string, pace: number, dt: number): void {
  panel.angle += panel.spin * dt * (1 + audio.mid * 2);
  const [length, thickness] = span(panel);
  const inset = panels.length > 1 ? 1 : 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(panel.x + inset, panel.y + inset, panel.w - inset * 2, panel.h - inset * 2);
  ctx.clip();
  ctx.translate(panel.x + panel.w / 2, panel.y + panel.h / 2);
  ctx.rotate(panel.angle);
  ctx.translate(-length / 2, -thickness / 2);

  const bands = panel.bands;
  const gap = 2;
  const bandHeight = (thickness - gap * (bands.length - 1)) / bands.length;
  const label = `${Math.max(9, Math.round(bandHeight * 0.28))}px ${MONOSPACE}`;
  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const y = i * (bandHeight + gap);
    const level = spectrumAt(band.bin, 0.5, 1.4);
    band.offset += band.speed * pace;
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    if (band.kind === 'barcode') drawBarcode(band, length, y, bandHeight, level);
    else if (band.kind === 'binary') drawBinary(band, length, y, bandHeight);
    else if (band.kind === 'bitmap') drawBitmap(band, length, y, bandHeight);
    else if (band.kind === 'wave') drawWave(length, y, bandHeight);
    // A small readout of the band's level, in the accent colour.
    ctx.fillStyle = color(0, 0.9, 60);
    ctx.font = label;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    const hex = Math.round(level * 255)
      .toString(16)
      .padStart(2, '0');
    ctx.fillText(`${String(i).padStart(2, '0')}:${hex}`, length - 4, y + 2);
  }
  ctx.restore();
}

/** Freezes the current picture, tinted, and lets it start to drip. */
function startMelt(): void {
  frozen.width = sceneCanvas.width;
  frozen.height = sceneCanvas.height;
  frozenCtx.drawImage(sceneCanvas, 0, 0);
  // Ink takes the accent colour: 'multiply' on dark palettes, 'screen' on light ones.
  frozenCtx.globalCompositeOperation = scene.palette.light ? 'screen' : 'multiply';
  frozenCtx.fillStyle = color(rnd(0, 6), 1, 60);
  frozenCtx.fillRect(0, 0, frozen.width, frozen.height);
  frozenCtx.globalCompositeOperation = 'source-over';
  // Neighbouring columns drip alike, so the drips come out round, like wax.
  for (let i = 0; i < MELT_COLUMNS; i++) weights[i] = Math.random();
  for (let i = 0; i < MELT_COLUMNS; i++) {
    const near = (weights[Math.max(0, i - 1)] + weights[Math.min(MELT_COLUMNS - 1, i + 1)]) / 2;
    dropSpeeds[i] = 0.05 + Math.pow(weights[i] * 0.5 + near * 0.5, 3) * 1.4;
    drops[i] = 0;
  }
  meltAge = 0;
}

function drawMelt(dt: number): void {
  if (meltAge < 0) return;
  meltAge += dt;
  const alpha = clamp((MELT_S - meltAge) / 0.8, 0, 1);
  if (alpha <= 0 || frozen.width !== sceneCanvas.width) {
    meltAge = -1;
    return;
  }
  const height = frozen.height;
  const columnWidth = frozen.width / MELT_COLUMNS;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = scene.palette.light ? 'darken' : 'lighten';
  for (let i = 0; i < MELT_COLUMNS; i++) {
    // Each column falls faster and faster; the bass gives it weight.
    drops[i] += dropSpeeds[i] * (1 + audio.bass * 1.5) * meltAge * height * dt;
    const drop = drops[i];
    const x = Math.floor(i * columnWidth);
    const w = Math.floor((i + 1) * columnWidth) - x;
    // The top sags less than the bottom, so the column also stretches.
    ctx.drawImage(frozen, x, 0, w, height, x, drop * 0.35, w, height + drop);
  }
  ctx.restore();
}

/** Picks new strips and blocks to move. */
function cutGlitches(amount: number): void {
  const { width, height } = view;
  cuts = [];
  const count = Math.floor(amount * (3 + Math.random() * 7));
  for (let i = 0; i < count; i++) {
    const jump = rnd(-1, 1) * (15 + amount * 200);
    const size = rnd(3, 12 + amount * 50);
    const kind = Math.random();
    if (kind < 0.55) {
      // A strip across the screen, moved sideways.
      cuts.push({ x: 0, y: Math.random() * height, w: width, h: size, dx: jump, dy: 0 });
    } else if (kind < 0.8) {
      // A strip down the screen, moved up or down.
      cuts.push({ x: Math.random() * width, y: 0, w: size, h: height, dx: 0, dy: jump });
    } else {
      // A block moved a little, as in a broken video stream.
      const w = rnd(30, 180);
      const h = rnd(12, 100);
      cuts.push({
        x: Math.random() * (width - w),
        y: Math.random() * (height - h),
        w,
        h,
        dx: rnd(-80, 80),
        dy: rnd(-50, 50),
      });
    }
  }
  stripe = Math.random() < amount * 0.6 ? [Math.random() * height, rnd(2, 26)] : null;
}

function drawGlitches(): void {
  const amount = Math.min(1.5, glitch + audio.high * 0.7);
  // The cuts are held for a few frames: a jitter, not a flicker.
  if (clock.time >= nextCut || clock.time < nextCut - 1) {
    cutGlitches(amount);
    nextCut = clock.time + rnd(0.06, 0.16);
  }
  if (!cuts.length && !stripe) return;
  const dpr = view.dpr;
  takeSnapshot();
  for (const cut of cuts) {
    ctx.drawImage(
      snapshot,
      cut.x * dpr,
      cut.y * dpr,
      cut.w * dpr,
      cut.h * dpr,
      cut.x + cut.dx,
      cut.y + cut.dy,
      cut.w,
      cut.h,
    );
  }
  if (stripe) {
    // Colour leaks into the black and white.
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = color(3, 1, 55);
    ctx.fillRect(0, stripe[0], view.width, stripe[1]);
    ctx.globalCompositeOperation = 'source-over';
  }
}

export const datamatics: Mode = {
  name: 'datamatics',
  fade: 1,
  bloom: 0.15,
  blend: 'source-over',
  beatRings: false,
  palettes: ['mono', 'noir', 'void', 'blueprint', 'hazard', 'paper'],

  beat() {
    if (!panels.length) return;
    glitch = 1;
    beats++;
    if (beats % 8 === 0 && Math.random() < 0.7) {
      layout = pick(LAYOUTS, layout);
      panels = makePanels(layout);
    } else {
      // Re-cut some bands, and throw some into reverse.
      for (const panel of panels) {
        const bands = panel.bands;
        for (let i = 0; i < bands.length; i++) {
          const r = Math.random();
          if (r < 0.25) bands[i] = newBand(i, bands.length);
          else if (r < 0.4) bands[i].speed *= -rnd(0.7, 1.6);
          else if (r < 0.45) bands[i].offset += rnd(-1, 1) * view.width;
        }
      }
    }
    if (meltAge < 0 && Math.random() < 0.3) startMelt();
  },

  resize() {
    panels = [];
    meltAge = -1;
  },

  draw(dt) {
    const { width, height } = view;
    if (!panels.length) panels = makePanels(layout);
    glitch = Math.max(0, glitch - dt * 2.5);
    ctx.fillStyle = background(1);
    ctx.fillRect(0, 0, width, height);

    const ink = scene.palette.light ? 'rgb(12,12,12)' : 'rgb(245,245,245)';
    const pace = (0.4 + audio.mid * 2.2 + audio.beat) * dt * width;
    for (const panel of panels) drawPanel(panel, ink, pace, dt);
    drawMelt(dt);
    drawGlitches();

    // A strong beat inverts the picture, but never more than about once a second.
    if (audio.beat > 0.9 && audio.bass > 0.6 && clock.time - lastInvert > INVERT_GAP_S) {
      lastInvert = clock.time;
    }
    if (clock.time - lastInvert < 0.07) {
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }
  },
};
