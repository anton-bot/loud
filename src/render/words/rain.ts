/** Ambient: letters fall from the top, bounce on the floor and tumble; each beat drops the whole word. */
import { rnd } from '../../core/math';
import { audio, view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { FONT, type WordStyle } from './show';

interface Drop {
  letter: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  turn: number;
  spin: number;
  life: number;
  k: number;
}

const drops: Drop[] = [];

function drop(letter: string, x: number): void {
  drops.push({
    letter,
    x,
    y: -20,
    vx: rnd(-40, 40),
    vy: rnd(0, 120),
    turn: rnd(-0.5, 0.5),
    spin: rnd(-3, 3),
    life: 3.5,
    k: Math.random() * 4,
  });
  if (drops.length > 160) drops.shift();
}

export const rain: WordStyle = {
  name: 'rain',
  role: 'ambient',
  weight: 2,
  start() {
    drops.length = 0;
  },
  draw(show, dt) {
    const { width, height, min } = view;
    const letters = [...show.phrase.replace(/\s+/g, '')];
    if (show.beat) {
      const word = [...show.word];
      word.forEach((letter, i) => drop(letter, width * (0.15 + (0.7 * (i + 0.5)) / word.length)));
    }
    if (Math.random() < dt * (5 + audio.high * 20))
      drop(letters[Math.floor(Math.random() * letters.length)], Math.random() * width);
    const size = min * 0.06;
    ctx.font = `700 ${size}px ${FONT}`;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.life -= dt;
      if (d.life <= 0) {
        drops.splice(i, 1);
        continue;
      }
      d.vy += 900 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.turn += d.spin * dt;
      if (d.y > height - size / 2) {
        d.y = height - size / 2;
        d.vy *= -0.45;
        d.vx *= 0.8;
        d.spin *= 0.6;
      }
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.turn);
      ctx.fillStyle = color(d.k, show.alpha * Math.min(1, d.life), 80);
      ctx.fillText(d.letter, 0, 0);
      ctx.restore();
    }
  },
};
