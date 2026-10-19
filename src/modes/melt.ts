/** Liquid feedback: the last frame drips down in wavy strips; blobs and the waveform feed it. */
import { waveAt } from '../core/signal';
import { audio, clock, scene, view } from '../core/state';
import { ctx, drawStrip, snapshot, takeSnapshot } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle, pathPoint } from '../render/shapes';
import type { Mode } from './mode';

export const melt: Mode = {
  name: 'melt',
  fade: 0.03,
  palettes: ['acid', 'lava', 'vapor', 'candy', 'neon'],

  draw() {
    const { width, height, min } = view;
    const time = clock.time;

    takeSnapshot();
    ctx.globalCompositeOperation = 'source-over';
    const strip = 8;
    const amplitude = 6 + audio.bass * 40;
    const f = 0.012 + audio.mid * 0.01;
    const t = time * 2;
    const drift = 1 + audio.bass * 3;
    for (let y = 0; y < height; y += strip) {
      const dx = Math.sin(y * f + t) * amplitude + Math.sin(y * 0.03 - t * 0.6) * amplitude * 0.4;
      drawStrip(snapshot, y, strip, dx, y + drift);
    }
    ctx.globalCompositeOperation = scene.palette.blend;

    const count = 1 + Math.floor(audio.mid * 4);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.4;
      const r = min * (0.02 + audio.bass * 0.08) * (0.3 + Math.random());
      const k = Math.random() * 4;
      const blob = ctx.createRadialGradient(x, y, 0, x, y, r);
      blob.addColorStop(0, color(k, 1, 80));
      blob.addColorStop(1, color(k, 0, 50));
      ctx.fillStyle = blob;
      fillCircle(ctx, x, y, r);
    }

    ctx.lineWidth = 3 + audio.bass * 6;
    ctx.strokeStyle = color(time * 0.3, 0.9, 65);
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      pathPoint(ctx, i, t * width, height * 0.25 + waveAt(t) * height * 0.2 * (0.5 + audio.mid));
    }
    ctx.stroke();
  },
};
