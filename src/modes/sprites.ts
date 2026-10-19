/** Random symmetric 8-bit critters that walk and blink, over a blocky spectrum floor. */
import { rnd } from '../core/math';
import { spectrumAt } from '../core/signal';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import type { Mode } from './mode';

interface Critter {
  /** Left half of the 9×8 bitmap: 8 rows of 5 cells; the right half is its mirror. */
  bitmap: boolean[][];
  x: number;
  y: number;
  size: number;
  k: number;
  age: number;
  life: number;
  vx: number;
}

const critters: Critter[] = [];

function randomBitmap(): boolean[][] {
  const bitmap: boolean[][] = [];
  for (let y = 0; y < 8; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < 5; x++) row.push(Math.random() < 0.5);
    bitmap.push(row);
  }
  return bitmap;
}

function hatch(): void {
  const count = 1 + Math.floor(audio.bass * 3);
  for (let i = 0; i < count; i++) {
    critters.push({
      bitmap: randomBitmap(),
      x: rnd(0.1, 0.9),
      y: rnd(0.1, 0.8),
      size: rnd(0.5, 1.2),
      k: Math.random() * 4,
      age: 0,
      life: rnd(2, 5),
      vx: rnd(-0.06, 0.06),
    });
  }
  while (critters.length > 14) critters.shift();
}

export const sprites: Mode = {
  name: 'sprites',
  fade: 0.5,
  blend: 'source-over',
  beatRings: false,
  fps: 12,
  palettes: ['hazard', 'phosphor', 'mono', 'void', 'neon', 'noir'],

  beat: hatch,

  draw(dt) {
    const { width, height, min } = view;
    if (!critters.length) hatch();
    // Two-frame walk cycle: the legs (the last two rows) swap sides.
    const walkFrame = Math.floor(clock.time * 4) % 2;
    for (let i = critters.length - 1; i >= 0; i--) {
      const s = critters[i];
      s.age += dt;
      if (s.age > s.life) {
        critters.splice(i, 1);
        continue;
      }
      s.x += s.vx * dt;
      const cell = min * 0.03 * s.size * (1 + audio.bass * 0.4 + audio.beat * 0.3);
      const x0 = s.x * width - cell * 4.5;
      const y0 = s.y * height - cell * 4;
      ctx.fillStyle = color(s.k, Math.min(1, s.life - s.age), 60);
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 9; x++) {
          const bx = x < 5 ? x : 8 - x;
          let on = s.bitmap[y][bx];
          if (walkFrame && y > 5) on = s.bitmap[y][4 - bx];
          if (!on) continue;
          ctx.fillRect(x0 + x * cell, y0 + y * cell, cell - 1, cell - 1);
        }
      }
    }

    const columns = 16;
    const columnWidth = width / columns;
    for (let i = 0; i < columns; i++) {
      const blocks = Math.floor(spectrumAt(i / columns, 0.45, 1.7) * 8);
      for (let k = 0; k < blocks; k++) {
        ctx.fillStyle = color(k * 0.4, 1, 50 + k * 4);
        ctx.fillRect(
          i * columnWidth + 2,
          height - (k + 1) * columnWidth * 0.6,
          columnWidth - 4,
          columnWidth * 0.6 - 3,
        );
      }
    }
  },
};
