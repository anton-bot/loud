/** A classic segmented spectrum analyser with falling peak caps. */
import { spectrumAt } from '../core/signal';
import { scene, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import type { Mode } from './mode';

const SEGMENTS = 14;
let peaks: Float32Array | null = null;

export const bars: Mode = {
  name: 'bars',
  fade: 1,
  bloom: 0.55,
  blend: 'source-over',
  beatRings: false,

  resize() {
    peaks = null;
  },

  draw(dt) {
    const { width, height } = view;
    const count = width > height ? 32 : 20;
    const gap = Math.max(3, width * 0.008);
    const barWidth = (width - gap * (count + 1)) / count;
    const segmentHeight = (height * 0.72) / SEGMENTS;
    const base = height * 0.88;
    if (!peaks || peaks.length !== count) peaks = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const lit = Math.round(spectrumAt(i / count, 0.5, 1.8) * SEGMENTS);
      peaks[i] = Math.max(peaks[i] - dt * 6, lit);
      const x = gap + i * (barWidth + gap);
      for (let s = 0; s < SEGMENTS; s++) {
        const y = base - (s + 1) * segmentHeight;
        const k = (s / SEGMENTS) * 3;
        ctx.fillStyle =
          s < lit
            ? color(k, 1, 55 + (s / SEGMENTS) * 30)
            : color(k, scene.palette.light ? 0.12 : 0.08);
        ctx.fillRect(x, y + 2, barWidth, segmentHeight - 4);
      }
      ctx.fillStyle = color(3, 1, 90);
      ctx.fillRect(x, base - Math.ceil(peaks[i]) * segmentHeight - 3, barWidth, 3);
    }
  },
};
