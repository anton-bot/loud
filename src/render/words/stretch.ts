/**
 * Hero: a rubber word, as big as the screen allows. The beat squashes and stretches it
 * (tall and thin, or wide and flat), and it wobbles back like jelly. Now and then it
 * turns on its side.
 */
import { clamp } from '../../core/math';
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { fitFont, font, shadowText, type WordStyle } from './show';

const STIFFNESS = 160;
const DAMPING = 9;
const jelly = { sx: 1, sy: 1, vx: 0, vy: 0, turn: 0, targetTurn: 0, k: 0 };

export const stretch: WordStyle = {
  name: 'stretch',
  role: 'hero',
  weight: 1.8,
  start() {
    jelly.k = Math.random() * 4;
  },
  draw(show, dt) {
    if (show.beat) {
      const kick = (4 + audio.bass * 4) * (Math.random() < 0.5 ? 1 : -1);
      jelly.vx += kick;
      jelly.vy -= kick;
      if (Math.random() < 0.25) {
        jelly.targetTurn = jelly.targetTurn ? 0 : (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2);
      }
      jelly.k += 0.8;
    }
    const step = Math.min(dt, 1 / 30);
    jelly.vx += ((1 - jelly.sx) * STIFFNESS - jelly.vx * DAMPING) * step;
    jelly.vy += ((1 - jelly.sy) * STIFFNESS - jelly.vy * DAMPING) * step;
    jelly.sx = clamp(jelly.sx + jelly.vx * step, 0.25, 3);
    jelly.sy = clamp(jelly.sy + jelly.vy * step, 0.25, 3);
    jelly.turn += (jelly.targetTurn - jelly.turn) * Math.min(1, dt * 6);

    const { width, height, cx, cy } = view;
    const sideways = Math.abs(Math.sin(jelly.turn)) > 0.5;
    const size = sideways
      ? fitFont(show.word, (height / width) * 0.75, width * 0.36)
      : fitFont(show.word, 0.72, height * 0.4);
    ctx.font = font(size);
    ctx.translate(cx, cy);
    ctx.rotate(jelly.turn);
    ctx.scale(jelly.sx, jelly.sy);
    shadowText(show.word, 0, 0, size, show.alpha);
    const split = size * 0.05 * audio.beat;
    if (split > 0.5) {
      ctx.fillStyle = color(jelly.k + 2, show.alpha * 0.6, 55);
      ctx.fillText(show.word, -split, 0);
      ctx.fillStyle = color(jelly.k + 4, show.alpha * 0.6, 55);
      ctx.fillText(show.word, split, 0);
    }
    ctx.fillStyle = color(jelly.k, show.alpha, 80);
    ctx.fillText(show.word, 0, 0);
  },
};
