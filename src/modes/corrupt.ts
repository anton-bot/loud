/** A broken signal: torn strips, stuck blocks, a hex dump of the spectrum and a jumpy trace. */
import { rnd } from '../core/math';
import { bandLevel, waveAt } from '../core/signal';
import { audio, clock, scene, view } from '../core/state';
import { ctx, drawStrip, snapshot, takeSnapshot } from '../render/canvases';
import { color } from '../render/color';
import { pathPoint } from '../render/shapes';
import { MONOSPACE } from './fonts';
import type { Mode } from './mode';

export const corrupt: Mode = {
  name: 'corrupt',
  fade: 0.12,
  palettes: ['hazard', 'noir', 'mono', 'neon', 'blueprint'],

  draw() {
    const { width, height, cy, min } = view;
    const freq = audio.freq;

    takeSnapshot();
    ctx.globalCompositeOperation = 'source-over';
    const tears = 1 + Math.floor(audio.high * 6 + audio.beat * 6);
    for (let i = 0; i < tears; i++) {
      const y = Math.random() * height;
      const h = rnd(4, 40) * (1 + audio.beat * 2);
      const dx = (Math.random() - 0.5) * width * 0.3 * (0.3 + audio.beat);
      drawStrip(snapshot, y, h, dx, y);
    }
    ctx.globalCompositeOperation = scene.palette.blend;

    // Colour bars that flash in random columns.
    const bars = 7;
    const barWidth = width / bars;
    for (let i = 0; i < bars; i++) {
      const v = bandLevel(i % 3);
      if (Math.random() < 0.3) {
        ctx.fillStyle = color(i * 0.6, 0.3 + v * 0.7, 55);
        ctx.fillRect(
          i * barWidth,
          rnd(0, height * 0.6),
          barWidth,
          rnd(height * 0.05, height * 0.4) * v,
        );
      }
    }

    // Stuck blocks.
    const stuck = Math.floor(audio.mid * 40 + audio.beat * 60);
    const block = Math.max(6, min / 60);
    ctx.fillStyle = color(Math.random() * 4, 0.8, 70);
    for (let i = 0; i < stuck; i++) {
      ctx.fillRect(
        Math.floor((Math.random() * width) / block) * block,
        Math.floor((Math.random() * height) / block) * block,
        block,
        block,
      );
    }

    // Hex dump of the spectrum bytes.
    ctx.font = `${Math.max(11, min * 0.028)}px ${MONOSPACE}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color(3, 0.9, 80);
    for (let line = 0; line < 6; line++) {
      let text = '';
      for (let k = 0; k < 12; k++) {
        const byte = freq[(line * 37 + k * 11 + Math.floor(clock.time * 20)) % freq.length];
        text += byte.toString(16).padStart(2, '0') + ' ';
      }
      ctx.fillText(text, 8, height * 0.72 + line * min * 0.032);
    }

    // The waveform, with random jumps.
    ctx.lineWidth = 2 + audio.bass * 4;
    ctx.strokeStyle = color(1, 0.9, 65);
    ctx.beginPath();
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const jump = Math.random() < 0.05 ? rnd(-40, 40) : 0;
      pathPoint(ctx, i, t * width, cy + waveAt(t) * height * 0.25 * (0.5 + audio.mid) + jump);
    }
    ctx.stroke();
  },
};
