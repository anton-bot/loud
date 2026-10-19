/** Ambient: rainbow letters on a sine wave near the bottom, wobbling like jelly. */
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { fitFont, FONT, type WordStyle } from './show';

export const wave: WordStyle = {
  name: 'wave',
  role: 'ambient',
  weight: 2,
  draw(show) {
    const { cx, height } = view;
    const size = fitFont(show.phrase, 0.9, height * 0.1);
    ctx.font = `700 ${size}px ${FONT}`;
    const letters = [...show.phrase];
    const widths = letters.map((letter) => ctx.measureText(letter).width);
    let x = cx - widths.reduce((sum, w) => sum + w, 0) / 2;
    const baseY = height * 0.84;
    letters.forEach((letter, i) => {
      const y = baseY + Math.sin(i * 0.55 - show.age * 5) * size * 0.6 * (0.4 + audio.bass);
      const squash = 1 + 0.35 * Math.sin(show.age * 7 + i * 0.8) * (0.3 + audio.mid);
      ctx.save();
      ctx.translate(x + widths[i] / 2, y);
      ctx.scale(1 / Math.sqrt(squash), squash);
      ctx.fillStyle = color(i * 0.25 + show.age, show.alpha, 80);
      ctx.fillText(letter, 0, 0);
      ctx.restore();
      x += widths[i];
    });
  },
};
