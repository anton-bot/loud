/** A grid of spinning squares; distance from the centre picks the frequency. */
import { TAU } from '../core/math';
import { spectrumAt } from '../core/signal';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import type { Mode } from './mode';

export const grid: Mode = {
  name: 'grid',
  fade: 0.22,
  bloom: 0.7,

  draw() {
    const { width, height } = view;
    const cols = Math.min(40, Math.ceil(width / 44));
    const rows = Math.min(26, Math.ceil(height / 44));
    const cellW = width / cols;
    const cellH = height / rows;
    const maxDistance = Math.hypot(cols, rows) / 2;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const dx = i - cols / 2 + 0.5;
        const dy = j - rows / 2 + 0.5;
        const d = Math.hypot(dx, dy);
        const v = spectrumAt(d / maxDistance, 0.35);
        if (v < 0.12) continue;
        const size = v * v * Math.min(cellW, cellH) * 1.15 * (1 + audio.beat * 0.5);
        ctx.fillStyle = color((Math.atan2(dy, dx) / TAU) * 4 + d * 0.2, v, 40 + v * 40);
        ctx.save();
        ctx.translate(i * cellW + cellW / 2, j * cellH + cellH / 2);
        ctx.rotate(clock.time * 0.5 + d * 0.1 * audio.high * 5);
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      }
    }
  },
};
