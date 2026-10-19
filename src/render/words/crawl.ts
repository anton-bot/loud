/**
 * Ambient: the words run away on a floor in perspective, line after line toward the
 * horizon, like the opening of a space film; sometimes on the ceiling instead.
 */
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { fitFont, font, type WordStyle } from './show';

const LINES = 10;
let ceiling = false;

export const crawl: WordStyle = {
  name: 'crawl',
  role: 'ambient',
  weight: 2,
  start() {
    ceiling = Math.random() < 0.35;
  },
  draw(show) {
    const { height, cx } = view;
    const horizon = height * (ceiling ? 0.64 : 0.36);
    const span = ceiling ? horizon + height * 0.05 : height * 1.05 - horizon;
    const flow = show.age * (0.5 + audio.mid * 0.8);
    const shift = Math.floor(flow);
    const lines = show.words.length > 1 ? show.words : [show.phrase];
    const base = fitFont(show.phrase, 0.9, height * 0.12);
    for (let n = 0; n < LINES; n++) {
      // Line `id` is at depth z; z grows, so the lines move away.
      const z = 1 + n + (flow - shift);
      const id = n - shift;
      const near = 1 / z;
      const y = horizon + (ceiling ? -1 : 1) * span * near;
      const alpha = show.alpha * Math.min(1, near * 3) * Math.min(1, (z - 1) * 3);
      if (alpha <= 0.01) continue;
      ctx.save();
      ctx.translate(cx, y);
      // Flattened, as if lying on the floor.
      ctx.scale(1, 0.55);
      ctx.font = font(base * near * 1.6);
      ctx.fillStyle = color(id * 0.5 + show.age * 0.2, alpha, 80);
      ctx.fillText(lines[((id % lines.length) + lines.length) % lines.length], 0, 0);
      ctx.restore();
    }
  },
};
