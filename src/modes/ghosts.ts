/**
 * Motion ghosts: the camera looks at the room, still things go dark, and only what
 * moves leaves glowing trails in colours that turn with the beat. Trails last longer
 * when the music is loud. When nothing has moved for a moment, an indicator in the
 * picture itself (so it shows in full screen, with no buttons) asks to move the
 * camera. Without a camera it watches its own dancers and says so.
 */
import { context2d } from '../core/dom';
import { TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { cameraState, cameraVideo } from '../input/camera';
import { ctx } from '../render/canvases';
import { color, colorRgb } from '../render/color';
import { neonStroke } from '../render/neon';
import { PixelLayer } from '../render/pixelLayer';
import { FACES } from '../render/words/show';
import { drawDancers } from './dancers';
import type { Mode } from './mode';

const W = 160;
/** A pixel counts as moving above this change (sum of red, green and blue). */
const THRESHOLD = 40;
/** Seconds of stillness before the indicator shows. */
const STILL_S = 1.2;

const source = document.createElement('canvas');
const sourceCtx = context2d(source, { willReadFrequently: true });
const layer = new PixelLayer();
let trail = new Float32Array(0);
let last: Uint8ClampedArray | null = null;
let still = 0;
let hint = 0;

function setUp(w: number, h: number): void {
  source.width = w;
  source.height = h;
  layer.setSize(w, h);
  trail = new Float32Array(w * h * 3);
  last = null;
}

/** The camera picture, cut to fill the frame. */
function drawCamera(video: HTMLVideoElement, w: number, h: number): void {
  const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
  const dw = video.videoWidth * scale;
  const dh = video.videoHeight * scale;
  sourceCtx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/** Text with a soft glow, in the display face. */
function glowText(text: string, x: number, y: number, size: number, alpha: number): void {
  ctx.font = `700 ${size}px ${FACES[0].family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color(0, alpha, 60);
  ctx.shadowBlur = size * 0.6;
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

/** The indicator: a phone swinging left and right, with motion arcs and a line of text. */
function drawHint(alpha: number, title: string, line: string): void {
  const { cx, cy, min } = view;
  const t = clock.time;
  const w = min * 0.12;
  const h = w * 1.8;
  const swing = Math.sin(t * 3.2) * 0.45;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(0,0,0,${alpha * 0.45})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, min * 0.42, min * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.translate(cx + swing * min * 0.12, cy - min * 0.06);
  ctx.rotate(swing * 0.5);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, w * 0.18);
  neonStroke(ctx, 0, Math.max(1.5, min * 0.006), alpha);
  ctx.beginPath();
  ctx.arc(0, -h * 0.32, w * 0.12, 0, TAU);
  neonStroke(ctx, 1, Math.max(1, min * 0.004), alpha);
  ctx.restore();
  // Motion arcs on both sides.
  ctx.save();
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let k = 1; k <= 3; k++) {
      const pulse = (t * 1.6 + k * 0.33) % 1;
      ctx.beginPath();
      ctx.arc(
        cx,
        cy - min * 0.06,
        min * (0.12 + k * 0.05),
        side > 0 ? -0.5 : Math.PI - 0.5,
        side > 0 ? 0.5 : Math.PI + 0.5,
      );
      neonStroke(ctx, 2, Math.max(1, min * 0.004), alpha * (1 - pulse) * 0.9);
    }
  }
  ctx.restore();
  glowText(title, cx, cy + min * 0.16, min * 0.055, alpha);
  ctx.globalAlpha = 0.8;
  glowText(line, cx, cy + min * 0.23, min * 0.026, alpha * 0.85);
  ctx.globalAlpha = 1;
}

export const ghosts: Mode = {
  name: 'ghosts',
  fade: 1,
  bloom: 0.8,
  blend: 'source-over',
  beatRings: false,
  camera: true,
  palettes: ['void', 'technicolor', 'neon', 'acid', 'vapor', 'ultraviolet'],

  resize() {
    trail = new Float32Array(0);
  },

  draw(dt) {
    const { width, height } = view;
    const h = Math.max(60, Math.round((W * height) / width));
    if (source.width !== W || source.height !== h || !trail.length) setUp(W, h);
    const video = cameraVideo();
    if (video) drawCamera(video, W, h);
    else drawDancers(sourceCtx, W, h);
    const now = sourceCtx.getImageData(0, 0, W, h).data;

    // Trails in a colour that turns with the beat; longer when it is loud.
    const [cr, cg, cb] = colorRgb(clock.time * 0.4 + audio.beats * 0.5, 70);
    const keep = Math.pow(Math.min(0.985, 0.92 + audio.bass * 0.06), dt * 60);
    const out = layer.pixels;
    let moving = 0;
    for (let p = 0, o = 0; p < W * h; p++, o += 4) {
      const k = p * 3;
      trail[k] *= keep;
      trail[k + 1] *= keep;
      trail[k + 2] *= keep;
      if (last) {
        const change =
          Math.abs(now[o] - last[o]) +
          Math.abs(now[o + 1] - last[o + 1]) +
          Math.abs(now[o + 2] - last[o + 2]);
        if (change > THRESHOLD) {
          moving++;
          const f = Math.min(1, change / 160);
          trail[k] = Math.max(trail[k], cr * f);
          trail[k + 1] = Math.max(trail[k + 1], cg * f);
          trail[k + 2] = Math.max(trail[k + 2], cb * f);
        }
      }
      // The room itself stays faint.
      out[o] = now[o] * 0.1 + trail[k];
      out[o + 1] = now[o + 1] * 0.1 + trail[k + 1];
      out[o + 2] = now[o + 2] * 0.1 + trail[k + 2];
      out[o + 3] = 255;
    }
    last = now;
    layer.flush();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer.canvas, 0, 0, width, height);

    // The indicator: drawn in the picture, so it also shows in full screen.
    still = moving / (W * h) < 0.003 ? still + dt : 0;
    const state = cameraState();
    const asking = state === 'asking' || state === 'off';
    const show = asking || still > STILL_S;
    hint += ((show ? 1 : 0) - hint) * Math.min(1, dt * 4);
    if (hint > 0.02) {
      if (asking) drawHint(hint, 'ALLOW THE CAMERA', 'only what moves will glow');
      else drawHint(hint, 'MOVE THE CAMERA', 'or dance in front of it');
    }
    if (!video && !asking) {
      ctx.font = `700 ${Math.max(10, view.min * 0.022)}px ${FACES[0].family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText('NO CAMERA · DEMO DANCERS', view.cx, height - view.min * 0.04);
    }
  },
};
