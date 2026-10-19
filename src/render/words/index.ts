/**
 * Words heard by the mic (audio/speech.ts), shown over any mode for a while. Each text
 * gets one big "hero" style in the middle and one or two "ambient" styles around it;
 * the hero changes every 8 beats, so one text can go through several heroes. Each text
 * also gets a typeface for the ambients and one for the hero, which can change with it.
 */
import { audio, clock } from '../../core/state';
import { ctx } from '../canvases';
import { anagram } from './anagram';
import { blinds } from './blinds';
import { bounce } from './bounce';
import { crawl } from './crawl';
import { cutout } from './cutout';
import { decode } from './decode';
import { flap } from './flap';
import { kaleido } from './kaleido';
import { marquee } from './marquee';
import { orbit } from './orbit';
import { particles } from './particles';
import { rain } from './rain';
import {
  FACES,
  glowBlend,
  pickFace,
  useFace,
  type Face,
  type WordShow,
  type WordStyle,
} from './show';
import { slam } from './slam';
import { slide } from './slide';
import { spiral } from './spiral';
import { stickersStyle } from './stickers';
import { stretch } from './stretch';
import { tape } from './tape';
import { tunnel } from './tunnel';
import { wave } from './wave';

const SHOW_S = 16;
const HERO_BEATS = 8;
/** Without beats, the next word comes after this long anyway. */
const WORD_MAX_S = 1.2;
/** The longest wait for the text's fonts before it shows anyway. */
const FONT_WAIT_S = 1.5;
// prettier-ignore
const HEROES: readonly WordStyle[] = [slam, particles, decode, kaleido, cutout, anagram, slide, blinds, flap, stretch];
// prettier-ignore
const AMBIENTS: readonly WordStyle[] = [tunnel, orbit, wave, bounce, rain, spiral, marquee, tape, stickersStyle, crawl];

let show: WordShow | null = null;
/** False while the fonts load; the text starts when they are ready. */
let started = false;
let shownAt = 0;
let lastBeats = 0;
let lastWordAt = 0;
let heroStyle: WordStyle = slam;
let ambients: WordStyle[] = [];
let heroBeats = 0;
let heroFace: Face = FACES[0];
let ambientFace: Face = FACES[0];

/** A random style, by weight, that is not in `not` (and not round, if `noRound`). */
function pickStyle(
  styles: readonly WordStyle[],
  not: readonly WordStyle[],
  noRound = false,
): WordStyle {
  const options = styles.filter((s) => !not.includes(s) && !(noRound && s.round));
  let roll = Math.random() * options.reduce((sum, s) => sum + s.weight, 0);
  for (const style of options) {
    roll -= style.weight;
    if (roll <= 0) return style;
  }
  return options[options.length - 1];
}

/** Chinese, Japanese and Korean characters. */
const CJK = /[぀-ヿ㐀-鿿가-힯豈-﫿]/;

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

function fontReady(face: Face, phrase: string): boolean {
  try {
    return document.fonts?.check?.(`${face.weight} 60px ${face.family}`, phrase) ?? true;
  } catch {
    return true;
  }
}

/** Calls each style's `start`, in its own face. */
function startStyles(): void {
  if (!show) return;
  for (const style of [heroStyle, ...ambients]) {
    useFace(style.role === 'hero' ? heroFace : ambientFace);
    style.start?.(show);
  }
}

/**
 * Shows `text`. Styles and faces are picked at random, unless `hero` and `ambient`
 * name styles (for trying them from the console). A face can be named too, as
 * "face:pixel" among `ambient`.
 */
export function showHeardWords(text: string, hero?: string, ...ambient: string[]): void {
  const phrase = text.toUpperCase().trim();
  const words = splitWords(phrase);
  if (!words.length) return;
  // Load the parts of all faces that this text needs (Cyrillic, Chinese, ...).
  for (const face of FACES) {
    document.fonts?.load?.(`${face.weight} 60px ${face.family}`, phrase).catch(() => {});
  }
  const named = FACES.find((f) => ambient.includes(`face:${f.name}`));
  ambientFace = named ?? pickFace();
  heroFace = named ?? (Math.random() < 0.5 ? ambientFace : pickFace());
  show = { phrase, words, age: 0, alpha: 0, beats: 0, beat: false, word: words[0] };
  started = false;
  shownAt = clock.time;
  heroStyle = HEROES.find((s) => s.name === hero) ?? pickStyle(HEROES, []);
  heroBeats = 0;
  const chosen = AMBIENTS.filter((s) => ambient.includes(s.name));
  ambients = chosen.length ? chosen : [pickStyle(AMBIENTS, [], heroStyle.round)];
  if (!chosen.length && Math.random() < 0.45) {
    ambients.push(pickStyle(AMBIENTS, ambients, heroStyle.round || ambients[0].round));
  }
}

/** Draws the heard words, if there are any to show now. */
export function drawHeardWords(dt: number): void {
  if (!show) return;
  if (!started) {
    const ready = fontReady(heroFace, show.phrase) && fontReady(ambientFace, show.phrase);
    if (!ready && clock.time - shownAt < FONT_WAIT_S) return;
    started = true;
    shownAt = clock.time;
    lastBeats = audio.beats;
    lastWordAt = 0;
    startStyles();
  }
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
      heroStyle = pickStyle(
        HEROES,
        [heroStyle],
        ambients.some((s) => s.round),
      );
      if (Math.random() < 0.6) heroFace = pickFace(heroFace);
      useFace(heroFace);
      heroStyle.start?.(show);
      heroBeats = 0;
    }
  }
  for (const style of [...ambients, heroStyle]) {
    useFace(style.role === 'hero' ? heroFace : ambientFace);
    ctx.save();
    ctx.globalCompositeOperation = glowBlend();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    style.draw(show, dt);
    ctx.restore();
  }
}
