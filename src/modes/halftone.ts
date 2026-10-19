/** A halftone dot screen: dot size from the spectrum, rows shifted by the waveform. */
import { spectrumAt, waveAt } from '../core/signal';
import { audio, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle } from '../render/shapes';
import type { Mode } from './mode';

export const halftone: Mode = {
  name: 'halftone',
  fade: 1,
  bloom: 0.45,
  blend: 'source-over',
  beatRings: false,

  draw() {
    const { width, height } = view;
    const cell = Math.max(16, Math.sqrt((width * height) / 1400));
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);
    for (let j = 0; j < rows; j++) {
      const shift = waveAt(j / rows);
      for (let i = 0; i < cols; i++) {
        const v = spectrumAt(i / cols, 0.4, 1.5);
        const x = i * cell + cell / 2;
        const y = j * cell + cell / 2 + shift * cell * 2 * (0.5 + audio.mid);
        ctx.fillStyle = color(v * 3 + j * 0.02, 0.9, 45 + v * 40);
        fillCircle(ctx, x, y, cell * 0.5 * (0.15 + v * 0.95) * (1 + audio.beat * 0.3));
      }
    }
  },
};
