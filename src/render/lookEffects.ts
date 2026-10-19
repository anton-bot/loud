/** The effects of the current look (and of phone motion), applied to the scene after the mode draws. */
import { createLayer, setCanvasSize } from '../core/dom';
import { rnd } from '../core/math';
import { audio, clock, motion, scene, view } from '../core/state';
import { ctx, drawStrip, mirrorLeftHalf, sceneCanvas, snapshot, takeSnapshot } from './canvases';
import { speckle, vignette } from './shapes';

const pixelLayer = createLayer();

/** Two copies of the scene, offset left and right, blended on top: a double image. */
function ghost(alpha: number, offset: number): void {
  const { width, height } = view;
  ctx.globalCompositeOperation = scene.palette.light ? 'multiply' : 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(sceneCanvas, offset, 0, width, height);
  ctx.drawImage(sceneCanvas, -offset, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** Moves `count` random horizontal strips sideways, by up to ±shift/2 × strength. */
function tearStrips(count: number, maxHeight: number, shift: number, strength: number): void {
  for (let i = 0; i < count; i++) {
    const y = Math.random() * view.height;
    const h = rnd(6, maxHeight);
    const dx = (Math.random() - 0.5) * shift * strength;
    drawStrip(sceneCanvas, y, h, dx, y);
  }
}

/** Bends the scene sideways along a sine wave, in strips 6 px high. */
function waveStrips(amplitude: number, frequency: number, phase: number): void {
  takeSnapshot();
  ctx.globalCompositeOperation = 'source-over';
  const strip = 6;
  for (let y = 0; y < view.height; y += strip) {
    drawStrip(snapshot, y, strip, Math.sin(y * frequency + phase) * amplitude, y);
  }
}

function pixelate(size: number): void {
  const { width, height } = view;
  const w = Math.max(8, Math.round(width / size));
  const h = Math.max(8, Math.round(height / size));
  setCanvasSize(pixelLayer.canvas, w, h);
  pixelLayer.ctx.imageSmoothingEnabled = false;
  pixelLayer.ctx.drawImage(sceneCanvas, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixelLayer.canvas, 0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
}

/** Shake: double image, torn strips, sometimes a mirror. Twist: the image bends. */
function motionEffects(): void {
  if (motion.shake > 0.2 && Math.random() < 0.6) {
    const shake = motion.shake;
    ghost(shake * 0.25, 6 + shake * 30);
    tearStrips(Math.floor(shake * 8), 80, 120, shake);
    if (shake > 0.5 && Math.random() < shake * 0.5) mirrorLeftHalf();
  }
  if (motion.twist > 0.15) waveStrips(motion.twist * 30, 0.015, clock.time * 4);
}

export function applyLookEffects(): void {
  const { width, height, cx, cy, min } = view;
  const look = scene.look;
  const light = scene.palette.light;
  const beat = audio.beat;

  if (look.pixel) pixelate(look.pixel);
  if (motion.enabled && motion.available) motionEffects();
  ctx.globalCompositeOperation = 'source-over';
  if (look.mirror) mirrorLeftHalf();
  if (look.ghost && beat > 0.25) ghost(beat * 0.35, 4 + beat * 14);
  if (look.quad) {
    mirrorLeftHalf();
    ctx.save();
    ctx.translate(0, height);
    ctx.scale(1, -1);
    ctx.drawImage(
      sceneCanvas,
      0,
      0,
      sceneCanvas.width,
      sceneCanvas.height / 2,
      0,
      0,
      width,
      height / 2,
    );
    ctx.restore();
  }
  if (look.liquid) waveStrips(3 + beat * 14 + audio.bass * 8, 0.02, clock.time * 3);
  if (look.glitch && beat > 0.35 && Math.random() < look.glitch) {
    tearStrips(2 + Math.floor(Math.random() * 5), 60, 80, beat);
  }
  if (look.scanlines) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    for (let y = 0; y < height; y += 4) ctx.rect(0, y, width, 1.5);
    ctx.fill();
  }
  if (look.grain) {
    ctx.fillStyle = light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.09)';
    speckle(ctx, Math.floor((width * height) / 2500), width, height, 1.5);
  }
  if (look.vignette) {
    vignette(
      ctx,
      cx,
      cy,
      min * 0.3,
      Math.hypot(cx, cy),
      light ? 'rgba(80,40,10,0.35)' : 'rgba(0,0,0,0.6)',
      width,
      height,
    );
  }
}
