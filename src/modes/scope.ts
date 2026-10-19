/** Oscilloscope: a Lissajous figure modulated by the waveform, plus an X/Y trace. */
import { rndInt, TAU } from '../core/math';
import { waveAt } from '../core/signal';
import { audio, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { pathPoint } from '../render/shapes';
import type { Mode } from './mode';

/** Lissajous frequency ratio a:b and phase. */
let ratioA = 3;
let ratioB = 2;
let phase = 0;

export const scope: Mode = {
  name: 'scope',
  fade: 0.18,
  zoom: 1.004,
  rotate: 0.002,
  palettes: ['phosphor', 'deep sea', 'blueprint', 'void'],

  beat() {
    if (Math.random() < 0.5) {
      ratioA = 1 + rndInt(5);
      ratioB = 1 + rndInt(5);
      if (ratioA === ratioB) ratioB++;
    }
  },

  draw(dt) {
    const { cx, cy, min } = view;
    phase += dt * (0.4 + audio.mid);
    const R = min * 0.38;
    const points = 600;
    ctx.lineWidth = 1.5 + audio.bass * 3;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color(0, 0.9, 70);
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const t = (i / points) * TAU;
      const r = R * (1 + waveAt(i / points) * 0.35 * (0.5 + audio.mid));
      pathPoint(
        ctx,
        i,
        cx + Math.sin(ratioA * t + phase) * r,
        cy + Math.sin(ratioB * t) * r * 0.75,
      );
    }
    ctx.stroke();

    // X/Y trace: the waveform against itself a quarter buffer later.
    const wave = audio.wave;
    const offset = Math.floor(wave.length / 4);
    ctx.strokeStyle = color(2, 0.7, 80);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < wave.length - offset; i += 4) {
      const x = cx + ((wave[i] - 128) / 128) * R * 1.1;
      const y = cy + ((wave[i + offset] - 128) / 128) * R * 0.8;
      pathPoint(ctx, i, x, y);
    }
    ctx.stroke();
  },
};
