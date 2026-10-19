/**
 * Magic eye: a random-dot stereogram. Look through the screen until the two white dots
 * at the top become three, and a shape floats out in 3D: the last word the mic heard
 * (or LOUD), rings, a dome or a wavy sea, pulsing toward you with the kick.
 *
 * How: each row is built left to right. Where the hidden surface is near, a pixel
 * copies the pixel a little less than one pattern width to its left; where it is far,
 * a full width. The two eyes then match pixels at different distances, and the brain
 * reads that as depth.
 */
import { audio, clock, scene, view } from '../core/state';
import { context2d } from '../core/dom';
import { ctx } from '../render/canvases';
import { colorRgb } from '../render/color';
import { PixelLayer } from '../render/pixelLayer';
import { fillCircle } from '../render/shapes';
import { lastHeardWord } from '../render/words';
import { FACES } from '../render/words/show';
import type { Mode } from './mode';

type Shape = 'word' | 'rings' | 'dome' | 'sea';
const SHAPES: readonly Shape[] = ['word', 'rings', 'word', 'dome', 'sea'];
/** Depth range in pattern pixels: near points copy from this much closer. */
const DEPTH = 12;

const layer = new PixelLayer();
const depthCanvas = document.createElement('canvas');
const depthCtx = context2d(depthCanvas, { willReadFrequently: true });
/** Depth per pixel, 0 far .. 255 near. */
let depth = new Uint8Array(0);
let waveX = new Float32Array(0);
let waveY = new Float32Array(0);
let pattern = new Uint8Array(0);
let patternWidth = 0;
let patternFor: unknown = null;
let shape = 0;
let beats = 0;

/** A fixed random dot pattern in the palette's colours. */
function makePattern(width: number, height: number): void {
  patternWidth = width;
  pattern = new Uint8Array(width * height * 3);
  const colors = [0, 1, 2, 3, 4].map((k) => colorRgb(k * 1.3, 35 + k * 12));
  for (let i = 0; i < width * height; i++) {
    const c = colors[Math.floor(Math.random() * colors.length)];
    pattern[i * 3] = c[0];
    pattern[i * 3 + 1] = c[1];
    pattern[i * 3 + 2] = c[2];
  }
  patternFor = scene.palette;
}

/** Fills `depth` with the hidden surface. */
function makeDepth(w: number, h: number, pulse: number, shift: number): void {
  const kind = SHAPES[shape];
  if (kind === 'sea') {
    // A wavy sea that rolls: depth from two sine waves.
    if (waveX.length !== w) waveX = new Float32Array(w);
    if (waveY.length !== h) waveY = new Float32Array(h);
    for (let x = 0; x < w; x++) waveX[x] = Math.sin(x * 0.06 + clock.time * 1.5);
    for (let y = 0; y < h; y++) waveY[y] = Math.sin(y * 0.08 - clock.time);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++)
        depth[y * w + x] = 255 * pulse * (0.45 + 0.45 * waveX[x] * waveY[y]);
    }
    return;
  }
  const g = depthCtx;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  const level = (v: number): string => {
    const n = Math.round(255 * v * pulse);
    return `rgb(${n},${n},${n})`;
  };
  const cx = w / 2 + shift;
  const cy = h / 2;
  if (kind === 'word') {
    const text = lastHeardWord() || 'LOUD';
    g.font = `700 100px ${FACES[0].family}`;
    const size = Math.min(h * 0.55, (100 * (w - shift * 2) * 0.82) / g.measureText(text).width);
    g.font = `700 ${size}px ${FACES[0].family}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = h * 0.03;
    g.strokeStyle = level(0.45);
    g.beginPath();
    g.ellipse(cx, cy, w * 0.4, h * 0.42, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = level(1);
    g.fillText(text, cx, cy);
  } else if (kind === 'rings') {
    for (let i = 5; i >= 1; i--) {
      g.fillStyle = level(i % 2 ? 1 - i * 0.12 : 0.15);
      fillCircle(g, cx, cy, (h * 0.45 * i) / 5);
    }
  } else if (kind === 'dome') {
    const dome = g.createRadialGradient(cx, cy, 0, cx, cy, h * 0.45);
    dome.addColorStop(0, level(1));
    dome.addColorStop(0.7, level(0.6));
    dome.addColorStop(1, level(0));
    g.fillStyle = dome;
    fillCircle(g, cx, cy, h * 0.45);
  }
  const grey = g.getImageData(0, 0, w, h).data;
  for (let i = 0; i < w * h; i++) depth[i] = grey[i * 4];
}

export const stereo: Mode = {
  name: 'magic-eye',
  fade: 1,
  bloom: 0,
  blend: 'source-over',
  beatRings: false,
  plain: true,
  palettes: ['candy', 'technicolor', 'vapor', 'acid', 'neon', 'sunset', 'mint'],

  beat() {
    if (++beats % 16 === 0) shape = (shape + 1) % SHAPES.length;
  },

  resize() {
    patternWidth = 0;
  },

  draw() {
    const { width, height } = view;
    const w = Math.max(160, Math.min(420, Math.round(width / 2)));
    const h = Math.max(100, Math.round((w * height) / width));
    layer.setSize(w, h);
    const p = Math.round(w / 8);
    if (patternWidth !== p || patternFor !== scene.palette) makePattern(p, h);
    if (depthCanvas.width !== w || depthCanvas.height !== h) {
      depthCanvas.width = w;
      depthCanvas.height = h;
      depth = new Uint8Array(w * h);
    }
    // The kick pushes the shape toward the viewer, gently: big jumps are hard to see.
    makeDepth(w, h, 0.72 + audio.beat * 0.2 + audio.bass * 0.08, p / 2);
    const out = layer.pixels;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const i = (row + x) * 4;
        const shift = p - Math.round((depth[row + x] / 255) * DEPTH);
        if (x < shift) {
          const s = (y * p + (x % p)) * 3;
          out[i] = pattern[s];
          out[i + 1] = pattern[s + 1];
          out[i + 2] = pattern[s + 2];
        } else {
          const j = i - shift * 4;
          out[i] = out[j];
          out[i + 1] = out[j + 1];
          out[i + 2] = out[j + 2];
        }
        out[i + 3] = 255;
      }
    }
    layer.flush();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(layer.canvas, 0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    // Two guide dots, one pattern width apart.
    const dotGap = (p * width) / w;
    ctx.fillStyle = '#fff';
    fillCircle(ctx, width / 2 - dotGap / 2, height * 0.05, Math.max(3, height * 0.008));
    fillCircle(ctx, width / 2 + dotGap / 2, height * 0.05, Math.max(3, height * 0.008));
  },
};
