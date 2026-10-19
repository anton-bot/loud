/**
 * A glitchy 8-bit platformer. A little hero with headphones runs through a scrolling
 * brick world: it jumps on beats and over pits, stomps glitch-blobs, and hits eye
 * blocks that pop coins. Speaker stacks pump with the bass. The cartridge is not
 * well: rows tear, tiles turn to garbage, the colours invert, the picture rolls,
 * and now and then the hero is suddenly huge.
 * Everything is drawn at a low resolution and scaled up without smoothing.
 */
import { createLayer, setCanvasSize } from '../core/dom';
import { hash01, rnd, rndInt } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { background, color } from '../render/color';
import type { Mode } from './mode';

/** Width of the low-resolution screen, and the tile size, in its pixels. */
const SCREEN_W = 128;
const TILE = 8;

// Sprites, one string per row. A letter is a colour slot (see `paint`), '.' is clear.
// prettier-ignore
const HERO_TOP = [
  '....XXXX....',
  '..XXXXXXXX..',
  '.HXXXXXXXXH.',
  'HHXSSSSSSXHH',
  'HH.SESSES.HH',
  'HH.SSSSSS.HH',
  '...SSMMSS...',
  '....SSSS....',
  '..BBBBBBBB..',
  '.BBBBBBBBBB.',
  '.SBBBBBBBBS.',
  '...BBBBBB...',
];
// prettier-ignore
const HERO_LEGS = [
  ['...LL..LL...', '..FF....FF..'],
  ['....LLLL....', '...FF..FF...'],
  ['..LL....LL..', '.FF......FF.'],
];
// prettier-ignore
const BLOB = [
  '..XXXX..',
  '.XXXXXX.',
  'XXWXXWXX',
  'XXEXXEXX',
  'XXXXXXXX',
  'XXX..XXX',
  '.X.XX.X.',
  'X......X',
];

type Column = { pit: boolean; platform: number; eyeBlock: boolean; speaker: boolean };

interface Coin {
  x: number;
  y: number;
  vy: number;
  life: number;
}

interface Blob {
  x: number;
  squashed: number;
}

const screen = createLayer();
let screenH = 0;
let scroll = 0;
let seed = 1;
const hero = { y: 0, vy: 0, onGround: false, step: 0, giant: 0 };
const coins: Coin[] = [];
let blobs: Blob[] = [];
/** Glitch timers in seconds. */
const glitch = { invert: 0, roll: 0, rollOffset: 0, corrupt: 0 };
/** Eye blocks that were hit: column → time of the hit (they bounce). */
const hitBlocks = new Map<number, number>();

/** The level is a pure function of the column number: it never has to be stored. */
function column(c: number): Column {
  const r = hash01(c * 12.9898 + seed);
  const r2 = hash01(c * 78.233 + seed * 3);
  const block = Math.floor(c / 6);
  const pit = c > 24 && hash01(block * 3.7 + seed) < 0.18 && c % 6 > 1 && c % 6 < 4;
  return {
    pit,
    platform: !pit && r < 0.22 ? 3 + Math.floor(r2 * 3) : 0,
    eyeBlock: !pit && r > 0.86,
    speaker: !pit && hash01(block * 9.1 + seed) > 0.8 && c % 6 === 4,
  };
}

/** The 8-bit colour set, taken from the palette each frame. */
function inks(): Record<string, string> {
  return {
    X: color(0, 1, 45),
    H: color(1, 1, 60),
    S: 'rgb(255,214,170)',
    E: 'rgb(20,20,30)',
    M: 'rgb(150,40,50)',
    B: color(2, 1, 55),
    L: color(3, 1, 35),
    F: 'rgb(40,25,20)',
    W: 'rgb(250,250,250)',
  };
}

function paint(
  g: CanvasRenderingContext2D,
  rows: readonly string[],
  x: number,
  y: number,
  ink: Record<string, string>,
  scale = 1,
  flip = false,
): void {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const slot = row[flip ? row.length - 1 - i : i];
      if (slot === '.') continue;
      g.fillStyle = ink[slot];
      g.fillRect(Math.round(x + i * scale), Math.round(y + j * scale), scale, scale);
    }
  });
}

