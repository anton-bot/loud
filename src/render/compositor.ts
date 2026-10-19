/**
 * Copies the finished scene to the visible canvas, with effects that must never feed
 * back into the scene: a camera punch-in on the beat, chromatic aberration, bloom, an
 * exposure kick, scene transitions, a vignette and dither.
 */
import { createLayer, setCanvasSize } from '../core/dom';
import { cssRgba } from '../core/rgb';
import { audio, clock, scene, view } from '../core/state';
import type { Mode } from '../modes';
import { ctx, display, displayCtx, onResize, sceneCanvas } from './canvases';
import { backgroundGradient, colorRgb } from './color';
import { quality } from './quality';
import { speckle, vignette } from './shapes';

/** The outgoing frame of a transition. */
const outgoing = createLayer();
/** Red and cyan copies of the scene for chromatic aberration. */
const red = createLayer();
const cyan = createLayer();
/** Bloom pyramid at 1/4, 1/8 and 1/16 of the screen size. */
const bloomLevels = [createLayer(), createLayer(), createLayer()];
/** LED wall look: one pixel per lamp, and a mask tile with a round hole. */
const lamps = createLayer();
const lampMask = createLayer();
let lampPattern: CanvasPattern | null = null;
const hasFilter = 'filter' in CanvasRenderingContext2D.prototype;

onResize(() => {
  for (const layer of [outgoing, red, cyan]) {
    layer.canvas.width = sceneCanvas.width;
    layer.canvas.height = sceneCanvas.height;
  }
});

const transition = {
  /** 1 at the start, 0 when done. */
  t: 0,
  duration: 1,
  /** Clear the scene at the next frame (a new mode must not draw over the old one). */
  clearScene: false,
  /** Frame number when the outgoing frame was captured. */
  capturedAt: -1,
  /** 0 zoom through, 1 twist away, 2 lift off, 3 light dissolve. */
  kind: 0,
};
let transitionsOn = false;
let frameNumber = 0;

/** Transitions start working after the first scene is set up. */
export function enableTransitions(): void {
  transitionsOn = true;
}

/**
 * Starts a transition from what is on screen now. When the mode, palette and look all
 * change in one frame, they share one transition.
 */
export function startTransition(duration: number, clearScene: boolean): void {
  if (!transitionsOn) return;
  if (transition.capturedAt !== frameNumber) {
    const o = outgoing.ctx;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'copy';
    o.drawImage(display, 0, 0);
    transition.capturedAt = frameNumber;
    transition.kind = Math.floor(Math.random() * 4);
    transition.duration = duration;
    transition.clearScene = clearScene;
  } else {
    transition.duration = Math.max(transition.duration, duration);
    transition.clearScene = transition.clearScene || clearScene;
  }
  transition.t = 1;
}

/** Bright-pass and blur into the bloom pyramid. */
function renderBloom(): void {
  const levels = quality.level >= 1 ? 3 : 2;
  const w0 = Math.max(16, Math.round(view.width / 4));
  const h0 = Math.max(16, Math.round(view.height / 4));
  bloomLevels.forEach((layer, i) =>
    setCanvasSize(layer.canvas, Math.max(8, w0 >> i), Math.max(8, h0 >> i)),
  );

  const first = bloomLevels[0];
  first.ctx.globalCompositeOperation = 'copy';
  first.ctx.imageSmoothingEnabled = true;
  if (hasFilter) first.ctx.filter = 'brightness(0.62) contrast(2.6) saturate(1.35)';
  first.ctx.drawImage(sceneCanvas, 0, 0, first.canvas.width, first.canvas.height);
  if (hasFilter) first.ctx.filter = 'none';
  for (let i = 1; i < levels; i++) {
    const layer = bloomLevels[i];
    layer.ctx.globalCompositeOperation = 'copy';
    layer.ctx.imageSmoothingEnabled = true;
    if (hasFilter) layer.ctx.filter = 'blur(1.5px)';
    layer.ctx.drawImage(bloomLevels[i - 1].canvas, 0, 0, layer.canvas.width, layer.canvas.height);
    if (hasFilter) layer.ctx.filter = 'none';
  }
}

/** Fills `layer` with the scene multiplied by `tint` (one colour channel of it). */
function tintedCopy(
  layer: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D },
  tint: string,
): void {
  layer.ctx.globalCompositeOperation = 'copy';
  layer.ctx.drawImage(sceneCanvas, 0, 0);
  layer.ctx.globalCompositeOperation = 'multiply';
  layer.ctx.fillStyle = tint;
  layer.ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
}

/**
 * The LED wall look: the picture at one pixel per lamp, scaled up without smoothing,
 * then a mask of dark gaps with round holes on top. On the display only, so the
 * gaps never feed back into the scene.
 */
