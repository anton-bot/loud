/** A chunky 32-pixel-wide field; beats sort rows and columns like a pixel-sorting glitch. */
import { clamp, rndInt } from '../core/math';
import { spectrumAt, waveAt } from '../core/signal';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { colorRgb } from '../render/color';
import { PixelLayer } from '../render/pixelLayer';
import type { Mode } from './mode';

const COLUMNS = 32;
const layer = new PixelLayer();
/** Brightness per pixel, 0..1, smoothed over time. */
let values: Float32Array | null = null;

const ascending = (a: number, b: number): number => a - b;

function sortRow(v: Float32Array, w: number, h: number): void {
  const j = rndInt(h);
  const row = Array.from(v.subarray(j * w, (j + 1) * w)).sort(ascending);
  if (Math.random() < 0.5) row.reverse();
  for (let i = 0; i < w; i++) v[j * w + i] = row[i];
}

function sortColumn(v: Float32Array, w: number, h: number): void {
  const i = rndInt(w);
  const column: number[] = [];
  for (let j = 0; j < h; j++) column.push(v[j * w + i]);
  column.sort(ascending);
  for (let j = 0; j < h; j++) v[j * w + i] = column[j];
}

export const pixels: Mode = {
  name: 'pixels',
  fade: 1,
  bloom: 0.4,
  blend: 'source-over',
  beatRings: false,
  palettes: ['acid', 'neon', 'vapor', 'hazard', 'candy'],

  beat() {
    if (!values) return;
    const rows = 1 + Math.floor(audio.bass * 4);
    for (let r = 0; r < rows; r++) sortRow(values, layer.width, layer.height);
    if (Math.random() < 0.4) sortColumn(values, layer.width, layer.height);
  },

  draw(dt) {
    const { width, height } = view;
    const w = COLUMNS;
    const h = Math.max(8, Math.round((32 * height) / width));
    if (layer.setSize(w, h) || !values) values = new Float32Array(w * h);
    const v = values;
    const data = layer.pixels;
    const rate = Math.min(1, dt * 6);
    for (let j = 0; j < h; j++) {
      const wave = Math.abs(waveAt(j / h));
      for (let i = 0; i < w; i++) {
        const n = j * w + i;
        const target =
          spectrumAt(i / w, 0.4, 1.6) *
            (0.55 + 0.45 * Math.sin(i * 0.5 + clock.time * 3 + j * 0.3)) +
          wave * 0.6 * (1 - Math.abs(i / w - 0.5) * 2);
        v[n] += (target - v[n]) * rate;
        const value = clamp(v[n], 0, 1);
        const c = colorRgb(value * 4 + j * 0.06, 25 + value * 65);
        data[n * 4] = c[0];
        data[n * 4 + 1] = c[1];
        data[n * 4 + 2] = c[2];
        data[n * 4 + 3] = 255;
      }
    }
    // Loud treble: the whole field slips up one row.
    if (audio.high > 0.6 && Math.random() < 0.3) v.copyWithin(0, w);
    layer.flush();

    ctx.imageSmoothingEnabled = false;
    const jolt = audio.beat > 0.5 ? ((Math.random() - 0.5) * width) / w : 0;
    ctx.drawImage(layer.canvas, jolt, 0, width, height);
    ctx.imageSmoothingEnabled = true;
  },
};
