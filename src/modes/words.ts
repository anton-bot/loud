/**
 * A big word with a stacked 3D shadow. A new word on each beat, and now and then a new
 * typeface (bold, pixel, glitch, horror, ...).
 */
import { rnd, rndInt } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { FACES, font, pickFace, useFace } from '../render/words/show';
import type { Mode } from './mode';

// prettier-ignore
const WORDS = [
  'LOUD', 'BASS', 'BOOM', 'MORE', 'NOW', 'GO', 'YES', 'WOW', 'DROP', 'LOUDER',
  '!!!', 'OK', 'HEY', 'UP', 'BIG', 'WHY', 'FUN', 'DANCE', 'BEAT', 'AGAIN',
];

let word = 'LOUD';
let rotation = 0;
let offsetX = 0;
let offsetY = 0;
let k = 0;
let face = FACES[0];

// Load the fonts early, so that no word shows in a fallback font.
for (const f of FACES) {
  document.fonts?.load?.(`${f.weight} 40px ${f.family}`, WORDS.join('')).catch(() => {});
}

export const words: Mode = {
  name: 'words',
  fade: 0.3,
  bloom: 0.6,

  beat() {
    word = WORDS[rndInt(WORDS.length)];
    rotation = rnd(-0.25, 0.25);
    offsetX = rnd(-0.12, 0.12);
    offsetY = rnd(-0.2, 0.2);
    k = Math.random() * 4;
    if (Math.random() < 0.3) face = pickFace(face);
  },

  draw() {
    const { width, height, cx, cy } = view;
    // Measure at 100 px, then scale the word to about 86% of the screen width.
    useFace(face);
    ctx.font = font(100);
    const measured = Math.max(1, ctx.measureText(word).width);
    const size = Math.min(
      height * 0.45,
      100 * ((width * 0.86) / measured) * (0.75 + audio.bass * 0.35 + audio.beat * 0.15),
    );
    ctx.font = font(size);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(cx + offsetX * width, cy + offsetY * height);
    ctx.rotate(rotation + Math.sin(clock.time * 3) * audio.high * 0.1);
    for (let i = 4; i >= 0; i--) {
      const o = i * size * 0.05 * (1 + audio.mid);
      ctx.fillStyle = i ? color(k + i, 0.9, 50) : color(k, 1, 85);
      ctx.fillText(word, o, o);
    }
    ctx.restore();
  },
};
