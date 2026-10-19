/**
 * Hero: the word is cut into horizontal slices. On each beat the slices shoot in one
 * after another from the side (all from one side: a diagonal staircase; from both
 * sides in turn: a comb) and meet to form the word. The treble makes them jitter.
 */
import { clamp } from '../../core/math';
import { audio, clock, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { fitFont, font, shadowText, type WordStyle } from './show';

const SLICES = 9;
const state = { since: 1, from: 1, comb: false, k: 0 };

function restart(): void {
  state.since = 0;
  state.from = Math.random() < 0.5 ? 1 : -1;
  state.comb = Math.random() < 0.45;
}

export const blinds: WordStyle = {
  name: 'blinds',
  role: 'hero',
  weight: 2,
  start() {
    restart();
    state.k = Math.random() * 4;
  },
  draw(show, dt) {
    if (show.beat) {
      restart();
      state.k += 0.7;
    }
    state.since += dt;
    const { width, height, cx, cy } = view;
    const size = fitFont(show.word, 0.86, height * 0.38) * (1 + audio.bass * 0.1);
    ctx.font = font(size);
    const top = cy - size * 0.62;
    const sliceHeight = (size * 1.24) / SLICES;
    for (let s = 0; s < SLICES; s++) {
      const p = clamp((state.since - s * 0.03) / 0.28, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const side = state.comb && s % 2 ? -state.from : state.from;
      const jitter = Math.sin(clock.time * 37 + s * 2.1) * audio.high * size * 0.06;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, top + s * sliceHeight, width, sliceHeight + 0.5);
      ctx.clip();
      const x = cx + side * (1 - eased) * width + jitter;
      shadowText(show.word, x, cy, size, show.alpha);
      ctx.fillStyle = color(state.k + s * 0.25, show.alpha, 76);
      ctx.fillText(show.word, x, cy);
      ctx.restore();
    }
  },
};
