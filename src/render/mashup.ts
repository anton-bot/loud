/**
 * The mashup look: a second mode, in its own palette, shows through a mask over the
 * first one. Each mode keeps its own picture between frames (so trails and feedback
 * work for both), and the mask goes wild: circles with ragged edges, sliding
 * diagonals, checkerboards, blinds, shards, scan slices, blocks, rings and torn strips.
 * It changes every few beats, the two pictures sometimes swap or meet in a strange
 * blend, the mask edge glows with split colours, and strong beats tear the frame.
 * Every 16 beats a new partner mode comes in.
 */
import { createLayer, setCanvasSize, type Layer } from '../core/dom';
import { hash01, pick, rnd, rndInt, TAU } from '../core/math';
import { audio, clock, scene, view } from '../core/state';
import { PALETTES } from '../look/palettes';
import { MODES, type Mode } from '../modes';
import { ctx, drawStrip, sceneCanvas, snapshot, takeSnapshot } from './canvases';
import { color } from './color';

type Mask =
  'circle' | 'diagonal' | 'checker' | 'blinds' | 'shards' | 'scan' | 'blocks' | 'rings' | 'tear';
// prettier-ignore
const MASKS: readonly Mask[] = ['circle', 'diagonal', 'checker', 'blinds', 'shards', 'scan', 'blocks', 'rings', 'tear'];
const BLENDS: readonly GlobalCompositeOperation[] = [
  'source-over',
  'source-over',
  'source-over',
  'difference',
  'screen',
  'exclusion',
];
const COLS = 12;
const ROWS = 8;

const pictures = { main: createLayer(), partner: createLayer() };
let partner: Mode | null = null;
let partnerPalette = PALETTES[0];
let forMode: Mode | null = null;
let beats = 0;
let mask: Mask = 'circle';
let swap = false;
let blend: GlobalCompositeOperation = 'source-over';
/** Triangles for the shards mask, as x, y triples in 0..1. */
let shards: number[] = [];
const blocks = new Uint8Array(COLS * ROWS);
/** Slices of the scan mask (y, height in 0..1), re-cut many times a second. */
let slices: number[] = [];
let nextCut = 0;
/** A short swap of the two pictures, until this clock.time. */
let flashUntil = 0;

function newMask(): void {
  mask = pick(MASKS, mask);
  swap = Math.random() < 0.3;
  blend = pick(BLENDS);
  shards = [];
  for (let i = 0; i < 7; i++) {
    const x = Math.random();
    const y = Math.random();
    for (let k = 0; k < 3; k++) shards.push(x + rnd(-0.22, 0.22), y + rnd(-0.22, 0.22));
  }
  for (let i = 0; i < blocks.length; i++) blocks[i] = Math.random() < 0.5 ? 1 : 0;
}

function newPartner(main: Mode): void {
  partner = pick(MODES.filter((m) => m !== main && !m.camera));
  // Mostly dark palettes: a light one floods the screen with white.
  const dark = Math.random() < 0.85;
  partnerPalette = pick(PALETTES.filter((p) => p !== scene.palette && (!dark || !p.light)));
  const g = pictures.partner.ctx;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#000';
  g.fillRect(0, 0, pictures.partner.canvas.width, pictures.partner.canvas.height);
}

/** Called on each beat while the mashup look is on. */
export function mashupBeat(): void {
  partner?.beat?.();
  beats++;
  if (beats % 16 === 0) partner = null;
  if (beats % 2 === 0 && Math.random() < 0.7) newMask();
  else if (mask === 'blocks' || mask === 'shards') newMask();
  if (beats % 8 === 4 && audio.bass > 0.5) flashUntil = clock.time + 0.12;
}

function copyIn(layer: Layer): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'copy';
  ctx.globalAlpha = 1;
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.restore();
}

function copyOut(layer: Layer): void {
  layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  layer.ctx.globalCompositeOperation = 'copy';
  layer.ctx.drawImage(sceneCanvas, 0, 0);
}

