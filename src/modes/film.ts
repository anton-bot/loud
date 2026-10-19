/** A liquid light show projected through badly damaged film: burns, scratches, dust and gate slips. */
import { rnd, TAU } from '../core/math';
import { audio, clock, scene, view } from '../core/state';
import { ctx, snapshot, takeSnapshot } from '../render/canvases';
import { color } from '../render/color';
import { blobPath, fillCircle, pathPoint, speckle, vignette } from '../render/shapes';
import type { Mode } from './mode';

interface Burn {
  /** Position as a fraction of the screen. */
  x: number;
  y: number;
  r: number;
  age: number;
  life: number;
  seed: number;
}

interface Scratch {
  /** Horizontal position as a fraction of the screen. */
  x: number;
  length: number;
  top: number;
  alpha: number;
  life: number;
  drift: number;
  dark: boolean;
  width: number;
}

const burns: Burn[] = [];
const scratches: Scratch[] = [];
/** Inverted flash on a beat, 1..0. */
let flash = 0;
let flashK = 0;
/** Frame slip: the picture jumps up or down by `slip` pixels for `slipTime` seconds. */
let slip = 0;
let slipTime = 0;
const SLIP_DURATION = 0.25;

function addBurn(x: number, y: number, r: number, life: number): void {
  burns.push({ x, y, r, age: 0, life, seed: Math.random() * 100 });
}

/** The last frame, shaken a little; during a slip it shows two frames and the line between them. */
function projectLastFrame(dt: number): void {
  const { width, height } = view;
  takeSnapshot();
  ctx.globalCompositeOperation = 'source-over';
  const jx = rnd(-1.5, 1.5) * (1 + audio.beat * 2);
  const jy = rnd(-1, 1) * (1 + audio.beat * 2);
  if (slipTime <= 0) {
    ctx.drawImage(snapshot, jx, jy, width, height);
    return;
  }
  slipTime -= dt;
  const sy = slip * (slipTime > 0.12 ? 1 : slipTime / 0.12);
  ctx.drawImage(snapshot, jx, jy + sy, width, height);
  ctx.drawImage(snapshot, jx, jy + sy - Math.sign(sy) * height, width, height);
  // The black frame line between the two frames.
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  const lineY = sy > 0 ? jy + sy - height * 0.03 : jy + sy + (height - height * 0.03);
  ctx.fillRect(0, lineY, width, height * 0.03);
}

