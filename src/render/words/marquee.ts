/** Ambient (rare): three bands of the text scrolling left and right, with split colours. */
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { MONOSPACE, type WordStyle } from './show';

export const marquee: WordStyle = {
  name: 'marquee',
  role: 'ambient',
  weight: 0.4,
  draw(show) {
    const { width, height } = view;
    const size = Math.max(14, height * 0.065);
    ctx.font = `700 ${size}px ${MONOSPACE}`;
    const unit = `${show.phrase}  ✦  `;
    const text = unit.repeat(8);
    const unitWidth = ctx.measureText(unit).width;
    [0.18, 0.5, 0.82].forEach((at, band) => {
      const direction = band % 2 ? -1 : 1;
      const shift =
        (((show.age * (60 + audio.mid * 160) * direction) % unitWidth) + unitWidth) % unitWidth;
      const x = width / 2 - shift - unitWidth;
      const y = height * at;
      const split = 2 + audio.bass * 6;
      ctx.fillStyle = color(band, show.alpha * 0.55, 55);
      ctx.fillText(text, x - split, y);
      ctx.fillStyle = color(band + 2, show.alpha * 0.55, 55);
      ctx.fillText(text, x + split, y);
      ctx.fillStyle = color(band + 1, show.alpha, 92);
      ctx.fillText(text, x, y);
    });
  },
};
