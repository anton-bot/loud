/**
 * The canvases that every frame goes through:
 *   scene    the modes draw here; each frame starts from the last one (trails, feedback)
 *   display  the visible canvas; the compositor copies the scene here with camera moves,
 *            bloom and transitions, and nothing on it feeds back into the scene
 */
import { byId, context2d } from '../core/dom';
import { view } from '../core/state';
import { background } from './color';
import { quality } from './quality';

export const display = byId<HTMLCanvasElement>('display');
export const displayCtx = context2d(display, { alpha: false });

export const sceneCanvas = document.createElement('canvas');
/** The scene context. Its transform maps CSS pixels to canvas pixels. */
export const ctx = context2d(sceneCanvas, { alpha: false });

/** A copy of the scene for effects that move parts of the scene within one frame. */
export const snapshot = document.createElement('canvas');
const snapshotCtx = context2d(snapshot);

export function takeSnapshot(): void {
  snapshotCtx.setTransform(1, 0, 0, 1, 0, 0);
  snapshotCtx.drawImage(sceneCanvas, 0, 0);
}

/**
 * Draws the full-width strip y..y+h of `source` (a canvas the size of the scene)
 * onto the scene, moved sideways by `dx` and placed at `toY`.
 */
export function drawStrip(
  source: HTMLCanvasElement,
  y: number,
  h: number,
  dx: number,
  toY: number,
): void {
  ctx.drawImage(source, 0, y * view.dpr, source.width, h * view.dpr, dx, toY, view.width, h);
}

/** Draws the left half of the scene mirrored onto the right half. */
export function mirrorLeftHalf(): void {
  ctx.save();
  ctx.translate(view.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(
    sceneCanvas,
    0,
    0,
    sceneCanvas.width / 2,
    sceneCanvas.height,
    0,
    0,
    view.width / 2,
    view.height,
  );
  ctx.restore();
}

const resizeListeners: (() => void)[] = [];

/** Calls `listener` after each resize, when the canvases have their new size. */
export function onResize(listener: () => void): void {
  resizeListeners.push(listener);
}

/** Fits the canvases to the window. A resize clears the scene. */
export function resize(): void {
  view.dpr = Math.min(window.devicePixelRatio || 1, quality.level === 0 ? 1 : 1.5);
  view.width = Math.max(1, Math.floor(window.innerWidth));
  view.height = Math.max(1, Math.floor(window.innerHeight));
  view.cx = view.width / 2;
  view.cy = view.height / 2;
  view.min = Math.min(view.width, view.height);

  const pixelWidth = Math.floor(view.width * view.dpr);
  const pixelHeight = Math.floor(view.height * view.dpr);
  for (const canvas of [sceneCanvas, display, snapshot]) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  display.style.width = view.width + 'px';
  display.style.height = view.height + 'px';

  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.fillStyle = background();
  ctx.fillRect(0, 0, view.width, view.height);
  for (const listener of resizeListeners) listener();
}
