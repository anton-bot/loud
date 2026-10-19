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

function limb(x1: number, y1: number, x2: number, y2: number): void {
  sourceCtx.beginPath();
  sourceCtx.moveTo(x1, y1);
  sourceCtx.lineTo(x2, y2);
  sourceCtx.stroke();
}

/** Three dancing figures under stage lights, for when there is no camera. */
function drawDancers(w: number, h: number): void {
  const g = sourceCtx;
  const t = clock.time;
  const beat = audio.beats + (1 - audio.beat) * 0.5;
  g.fillStyle = '#0a0710';
  g.fillRect(0, 0, w, h);
  for (let k = 0; k < 3; k++) {
    const x = w * (0.2 + k * 0.3) + Math.sin(t * 0.7 + k) * w * 0.15;
    const light = g.createLinearGradient(x, 0, x, h);
    light.addColorStop(0, `hsla(${k * 120 + t * 20},100%,60%,${0.35 + audio.beat * 0.3})`);
    light.addColorStop(1, 'hsla(0,0%,0%,0)');
    g.fillStyle = light;
    g.beginPath();
    g.moveTo(x - 3, 0);
    g.lineTo(x + 3, 0);
    g.lineTo(x + w * 0.18, h);
    g.lineTo(x - w * 0.18, h);
    g.closePath();
    g.fill();
  }
  [
    [0.24, 0.55, 0, 330],
    [0.52, 0.6, 1.3, 190],
    [0.79, 0.52, 2.6, 50],
  ].forEach(([px, py, offset, hue], i) => {
    const s = h * 0.2;
    const swing = Math.sin(beat * Math.PI + offset);
    g.save();
    g.translate(w * px + Math.sin(t * (0.6 + i * 0.25) + i * 2) * w * 0.05, h * py);
    g.translate(0, -Math.abs(Math.sin(beat * Math.PI)) * s * 0.18);
    g.rotate(swing * 0.12);
    g.strokeStyle = g.fillStyle = `hsl(${hue},95%,72%)`;
    g.lineWidth = s * 0.24;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(0, -s * 1.1, s * 0.28, 0, TAU);
    g.fill();
    limb(0, -s * 0.8, 0, s * 0.2);
    const left = -2.3 + swing * 0.9;
    const right = -0.85 - swing * 0.9;
    limb(0, -s * 0.62, Math.cos(left) * s * 0.8, -s * 0.62 + Math.sin(left) * s * 0.8);
    limb(0, -s * 0.62, Math.cos(right) * s * 0.8, -s * 0.62 + Math.sin(right) * s * 0.8);
    limb(0, s * 0.2, -s * 0.35 - swing * s * 0.15, s * 0.95);
    limb(0, s * 0.2, s * 0.35 - swing * s * 0.15, s * 0.95);
    g.restore();
  });
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
    else drawDancers(w, h);
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
