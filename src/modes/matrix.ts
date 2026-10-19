/** Digital rain: columns of glyphs fall at their own speed; beats restart some columns. */
import { rnd, rndInt } from '../core/math';
import { audio, view } from '../core/state';
import { ctx } from '../render/canvases';
import { background, color } from '../render/color';
import { MONOSPACE } from './fonts';
import type { Mode } from './mode';

interface Column {
  /** Head position in rows. */
  y: number;
  speed: number;
  length: number;
  /** Last row drawn. */
  last: number;
}

let columns: Column[] = [];
let cell = 14;
let glyphs = '0123456789';
/** Whether the font has the half-width katakana; checked once. */
let hasKatakana: boolean | null = null;

function setUp(): void {
  cell = Math.max(14, Math.round(view.min / 26));
  ctx.font = `${cell}px ${MONOSPACE}`;
  if (hasKatakana === null) {
    // A font without the glyphs draws them as boxes as wide as private-use characters.
    hasKatakana = Math.abs(ctx.measureText('ｱｲｳｴｵ').width - ctx.measureText('').width) > 1;
  }
  glyphs = '0123456789:・"=*+<>¦|Z';
  if (hasKatakana) for (let c = 0xff71; c <= 0xff9d; c++) glyphs += String.fromCharCode(c);
  columns = [];
  const count = Math.ceil(view.width / cell);
  for (let i = 0; i < count; i++)
    columns.push({ y: -Math.random() * 60, speed: rnd(6, 22), length: rnd(8, 30), last: -1 });
}

/** Draws a random glyph centred at (x, y). Katakana are mirrored, as in the film. */
function drawGlyph(x: number, y: number): void {
  const char = glyphs[rndInt(glyphs.length)];
  if (char.charCodeAt(0) > 0x3000) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.fillText(char, 0, 0);
    ctx.restore();
  } else ctx.fillText(char, x, y);
}

/** Paints over one cell and draws a new glyph in it. */
function redrawCell(col: number, row: number, glyphColor: string): void {
  ctx.fillStyle = background(1);
  ctx.fillRect(col * cell, row * cell, cell, cell);
  ctx.fillStyle = glyphColor;
  drawGlyph(col * cell + cell / 2, row * cell + cell / 2);
}

export const matrix: Mode = {
  name: 'matrix',
  fade: 0.045,
  blend: 'source-over',
  beatRings: false,
  palettes: ['phosphor', 'phosphor', 'phosphor', 'toxic', 'mono', 'noir'],

  beat() {
    const count = Math.floor(columns.length * (0.08 + audio.bass * 0.35));
    for (let i = 0; i < count; i++) {
      const c = columns[rndInt(columns.length)];
      if (c && c.y > c.length * 0.5) {
        c.y = -rnd(0, 6);
        c.speed = rnd(8, 26);
        c.length = rnd(8, 30);
        c.last = -1;
      }
    }
  },

  resize() {
    columns = [];
  },

  draw(dt) {
    if (!columns.length) setUp();
    const rows = Math.ceil(view.height / cell) + 1;
    const speed = 0.45 + audio.mid * 1.4 + audio.beat * 0.5;
    ctx.font = `${cell}px ${MONOSPACE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < columns.length; i++) {
      const c = columns[i];
      c.y += c.speed * speed * dt;
      const row = Math.floor(c.y);
      if (row !== c.last) {
        // The trail behind the head, then the bright head itself.
        for (let r = Math.max(c.last, row - 3); r < row; r++) {
          if (r < 0 || r > rows) continue;
          redrawCell(i, r, color(0, 0.95, 60));
        }
        c.last = row;
        if (row >= 0 && row <= rows) {
          ctx.fillStyle = color(1, 1, 95);
          drawGlyph(i * cell + cell / 2, row * cell + cell / 2);
        }
      }
      if (c.y - c.length > rows) {
        c.y = -rnd(0, 40);
        c.speed = rnd(6, 22);
        c.length = rnd(8, 30);
        c.last = -1;
      }
    }

    // Treble flickers glyphs inside the trails.
    const flickers = Math.floor(audio.high * columns.length * 0.5);
    for (let n = 0; n < flickers; n++) {
      const i = rndInt(columns.length);
      const c = columns[i];
      const r = Math.floor(c.y - 1 - Math.random() * c.length * 0.7);
      if (r < 0 || r > rows) continue;
      redrawCell(i, r, color(0, 0.8, 68));
    }
  },
};
