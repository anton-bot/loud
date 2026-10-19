/** ASCII art: a character ramp from dark to bright, rings of frequencies from the centre. */
import { clamp } from '../core/math';
import { spectrumAt, waveAt } from '../core/signal';
import { view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { MONOSPACE } from './fonts';
import type { Mode } from './mode';

const RAMP = ' .:-=+*#%@';

export const ascii: Mode = {
  name: 'ascii',
  fade: 1,
  blend: 'source-over',
  beatRings: false,
  palettes: ['phosphor', 'void', 'blueprint', 'hazard'],

  draw() {
    const { width, height } = view;
    const cell = Math.max(13, Math.sqrt((width * height) / 1000));
    const lineHeight = cell * 0.9;
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / lineHeight);
    ctx.font = `${cell * 1.1}px ${MONOSPACE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let j = 0; j < rows; j++) {
      const w = waveAt(j / rows);
      for (let i = 0; i < cols; i++) {
        const dx = i - cols / 2;
        const dy = (j - rows / 2) * 1.1;
        const d = Math.hypot(dx, dy) / Math.hypot(cols / 2, rows / 2);
        const v = clamp(spectrumAt(d, 0.35) + Math.abs(w) * 0.5 * (1 - d), 0, 1);
        const char = RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))];
        if (char === ' ') continue;
        ctx.fillStyle = color(v * 2 + d, 0.5 + v * 0.5, 50 + v * 40);
        ctx.fillText(char, i * cell + cell / 2, j * lineHeight + lineHeight / 2);
      }
    }
  },
};
