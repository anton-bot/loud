/** A big word in the display font, with a stacked 3D shadow. A new word on each beat. */
import { rnd, rndInt } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import type { Mode } from './mode';

// prettier-ignore
const WORDS = [
  'LOUD', 'BASS', 'BOOM', 'MORE', 'NOW', 'GO', 'YES', 'WOW', 'DROP', 'LOUDER',
  '!!!', 'OK', 'HEY', 'UP', 'BIG', 'WHY', 'FUN', 'DANCE', 'BEAT', 'AGAIN',
];
const FONT = 'Unbounded, sans-serif';

let word = 'LOUD';
let rotation = 0;
let offsetX = 0;
let offsetY = 0;
let k = 0;

// Load the font early, so the first word does not show in the fallback font.
document.fonts?.load?.('700 40px Unbounded').catch(() => {});

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
  },

  draw() {
    const { width, height, cx, cy } = view;
    // Measure at 100 px, then scale the word to about 86% of the screen width.
    ctx.font = `700 100px ${FONT}`;
    const measured = Math.max(1, ctx.measureText(word).width);
    const size = Math.min(
      height * 0.45,
      100 * ((width * 0.86) / measured) * (0.75 + audio.bass * 0.35 + audio.beat * 0.15),
    );
    ctx.font = `700 ${size}px ${FONT}`;
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
