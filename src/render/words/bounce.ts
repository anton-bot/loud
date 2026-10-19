/** Ambient: the current word bounces around the screen like the old DVD logo, and changes colour at each wall. */
import { rnd } from '../../core/math';
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { FONT, type WordStyle } from './show';

const box = { x: 0, y: 0, vx: 1, vy: 1, k: 0, flash: 0 };

export const bounce: WordStyle = {
  name: 'bounce',
  role: 'ambient',
  weight: 2,
  start() {
    box.x = rnd(0.25, 0.75) * view.width;
    box.y = rnd(0.25, 0.75) * view.height;
    box.vx = Math.random() < 0.5 ? 1 : -1;
    box.vy = Math.random() < 0.5 ? 1 : -1;
    box.k = Math.random() * 4;
  },
  draw(show, dt) {
    const { width, height, min } = view;
    const size = min * 0.075 * (1 + box.flash * 0.6);
    ctx.font = `700 ${size}px ${FONT}`;
    const halfW = ctx.measureText(show.word).width / 2;
    const halfH = size / 2;
    const speed = (140 + audio.mid * 220) * dt;
    box.x += box.vx * speed;
    box.y += box.vy * speed;
    let walls = 0;
    if (box.x - halfW < 0 || box.x + halfW > width) {
      box.vx = box.x - halfW < 0 ? 1 : -1;
      box.x = Math.min(width - halfW, Math.max(halfW, box.x));
      walls++;
    }
    if (box.y - halfH < 0 || box.y + halfH > height) {
      box.vy = box.y - halfH < 0 ? 1 : -1;
      box.y = Math.min(height - halfH, Math.max(halfH, box.y));
      walls++;
    }
    if (walls) box.k += 1.3;
    // The famous corner hit.
    if (walls === 2) box.flash = 1;
    box.flash = Math.max(0, box.flash - dt * 1.5);
    ctx.fillStyle = color(box.k, show.alpha, 80);
    ctx.fillText(show.word, box.x, box.y);
  },
};