/** Oil-and-water blobs and wobbling rings, as in a 60s light show. */
function drawLightShow(): void {
  const { width, height, cx, cy, min } = view;
  const time = clock.time;
  const additive = scene.palette.light ? 'multiply' : 'lighter';
  for (let i = 0; i < 10; i++) {
    const a = time * (0.15 + i * 0.03) * (i % 2 ? 1 : -1) + i;
    const x = cx + Math.cos(a) * width * 0.35 * (0.6 + 0.4 * Math.sin(time * 0.3 + i));
    const y = cy + Math.sin(a * 1.3) * height * 0.3;
    const r = min * (0.18 + 0.12 * Math.sin(time * 0.7 + i * 2)) * (1 + audio.bass * 0.4);
    ctx.globalCompositeOperation = i % 3 === 2 ? 'difference' : additive;
    const blob = ctx.createRadialGradient(x, y, 0, x, y, r);
    blob.addColorStop(0, color(i * 0.5 + time * 0.1, 0.45, 62));
    blob.addColorStop(1, color(i * 0.5, 0, 50));
    ctx.fillStyle = blob;
    fillCircle(ctx, x, y, r);
  }

  ctx.globalCompositeOperation = 'difference';
  ctx.lineWidth = min * 0.02 * (1 + audio.mid);
  for (let i = 1; i <= 5; i++) {
    const r = min * 0.08 * i * (1 + audio.bass * 0.3);
    ctx.strokeStyle = color(i + time * 0.2, 0.35, 60);
    ctx.beginPath();
    for (let a = 0; a <= 48; a++) {
      const angle = (a / 48) * TAU;
      const rr = r * (1 + 0.12 * Math.sin(angle * 5 + time * 3 + i));
      pathPoint(ctx, a, cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // A light leak from the top-left corner.
  ctx.globalCompositeOperation = additive;
  const leak = ctx.createLinearGradient(0, 0, width * 0.6, height * 0.4);
  leak.addColorStop(0, color(0.7, 0.12 + audio.bass * 0.15 + 0.06 * Math.sin(time * 0.9), 60));
  leak.addColorStop(1, color(0.7, 0, 60));
  ctx.fillStyle = leak;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

/** Spots where the film melts under the projector lamp. */
function drawBurns(dt: number): void {
  const { width, height, min } = view;
  if (Math.random() < audio.high * 0.04)
    addBurn(Math.random(), Math.random(), min * rnd(0.05, 0.15), rnd(0.5, 1.2));
  for (let i = burns.length - 1; i >= 0; i--) {
    const b = burns[i];
    b.age += dt;
    if (b.age > b.life) {
      burns.splice(i, 1);
      continue;
    }
    const t = b.age / b.life;
    const r = b.r * Math.min(1, t * 3) * (1 + audio.beat * 0.2);
    const x = b.x * width;
    const y = b.y * height;
    const burn = ctx.createRadialGradient(x, y, 0, x, y, r);
    burn.addColorStop(0, `rgba(255,250,225,${(1 - t) * 0.95})`);
    burn.addColorStop(0.55, `rgba(255,150,40,${(1 - t) * 0.8})`);
    burn.addColorStop(0.85, `rgba(90,25,5,${(1 - t) * 0.9})`);
    burn.addColorStop(1, 'rgba(40,10,0,0)');
    ctx.fillStyle = burn;
    blobPath(ctx, x, y, r, 0.5, b.seed + t * 2);
    ctx.fill();
  }
}

/** Vertical scratches, dust, hairs, flicker. */
function drawDamage(dt: number): void {
  const { width, height, min } = view;
  const time = clock.time;
  if (Math.random() < 0.35 + audio.high * 0.5) {
    scratches.push({
      x: Math.random(),
      length: rnd(0.2, 1),
      top: rnd(0, 0.5),
      alpha: rnd(0.35, 0.95),
      life: rnd(0.05, 1.5),
      drift: rnd(-8, 8),
      dark: Math.random() < 0.4,
      width: Math.random() < 0.2 ? 2.5 : 1,
    });
  }
  for (let i = scratches.length - 1; i >= 0; i--) {
    const s = scratches[i];
    s.life -= dt;
    if (s.life <= 0) {
      scratches.splice(i, 1);
      continue;
    }
    const x = s.x * width + s.drift * Math.sin(time * 7 + i);
    const alpha = s.alpha * (0.5 + 0.5 * Math.random());
    ctx.strokeStyle = s.dark ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    ctx.moveTo(x, s.top * height);
    ctx.lineTo(x + rnd(-1, 1), (s.top + s.length) * height);
    ctx.stroke();
  }

  const dust = 6 + Math.floor(audio.high * 20);
  for (let i = 0; i < dust; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.6)';
    const size = rnd(1, 3.5);
    ctx.fillRect(Math.random() * width, Math.random() * height, size, size * rnd(0.5, 2));
  }

  if (Math.random() < 0.3) {
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    const x = Math.random() * width;
    const y = Math.random() * height;
    const reach = min * rnd(0.05, 0.25);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x + rnd(-reach, reach),
      y + rnd(-reach, reach),
      x + rnd(-reach, reach),
      y + rnd(-reach, reach),
      x + rnd(-reach, reach),
      y + rnd(-reach, reach),
    );
    ctx.stroke();
  }

  // Lamp flicker: mostly a little darker, rarely a deep dip or a bright flash.
  ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.12 + (Math.random() < 0.03 ? 0.45 : 0)})`;
  ctx.fillRect(0, 0, width, height);
  if (Math.random() < 0.02) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, width, height);
  }
}

/** The film strip edges with sprocket holes that move during a slip. */
function drawSprockets(): void {
  const { width, height } = view;
  const border = width * 0.07;
  const holeSpacing = height * 0.1;
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, border, height);
  ctx.fillRect(width - border, 0, border, height);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  const offset = (slipTime > 0 ? slip * (slipTime / SLIP_DURATION) : 0) % holeSpacing;
  for (let y = -holeSpacing + offset; y < height + holeSpacing; y += holeSpacing) {
    ctx.beginPath();
    ctx.roundRect(border * 0.25, y, border * 0.5, holeSpacing * 0.45, 3);
    ctx.roundRect(width - border * 0.75, y, border * 0.5, holeSpacing * 0.45, 3);
    ctx.fill();
  }
}

export const film: Mode = {
  name: 'zeds-film',
  fade: 0.3,
  bloom: 0.35,
  blend: 'source-over',
  beatRings: false,
  palettes: ['sepia', 'technicolor', 'wine', 'noir', 'mono', 'mushroom', 'lava', 'sand'],

  beat() {
    flash = 1;
    flashK = Math.random() * 4;
    if (Math.random() < 0.5) {
      addBurn(rnd(0.15, 0.85), rnd(0.15, 0.85), view.min * rnd(0.08, 0.3), rnd(0.7, 1.6));
    }
    if (Math.random() < 0.35) {
      slip = rnd(0.15, 0.6) * view.height * (Math.random() < 0.5 ? 1 : -1);
      slipTime = SLIP_DURATION;
    }
  },

  draw(dt) {
    const { width, height, cx, cy, min } = view;
    projectLastFrame(dt);
    drawLightShow();
    drawBurns(dt);
    drawDamage(dt);
    if (flash > 0) {
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = color(flashK, flash * 0.75, 60);
      ctx.fillRect(0, 0, width, height);
      flash = Math.max(0, flash - dt * 4);
      ctx.globalCompositeOperation = 'source-over';
    }
    drawSprockets();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    speckle(ctx, Math.floor((width * height) / 1500), width, height, 1.5);
    vignette(ctx, cx, cy, min * 0.25, Math.hypot(cx, cy), 'rgba(0,0,0,0.7)', width, height);
  },
};
