/**
 * Hero: each word slides in along a diagonal from a corner and brakes hard in the
 * middle, with a wobble; the word before shoots on out of the far corner. Both leave
 * a trail of fading copies and lean into the motion.
 */
import { rndInt } from '../../core/math';
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { fitFont, font, shadowText, type WordStyle } from './show';

const IN_S = 0.32;
const TRAIL = 5;
/** The corners, as steps from the centre. */
// prettier-ignore
const CORNERS: readonly (readonly [number, number])[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

const state = { corner: 0, lastCorner: 0, word: '', last: '', since: 1, k: 0 };

/** Where a word is at `p` (0..1 of its slide): coming in from `corner`, or going out. */
function place(corner: number, p: number, coming: boolean): [number, number] {
  const [dx, dy] = CORNERS[corner];
  const { cx, cy, width, height } = view;
  // Coming in: fast, then a hard brake. Going out: slow, then faster and faster.
  const away = coming ? Math.pow(1 - p, 4) : -(p * p);
  return [cx + dx * width * 0.75 * away, cy + dy * height * 0.75 * away];
}

function drawWord(
  text: string,
  corner: number,
  p: number,
  coming: boolean,
  k: number,
  alpha: number,
): void {
  const [x, y] = place(corner, p, coming);
  const [bx, by] = place(corner, Math.max(0, p - 0.05), coming);
  const speed = Math.hypot(x - bx, y - by) / view.min;
  const lean = Math.sign(bx - x) * Math.min(0.6, speed * 3);
  for (let j = TRAIL; j >= 0; j--) {
    const [tx, ty] = j ? place(corner, Math.max(0, p - j * 0.04), coming) : [x, y];
    if (j && Math.hypot(tx - x, ty - y) < 2) continue;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.transform(1, 0, lean, 1, 0, 0);
    if (!j) shadowText(text, 0, 0, view.min * 0.1, alpha);
    ctx.fillStyle = j
      ? color(k + j * 0.4, alpha * 0.3 * (1 - j / (TRAIL + 1)), 55)
      : color(k, alpha, 78);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}

export const slide: WordStyle = {
  name: 'slide',
  role: 'hero',
  weight: 2,
  start(show) {
    state.word = show.word;
    state.last = '';
    state.corner = rndInt(4);
    state.since = 0;
    state.k = Math.random() * 4;
  },
  draw(show, dt) {
    if (show.beat) {
      state.last = state.word;
      state.lastCorner = state.corner;
      state.word = show.word;
      state.corner = (state.corner + 1 + rndInt(3)) % 4;
      state.since = 0;
      state.k += 0.9;
    }
    state.since += dt;
    const size = fitFont(show.word, 0.7, view.height * 0.34) * (1 + audio.bass * 0.12);
    ctx.font = font(size);
    const p = Math.min(1, state.since / IN_S);
    if (state.last && p < 1)
      drawWord(state.last, state.lastCorner, p, false, state.k - 0.9, show.alpha);
    // After the brake, a jelly wobble.
    const settle = state.since - IN_S;
    const wobble = settle > 0 ? Math.sin(settle * 28) * Math.exp(-settle * 7) * 0.12 : 0;
    ctx.save();
    ctx.translate(view.cx, view.cy);
    ctx.scale(1 + wobble, 1 - wobble);
    ctx.translate(-view.cx, -view.cy);
    drawWord(state.word, state.corner, p, true, state.k, show.alpha);
    ctx.restore();
  },
};
