/**
 * A tree that grows in real time. Branches sprout level by level (faster with the mids,
 * in spurts on beats) up to 11 levels and about two thousand tips, which blossom with
 * the treble. The thin branches sway more in the wind than the trunk. When the tree is
 * full grown it stands for a moment, then a new tree grows while the old one fades.
 *
 * The branches are collected per level and drawn with one stroke per level, so even
 * thousands of branches stay fast.
 */
import { clamp, hash01, TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import type { Mode } from './mode';

const LEVELS = 11;
/** Upper limit of branches per frame. */
const MAX_BRANCHES = 5000;
/** Levels of growth per second, and how long a full tree stands before the next one. */
const GROWTH_SPEED = 0.9;
const STAND_LEVELS = 4;

let treeSeed = 1;
/** Grown levels: 2.5 means two levels are complete and the third is half grown. */
let growth = 0;
/** Branch segments per level, as x1, y1, x2, y2. */
const segments: number[][] = Array.from({ length: LEVELS }, () => []);
const tips: number[] = [];

export const tree: Mode = {
  name: 'tree',
  fade: 0.3,
  palettes: ['forest', 'mushroom', 'paper', 'toxic', 'sunset', 'technicolor'],

  beat() {
    growth += 0.4 + audio.bass * 0.4;
  },

  draw(dt) {
    const { height, cx, min } = view;
    const time = clock.time;
    growth += dt * GROWTH_SPEED * (0.8 + audio.mid * 1.5);
    if (growth > LEVELS + STAND_LEVELS) {
      treeSeed = hash01(treeSeed * 7.13 + time) * 1000;
      growth = 0;
    }
    const spread = 0.38 + audio.mid * 0.3 + Math.sin(time * 0.3) * 0.08;
    for (const list of segments) list.length = 0;
    tips.length = 0;
    let branches = 0;

    function branch(
      x: number,
      y: number,
      length: number,
      angle: number,
      level: number,
      seed: number,
    ): void {
      if (level >= LEVELS || branches++ > MAX_BRANCHES) return;
      const grown = clamp(growth - level, 0, 1);
      if (grown <= 0) return;
      // Wind: the higher the level, the more it sways.
      const sway = Math.sin(time * 1.3 + level * 0.4 + seed) * 0.03 * level * (0.4 + audio.mid);
      const a = angle + sway;
      const x2 = x + Math.cos(a) * length * grown;
      const y2 = y + Math.sin(a) * length * grown;
      segments[level].push(x, y, x2, y2);
      if (grown < 1) return;
      if (level >= LEVELS - 2) tips.push(x2, y2);
      const r1 = hash01(seed * 12.9898);
      const r2 = hash01(seed * 78.233);
      branch(
        x2,
        y2,
        length * (0.68 + r1 * 0.12),
        a - spread * (0.7 + r2 * 0.6),
        level + 1,
        seed * 1.7 + 1,
      );
      branch(
        x2,
        y2,
        length * (0.68 + r2 * 0.12),
        a + spread * (0.7 + r1 * 0.6),
        level + 1,
        seed * 2.3 + 2,
      );
      if (level < LEVELS - 3 && r1 > 0.55)
        branch(x2, y2, length * 0.55, a + sway * 2, level + 2, seed * 3.1 + 3);
    }

    branch(cx, height, min * 0.24 * (1 + audio.bass * 0.15), -Math.PI / 2, 0, treeSeed);

    ctx.lineCap = 'round';
    segments.forEach((list, level) => {
      if (!list.length) return;
      ctx.beginPath();
      for (let i = 0; i < list.length; i += 4) {
        ctx.moveTo(list[i], list[i + 1]);
        ctx.lineTo(list[i + 2], list[i + 3]);
      }
      ctx.strokeStyle = color(level * 0.45 + time * 0.2, 0.9, 40 + level * 4);
      ctx.lineWidth = Math.max(0.8, Math.pow(LEVELS - level, 1.5) * 0.35 * (1 + audio.bass * 0.5));
      ctx.stroke();
    });

    // Blossoms on the tips.
    const bloom = 1.2 + audio.high * 4 + audio.beat * 1.5;
    ctx.fillStyle = color(3 + time * 0.2, 0.85, 80);
    ctx.beginPath();
    for (let i = 0; i < tips.length; i += 2) {
      ctx.moveTo(tips[i] + bloom, tips[i + 1]);
      ctx.arc(tips[i], tips[i + 1], bloom, 0, TAU);
    }
    ctx.fill();
  },
};
