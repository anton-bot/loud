/** A ring of spectrum spokes around a waveform circle. */
import { TAU } from '../core/math';
import { spectrumAt, waveAt } from '../core/signal';
import { audio, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { fillCircle, pathPoint } from '../render/shapes';
import type { Mode } from './mode';

const SPOKES = 112;
let angle = 0;

export const halo: Mode = {
  name: 'halo',
  fade: 0.28,

  draw(dt) {
    const { cx, cy, min } = view;
    angle += dt * (0.15 + audio.mid * 1.2);
    const half = SPOKES / 2;
    const innerR = min * 0.15 * (1 + audio.bass * 0.6 + audio.beat * 0.2);
    const maxLength = min * 0.42;

    // Spokes: the spectrum runs up one side and back down the other.
    ctx.lineCap = 'round';
    for (let i = 0; i < SPOKES; i++) {
      const j = i < half ? i : SPOKES - 1 - i;
      const v = spectrumAt(j / half, 0.45, 1.7);
      const length = 4 + v * v * maxLength;
      const a = angle + (i / SPOKES) * TAU;
      ctx.strokeStyle = color((j / half) * 5, 0.9, 45 + v * 35);
      ctx.lineWidth = 2.5 + v * 7;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR);
      ctx.lineTo(cx + Math.cos(a) * (innerR + length), cy + Math.sin(a) * (innerR + length));
      ctx.stroke();
    }

    // The waveform bent into a circle.
    ctx.beginPath();
    for (let i = 0; i < 200; i++) {
      const a = (i / 200) * TAU - angle * 0.5;
      const r = innerR * 0.8 + waveAt(i / 200) * innerR * 0.6;
      pathPoint(ctx, i, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.strokeStyle = color(4.5, 0.9, 78);
    ctx.lineWidth = 2;
    ctx.stroke();

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR * 0.7);
    glow.addColorStop(0, color(1.5, 0.5 + audio.beat * 0.5, 85));
    glow.addColorStop(1, color(1.5, 0, 85));
    ctx.fillStyle = glow;
    fillCircle(ctx, cx, cy, innerR * 0.7);
  },
};
