/** Stacked ridge lines of the spectrum history, like the famous album cover. */
import { audio, view } from '../core/state';
import { ctx } from '../render/canvases';
import { background, color } from '../render/color';
import { pathPoint } from '../render/shapes';
import type { Mode } from './mode';
import { HISTORY_POINTS, HISTORY_ROWS, recordSpectrum, spectrumHistory } from './spectrumHistory';

export const ridges: Mode = {
  name: 'ridges',
  fade: 1,
  blend: 'source-over',
  beatRings: false,

  draw(dt) {
    recordSpectrum(dt);
    const { width, height } = view;
    const gap = (height * 0.8) / HISTORY_ROWS;
    const top = height * 0.1;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    for (let r = spectrumHistory.length - 1; r >= 0; r--) {
      const row = spectrumHistory[r];
      const y = top + (HISTORY_ROWS - r) * gap;
      const amplitude = gap * 4 * (0.5 + audio.bass);
      ctx.beginPath();
      // The row runs mirrored: high to low frequencies, then low to high.
      for (let i = 0; i <= HISTORY_POINTS * 2; i++) {
        const j = Math.min(
          HISTORY_POINTS - 1,
          i < HISTORY_POINTS ? HISTORY_POINTS - 1 - i : i - HISTORY_POINTS,
        );
        const t = i / (HISTORY_POINTS * 2);
        const envelope = Math.pow(Math.sin(t * Math.PI), 1.5);
        pathPoint(ctx, i, width * 0.05 + t * width * 0.9, y - row[j] * amplitude * envelope);
      }
      ctx.lineTo(width * 0.95, y + gap);
      ctx.lineTo(width * 0.05, y + gap);
      ctx.closePath();
      ctx.fillStyle = background(1);
      ctx.fill();
      ctx.strokeStyle = color((r / HISTORY_ROWS) * 3, 1, 60);
      ctx.stroke();
    }
  },
};
