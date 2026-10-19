/** Shared types and helpers for the heard-words styles. */
import { scene, view } from '../../core/state';
import { ctx } from '../canvases';

/**
 * A typeface for the heard words. All come from Google Fonts in loud.html. A face
 * without Cyrillic names one with it next in its stack, and Noto Sans SC is always
 * last, for Chinese (and the Japanese kanji it shares).
 */
export interface Face {
  readonly name: string;
  readonly family: string;
  /** The weight that the face has (the others would be faked by the browser). */
  readonly weight: number;
  /** How often it is picked, compared with the others. */
  readonly chance: number;
}

const CJK = '"Noto Sans SC", sans-serif';
// prettier-ignore
export const FACES: readonly Face[] = [
  { name: 'bold', family: `Unbounded, ${CJK}`, weight: 700, chance: 3 },
  { name: 'pixel', family: `"Press Start 2P", ${CJK}`, weight: 400, chance: 1.6 },
  { name: 'glitch', family: `"Rubik Glitch", ${CJK}`, weight: 400, chance: 1 },
  { name: 'horror', family: `Creepster, "Rubik Wet Paint", ${CJK}`, weight: 400, chance: 1 },
  { name: 'drip', family: `"Rubik Wet Paint", ${CJK}`, weight: 400, chance: 0.8 },
  { name: 'beast', family: `"Rubik Beastly", ${CJK}`, weight: 400, chance: 0.8 },
  { name: 'neon', family: `Monoton, Unbounded, ${CJK}`, weight: 400, chance: 0.8 },
];
export const MONOSPACE = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

let face: Face = FACES[0];

/** Makes `next` the face of the styles drawn from now on. */
export function useFace(next: Face): void {
  face = next;
}

export function currentFace(): Face {
  return face;
}

/** A random face, by chance, that is not `not`. */
export function pickFace(not?: Face): Face {
  const options = FACES.filter((f) => f !== not);
  let roll = Math.random() * options.reduce((sum, f) => sum + f.chance, 0);
  for (const f of options) {
    roll -= f.chance;
    if (roll <= 0) return f;
  }
  return options[options.length - 1];
}

/** CSS font of `size` px: the current face, or `family` (bold) when given. */
export function font(size: number, family?: string): string {
  return family ? `700 ${size}px ${family}` : `${face.weight} ${size}px ${face.family}`;
}

/** The text on screen now, shared by all styles that show it. */
export interface WordShow {
  /** The whole text, in capitals. */
  readonly phrase: string;
  readonly words: readonly string[];
  /** Seconds since the text arrived. */
  age: number;
  /** Fade in and out, 0..1. */
  alpha: number;
  /** Beats since the text arrived. */
  beats: number;
  /** True in the frame of a beat. */
  beat: boolean;
  /** The word for this beat. */
  word: string;
}

export interface WordStyle {
  readonly name: string;
  /** hero: big, in the middle, one at a time. ambient: around the hero. */
  readonly role: 'hero' | 'ambient';
  /** How often it is picked, compared with the others. */
  readonly weight: number;
  /** Laid out on a circle: two of these never show at the same time. */
  readonly round?: boolean;
  /** Called when the style starts to show a text. */
  start?(show: WordShow): void;
  draw(show: WordShow, dt: number): void;
}

/** Font size at which `text` takes `share` of the screen width, but at most `max` px. */
export function fitFont(text: string, share: number, max: number, family?: string): number {
  ctx.font = font(100, family);
  const measured = Math.max(1, ctx.measureText(text).width);
  return Math.min(max, (100 * view.width * share) / measured);
}

/**
 * A soft dark copy of `text` under where it will be drawn, so that a glowing word
 * stays readable over a bright picture.
 */
export function shadowText(text: string, x: number, y: number, size: number, alpha: number): void {
  const blend = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(0,0,0,${alpha * 0.55})`;
  ctx.fillText(text, x + size * 0.035, y + size * 0.05);
  ctx.globalCompositeOperation = blend;
}

/** Glowing blend on dark palettes; normal drawing on light ones. */
export function glowBlend(): GlobalCompositeOperation {
  return scene.palette.light ? 'source-over' : 'lighter';
}
