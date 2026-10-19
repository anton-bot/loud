/**
 * Hero: the letters of the text change places on beats, hopping over each other in arcs;
 * every other beat they go back to the right order, so the text stays readable.
 */
import { clamp } from '../../core/math';
import { view } from '../../core/state';
import { ctx } from '../canvases';
import { color } from '../color';
import { fitFont, FONT, type WordStyle } from './show';

/** Longest text that is shuffled; a longer text is cut after a word. */
const MAX_LETTERS = 16;
const HOP_S = 0.35;

let letters: string[] = [];
let order: number[] = [];
let previous: number[] = [];
let movedAt = 0;
let scrambled = false;

function shortText(phrase: string): string {
  let text = '';
  for (const word of phrase.split(' ')) {
    if ((text + ' ' + word).trim().length > MAX_LETTERS && text) break;
    text = (text + ' ' + word).trim();
  }
  return [...text].slice(0, MAX_LETTERS).join('');
}

function shuffled(n: number): number[] {
  const result = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const anagram: WordStyle = {
  name: 'anagram',
  role: 'hero',
  weight: 1.5,
  start(show) {
    letters = [...shortText(show.phrase)];
    order = letters.map((_, i) => i);
    previous = [...order];
    movedAt = show.age;
    scrambled = false;
  },
  draw(show) {
    if (show.beat) {
      previous = order;
      scrambled = !scrambled;
      order = scrambled ? shuffled(letters.length) : letters.map((_, i) => i);
      movedAt = show.age;
    }
    const { cx, cy, height } = view;
    const text = letters.join('');
    const size = fitFont(text, 0.86, height * 0.24);
    ctx.font = `700 ${size}px ${FONT}`;
    // Slot positions: where the letters of the text would stand in the right order.
    const widths = letters.map((letter) => ctx.measureText(letter).width);
    const slots: number[] = [];
    let x = cx - widths.reduce((sum, w) => sum + w, 0) / 2;
    for (const w of widths) {
      slots.push(x + w / 2);
      x += w;
    }
    const p = clamp((show.age - movedAt) / HOP_S, 0, 1);
    const ease = p * p * (3 - 2 * p);
    letters.forEach((letter, i) => {
      const fromX = slots[previous[i]];
      const toX = slots[order[i]];
      const hop = Math.sin(p * Math.PI) * size * 0.6 * (i % 2 ? 1 : -1);
      ctx.fillStyle = color(i * 0.35 + show.age * 0.3, show.alpha, 82);
      ctx.fillText(letter, fromX + (toX - fromX) * ease, cy - hop);
    });
  },
};
