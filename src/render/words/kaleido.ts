/** Hero: a mandala made of the word: two counter-turning rings of copies, every other one mirrored. */
import { TAU } from '../../core/math';
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { fitFont, font, type WordStyle } from './show';

const COPIES = 8;

export const kaleido: WordStyle = {
  name: 'kaleido',
  role: 'hero',
  weight: 1,
  round: true,
  draw(show) {
    const { cx, cy, min, width } = view;
    const outer = min * 0.27 * (1 + audio.bass * 0.2 + audio.beat * 0.06);
    for (const ring of [0, 1]) {
      const radius = ring ? outer * 0.45 : outer;
      const size = fitFont(show.word, (radius * (ring ? 1.1 : 0.95)) / width, min * 0.16);
      ctx.font = font(size);
      const spin = show.age * (ring ? -0.8 : 0.45) + audio.bass * 0.3;
      for (let c = 0; c < COPIES; c++) {
        const a = (c / COPIES) * TAU + spin;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
        ctx.rotate(a + Math.PI / 2);
        if (c % 2) ctx.scale(-1, 1);
        ctx.fillStyle = color(
          c * 0.5 + ring * 2 + show.age * 0.3,
          show.alpha * (ring ? 0.75 : 1),
          75,
        );
        ctx.fillText(show.word, 0, 0);
        ctx.restore();
      }
    }
  },
};
