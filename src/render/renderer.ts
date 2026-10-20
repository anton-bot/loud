/** Draws one frame: feedback, fade, camera shake, the mode, the look effects, then the compositor. */
import { audio, motion, scene, view } from '../core/state';
import { motionIsActive } from '../input/motion';
import type { Mode } from '../modes';
import { drawBeatRings } from './beatRings';
import { drawDream } from './dream';
import { drawHeardWords } from './words';
import { ctx, sceneCanvas } from './canvases';
import { backgroundGradient } from './color';
import { composite } from './compositor';
import { applyLookEffects } from './lookEffects';
import { drawMashup } from './mashup';

/** Camera shake on the beat, the hand-held jitter of some looks, and phone motion. */
function moveCamera(moving: boolean): void {
  const { width, height, cx, cy } = view;
  let shakeX = 0;
  let shakeY = 0;
  if (audio.beat > 0.05) {
    const k = audio.beat * audio.beat * 4;
    shakeX += (Math.random() - 0.5) * k;
    shakeY += (Math.random() - 0.5) * k;
  }
  const jitter = scene.look.jitter;
  if (jitter) {
    ctx.translate(cx, cy);
    ctx.rotate((Math.random() - 0.5) * 0.02 * jitter);
    ctx.translate(-cx, -cy);
    shakeX += (Math.random() - 0.5) * 5 * jitter;
    shakeY += (Math.random() - 0.5) * 5 * jitter;
  }
  ctx.translate(shakeX, shakeY);
  if (moving) {
    ctx.translate(cx, cy);
    ctx.rotate(motion.tiltX * 0.12 + motion.spin * 0.3);
    const z = 1 + motion.shake * 0.2;
    ctx.scale(z, z);
    ctx.translate(-cx + motion.tiltX * width * 0.1, -cy + motion.tiltY * height * 0.1);
  }
}

/** Feedback, fade and one mode on the scene canvas; beat rings too when `rings`. */
export function drawMode(mode: Mode, dt: number, rings: boolean): void {
  const { width, height, cx, cy } = view;
  const k60 = Math.min(3, dt * 60);
  const moving = motionIsActive();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;

  // Tilt pushes the last frame along, so the whole image streams and swirls.
  if (moving && mode.fade < 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(motion.spin * 0.06 + motion.tiltX * 0.03);
    const z = 1 + motion.shake * 0.08 + motion.twist * 0.03;
    ctx.scale(z, z);
    ctx.translate(-cx + motion.tiltX * width * 0.06, -cy + motion.tiltY * height * 0.06);
    ctx.drawImage(sceneCanvas, 0, 0, width, height);
    ctx.restore();
  }

  // Feedback: the last frame, zoomed and turned a little.
  const zoom = mode.zoom ?? 1;
  const rotate = mode.rotate ?? 0;
  if (zoom !== 1 || rotate) {
    const z = 1 + (zoom - 1 + audio.bass * 0.02 + audio.beat * 0.03) * k60;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(z, z);
    ctx.rotate(rotate * (1 + audio.mid * 3) * k60);
    ctx.drawImage(sceneCanvas, -cx, -cy, width, height);
    ctx.restore();
  }

  // Fade the last frame toward the background. The same trail length at any frame rate.
  const fade =
    mode.fade >= 1
      ? 1
      : 1 -
        Math.pow(
          1 - Math.min(0.6, mode.fade + (moving ? motion.shake * 0.2 + motion.twist * 0.08 : 0)),
          dt * 60,
        );
  ctx.globalAlpha = fade;
  ctx.fillStyle = backgroundGradient(ctx);
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;

  ctx.save();
  moveCamera(moving);
  ctx.globalCompositeOperation = mode.blend || scene.palette.blend;
  mode.draw(dt);
  if (rings && mode.beatRings !== false) drawBeatRings(dt);
  ctx.restore();
}

export function renderFrame(mode: Mode, dt: number): void {
  if (scene.look.mashup) drawMashup(mode, dt, drawMode);
  else drawMode(mode, dt, true);

  ctx.save();
  moveCamera(motionIsActive());
  drawDream();
  drawHeardWords(dt);
  ctx.restore();

  applyLookEffects();
  composite(mode, dt);
}
