/** Vertical strings that vibrate with the waveform, one per frequency band. */
import { spectrumAt } from '../core/signal';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle, pathPoint } from '../render/shapes';
import type { Mode } from './mode';

export const strings: Mode = {
  name: 'strings',
  fade: 0.25,

  draw() {
    const { width, height } = view;
    const wave = audio.wave;
    const count = width > height ? 12 : 8;
    const spacing = width / (count + 1);
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = spacing * (i + 1);
      const v = spectrumAt(i / count, 0.3, 1.5);
      const amplitude = spacing * 0.45 * v * (1 + audio.beat * 0.5);
      // Each string reads its own stretch of the waveform.
      const offset = Math.floor((i / count) * wave.length * 0.5);
      ctx.strokeStyle = color(i * 0.5, 0.9, 55 + v * 35);
      ctx.lineWidth = 1.5 + v * 5;
      ctx.beginPath();
      for (let j = 0; j <= 80; j++) {
        const t = j / 80;
        const w = (wave[(offset + Math.floor(t * wave.length * 0.5)) % wave.length] - 128) / 128;
        pathPoint(ctx, j, x + w * amplitude * Math.sin(t * Math.PI), t * height);
      }
      ctx.stroke();
      ctx.fillStyle = color(i * 0.5 + 2, 0.9, 80);
      fillCircle(ctx, x, height * 0.5 + Math.sin(clock.time * 2 + i) * height * 0.3 * v, 3 + v * 8);
    }
  },
};
