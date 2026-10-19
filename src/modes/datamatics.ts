/**
 * Data as a picture, after Ryoji Ikeda's "test pattern": stacked bands of barcodes,
 * binary digits, spectrum bitmaps and waveforms, scrolling past at high speed in
 * black and white. Every band reads its own part of the spectrum. Beats re-cut the
 * bands; a strong beat inverts the picture (at most about once a second).
 */
import { hash01, pick, rnd } from '../core/math';
import { spectrumAt, waveAt } from '../core/signal';
import { audio, clock, scene, view } from '../core/state';
import { ctx } from '../render/canvases';
import { background, color } from '../render/color';
import { pathPoint } from '../render/shapes';
import { MONOSPACE } from './fonts';
import type { Mode } from './mode';

type Kind = 'barcode' | 'binary' | 'bitmap' | 'wave' | 'blank';
/** Barcodes are the main material; a kind can repeat to make it more likely. */
// prettier-ignore
const KINDS: readonly Kind[] = ['barcode', 'barcode', 'barcode', 'barcode', 'binary', 'binary', 'bitmap', 'bitmap', 'wave', 'blank'];
/** Seconds between two inversions: flashes stay slow (photosensitivity). */
const INVERT_GAP_S = 0.9;

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

let bands: Band[] = [];
let lastInvert = -1;

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

function setUp(): void {
  const count = Math.max(8, Math.min(18, Math.round(view.height / 46)));
  bands = Array.from({ length: count }, (_, i) => newBand(i, count));
}

function drawBarcode(band: Band, y: number, h: number, level: number): void {
  const barWidth = Math.max(2, Math.round(view.min / 220)) * band.bar;
  const start = Math.floor(band.offset / barWidth);
  const shift = band.offset - start * barWidth;
  const columns = Math.ceil(view.width / barWidth) + 1;
  const density = 0.3 + level * 0.55;
  ctx.beginPath();
  for (let c = 0; c < columns; c++) {
    if (hash01((start + c) * 0.731 + band.seed) < density)
      ctx.rect(c * barWidth - shift, y, barWidth, h);
  }
  ctx.fill();
}

function drawBinary(band: Band, y: number, h: number): void {
  const freq = audio.freq;
  const size = Math.max(8, Math.floor(h * 0.62));
  const charWidth = size * 0.62;
  const count = Math.ceil(view.width / charWidth) + 1;
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
function drawBitmap(band: Band, y: number, h: number): void {
  const freq = audio.freq;
  const cell = h / 3;
  const columns = Math.ceil(view.width / cell) + 1;
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

function drawWave(y: number, h: number): void {
  const { width } = view;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 160; i++) {
    const t = i / 160;
    pathPoint(ctx, i, t * width, y + h / 2 + waveAt(t) * h * 0.45);
  }
  ctx.stroke();
  // Ticks, as on a measuring instrument.
  ctx.beginPath();
  for (let x = 0; x < width; x += 8) {
    const tick = 2 + Math.abs(waveAt(x / width)) * h * 0.4;
    ctx.rect(x, y + h - tick, 1, tick);
  }
  ctx.fill();
}

export const datamatics: Mode = {
  name: 'datamatics',
  fade: 1,
  bloom: 0.15,
  blend: 'source-over',
  beatRings: false,
  palettes: ['mono', 'noir', 'void', 'blueprint', 'hazard', 'paper'],

  beat() {
    if (!bands.length) return;
    // Re-cut some bands.
    for (let i = 0; i < bands.length; i++) {
      if (Math.random() < 0.3) bands[i] = newBand(i, bands.length);
    }
  },

  resize() {
    bands = [];
  },

  draw(dt) {
    const { width, height } = view;
    if (!bands.length) setUp();
    ctx.fillStyle = background(1);
    ctx.fillRect(0, 0, width, height);

    const ink = scene.palette.light ? 'rgb(12,12,12)' : 'rgb(245,245,245)';
    const gap = 2;
    const bandHeight = (height - gap * (bands.length - 1)) / bands.length;
    const pace = (0.4 + audio.mid * 2.2 + audio.beat) * dt * width;
    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      const y = i * (bandHeight + gap);
      const level = spectrumAt(band.bin, 0.5, 1.4);
      band.offset += band.speed * pace;
      ctx.fillStyle = ink;
      ctx.strokeStyle = ink;
      if (band.kind === 'barcode') drawBarcode(band, y, bandHeight, level);
      else if (band.kind === 'binary') drawBinary(band, y, bandHeight);
      else if (band.kind === 'bitmap') drawBitmap(band, y, bandHeight);
      else if (band.kind === 'wave') drawWave(y, bandHeight);
      // A small readout of the band's level, in the accent colour.
      ctx.fillStyle = color(0, 0.9, 60);
      ctx.font = `${Math.max(9, Math.round(bandHeight * 0.28))}px ${MONOSPACE}`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'right';
      const hex = Math.round(level * 255)
        .toString(16)
        .padStart(2, '0');
      ctx.fillText(`${String(i).padStart(2, '0')}:${hex}`, width - 4, y + 2);
    }

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
