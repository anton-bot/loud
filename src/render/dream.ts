/**
 * Dream frames: a heard phrase becomes a picture. The text goes to Pollinations (a free
 * image generator; `private=true` keeps it out of their public feed). The picture fades in over the current mode, holds for a moment, then melts away:
 * bright runs of pixels slide down (pixel sorting) and the columns drip off the bottom
 * of the screen, until only the mode is left.
 */
import { context2d } from '../core/dom';
import { clamp, hash01 } from '../core/math';
import { clock, view } from '../core/state';
import { ctx } from './canvases';
import { PixelLayer } from './pixelLayer';

const W = 240;
const FADE_IN_S = 1;
const HOLD_S = 3;
const MELT_S = 7;
const TOTAL_S = FADE_IN_S + HOLD_S + MELT_S;
/** At most one picture per this long (speech comes every 45 s anyway). */
const GAP_MS = 30_000;
/**
 * Pollinations token (free at https://auth.pollinations.ai). Since 2025, requests
 * without one are refused ("Missing Turnstile token"). Empty: dream frames stay off,
 * and no text is sent.
 */
const TOKEN = '';

const layer = new PixelLayer();
const fit = document.createElement('canvas');
const fitCtx = context2d(fit, { willReadFrequently: true });
let base: Uint8ClampedArray | null = null;
let shownAt = 0;
let pending = false;
let lastRequest = -Infinity;
let dreams = 0;
const packed = new Uint32Array(1024);

/** Asks for a picture of `text`; it shows when it arrives (usually 5 to 20 s). */
export function requestDream(text: string): void {
  const phrase = text.trim();
  if (!TOKEN || pending || [...phrase].length < 4 || Date.now() - lastRequest < GAP_MS) return;
  pending = true;
  lastRequest = Date.now();
  const prompt = `${phrase}, dreamlike psychedelic digital art, vivid neon colours`;
  const seed = Math.floor(Math.random() * 1e6);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=768&height=512&nologo=true&private=true&seed=${seed}&token=${TOKEN}`;
  load(url);
}

/** Shows the picture at `url` as a dream (for trying the melt from the console). */
export function dreamFromUrl(url: string): void {
  pending = true;
  load(url);
}

function load(url: string): void {
  fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    })
    .then((blob) => createImageBitmap(blob))
    .then(show)
    .catch(() => {})
    .finally(() => {
      pending = false;
    });
}

/** Cuts the picture to the screen's shape at a small size and starts the show. */
function show(picture: ImageBitmap): void {
  const h = Math.max(80, Math.round((W * view.height) / view.width));
  fit.width = W;
  fit.height = h;
  const scale = Math.max(W / picture.width, h / picture.height);
  const dw = picture.width * scale;
  const dh = picture.height * scale;
  fitCtx.drawImage(picture, (W - dw) / 2, (h - dh) / 2, dw, dh);
  picture.close();
  base = fitCtx.getImageData(0, 0, W, h).data;
  layer.setSize(W, h);
  shownAt = clock.time;
  dreams++;
}

const luma = (data: Uint8ClampedArray, i: number): number =>
  data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;

/** Sorts the run of rows `from`..`to` in column `x` by brightness, bright ones lowest. */
function sortRun(
  source: Uint8ClampedArray,
  out: Uint8ClampedArray,
  x: number,
  from: number,
  to: number,
): void {
  const n = to - from;
  for (let k = 0; k < n; k++) {
    const i = ((from + k) * W + x) * 4;
    packed[k] =
      (luma(source, i) | 0) * 16777216 + (source[i] << 16) + (source[i + 1] << 8) + source[i + 2];
  }
  const run = packed.subarray(0, n);
  run.sort();
  for (let k = 0; k < n; k++) {
    const v = run[k];
    const i = ((from + k) * W + x) * 4;
    out[i] = (v >>> 16) & 255;
    out[i + 1] = (v >>> 8) & 255;
    out[i + 2] = v & 255;
  }
}

/** Draws the dream picture, if one is showing. */
export function drawDream(): void {
  if (!base) return;
  const age = clock.time - shownAt;
  if (age > TOTAL_S) {
    base = null;
    return;
  }
  const h = layer.height;
  const out = layer.pixels;
  out.set(base);
  const melt = clamp((age - FADE_IN_S - HOLD_S) / MELT_S, 0, 1);
  if (melt > 0) {
    const threshold = 255 * (1 - melt * 0.95);
    for (let x = 0; x < W; x++) {
      // Bright runs slide down.
      let y = 0;
      while (y < h) {
        while (y < h && luma(base, (y * W + x) * 4) < threshold) y++;
        const start = y;
        while (y < h && luma(base, (y * W + x) * 4) >= threshold * 0.55) y++;
        if (y - start > 1) sortRun(base, out, x, start, Math.min(y, start + packed.length));
        if (y === start) y++;
      }
      // The column drips: it slides down and leaves the mode showing above it.
      const shape =
        Math.pow(0.5 + 0.5 * Math.sin(x * 0.11 + dreams * 2.1), 3) * 0.7 +
        hash01(x * 0.37 + dreams) * 0.3;
      const drip = Math.floor(melt * melt * (0.25 + shape) * h * 1.2);
      for (let row = h - 1; row >= 0; row--) {
        const i = (row * W + x) * 4;
        if (row < drip) {
          out[i + 3] = 0;
          continue;
        }
        const j = ((row - drip) * W + x) * 4;
        out[i] = out[j];
        out[i + 1] = out[j + 1];
        out[i + 2] = out[j + 2];
      }
    }
  }
  layer.flush();
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.92 * Math.min(1, age / FADE_IN_S, (TOTAL_S - age) / 0.8);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(layer.canvas, 0, 0, view.width, view.height);
  ctx.restore();
}
