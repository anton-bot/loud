/** Ambient: the letters of the text circle the centre. */
import { TAU } from '../../core/math';
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { font, type WordStyle } from './show';

export const orbit: WordStyle = {
  name: 'orbit',
  role: 'ambient',
  weight: 1,
  round: true,
  draw(show) {
    const { cx, cy, min } = view;
    const letters = [...show.phrase.replace(/\s+/g, ' ')].slice(0, 48);
    const radius = min * 0.38 * (1 + audio.bass * 0.2);
    const size = Math.max(14, Math.min(72, ((TAU * radius) / letters.length) * 0.9));
    ctx.font = font(size);
    letters.forEach((letter, i) => {
      const a = (i / letters.length) * TAU + show.age * 0.6;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = color(i * 0.3 - show.age, show.alpha, 80);
      ctx.fillText(letter, 0, 0);
      ctx.restore();
    });
  },
};
