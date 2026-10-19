/**
 * Ambient: on each beat the word is slapped on the screen as a sticker: a tilted label
 * with a white edge and a shadow, popping in with an overshoot. The oldest fade away.
 */
import { rnd } from '../../core/math';
import { view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { font, type WordStyle } from './show';

interface Sticker {
  x: number;
  y: number;
  turn: number;
  word: string;
  k: number;
  age: number;
}

const MAX = 7;
const stickers: Sticker[] = [];

export const stickersStyle: WordStyle = {
  name: 'stickers',
  role: 'ambient',
  weight: 2,
  start() {
    stickers.length = 0;
  },
  draw(show, dt) {
    const { width, height, min } = view;
    if (show.beat || !stickers.length) {
      stickers.push({
        x: rnd(0.15, 0.85) * width,
        y: rnd(0.12, 0.88) * height,
        turn: rnd(-0.45, 0.45),
        word: show.word,
        k: Math.random() * 6,
        age: 0,
      });
      while (stickers.length > MAX) stickers.shift();
    }
    // Solid stickers, also on palettes that glow.
    ctx.globalCompositeOperation = 'source-over';
    const size = min * 0.05;
    ctx.font = font(size);
    const edge = size * 0.18;
    stickers.forEach((s, i) => {
      s.age += dt;
      // Ease out with an overshoot ("back" easing).
      const p = Math.min(1, s.age / 0.22) - 1;
      const pop = 1 + 2.70158 * p * p * p + 1.70158 * p * p;
      const w = ctx.measureText(s.word).width + size * 1.2;
      const h = size * 1.7;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.turn);
      ctx.scale(pop, pop);
      ctx.globalAlpha = show.alpha * (0.45 + (0.55 * (i + 1)) / stickers.length);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.roundRect(
        -w / 2 - edge + size * 0.15,
        -h / 2 - edge + size * 0.2,
        w + edge * 2,
        h + edge * 2,
        h * 0.3,
      );
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(-w / 2 - edge, -h / 2 - edge, w + edge * 2, h + edge * 2, h * 0.3);
      ctx.fill();
      ctx.fillStyle = color(s.k, 1, 55);
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.25);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(s.word, 0, size * 0.04);
      ctx.restore();
    });
  },
};
