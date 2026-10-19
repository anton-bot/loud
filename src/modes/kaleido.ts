/** The waveform drawn in eight mirrored segments. */
import { TAU } from '../core/math';
import { spectrumAt, waveAt } from '../core/signal';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle, pathPoint } from '../render/shapes';
import type { Mode } from './mode';

const SEGMENTS = 8;
const POINTS = 110;

export const kaleido: Mode = {
  name: 'kaleido',
  fade: 0.12,
  zoom: 1.006,
  rotate: 0.01,

  draw() {
    const { width, height, cx, cy } = view;
    const length = Math.max(width, height) * 0.6;
    const waveHeight = 60 + audio.mid * 220;
    ctx.lineWidth = 2 + audio.bass * 4;
    ctx.lineJoin = 'round';
    for (let s = 0; s < SEGMENTS; s++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((s / SEGMENTS) * TAU + clock.time * 0.2);
      if (s % 2) ctx.scale(1, -1);

      ctx.beginPath();
      for (let i = 0; i <= POINTS; i++) {
        const t = i / POINTS;
        const y = waveAt(t) * waveHeight + Math.sin(t * 10 + clock.time * 4) * audio.high * 40;
        pathPoint(ctx, i, t * length, y);
      }
      ctx.strokeStyle = color(s * 0.55, 0.85, 65);
      ctx.stroke();

      // Beads on the line where the spectrum is loud.
      for (let i = 2; i < POINTS; i += 9) {
        const t = i / POINTS;
        const v = spectrumAt(t, 0.3);
        if (v < 0.15) continue;
        ctx.fillStyle = color(4.5 + s * 0.55, v, 70);
        fillCircle(ctx, t * length, waveAt(t) * waveHeight, 2 + v * 9);
      }
      ctx.restore();
    }
  },
};
