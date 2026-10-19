/**
 * Ambient: two diagonal tapes cross the screen, like caution tape. The text runs along
 * each tape, the tapes run opposite ways, and the beat makes them shudder.
 */
import { audio, clock, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { font, type WordStyle } from './show';

// prettier-ignore
const TAPES = [{ angle: -0.38, at: -0.16, direction: 1 }, { angle: 0.33, at: 0.2, direction: -1 }];

export const tape: WordStyle = {
  name: 'tape',
  role: 'ambient',
  weight: 2,
  draw(show) {
    const { width, height, cx, cy, min } = view;
    const size = Math.max(13, min * 0.045);
    ctx.font = font(size);
    const unit = `${show.phrase}  ///  `;
    const unitWidth = Math.max(1, ctx.measureText(unit).width);
    const long = Math.hypot(width, height) * 1.1;
    const text = unit.repeat(Math.ceil(long / unitWidth) + 2);
    const band = size * 1.7;
    // Solid tape, also on palettes that glow.
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'left';
    TAPES.forEach((tape, i) => {
      ctx.save();
      ctx.translate(cx, cy + tape.at * height);
      const shudder = Math.sin(clock.time * 53 + i * 3) * audio.beat * 0.025;
      ctx.rotate(tape.angle + Math.sin(clock.time * 0.4 + i) * 0.04 + shudder);
      ctx.fillStyle = color(i * 2 + show.age * 0.2, show.alpha * 0.9, 58);
      ctx.fillRect(-long / 2, -band / 2, long, band);
      ctx.fillStyle = `rgba(0,0,0,${show.alpha * 0.85})`;
      ctx.fillRect(-long / 2, -band / 2, long, band * 0.08);
      ctx.fillRect(-long / 2, band / 2 - band * 0.08, long, band * 0.08);
      const run = show.age * (90 + audio.mid * 200) * tape.direction;
      const shift = ((run % unitWidth) + unitWidth) % unitWidth;
      ctx.fillText(text, -long / 2 - shift, size * 0.04);
      ctx.restore();
    });
  },
};
