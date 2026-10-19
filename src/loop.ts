/** The frame loop: analyse the audio, update the scene, render. */
import { analyze } from './audio/analysis';
import { clamp } from './core/math';
import { clock, scene } from './core/state';
import { updateMotion } from './input/motion';
import { resize } from './render/canvases';
import { trackFrameTime } from './render/quality';
import { renderFrame } from './render/renderer';
import { currentMode, shuffle } from './scene';
import { updateMeter } from './ui/controls';

/** Without music events, the scene changes on its own after this many seconds. */
const AUTO_SWITCH_S = 30;

let last = performance.now();
/** Time since the last drawn frame, for modes and looks with a frame-rate cap. */
let sinceDrawn = 0;

function frame(now: number): void {
  if (trackFrameTime(clamp(now - last, 1, 100))) resize();
  const dt = clamp((now - last) / 1000, 0.001, 0.05);
  last = now;
  clock.time += dt;

  analyze(dt);
  updateMotion(dt);
  updateMeter();
  scene.hue = (scene.hue + dt * 10) % 360;
  if (scene.autoSwitch && clock.time - scene.lastSwitch > AUTO_SWITCH_S) shuffle();

  const mode = currentMode();
  const fps = mode.fps || scene.look.fps || 0;
  sinceDrawn += dt;
  if (!fps || sinceDrawn >= 1 / fps) {
    renderFrame(mode, fps ? sinceDrawn : dt);
    sinceDrawn = 0;
  }
  requestAnimationFrame(frame);
}

export function startLoop(): void {
  requestAnimationFrame(frame);
}
