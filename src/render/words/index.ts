/**
 * Words heard by the mic (audio/speech.ts), shown over any mode for a while. Each text
 * gets one big "hero" style in the middle and one or two "ambient" styles around it;
 * the hero changes every 8 beats, so one text can go through several heroes.
 */
import { audio, clock } from '../../core/state';
import { ctx } from '../canvases';
import { anagram } from './anagram';
import { bounce } from './bounce';
import { cutout } from './cutout';
import { decode } from './decode';
import { kaleido } from './kaleido';
import { marquee } from './marquee';
import { orbit } from './orbit';
import { particles } from './particles';
import { rain } from './rain';
import { FONT, glowBlend, type WordShow, type WordStyle } from './show';
import { slam } from './slam';
import { spiral } from './spiral';
import { tunnel } from './tunnel';
import { wave } from './wave';

const SHOW_S = 16;
const HERO_BEATS = 8;
/** Without beats, the next word comes after this long anyway. */
const WORD_MAX_S = 1.2;
const HEROES: readonly WordStyle[] = [slam, particles, decode, kaleido, cutout, anagram];
const AMBIENTS: readonly WordStyle[] = [tunnel, orbit, wave, bounce, rain, spiral, marquee];

let show: WordShow | null = null;
let shownAt = 0;
let lastBeats = 0;
let lastWordAt = 0;
let heroStyle: WordStyle = slam;
let ambients: WordStyle[] = [];
let heroBeats = 0;

/** A random style, by weight, that is not in `not`. */
function pickStyle(styles: readonly WordStyle[], not: readonly WordStyle[]): WordStyle {
  const options = styles.filter((s) => !not.includes(s));
  let roll = Math.random() * options.reduce((sum, s) => sum + s.weight, 0);
  for (const style of options) {
    roll -= style.weight;
    if (roll <= 0) return style;
  }
  return options[options.length - 1];
}

/** Chinese, Japanese and Korean characters. */
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uf900-\ufaff]/;

/** The words of the text. Text without spaces (Chinese, Japanese) is cut into short chunks. */
function splitWords(phrase: string): string[] {
  const words: string[] = [];
  for (const token of phrase.split(/\s+/).filter(Boolean)) {
    const characters = [...token];
    if (!CJK.test(token) || characters.length <= 4) {
      words.push(token);
      continue;
    }
    for (let i = 0; i < characters.length; i += 3) words.push(characters.slice(i, i + 3).join(''));
  }
  return words;
}

/**
 * Shows `text`. Styles are picked at random, unless `hero` and `ambient` name them
 * (for trying them from the console).
 */
export function showHeardWords(text: string, hero?: string, ...ambient: string[]): void {
  const phrase = text.toUpperCase().trim();
  const words = splitWords(phrase);
  if (!words.length) return;
  // Load the parts of the fonts that this text needs (Cyrillic, Chinese, ...).
  document.fonts?.load?.(`700 60px ${FONT}`, phrase).catch(() => {});
  show = { phrase, words, age: 0, alpha: 0, beats: 0, beat: false, word: words[0] };
  shownAt = clock.time;
  lastBeats = audio.beats;
  lastWordAt = 0;
  heroStyle = HEROES.find((s) => s.name === hero) ?? pickStyle(HEROES, []);
  heroBeats = 0;
  const named = AMBIENTS.filter((s) => ambient.includes(s.name));
  ambients = named.length ? named : [pickStyle(AMBIENTS, [])];
  if (!named.length && Math.random() < 0.45) ambients.push(pickStyle(AMBIENTS, ambients));
  for (const style of [heroStyle, ...ambients]) style.start?.(show);
}

/** Draws the heard words, if there are any to show now. */
export function drawHeardWords(dt: number): void {
  if (!show) return;
  const age = clock.time - shownAt;
  if (age > SHOW_S) {
    show = null;
    return;
  }
  show.age = age;
  show.alpha = Math.max(0, Math.min(1, age / 0.4, (SHOW_S - age) / 1.5));
  show.beat = audio.beats !== lastBeats || age - lastWordAt > WORD_MAX_S;
  if (show.beat) {
    lastBeats = audio.beats;
    lastWordAt = age;
    show.beats++;
    show.word = show.words[show.beats % show.words.length];
    if (++heroBeats >= HERO_BEATS) {
      heroStyle = pickStyle(HEROES, [heroStyle]);
      heroStyle.start?.(show);
      heroBeats = 0;
    }
  }
  for (const style of [...ambients, heroStyle]) {
    ctx.save();
    ctx.globalCompositeOperation = glowBlend();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    style.draw(show, dt);
    ctx.restore();
  }
}
