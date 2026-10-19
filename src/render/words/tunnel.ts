/** Ambient: copies of the text fly out of the centre, turning, and grow past the viewer. */
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { fitFont, font, type WordStyle } from './show';

export const tunnel: WordStyle = {
  name: 'tunnel',
  role: 'ambient',
  weight: 2,
  draw(show) {
    const { cx, cy } = view;
    const copies = 7;
    const base = fitFont(show.phrase, 0.5, view.height * 0.2);
    for (let i = 0; i < copies; i++) {
      const p = (show.age * (0.25 + audio.mid * 0.3) + i / copies) % 1;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((i % 2 ? 1 : -1) * p * 0.7);
      ctx.font = font(base * (0.12 + p * p * 2.8));
      ctx.fillStyle = color(
        i * 0.6 + show.age * 0.5,
        show.alpha * Math.sin(p * Math.PI) * 0.75,
        70,
      );
      ctx.fillText(show.phrase, 0, 0);
      ctx.restore();
    }
  },
};