function brick(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  face: string,
  mortar: string,
): void {
  g.fillStyle = face;
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle = mortar;
  g.fillRect(x, y, TILE, 1);
  g.fillRect(x, y + 4, TILE, 1);
  g.fillRect(x, y + 1, 1, 3);
  g.fillRect(x + 4, y + 5, 1, 3);
}

function drawBackdrop(g: CanvasRenderingContext2D, w: number, h: number): void {
  // Sky in a few hard bands, as on old hardware.
  for (let b = 0; b < 4; b++) {
    g.fillStyle = color(4 + b * 0.25, 1, 32 + b * 8);
    g.fillRect(0, (b * h) / 4, w, h / 4 + 1);
  }
  // Hills and clouds, slower than the ground.
  for (let k = -1; k < 4; k++) {
    const hx = Math.round(k * 70 - ((scroll * 0.3) % 70));
    const hh = 22 + (k % 2) * 10 + audio.bass * 6;
    g.fillStyle = color(2.5, 1, 30);
    for (let row = 0; row < hh; row++) {
      const half = Math.round((row / hh) * 28);
      g.fillRect(hx + 30 - half, h - 2 * TILE - hh + row, half * 2, 1);
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.9)';
  for (let k = -1; k < 4; k++) {
    const x = Math.round(k * 60 - ((scroll * 0.15) % 60)) + 10;
    const y = 14 + (k % 2) * 10;
    g.fillRect(x, y + 3, 22, 5);
    g.fillRect(x + 4, y, 12, 4);
  }
}

function drawSpeaker(g: CanvasRenderingContext2D, x: number, top: number): void {
  g.fillStyle = 'rgb(28,28,34)';
  g.fillRect(x, top, TILE * 2, TILE * 3);
  g.fillStyle = color(1, 1, 70);
  g.fillRect(x, top, TILE * 2, 1);
  for (const [cy, r] of [
    [top + 6, 3],
    [top + 16, 5],
  ] as const) {
    const pump = Math.round(r + audio.bass * 2 + (audio.beat > 0.5 ? 1 : 0));
    g.fillStyle = color(0, 1, 50);
    g.fillRect(x + TILE - pump, cy - pump, pump * 2, pump * 2);
    g.fillStyle = 'rgb(10,10,12)';
    g.fillRect(x + TILE - 1, cy - 1, 2, 2);
  }
}

function drawEyeBlock(g: CanvasRenderingContext2D, c: number, x: number, y: number): void {
  const hit = hitBlocks.get(c);
  const bounce = hit !== undefined ? Math.max(0, 3 - (clock.time - hit) * 20) : 0;
  const top = y - Math.round(bounce);
  g.fillStyle = color(1, 1, 55);
  g.fillRect(x, top, TILE, TILE);
  g.fillStyle = 'rgb(250,250,250)';
  const blink = Math.sin(clock.time * 3 + c) > 0.95;
  g.fillRect(x + 1, top + (blink ? 4 : 2), 6, blink ? 1 : 4);
  if (!blink) {
    g.fillStyle = 'rgb(20,20,30)';
    g.fillRect(x + 3 + Math.round(Math.sin(clock.time * 2) * 1.5), top + 3, 2, 2);
  }
}

function drawLevel(g: CanvasRenderingContext2D, w: number, h: number): void {
  const ground = h - 2 * TILE;
  const first = Math.floor(scroll / TILE) - 1;
  const face = color(0, 1, 42);
  const mortar = color(0, 1, 22);
  for (let c = first; c < first + w / TILE + 3; c++) {
    const x = Math.round(c * TILE - scroll);
    const col = column(c);
    if (!col.pit) {
      brick(g, x, ground, face, mortar);
      brick(g, x, ground + TILE, face, mortar);
    }
    if (col.platform) brick(g, x, ground - col.platform * TILE, face, mortar);
    if (col.eyeBlock) drawEyeBlock(g, c, x, ground - 5 * TILE);
    if (col.speaker) drawSpeaker(g, x, ground - 3 * TILE);
  }
}

/** Height of the floor under the hero (screen y of the top surface), or Infinity over a pit. */
function floorAt(worldX: number, h: number): number {
  const col = column(Math.floor(worldX / TILE));
  const ground = h - 2 * TILE;
  if (col.speaker) return ground - 3 * TILE;
  if (col.platform) return ground - col.platform * TILE;
  return col.pit ? Infinity : ground;
}

function jump(strength: number): void {
  if (!hero.onGround) return;
  hero.vy = -strength;
  hero.onGround = false;
}

function moveHero(dt: number, h: number, heroX: number): void {
  const worldX = scroll + heroX + 6;
  // Jump before a pit or a wall.
  const ahead = floorAt(worldX + TILE * 1.5, h);
  const here = floorAt(worldX, h);
  if (ahead === Infinity || ahead < here - 2) jump(150 + audio.bass * 40);
  hero.vy += 420 * dt;
  hero.y += hero.vy * dt;
  const floor = floorAt(worldX, h);
  const feet = hero.y + 14;
  if (hero.vy >= 0 && feet >= floor && feet - floor < 10) {
    hero.y = floor - 14;
    hero.vy = 0;
    hero.onGround = true;
  } else if (feet < floor - 1) hero.onGround = false;
  if (hero.y > h + 20) {
    // Fell into a pit: a glitchy warp back to the top.
    hero.y = -20;
    hero.vy = 0;
    glitch.roll = 0.5;
  }
  // Head-butt an eye block from below.
  const c = Math.floor(worldX / TILE);
  const blockBottom = h - 2 * TILE - 4 * TILE;
  if (column(c).eyeBlock && hero.vy < 0 && hero.y <= blockBottom && hero.y > blockBottom - 6) {
    hero.vy = 40;
    if (!hitBlocks.has(c) || clock.time - (hitBlocks.get(c) ?? 0) > 0.5) {
      hitBlocks.set(c, clock.time);
      coins.push({ x: c * TILE + 2, y: blockBottom - TILE, vy: -120, life: 0.8 });
    }
  }
}

function glitchScreen(g: CanvasRenderingContext2D, w: number, h: number): void {
  // Torn rows.
  const tears = Math.floor(audio.high * 4 + audio.beat * 3);
  for (let t = 0; t < tears; t++) {
    const y = rndInt(h);
    const rows = 1 + rndInt(6);
    g.drawImage(screen.canvas, 0, y, w, rows, rnd(-14, 14), y, w, rows);
  }
  // Garbage tiles.
  if (glitch.corrupt > 0) {
    for (let n = 0; n < 6; n++) {
      const x = rndInt(w / TILE) * TILE;
      const y = rndInt(h / TILE) * TILE;
      for (let p = 0; p < 16; p++) {
        g.fillStyle = color(rndInt(4), 1, rnd(20, 90));
        g.fillRect(x + rndInt(TILE), y + rndInt(TILE), 2, 1);
      }
    }
  }
  if (glitch.invert > 0) {
    g.globalCompositeOperation = 'difference';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }
}

export const eightBit: Mode = {
  name: '8bit',
  fade: 1,
  bloom: 0.3,
  blend: 'source-over',
  beatRings: false,
  palettes: ['neon', 'candy', 'vapor', 'acid', 'technicolor', 'hazard', 'phosphor', 'void'],

  beat() {
    jump(135 + audio.bass * 60);
    const r = Math.random();
    if (r < 0.2) glitch.invert = 0.08;
    else if (r < 0.35) glitch.corrupt = 0.4;
    else if (r < 0.45) {
      glitch.roll = 0.3;
      glitch.rollOffset = rnd(0.2, 0.8);
    } else if (r < 0.5) hero.giant = 1.2;
    // A blob to stomp now and then.
    if (Math.random() < 0.4) blobs.push({ x: scroll + SCREEN_W + 10, squashed: 0 });
  },

  resize() {
    screenH = 0;
  },

  draw(dt) {
    const { width, height } = view;
    const w = SCREEN_W;
    const h = Math.max(72, Math.round((SCREEN_W * height) / width));
    if (h !== screenH) {
      setCanvasSize(screen.canvas, w, h);
      screenH = h;
      hero.y = h - 2 * TILE - 14;
      seed = Math.random() * 100;
    }
    const g = screen.ctx;
    const step = Math.min(dt, 1 / 20);
    for (const key of ['invert', 'roll', 'corrupt'] as const)
      glitch[key] = Math.max(0, glitch[key] - dt);
    hero.giant = Math.max(0, hero.giant - dt);

    scroll += (40 + audio.mid * 70 + audio.beat * 30) * step;
    const heroX = Math.round(w * 0.28);
    moveHero(step, h, heroX);
    hero.step += step * (8 + audio.mid * 10);

    g.globalCompositeOperation = 'source-over';
    g.imageSmoothingEnabled = false;
    g.fillStyle = background(1);
    g.fillRect(0, 0, w, h);
    drawBackdrop(g, w, h);
    drawLevel(g, w, h);

    // Coins jump out of eye blocks and spin.
    for (let i = coins.length - 1; i >= 0; i--) {
      const coin = coins[i];
      coin.vy += 400 * step;
      coin.y += coin.vy * step;
      coin.life -= step;
      if (coin.life <= 0) {
        coins.splice(i, 1);
        continue;
      }
      const spin = [4, 2, 1, 2][Math.floor(clock.time * 16) % 4];
      g.fillStyle = color(1.5, 1, 80);
      g.fillRect(Math.round(coin.x - scroll + 2 - spin / 2), Math.round(coin.y), spin, 6);
    }

    // Glitch-blobs walk in; the hero stomps them.
    const ink = inks();
    const ground = h - 2 * TILE;
    blobs = blobs.filter((b) => b.x - scroll > -20 && b.squashed < 0.6);
    for (const b of blobs) {
      b.x -= 18 * step;
      const x = Math.round(b.x - scroll);
      if (b.squashed) {
        b.squashed += step;
        g.fillStyle = ink.X;
        g.fillRect(x, ground - 2, 8, 2);
        continue;
      }
      const hit = Math.abs(x - heroX - 2) < 8 && hero.y + 14 >= ground - 9 && hero.vy > 0;
      if (hit) {
        b.squashed = 0.01;
        hero.vy = -120;
        glitch.corrupt = 0.25;
      }
      paint(
        g,
        BLOB,
        x,
        ground - 8,
        { ...ink, X: color(3, 1, 50) },
        1,
        Math.floor(clock.time * 4) % 2 === 1,
      );
    }

    // The hero: a three-step run, legs together in the air.
    const legs = hero.onGround ? HERO_LEGS[Math.floor(hero.step) % 3] : HERO_LEGS[1];
    const scale = hero.giant > 0 ? 3 : 1;
    const heroY = Math.round(hero.y) - (scale - 1) * 14;
    paint(g, [...HERO_TOP, ...legs], heroX - (scale - 1) * 6, heroY, ink, scale);

    glitchScreen(g, w, h);

    // Scale up, with a rolling picture while the roll glitch runs.
    ctx.imageSmoothingEnabled = false;
    if (glitch.roll > 0) {
      const split = Math.round(h * glitch.rollOffset);
      const share = height / h;
      ctx.drawImage(screen.canvas, 0, split, w, h - split, 0, 0, width, (h - split) * share);
      ctx.drawImage(screen.canvas, 0, 0, w, split, 0, (h - split) * share, width, split * share);
      glitch.rollOffset = (glitch.rollOffset + dt * 0.8) % 1;
    } else {
      ctx.drawImage(screen.canvas, 0, 0, width, height);
    }
    ctx.imageSmoothingEnabled = true;
  },
};
