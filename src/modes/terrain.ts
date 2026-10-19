/** Synthwave landscape: the spectrum history as mountain ridges under a striped sun. */
import { audio, view } from '../core/state';
import { ctx } from '../render/canvases';
import { background, color } from '../render/color';
import { fillCircle, pathPoint } from '../render/shapes';
import type { Mode } from './mode';
import { HISTORY_POINTS, HISTORY_ROWS, recordSpectrum, spectrumHistory } from './spectrumHistory';

export const terrain: Mode = {
  name: 'terrain',
  fade: 1,
  blend: 'source-over',
  beatRings: false,
  palettes: ['sunset', 'neon', 'wine', 'deep sea'],

  draw(dt) {
    recordSpectrum(dt);
    const { width, height, cx, min } = view;
    const horizon = height * 0.45;

    // Sun with dark stripes across its lower half.
    const sunR = min * (0.12 + audio.bass * 0.08);
    const sun = ctx.createRadialGradient(cx, horizon, 0, cx, horizon, sunR);
    sun.addColorStop(0, color(0, 1, 85));
    sun.addColorStop(1, color(1, 0.9, 55));
    ctx.fillStyle = sun;
    fillCircle(ctx, cx, horizon, sunR);
    ctx.fillStyle = background(1);
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(
        cx - sunR,
        horizon + sunR * 0.15 + i * sunR * 0.17,
        2 * sunR,
        2 + sunR * 0.05 * (1 + i * 0.5) * audio.mid,
      );
    }

    // Ridges, far to near. Each one is filled with the background to hide the ones behind it.
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    for (let r = spectrumHistory.length - 1; r >= 0; r--) {
      const row = spectrumHistory[r];
      const z = (r + 0.5) / HISTORY_ROWS;
      const y = horizon + (height - horizon) * Math.pow(1 - z, 1.8);
      const rowWidth = width * 1.6 * (0.25 + 0.75 * (1 - z));
      const x0 = cx - rowWidth / 2;
      const amplitude = (height - horizon) * 0.5 * (1 - z) * (0.6 + audio.bass * 0.6);
      ctx.beginPath();
      for (let i = 0; i < HISTORY_POINTS; i++) {
        const t = i / (HISTORY_POINTS - 1);
        pathPoint(
          ctx,
          i,
          x0 + t * rowWidth,
          y - row[i] * amplitude * (0.3 + 0.7 * Math.sin(t * Math.PI)),
        );
      }
      ctx.lineTo(x0 + rowWidth, y + 2);
      ctx.lineTo(x0, y + 2);
      ctx.closePath();
      ctx.fillStyle = background(0.92);
      ctx.fill();
      ctx.strokeStyle = color(2 + z * 2, 0.9, 60 + (1 - z) * 20);
      ctx.stroke();
    }

    // Floor lines that run to the horizon.
    ctx.strokeStyle = color(3, 0.35, 60);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      ctx.moveTo(cx + (t - 0.5) * width * 1.6, height);
      ctx.lineTo(cx + (t - 0.5) * width * 0.25, horizon);
    }
    ctx.stroke();
  },
};
