/** Ambient: the text is pulled into a turning vortex, letters shrinking toward the centre. */
import { TAU } from '../../core/math';
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { FONT, type WordStyle } from './show';

const LETTERS = 72;

export const spiral: WordStyle = {
  name: 'spiral',
  role: 'ambient',
  weight: 2,
  draw(show) {
    const { cx, cy, min } = view;
    const text = [...`${show.phrase.replace(/\s+/g, ' ')} · `];
    const flow = show.age * (1.5 + audio.mid * 3);
    const shift = Math.floor(flow);
    const maxR = Math.hypot(cx, cy) * 0.95;
    for (let n = 0; n < LETTERS; n++) {
      // t: 0 at the outside, 1 at the centre; letters move inward as `flow` grows.
      const t = (n + (flow - shift)) / LETTERS;
      const size = 6 + Math.pow(1 - t, 1.2) * min * 0.075;
      if (size < 7) continue;
      const a = t * TAU * 2.6 + show.age * 0.5;
      const r = maxR * Math.pow(1 - t, 1.3);
      const letter = text[(((n - shift) % text.length) + text.length) % text.length];
      ctx.save();
      ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.rotate(a + Math.PI / 2);
      ctx.font = `700 ${size}px ${FONT}`;
      ctx.fillStyle = color(n * 0.12 + show.age, show.alpha * (1 - t * 0.6), 78);
      ctx.fillText(letter, 0, 0);
      ctx.restore();
    }
  },
};
