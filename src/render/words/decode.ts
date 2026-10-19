/**
 * Hero: each word scrambles through random glyphs and locks letter by letter, like
 * hacker text, with a blinking cursor. Under it, the whole text is typed out.
 */
import { rndInt } from '../../core/math';
import { view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { currentFace, fitFont, font, MONOSPACE, type WordStyle } from './show';

const GLYPHS = '!<>-_\\/[]{}=+*^?#%&ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
/** Seconds between two letters locking. */
const LOCK_STEP = 0.06;
const LATIN = /^[\u0000-ɏ\s]*$/;

let shown = '';
let shownAt = 0;

export const decode: WordStyle = {
  name: 'decode',
  role: 'hero',
  weight: 1.8,
  start(show) {
    shown = show.word;
    shownAt = show.age;
  },
  draw(show) {
    if (show.word !== shown) {
      shown = show.word;
      shownAt = show.age;
    }
    const { cx, cy, height } = view;
    // Monospace for Latin text in the plain face; the current face for the rest.
    const family = LATIN.test(show.phrase) && currentFace().name === 'bold' ? MONOSPACE : undefined;
    const size = fitFont(shown, 0.82, height * 0.3, family);
    ctx.font = font(size, family);
    ctx.textAlign = 'left';
    const letters = [...shown];
    const widths = letters.map((letter) => ctx.measureText(letter).width);
    let x = cx - widths.reduce((sum, w) => sum + w, 0) / 2;
    const t = show.age - shownAt;
    letters.forEach((letter, i) => {
      const locked = t > 0.15 + i * LOCK_STEP;
      ctx.fillStyle = locked
        ? color(i * 0.4, show.alpha, 90)
        : color(2 + i * 0.4, show.alpha * 0.8, 55);
      ctx.fillText(locked ? letter : GLYPHS[rndInt(GLYPHS.length)], x, cy);
      x += widths[i];
    });
    if (Math.floor(show.age * 3) % 2 === 0) {
      ctx.fillStyle = color(1, show.alpha, 85);
      ctx.fillRect(x + size * 0.08, cy - size * 0.38, size * 0.45, size * 0.76);
    }
    // The whole text, typed out below.
    const typed = [...show.phrase].slice(0, Math.floor(show.age * 14)).join('');
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.max(12, size * 0.22)}px ${family}`;
    ctx.fillStyle = color(3, show.alpha * 0.85, 75);
    ctx.fillText(typed, cx, cy + size * 0.85);
  },
};
