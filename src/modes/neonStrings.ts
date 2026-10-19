/**
 * Neon string art (the "times table" circle). Points sit on a circle, and a glowing
 * string joins point i to point i × k. As k glides, the strings fold into a cardioid
 * (k = 2), a nephroid (k = 3) and ever more knotted roses; k never stops drifting, so
 * the envelopes keep turning inside out. A smaller, counter-turning circle does the
 * same with another k. Beats send k to a new value; each colour group of strings glows
 * with its part of the spectrum.
 */
import { pick, TAU } from '../core/math';
import { spectrumAt } from '../core/signal';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { neonStroke } from '../render/neon';
import { quality } from '../render/quality';
import { fillCircle } from '../render/shapes';
import type { Mode } from './mode';

/** Multipliers with striking shapes. */
const MULTIPLIERS = [2, 3, 4, 5, 7, 9, 11, 13, 17, 21, 26, 34, 51, 68, 99];
const GROUPS = 4;

let k = 2;
let target = 2;
let turn = 0;

function drawCircle(
  radius: number,
  multiplier: number,
  spin: number,
  points: number,
  alpha: number,
  shift: number,
): void {
  const { cx, cy } = view;
  for (let g = 0; g < GROUPS; g++) {
    ctx.beginPath();
    for (let i = g; i < points; i += GROUPS) {
      const a = (i / points) * TAU + spin;
      const b = ((i * multiplier) / points) * TAU + spin;
      ctx.moveTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.lineTo(cx + Math.cos(b) * radius, cy + Math.sin(b) * radius);
    }
    const level = spectrumAt((g + 0.5) / GROUPS, 0.5, 1.3);
    neonStroke(
      ctx,
      g * 0.9 + shift + clock.time * 0.1,
      0.6 + level * 1.1,
      alpha * (0.2 + level * 0.45),
    );
  }
}

export const neonStrings: Mode = {
  name: 'neon-strings',
  fade: 0.55,
  zoom: 1.002,
  beatRings: false,
  palettes: ['neon', 'vapor', 'ultraviolet', 'acid', 'void', 'deep sea', 'technicolor'],

  beat() {
    if (Math.random() < 0.6) target = pick(MULTIPLIERS, target);
  },

  draw(dt) {
    const { cx, cy, min } = view;
    const points = quality.level === 2 ? 200 : 140;
    k += (target - k) * Math.min(1, dt * 0.9);
    k += dt * (0.02 + audio.mid * 0.06);
    turn += dt * (0.08 + audio.mid * 0.3);
    const radius = min * 0.43 * (1 + audio.bass * 0.06 + audio.beat * 0.03);
    ctx.lineCap = 'round';

    drawCircle(radius, k, turn, points, 1, 0);
    drawCircle(radius * 0.52, k * 0.5 + 1, -turn * 1.7, Math.round(points * 0.6), 0.6, 2);

    // Glowing nails around the big circle.
    for (let i = 0; i < points; i += 4) {
      const a = (i / points) * TAU + turn;
      const v = spectrumAt(i / points, 0.5, 1.3);
      ctx.fillStyle = color(i * 0.02, 0.5 + v * 0.5, 90);
      fillCircle(ctx, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, 1 + v * 3);
    }
  },
};
