/** Datamosh: blocks of the last frame are copied sideways, smearing everything. */
import { spectrumAt } from '../core/signal';
import { audio, clock, motion, view } from '../core/state';
import { ctx, snapshot, takeSnapshot } from '../render/canvases';
import { color } from '../render/color';
import { polygonPath } from '../render/shapes';
import type { Mode } from './mode';

export const mosh: Mode = {
  name: 'mosh',
  fade: 0.02,
  blend: 'source-over',
  palettes: ['neon', 'acid', 'vapor', 'hazard', 'paper'],

  draw() {
    const { width, height, cx, cy, min, dpr } = view;
    const time = clock.time;
    takeSnapshot();
    ctx.globalCompositeOperation = 'source-over';
    const block = Math.max(16, Math.round(min / 22));
    const moves = Math.floor(4 + audio.mid * 30 + audio.beat * 40);
    // With motion on, the smear leans toward the tilt.
    const bias = motion.enabled ? motion.tiltX : 0;
    for (let k = 0; k < moves; k++) {
      const sx = Math.floor((Math.random() * width) / block) * block;
      const sy = Math.floor((Math.random() * height) / block) * block;
      const dir = Math.random() < 0.5 + bias * 0.4 ? 1 : -1;
      const dx = sx + dir * block * (1 + Math.floor(Math.random() * 3));
      const dy = sy + (Math.random() < 0.3 ? block * (Math.random() < 0.5 ? 1 : -1) : 0);
      ctx.drawImage(snapshot, sx * dpr, sy * dpr, block * dpr, block * dpr, dx, dy, block, block);
    }

    // A spinning pentagon that keeps feeding new colour into the smear.
    ctx.save();
    ctx.translate(
      cx + Math.sin(time * 0.7) * width * 0.25,
      cy + Math.cos(time * 0.5) * height * 0.2,
    );
    ctx.rotate(time);
    ctx.fillStyle = color(time * 0.5, 0.9, 60);
    polygonPath(ctx, 5, min * (0.12 + audio.bass * 0.25));
    ctx.fill();
    ctx.restore();

    // Spectrum bars along the left edge.
    for (let i = 0; i < 8; i++) {
      const v = spectrumAt(i / 8, 0.4, 1.5);
      if (v < 0.2) continue;
      ctx.fillStyle = color(i * 0.5, v, 55);
      ctx.fillRect(0, (i * height) / 8, block * v * 3, height / 8);
    }
  },
};
