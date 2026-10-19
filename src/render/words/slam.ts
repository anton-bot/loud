/** Hero: one word per beat, slammed in with a stacked shadow and a split-colour echo. */
import { rnd } from '../../core/math';
import { audio, clock, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { fitFont, FONT, type WordStyle } from './show';

const pose = { turn: 0, x: 0, y: 0, k: 0 };

function newPose(): void {
  pose.turn = rnd(-0.3, 0.3);
  pose.x = rnd(-0.1, 0.1);
  pose.y = rnd(-0.15, 0.15);
  pose.k = Math.random() * 4;
}

export const slam: WordStyle = {
  name: 'slam',
  role: 'hero',
  weight: 2,
  start: newPose,
  draw(show) {
    if (show.beat) newPose();
    const { width, height, cx, cy } = view;
    const size =
      fitFont(show.word, 0.82, height * 0.42) * (0.9 + audio.bass * 0.25 + audio.beat * 0.15);
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.translate(cx + pose.x * width, cy + pose.y * height);
    ctx.rotate(pose.turn + Math.sin(clock.time * 3) * audio.high * 0.1);
    for (let i = 5; i >= 0; i--) {
      const o = i * size * 0.045 * (1 + audio.mid);
      ctx.fillStyle = i ? color(pose.k + i, show.alpha * 0.9, 50) : color(pose.k, show.alpha, 90);
      ctx.fillText(show.word, o, o);
    }
    if (audio.beat > 0.5) {
      const split = size * 0.04 * audio.beat;
      ctx.fillStyle = `rgba(255,0,80,${show.alpha * 0.5 * audio.beat})`;
      ctx.fillText(show.word, -split, 0);
      ctx.fillStyle = `rgba(0,230,255,${show.alpha * 0.5 * audio.beat})`;
      ctx.fillText(show.word, split, 0);
    }
  },
};