function drawLedWall(): void {
  const d = displayCtx;
  const dw = display.width;
  const dh = display.height;
  const lamp = Math.max(5, Math.round((view.min * view.dpr) / 80));
  const w = Math.ceil(dw / lamp);
  const h = Math.ceil(dh / lamp);
  setCanvasSize(lamps.canvas, w, h);
  lamps.ctx.imageSmoothingEnabled = true;
  lamps.ctx.drawImage(display, 0, 0, w, h);
  if (lampMask.canvas.width !== lamp || !lampPattern) {
    setCanvasSize(lampMask.canvas, lamp, lamp);
    const m = lampMask.ctx;
    m.clearRect(0, 0, lamp, lamp);
    m.fillStyle = 'rgba(0,0,0,0.92)';
    m.fillRect(0, 0, lamp, lamp);
    m.globalCompositeOperation = 'destination-out';
    const hole = m.createRadialGradient(lamp / 2, lamp / 2, 0, lamp / 2, lamp / 2, lamp * 0.46);
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(0.7, 'rgba(0,0,0,0.95)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    m.fillStyle = hole;
    m.fillRect(0, 0, lamp, lamp);
    m.globalCompositeOperation = 'source-over';
    lampPattern = d.createPattern(lampMask.canvas, 'repeat');
  }
  d.globalCompositeOperation = 'copy';
  d.imageSmoothingEnabled = false;
  d.drawImage(lamps.canvas, 0, 0, w * lamp, h * lamp);
  d.imageSmoothingEnabled = true;
  d.globalCompositeOperation = 'source-over';
  if (lampPattern) {
    d.fillStyle = lampPattern;
    d.fillRect(0, 0, dw, dh);
  }
}

function drawTransition(dt: number, light: boolean): void {
  const d = displayCtx;
  const dw = display.width;
  const dh = display.height;
  if (transition.clearScene) {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = backgroundGradient(ctx);
    ctx.fillRect(0, 0, view.width, view.height);
    transition.clearScene = false;
  }
  const t = transition.t;
  const e = t * t * (3 - 2 * t);
  d.globalCompositeOperation = 'source-over';
  d.globalAlpha = e;
  d.save();
  d.translate(dw / 2, dh / 2);
  if (transition.kind === 0) {
    const z = 1 + (1 - e) * 0.35;
    d.scale(z, z);
  } else if (transition.kind === 1) {
    const z = 1 - (1 - e) * 0.25;
    d.scale(z, z);
    d.rotate((1 - e) * 0.5);
  } else if (transition.kind === 2) {
    d.translate(0, -(1 - e) * dh * 0.25);
  } else {
    const z = 1 + (1 - e) * 0.12;
    d.scale(z, z);
    d.globalCompositeOperation = light ? 'multiply' : 'screen';
  }
  d.drawImage(outgoing.canvas, -dw / 2, -dh / 2, dw, dh);
  d.restore();
  d.globalAlpha = 1;
  transition.t = Math.max(0, transition.t - dt / transition.duration);
}

export function composite(mode: Mode, dt: number): void {
  frameNumber++;
  const d = displayCtx;
  const beat = audio.beat;
  const light = !!scene.palette.light;
  const time = clock.time;
  const dpr = view.dpr;
  d.setTransform(1, 0, 0, 1, 0, 0);
  d.globalAlpha = 1;
  d.globalCompositeOperation = 'copy';
  d.imageSmoothingEnabled = true;

  // Camera: a smooth punch-in on the beat and a slow drift.
  const zoom = 1 + beat * beat * 0.035 + audio.bass * 0.008;
  const roll = Math.sin(time * 0.23) * 0.004;
  const driftX = Math.sin(time * 0.17) * view.width * 0.004;
  const driftY = Math.cos(time * 0.13) * view.height * 0.004;
  const dw = display.width;
  const dh = display.height;
  const x = (dw - dw * zoom) / 2 + driftX * dpr;
  const y = (dh - dh * zoom) / 2 + driftY * dpr;

  // Chromatic aberration on hits: red and cyan copies, offset and added back together.
  const split = quality.level >= 2 && beat > 0.3 ? ((beat - 0.3) * 7 + audio.high * 1.2) * dpr : 0;
  d.save();
  d.translate(dw / 2, dh / 2);
  d.rotate(roll);
  d.translate(-dw / 2, -dh / 2);
  if (split > 0.8) {
    tintedCopy(red, '#f00');
    tintedCopy(cyan, '#0ff');
    d.drawImage(red.canvas, x - split, y, dw * zoom, dh * zoom);
    d.globalCompositeOperation = 'lighter';
    d.drawImage(cyan.canvas, x + split, y + split * 0.3, dw * zoom, dh * zoom);
  } else {
    d.drawImage(sceneCanvas, x, y, dw * zoom, dh * zoom);
  }
  d.restore();

  // Bloom: light bleeding out of the bright parts. Off on light palettes.
  const bloom = (mode.bloom ?? 1) * (light ? 0 : 1) * (hasFilter ? 1 : 0.35);
  if (bloom > 0) {
    renderBloom();
    d.globalCompositeOperation = 'screen';
    d.globalAlpha = Math.min(1, (0.42 + audio.bass * 0.25 + beat * 0.25) * bloom);
    d.drawImage(bloomLevels[1].canvas, 0, 0, dw, dh);
    d.globalAlpha = Math.min(1, (0.5 + audio.bass * 0.3 + beat * 0.3) * bloom);
    d.drawImage(bloomLevels[quality.level >= 1 ? 2 : 1].canvas, 0, 0, dw, dh);
    d.globalAlpha = 1;
  }

  // Exposure kick on hits.
  if (beat > 0.05) {
    d.globalCompositeOperation = light ? 'multiply' : 'screen';
    d.fillStyle = cssRgba(colorRgb(0, light ? 55 : 75), beat * beat * (light ? 0.12 : 0.16));
    d.fillRect(0, 0, dw, dh);
  }

  if (scene.look.ledWall) drawLedWall();
  if (transition.t > 0) drawTransition(dt, light);

  // Grade: a soft vignette and fine dither, so gradients never band.
  d.globalCompositeOperation = 'source-over';
  const R = Math.hypot(dw, dh) / 2;
  vignette(
    d,
    dw / 2,
    dh / 2,
    R * 0.45,
    R * 1.02,
    light ? 'rgba(60,35,15,0.22)' : 'rgba(0,0,0,0.42)',
    dw,
    dh,
  );
  d.fillStyle = light ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.03)';
  speckle(d, Math.floor((dw * dh) / 9000), dw, dh, dpr);
}
