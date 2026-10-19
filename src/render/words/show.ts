/** Shared types and helpers for the heard-words styles. */
import { scene, view } from '../../core/state';
import { ctx } from '../canvases';

/**
 * Display font: Unbounded (Latin and Cyrillic), then Noto Sans SC for Chinese (and
 * the Japanese kanji it shares). Both come from Google Fonts in loud.html.
 */
export const FONT = 'Unbounded, "Noto Sans SC", sans-serif';
export const MONOSPACE = 'ui-monospace,Menlo,Consolas,monospace';

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
  /** Called when the style starts to show a text. */
  start?(show: WordShow): void;
  draw(show: WordShow, dt: number): void;
}

/** Font size at which `text` takes `share` of the screen width, but at most `max` px. */
export function fitFont(text: string, share: number, max: number, family = FONT): number {
  ctx.font = `700 100px ${family}`;
  const measured = Math.max(1, ctx.measureText(text).width);
  return Math.min(max, (100 * view.width * share) / measured);
}

/** Glowing blend on dark palettes; normal drawing on light ones. */
export function glowBlend(): GlobalCompositeOperation {
  return scene.palette.light ? 'source-over' : 'lighter';
}
