/**
 * Camera time smear (slit-scan, the trick behind the stargate in "2001"): point the
 * phone at the dance floor. Each row of the picture comes from a different moment, so
 * people stretch and bend through time. Every 8 beats the time map changes: rows,
 * rings, columns, waves. The bass reaches further back in time. Without a camera it
 * smears three dancing figures of its own.
 */
import { context2d } from '../core/dom';
import { TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { cameraVideo } from '../input/camera';
import { ctx } from '../render/canvases';
import { PixelLayer } from '../render/pixelLayer';
import { drawDancers } from './dancers';
import type { Mode } from './mode';

type TimeMap = 'rows' | 'rings' | 'columns' | 'waves';
const MAPS: readonly TimeMap[] = ['rows', 'rings', 'columns', 'waves'];
/** Frames kept: about one second at 60 frames per second. */
const DEPTH = 64;

const source = document.createElement('canvas');
const sourceCtx = context2d(source, { willReadFrequently: true });
const layer = new PixelLayer();
let frames: Uint8ClampedArray[] = [];
let head = 0;
let map = 0;
let beats = 0;

function setUp(w: number, h: number): void {
  source.width = w;
  source.height = h;
  layer.setSize(w, h);
  frames = Array.from({ length: DEPTH }, () => new Uint8ClampedArray(w * h * 4));
  head = 0;
}

/** The camera picture, cut to fill the frame. */
function drawCamera(video: HTMLVideoElement, w: number, h: number): void {
  const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
  const dw = video.videoWidth * scale;
  const dh = video.videoHeight * scale;
  sourceCtx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export const smear: Mode = {
  name: 'time-smear',
  fade: 1,
  bloom: 0.4,
  blend: 'source-over',
  beatRings: false,
  camera: true,

  beat() {
    if (++beats % 8 === 0) map = (map + 1) % MAPS.length;
  },

  resize() {
    frames = [];
  },

  draw() {
    const { width, height } = view;
    const w = 160;
    const h = Math.max(60, Math.round((w * height) / width));
    if (!frames.length || source.width !== w || source.height !== h) setUp(w, h);
    const video = cameraVideo();
    if (video) drawCamera(video, w, h);
    else drawDancers(sourceCtx, w, h);
    frames[head].set(sourceCtx.getImageData(0, 0, w, h).data);

    const kind = MAPS[map];
    const reach = (DEPTH - 1) * (0.55 + audio.bass * 0.45);
    const out = layer.pixels;
    const t = clock.time;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // How far back in time this pixel looks, 0..1.
        let f: number;
        if (kind === 'rows') f = y / h;
        else if (kind === 'columns') f = x / w;
        else if (kind === 'rings')
          f = Math.min(1, Math.hypot(x - w / 2, (y - h / 2) * 1.6) / (w * 0.55));
        else f = 0.5 + 0.5 * Math.sin((x / w) * TAU * 1.5 + t) * (y / h);
        const frame = frames[(head - Math.floor(f * reach) + DEPTH) % DEPTH];
        const i = (y * w + x) * 4;
        out[i] = frame[i];
        out[i + 1] = frame[i + 1];
        out[i + 2] = frame[i + 2];
        out[i + 3] = 255;
      }
    }
    head = (head + 1) % DEPTH;
    layer.flush();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer.canvas, 0, 0, width, height);
  },
};
