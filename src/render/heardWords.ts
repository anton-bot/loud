/**
 * Words heard by the mic (audio/speech.ts), shown over any mode for a while, in two or
 * three freaky ways at once: slammed one word per beat with a stacked shadow, a tunnel
 * of copies flying out of the centre, scrolling bands with split colours, and letters
 * orbiting the centre.
 */
import { pick, rnd, TAU } from '../core/math';
import { audio, clock, scene, view } from '../core/state';
import { ctx } from './canvases';
import { color } from './color';

type Style = 'slam' | 'tunnel' | 'marquee' | 'orbit';

const SHOW_S = 14;
const FONT = 'Unbounded, sans-serif';
const MONOSPACE = 'ui-monospace,Menlo,Consolas,monospace';

let phrase = '';
let words: string[] = [];
let shownAt = -Infinity;
let styles: Style[] = [];
let wordIndex = 0;
let lastBeats = 0;
/** Pose of the slammed word: turn, offset (fractions of the screen), colour. */
const slamPose = { turn: 0, x: 0, y: 0, k: 0 };

export function showHeardWords(text: string): void {
  phrase = text.toUpperCase();
  words = phrase.split(/\s+/).filter(Boolean);
  shownAt = clock.time;
  wordIndex = 0;
  lastBeats = audio.beats;
  // One big style in the middle, and one or two more around it.
  styles = [pick<Style>(['slam', 'tunnel'])];
  for (const extra of ['marquee', 'orbit', 'tunnel'] as const) {
    if (!styles.includes(extra) && Math.random() < 0.55) styles.push(extra);
  }
  newSlamPose();
}

function newSlamPose(): void {
  slamPose.turn = rnd(-0.3, 0.3);
  slamPose.x = rnd(-0.1, 0.1);
  slamPose.y = rnd(-0.15, 0.15);
  slamPose.k = Math.random() * 4;
}

/** Font size at which `text` is `share` of the screen width (at most `max` px). */
function fitSize(text: string, share: number, max: number): number {
  ctx.font = `700 100px ${FONT}`;
  const measured = Math.max(1, ctx.measureText(text).width);
  return Math.min(max, (100 * view.width * share) / measured);
}

function drawSlam(alpha: number): void {
  const { width, height, cx, cy } = view;
  const word = words[wordIndex % words.length];
  const size = fitSize(word, 0.82, height * 0.42) * (0.9 + audio.bass * 0.25 + audio.beat * 0.15);
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.save();
  ctx.translate(cx + slamPose.x * width, cy + slamPose.y * height);
  ctx.rotate(slamPose.turn + Math.sin(clock.time * 3) * audio.high * 0.1);
  for (let i = 5; i >= 0; i--) {
    const o = i * size * 0.045 * (1 + audio.mid);
    ctx.fillStyle = i ? color(slamPose.k + i, alpha * 0.9, 50) : color(slamPose.k, alpha, 90);
    ctx.fillText(word, o, o);
  }
  // A split-colour echo on strong beats.
  if (audio.beat > 0.5) {
    const split = size * 0.04 * audio.beat;
    ctx.fillStyle = `rgba(255,0,80,${alpha * 0.5 * audio.beat})`;
    ctx.fillText(word, -split, 0);
    ctx.fillStyle = `rgba(0,230,255,${alpha * 0.5 * audio.beat})`;
    ctx.fillText(word, split, 0);
  }
  ctx.restore();
}

function drawTunnel(age: number, alpha: number): void {
  const { cx, cy } = view;
  const copies = 7;
  const base = fitSize(phrase, 0.5, view.height * 0.2);
  for (let i = 0; i < copies; i++) {
    const p = (age * (0.25 + audio.mid * 0.3) + i / copies) % 1;
    const scale = 0.12 + p * p * 2.8;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i % 2 ? 1 : -1) * p * 0.7);
    ctx.font = `700 ${base * scale}px ${FONT}`;
    ctx.fillStyle = color(i * 0.6 + age * 0.5, alpha * Math.sin(p * Math.PI) * 0.75, 70);
    ctx.fillText(phrase, 0, 0);
    ctx.restore();
  }
}

function drawMarquee(age: number, alpha: number): void {
  const { width, height } = view;
  const size = Math.max(14, height * 0.065);
  ctx.font = `700 ${size}px ${MONOSPACE}`;
  const text = `${phrase}  ✦  `.repeat(8);
  const textWidth = ctx.measureText(`${phrase}  ✦  `).width;
  [0.18, 0.5, 0.82].forEach((at, band) => {
    const direction = band % 2 ? -1 : 1;
    const shift =
      (((age * (60 + audio.mid * 160) * direction) % textWidth) + textWidth) % textWidth;
    const x = width / 2 - shift - textWidth;
    const y = height * at;
    const split = 2 + audio.bass * 6;
    ctx.fillStyle = color(band, alpha * 0.55, 55);
    ctx.fillText(text, x - split, y);
    ctx.fillStyle = color(band + 2, alpha * 0.55, 55);
    ctx.fillText(text, x + split, y);
    ctx.fillStyle = color(band + 1, alpha, 92);
    ctx.fillText(text, x, y);
  });
}

function drawOrbit(age: number, alpha: number): void {
  const { cx, cy, min } = view;
  const letters = [...phrase.replace(/\s+/g, ' ')].slice(0, 48);
  const radius = min * 0.36 * (1 + audio.bass * 0.2);
  const size = Math.max(14, Math.min(72, ((TAU * radius) / letters.length) * 0.9));
  ctx.font = `700 ${size}px ${FONT}`;
  letters.forEach((letter, i) => {
    const a = (i / letters.length) * TAU + age * 0.6;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = color(i * 0.3 - age, alpha, 80);
    ctx.fillText(letter, 0, 0);
    ctx.restore();
  });
}

/** Draws the heard words, if there are any to show now. */
export function drawHeardWords(): void {
  const age = clock.time - shownAt;
  if (!phrase || age > SHOW_S) return;
  if (audio.beats !== lastBeats) {
    lastBeats = audio.beats;
    wordIndex++;
    newSlamPose();
  }
  const alpha = Math.max(0, Math.min(1, age / 0.4, (SHOW_S - age) / 1.5));
  ctx.save();
  ctx.globalCompositeOperation = scene.palette.light ? 'source-over' : 'lighter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const style of styles) {
    if (style === 'slam') drawSlam(alpha);
    else if (style === 'tunnel') drawTunnel(age, alpha);
    else if (style === 'marquee') drawMarquee(age, alpha);
    else drawOrbit(age, alpha);
  }
  ctx.restore();
}