/** The mask as a path on `ctx` (in CSS pixels). */
function maskPath(): void {
  const { width, height, cx, cy, min } = view;
  const t = clock.time;
  ctx.beginPath();
  if (mask === 'circle') {
    // A circle with a ragged, flickering edge.
    const r = min * (0.24 + audio.bass * 0.16);
    const step = Math.floor(t * 14);
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU;
      const rr = r * (1 + (hash01(i * 3.1 + step) - 0.5) * (0.08 + audio.high * 0.2));
      if (i) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
  } else if (mask === 'diagonal') {
    const x = width * (0.5 + 0.35 * Math.sin(t * 1.3)) + (Math.random() - 0.5) * audio.beat * 40;
    ctx.moveTo(x - height * 0.4, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width, height);
    ctx.lineTo(x + height * 0.4, height);
    ctx.closePath();
  } else if (mask === 'checker') {
    const cols = 8;
    const rows = 5;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const flip = hash01(i * 7 + j * 13 + Math.floor(t * 10)) < audio.high * 0.3;
        if (((i + j + beats) % 2 === 0) !== flip)
          ctx.rect((i * width) / cols, (j * height) / rows, width / cols + 1, height / rows + 1);
      }
    }
  } else if (mask === 'blinds') {
    const bands = 9;
    for (let j = 0; j < bands; j++) {
      const open = 0.5 + 0.5 * Math.sin(t * 3 + j * 0.9 + audio.bass * 2);
      ctx.rect(0, (j * height) / bands, width, (height / bands) * open);
    }
  } else if (mask === 'shards') {
    const grow = 1 + audio.beat * 0.3;
    for (let i = 0; i < shards.length; i += 6) {
      const mx = (shards[i] + shards[i + 2] + shards[i + 4]) / 3;
      const my = (shards[i + 1] + shards[i + 3] + shards[i + 5]) / 3;
      for (let k = 0; k < 3; k++) {
        const x = (mx + (shards[i + k * 2] - mx) * grow) * width;
        const y = (my + (shards[i + k * 2 + 1] - my) * grow) * height;
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
    }
  } else if (mask === 'scan') {
    if (clock.time >= nextCut || clock.time < nextCut - 1) {
      slices = [];
      for (let i = 0; i < 9; i++) slices.push(Math.random(), rnd(0.01, 0.09));
      nextCut = clock.time + rnd(0.05, 0.14);
    }
    for (let i = 0; i < slices.length; i += 2)
      ctx.rect(0, slices[i] * height, width, slices[i + 1] * height);
  } else if (mask === 'blocks') {
    for (let i = 0; i < COLS; i++) {
      for (let j = 0; j < ROWS; j++) {
        const on =
          (blocks[j * COLS + i] === 1) !==
          hash01(i * 5 + j * 11 + Math.floor(t * 12)) < audio.high * 0.15;
        if (on)
          ctx.rect((i * width) / COLS, (j * height) / ROWS, width / COLS + 1, height / ROWS + 1);
      }
    }
  } else if (mask === 'rings') {
    const band = min * 0.07;
    const shift = (t * band * (1.5 + audio.bass * 3)) % (band * 2);
    for (let r = shift; r < Math.hypot(cx, cy) + band * 2; r += band * 2) {
      ctx.moveTo(cx + r + band, cy);
      ctx.arc(cx, cy, r + band, 0, TAU);
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, TAU, 0, true);
    }
  } else {
    // tear: drawn in strips by drawTear, the path is not used.
    ctx.rect(0, 0, 0, 0);
  }
}

/** Vertical strips of the top picture, each pushed up or down. */
function drawTear(top: HTMLCanvasElement): void {
  const { width, height, dpr } = view;
  const strips = 14;
  const step = Math.floor(clock.time * 8);
  for (let i = 0; i < strips; i++) {
    if (hash01(i * 2.7 + step) < 0.45) continue;
    const x = (i / strips) * width;
    const w = width / strips + 1;
    const dy = (hash01(i * 9.1 + step) - 0.5) * height * (0.2 + audio.beat * 0.6);
    ctx.drawImage(top, x * dpr, 0, w * dpr, top.height, x, dy, w, height);
  }
}

/** Draws the main mode and its partner through the mask onto the scene canvas. */
export function drawMashup(
  main: Mode,
  dt: number,
  drawMode: (mode: Mode, dt: number, rings: boolean) => void,
): void {
  const { width, height } = view;
  for (const layer of [pictures.main, pictures.partner]) {
    if (layer.canvas.width !== sceneCanvas.width || layer.canvas.height !== sceneCanvas.height) {
      setCanvasSize(layer.canvas, sceneCanvas.width, sceneCanvas.height);
      copyOut(layer);
    }
  }
  if (forMode !== main || !partner) {
    newPartner(main);
    forMode = main;
  }
  const other = partner as Mode;

  // The partner, in its own picture and its own palette.
  copyIn(pictures.partner);
  const palette = scene.palette;
  scene.palette = partnerPalette;
  drawMode(other, dt, false);
  scene.palette = palette;
  copyOut(pictures.partner);

  // The main mode, in its own picture.
  copyIn(pictures.main);
  drawMode(main, dt, true);
  copyOut(pictures.main);

  // One picture below, the other through the mask on top.
  const swapped = swap !== clock.time < flashUntil;
  const top = swapped ? pictures.main : pictures.partner;
  if (swapped) copyIn(pictures.partner);
  ctx.save();
  ctx.globalCompositeOperation = blend;
  if (mask === 'tear') drawTear(top.canvas);
  else {
    maskPath();
    ctx.clip();
    ctx.drawImage(top.canvas, 0, 0, width, height);
  }
  ctx.restore();

  // The mask edge glows, with red and cyan copies split apart.
  if (mask !== 'tear' && mask !== 'scan') {
    const split = 2 + audio.beat * 8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.5 + audio.beat * 2;
    for (const [dx, stroke] of [
      [-split, 'rgba(255,0,60,0.55)'],
      [split, 'rgba(0,220,255,0.55)'],
      [0, color(0, 0.8, 85)],
    ] as const) {
      ctx.save();
      ctx.translate(dx, 0);
      maskPath();
      ctx.strokeStyle = stroke;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // Strong beats tear the whole frame.
  if (audio.beat > 0.6 && Math.random() < 0.5) {
    takeSnapshot();
    for (let i = 0; i < 2 + rndInt(5); i++) {
      const y = Math.random() * height;
      drawStrip(snapshot, y, rnd(4, 50), (Math.random() - 0.5) * width * 0.25 * audio.beat, y);
    }
  }
}
