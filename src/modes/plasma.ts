/** Classic demo-scene plasma: four sine fields added together. */
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import type { Mode } from './mode';

export const plasma: Mode = {
  name: 'plasma',
  fade: 1,
  bloom: 0.25,
  blend: 'source-over',
  beatRings: false,
  palettes: ['acid', 'lava', 'ultraviolet', 'vapor', 'toxic'],

  draw() {
    const { width, height, cx, cy } = view;
    const cell = Math.max(10, Math.sqrt((width * height) / 2000));
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);
    const t = clock.time * (0.6 + audio.bass * 1.2);
    const fx = 0.06 + audio.mid * 0.05;
    const fr = 0.02 + audio.high * 0.03;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i * cell;
        const y = j * cell;
        const v =
          (Math.sin(x * fx + t) +
            Math.sin(y * 0.045 - t * 0.7) +
            Math.sin((x + y) * 0.035 + t * 0.5) +
            Math.sin(Math.hypot(x - cx, y - cy) * fr - t * 1.5) +
            4) /
          8;
        ctx.fillStyle = color(v * 4, 1, 35 + v * 50);
        ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
      }
    }
  },
};
