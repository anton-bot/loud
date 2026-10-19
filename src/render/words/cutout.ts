/** Hero: giant letters that invert the picture inside them, slowly zooming in. */
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { fitFont, FONT, glowBlend, type WordStyle } from './show';

let shown = '';
let shownAt = 0;

export const cutout: WordStyle = {
  name: 'cutout',
  role: 'hero',
  weight: 1.6,
  draw(show) {
    if (show.word !== shown) {
      shown = show.word;
      shownAt = show.age;
    }
    const { cx, cy, height } = view;
    const size =
      fitFont(shown, 0.96, height * 0.85) * (1 + (show.age - shownAt) * 0.18 + audio.beat * 0.04);
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(show.age * 0.7) * 0.08);
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = `rgba(255,255,255,${show.alpha})`;
    ctx.fillText(shown, 0, 0);
    ctx.globalCompositeOperation = glowBlend();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color(show.age * 0.5, show.alpha, 80);
    ctx.strokeText(shown, 0, 0);
  },
};
