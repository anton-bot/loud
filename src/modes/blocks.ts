/** A flat, poster-like split of the screen into blocks that pulse with the bands. */
import { rnd, rndInt, TAU } from '../core/math';
import { bandLevel } from '../core/signal';
import { view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import type { Mode } from './mode';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Block extends Rect {
  /** 0 bass, 1 mid, 2 high. */
  band: number;
  k: number;
  /** Circle in the middle instead of a square. */
  round: boolean;
}

let tiles: Block[] = [];

/** Splits the screen: again and again, cut the biggest rectangle in two. */
function splitScreen(): void {
  const rects: Rect[] = [{ x: 0, y: 0, w: view.width, h: view.height }];
  const cuts = 6 + rndInt(8);
  for (let n = 0; n < cuts; n++) {
    let biggest = 0;
    for (let j = 1; j < rects.length; j++) {
      if (rects[j].w * rects[j].h > rects[biggest].w * rects[biggest].h) biggest = j;
    }
    const r = rects.splice(biggest, 1)[0];
    const f = rnd(0.3, 0.7);
    if (r.w > r.h) {
      rects.push(
        { x: r.x, y: r.y, w: r.w * f, h: r.h },
        { x: r.x + r.w * f, y: r.y, w: r.w * (1 - f), h: r.h },
      );
    } else {
      rects.push(
        { x: r.x, y: r.y, w: r.w, h: r.h * f },
        { x: r.x, y: r.y + r.h * f, w: r.w, h: r.h * (1 - f) },
      );
    }
  }
  tiles = rects.map((r) => ({ ...r, band: rndInt(3), k: rndInt(4), round: Math.random() < 0.5 }));
}

export const blocks: Mode = {
  name: 'blocks',
  fade: 1,
  bloom: 0.2,
  blend: 'source-over',
  beatRings: false,
  fps: 12,
  palettes: ['paper', 'hazard', 'sand', 'mint', 'slate'],

  beat() {
    if (Math.random() < 0.5) splitScreen();
    else {
      for (const b of tiles) if (Math.random() < 0.3) b.k = (b.k + 1) % 4;
    }
  },

  resize() {
    tiles = [];
  },

  draw() {
    if (!tiles.length) splitScreen();
    const gap = Math.max(4, view.min * 0.012);
    for (const b of tiles) {
      const v = bandLevel(b.band);
      ctx.fillStyle = color(b.k, 0.25 + v * 0.75, 40 + v * 40);
      ctx.fillRect(b.x + gap, b.y + gap, b.w - 2 * gap, b.h - 2 * gap);
      const r = Math.min(b.w, b.h) * 0.3 * v;
      ctx.fillStyle = color(b.k + 2, 0.9, 75);
      ctx.beginPath();
      if (b.round) ctx.arc(b.x + b.w / 2, b.y + b.h / 2, r, 0, TAU);
      else ctx.rect(b.x + b.w / 2 - r, b.y + b.h / 2 - r, 2 * r, 2 * r);
      ctx.fill();
    }
  },
};
