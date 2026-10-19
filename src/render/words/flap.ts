/**
 * Hero: a split-flap board, as in old railway stations. On each beat every tile flips
 * through random letters, one tile after another, and lands on the next word.
 */
import { hash01 } from '../../core/math';
import { view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { font, type WordStyle } from './show';

const FLICKER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&?!';
const MAX_TILES = 12;
/** Flips per second while a tile spins. */
const RATE = 16;

const state = { target: [] as string[], settle: [] as number[], since: 0, k: 0 };

function aim(word: string): void {
  state.target = [...word].slice(0, MAX_TILES);
  state.settle = state.target.map((_, i) => 0.1 + i * 0.07 + Math.random() * 0.12);
  state.since = 0;
}

export const flap: WordStyle = {
  name: 'flap',
  role: 'hero',
  weight: 2,
  start(show) {
    aim(show.word);
    state.k = Math.random() * 4;
  },
  draw(show, dt) {
    if (show.beat) {
      aim(show.word);
      state.k += 0.6;
    }
    state.since += dt;
    const { width, height, cx, cy } = view;
    const n = Math.max(1, state.target.length);
    const gap = Math.max(3, width * 0.008);
    const tileW = Math.min((width * 0.9 - gap * (n - 1)) / n, height * 0.26);
    const tileH = tileW * 1.4;
    const left = cx - (n * tileW + (n - 1) * gap) / 2 + tileW / 2;
    // Solid tiles, also on palettes that glow.
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = font(tileH * 0.6);
    const flips = Math.floor(state.since * RATE);
    for (let i = 0; i < state.target.length; i++) {
      const x = left + i * (tileW + gap);
      const settled = state.since >= state.settle[i];
      // 0..1 through one flip; the letter is squashed flat in the middle of it.
      const turn = settled
        ? Math.min(1, (state.since - state.settle[i]) / 0.12)
        : (state.since * RATE) % 1;
      const letter = settled
        ? state.target[i]
        : FLICKER[Math.floor(hash01(flips * 1.7 + i * 7.3) * FLICKER.length)];
      ctx.fillStyle = `rgba(16,16,22,${show.alpha * 0.92})`;
      ctx.beginPath();
      ctx.roundRect(x - tileW / 2, cy - tileH / 2, tileW, tileH, tileW * 0.08);
      ctx.fill();
      const measured = Math.max(1, ctx.measureText(letter).width);
      ctx.save();
      ctx.translate(x, cy);
      ctx.scale(
        Math.min(1, (tileW * 0.86) / measured),
        Math.max(0.05, Math.abs(Math.cos(turn * Math.PI))),
      );
      ctx.fillStyle = settled
        ? color(state.k + i * 0.3, show.alpha, 90)
        : `rgba(235,235,235,${show.alpha * 0.85})`;
      ctx.fillText(letter, 0, tileH * 0.03);
      ctx.restore();
      // The split between the two flaps.
      ctx.fillStyle = `rgba(0,0,0,${show.alpha * 0.85})`;
      ctx.fillRect(x - tileW / 2, cy - 1, tileW, 2);
    }
  },
};
