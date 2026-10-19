/**
 * Hero: each word is built from hundreds of glowing particles. On every beat they blow
 * apart and fly together into the next word.
 */
import { createLayer, setCanvasSize } from '../../core/dom';
import { rnd, rndInt } from '../../core/math';
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { FONT, type WordStyle } from './show';

const MAX = 1100;
const px = new Float32Array(MAX);
const py = new Float32Array(MAX);
const vx = new Float32Array(MAX);
const vy = new Float32Array(MAX);
const tx = new Float32Array(MAX);
const ty = new Float32Array(MAX);
let count = 0;
let target = '';
/** The word is drawn here once, and its pixels become the particle targets. */
const sampler = createLayer();
const SAMPLE_W = 360;
const SAMPLE_H = 110;

function aimAt(word: string): void {
  const { width, height, cx, cy } = view;
  setCanvasSize(sampler.canvas, SAMPLE_W, SAMPLE_H);
  const g = sampler.ctx;
  g.clearRect(0, 0, SAMPLE_W, SAMPLE_H);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 90px ${FONT}`;
  const measured = g.measureText(word).width;
  if (measured > SAMPLE_W * 0.94) g.font = `700 ${(90 * SAMPLE_W * 0.94) / measured}px ${FONT}`;
  g.fillText(word, SAMPLE_W / 2, SAMPLE_H / 2);
  const alpha = g.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
  const points: number[] = [];
  for (let y = 0; y < SAMPLE_H; y += 2) {
    for (let x = 0; x < SAMPLE_W; x += 2)
      if (alpha[(y * SAMPLE_W + x) * 4 + 3] > 128) points.push(x, y);
  }
  const available = points.length / 2;
  const step = Math.max(1, available / MAX);
  const scale = Math.min((width * 0.86) / SAMPLE_W, (height * 0.5) / SAMPLE_H);
  let n = 0;
  for (let f = 0; f < available && n < MAX; f += step, n++) {
    const p = Math.floor(f) * 2;
    tx[n] = cx + (points[p] - SAMPLE_W / 2) * scale;
    ty[n] = cy + (points[p + 1] - SAMPLE_H / 2) * scale;
  }
  // New particles come out of old ones (or from anywhere at the start).
  for (let i = count; i < n; i++) {
    const from = count ? rndInt(count) : -1;
    px[i] = from >= 0 ? px[from] : Math.random() * width;
    py[i] = from >= 0 ? py[from] : Math.random() * height;
    vx[i] = 0;
    vy[i] = 0;
  }
  count = n;
  target = word;
}

export const particles: WordStyle = {
  name: 'particles',
  role: 'hero',
  weight: 2.2,
  start(show) {
    count = 0;
    aimAt(show.word);
  },
  draw(show, dt) {
    const { cx, cy, min } = view;
    if (show.beat) {
      for (let i = 0; i < count; i++) {
        const a = Math.atan2(py[i] - cy, px[i] - cx) + rnd(-0.6, 0.6);
        const speed = rnd(250, 800) * (0.6 + audio.bass);
        vx[i] += Math.cos(a) * speed;
        vy[i] += Math.sin(a) * speed;
      }
    }
    if (show.word !== target) aimAt(show.word);
    // A damped spring pulls every particle to its place in the word.
    const step = Math.min(dt, 1 / 30);
    for (let i = 0; i < count; i++) {
      vx[i] += ((tx[i] - px[i]) * 55 - vx[i] * 8.5) * step;
      vy[i] += ((ty[i] - py[i]) * 55 - vy[i] * 8.5) * step;
      px[i] += vx[i] * step;
      py[i] += vy[i] * step;
    }
    const size = Math.max(2.5, min / 160);
    for (let g = 0; g < 3; g++) {
      ctx.fillStyle = color(g * 1.2 + show.age * 0.4, show.alpha, 82);
      ctx.beginPath();
      for (let i = g; i < count; i += 3) ctx.rect(px[i] - size / 2, py[i] - size / 2, size, size);
      ctx.fill();
    }
  },
};
