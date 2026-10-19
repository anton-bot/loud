/**
 * Psilocybin mushrooms crawling through space. Two kinds: Psilocybe cubensis
 * (golden-caramel caps with a dark bump in the middle, a pale stem with a dark ring
 * and blue bruising at the base) and liberty caps (P. semilanceata: pointed cones on
 * thin, wavy stems). They crawl toward the viewer in surges and drift sideways, and
 * they turn and flip on every axis (flipped over, they show their gills). A glowing
 * mycelium web links each one to its nearest neighbour and carries light on beats;
 * spores drift off the caps. The louder the bass, the faster they come and the more
 * the palette's colours bleed into the caps.
 */
import { clamp, rnd, TAU } from '../core/math';
import type { Rgb } from '../core/rgb';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color, colorRgb } from '../render/color';
import { fillCircle } from '../render/shapes';
import type { Mode } from './mode';

interface Mushroom {
  kind: 'cubensis' | 'liberty';
  /** Position in space: x and y around the view axis, z the distance from the viewer. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  /** Approach speed. */
  vz: number;
  /** Turn in the picture plane, and flip around the horizontal axis (radians). */
  roll: number;
  rollSpeed: number;
  flip: number;
  flipSpeed: number;
  size: number;
  phase: number;
  /** Palette colour that bleeds into the cap. */
  tint: number;
  /** Light pulse on the link to the nearest neighbour, 0..1 (above 1: none). */
  pulse: number;
}

interface Spore {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  k: number;
}

/** Depth range: new mushrooms appear at FAR and leave at NEAR. */
const FAR = 4.2;
const NEAR = 0.35;
const COUNT = 14;
const STEM: Rgb = [240, 234, 220];
const BRUISE: Rgb = [70, 110, 190];
const GILLS: Rgb = [58, 40, 50];
/** Cap colours from the middle to the edge, per kind. */
const CAP: Record<Mushroom['kind'], readonly [Rgb, Rgb, Rgb]> = {
  cubensis: [
    [112, 62, 26],
    [204, 146, 66],
    [236, 212, 164],
  ],
  liberty: [
    [86, 66, 38],
    [176, 140, 86],
    [214, 196, 150],
  ],
};

let mushrooms: Mushroom[] = [];
const spores: Spore[] = [];
/** Glow after a beat, 1..0. */
let glow = 0;
/** Extra speed after a beat, 1..0. */
let surge = 0;

function mix(a: Rgb, b: Rgb, t: number, alpha = 1): string {
  return `rgba(${(a[0] + (b[0] - a[0]) * t) | 0},${(a[1] + (b[1] - a[1]) * t) | 0},${(a[2] + (b[2] - a[2]) * t) | 0},${alpha})`;
}

/** A mushroom somewhere in the space; `far`: at the back, where new ones appear. */
function spawn(far: boolean): Mushroom {
  const kind = Math.random() < 0.35 ? 'liberty' : 'cubensis';
  const z = far ? FAR : rnd(NEAR + 0.6, FAR);
  return {
    kind,
    x: rnd(-1.8, 1.8) * (z / 2),
    y: rnd(-1.3, 1.3) * (z / 2),
    z,
    vx: rnd(-0.25, 0.25),
    vy: rnd(-0.2, 0.2),
    vz: rnd(0.25, 0.6),
    roll: Math.random() * TAU,
    rollSpeed: rnd(-0.8, 0.8),
    flip: rnd(-0.7, 0.7),
    flipSpeed: rnd(-0.7, 0.7),
    size: rnd(0.75, 1.3),
    phase: Math.random() * TAU,
    tint: Math.random() * 4,
    pulse: 2,
  };
}

function crawl(m: Mushroom, dt: number): void {
  const time = clock.time;
  // Inchworm surges: fast, then almost still.
  const stride = Math.pow(0.5 + 0.5 * Math.sin(time * 2.6 + m.phase), 2);
  const speed = (0.5 + audio.bass * 1.6 + surge * 2) * (0.3 + stride);
  m.z -= m.vz * speed * dt;
  m.x += (m.vx + Math.sin(time * 0.7 + m.phase) * 0.18) * dt;
  m.y += (m.vy + Math.cos(time * 0.6 + m.phase) * 0.14) * dt;
  m.roll += m.rollSpeed * dt * (1 + audio.mid);
  m.flip += m.flipSpeed * dt * (1 + audio.mid * 0.5);
  if (m.pulse <= 1) m.pulse += dt * (0.8 + audio.mid);
}

function project(m: Mushroom): { x: number; y: number; scale: number } {
  const { cx, cy, min } = view;
  const scale = (min * 0.45) / m.z;
  return { x: cx + m.x * scale, y: cy + m.y * scale, scale };
}

/** Thin glowing threads from each mushroom to its nearest neighbour, with light pulses. */
function drawMycelium(): void {
  ctx.lineWidth = 1;
  ctx.strokeStyle = color(1, 0.18 + audio.bass * 0.2, 65);
  ctx.beginPath();
  const pulses: { x: number; y: number; t: number }[] = [];
  for (const m of mushrooms) {
    let nearest: Mushroom | null = null;
    let best = Infinity;
    for (const o of mushrooms) {
      if (o === m) continue;
      const d = (o.x - m.x) ** 2 + (o.y - m.y) ** 2 + (o.z - m.z) ** 2;
      if (d < best) {
        best = d;
        nearest = o;
      }
    }
    if (!nearest || best > 4) continue;
    const a = project(m);
    const b = project(nearest);
    // A slight sag, like a hanging thread.
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2 + Math.hypot(a.x - b.x, a.y - b.y) * 0.12;
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(midX, midY, b.x, b.y);
    if (m.pulse <= 1) {
      const t = m.pulse;
      pulses.push({
        x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * midX + t * t * b.x,
        y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * midY + t * t * b.y,
        t,
      });
    }
  }
  ctx.stroke();
  for (const p of pulses) {
    ctx.fillStyle = color(2, 1 - p.t * 0.7, 88);
    fillCircle(ctx, p.x, p.y, 2 + audio.bass * 2.5);
  }
}

function drawMushroom(m: Mushroom, trip: number): void {
  const time = clock.time;
  const p = project(m);
  // Fade in at the back, out when very close.
  const alpha = clamp((FAR - m.z) / 1.2, 0, 1) * clamp((m.z - NEAR) / 0.25, 0, 1);
  if (alpha <= 0.01) return;
  const unit = p.scale * m.size;
  const h = unit * (m.kind === 'cubensis' ? 0.9 : 1.1) * (1 + audio.bass * 0.06);
  const r = unit * (m.kind === 'cubensis' ? 0.3 : 0.17) * (1 + audio.bass * 0.12 + glow * 0.05);
  const flip = Math.cos(m.flip);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(m.roll);
  // The flip squashes the mushroom vertically; past 90° it shows its underside.
  ctx.scale(1, Math.abs(flip) < 0.08 ? 0.08 * Math.sign(flip || 1) : flip);
  // The stem bends as it crawls; liberty caps have thin, wavy stems.
  const wave = Math.sin(time * 2.6 + m.phase) * r * (m.kind === 'liberty' ? 0.9 : 0.4);
  drawStem(m, 0, h / 2, 0, -h / 2, m.kind === 'cubensis' ? r * 0.2 : r * 0.16, wave);
  drawCap(m, 0, -h / 2, r, colorRgb(m.tint + time * 0.2, 60), trip, flip < 0);
  ctx.restore();
}

/** Pale, slightly tapered stem along a curve, with fibres, a dark ring and blue bruising at the base. */
function drawStem(
  m: Mushroom,
  x0: number,
  y0: number,
  tx: number,
  ty: number,
  width: number,
  wave: number,
): void {
  const midX = (x0 + tx) / 2 + wave;
  const midY = (y0 + ty) / 2;
  const fill = ctx.createLinearGradient(x0, y0, tx, ty);
  fill.addColorStop(0, mix(STEM, BRUISE, 0.75));
  fill.addColorStop(0.18, mix(STEM, BRUISE, 0.1));
  fill.addColorStop(1, mix(STEM, STEM, 0));
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x0 - width * 1.3, y0);
  ctx.quadraticCurveTo(midX - width, midY, tx - width * 0.8, ty);
  ctx.lineTo(tx + width * 0.8, ty);
  ctx.quadraticCurveTo(midX + width, midY, x0 + width * 1.3, y0);
  ctx.closePath();
  ctx.fill();
  // Fibres along the stem.
  ctx.strokeStyle = 'rgba(120,100,90,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const f of [-0.45, 0.1, 0.5]) {
    ctx.moveTo(x0 + width * f, y0);
    ctx.quadraticCurveTo(midX + width * f * 0.8, midY, tx + width * f * 0.6, ty);
  }
  ctx.stroke();
  if (m.kind === 'cubensis') {
    // The ring left by the veil, stained dark by falling spores.
    const ringY = ty + (y0 - ty) * 0.12;
    const ringX = tx + (midX - tx) * 0.24;
    ctx.fillStyle = 'rgba(48,30,44,0.85)';
    ctx.beginPath();
    ctx.ellipse(ringX, ringY, width * 1.25, width * 0.35, 0, 0, TAU);
    ctx.fill();
  }
}

/** Gills: dark purple-brown, with fine radial lines. */
function drawGills(x: number, y: number, r: number, tint: Rgb, trip: number): void {
  ctx.fillStyle = mix(GILLS, tint, trip * 0.3);
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.95, r * 0.17, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,120,130,0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let g = -8; g <= 8; g++) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + (g / 8) * r * 0.92, y + Math.sqrt(1 - (g / 8) ** 2) * r * 0.15);
  }
  ctx.stroke();
}

/** The cap with its streaks; the gills show below it, or on top when it is seen from underneath. */
function drawCap(
  m: Mushroom,
  x: number,
  y: number,
  r: number,
  tint: Rgb,
  trip: number,
  underside: boolean,
): void {
  const [middle, body, edge] = CAP[m.kind];
  if (!underside) drawGills(x, y, r, tint, trip);
  const apexY = m.kind === 'cubensis' ? y - r * 0.78 : y - r * 1.35;
  const fill = ctx.createRadialGradient(x, apexY + r * 0.1, 0, x, apexY + r * 0.1, r * 1.25);
  fill.addColorStop(0, mix(middle, tint, trip * 0.6));
  fill.addColorStop(0.45, mix(body, tint, trip));
  fill.addColorStop(1, mix(edge, tint, trip * 0.7));
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (m.kind === 'cubensis') {
    // A wide dome with a small bump (umbo) on top and a slightly curled edge.
    ctx.moveTo(x - r, y);
    ctx.bezierCurveTo(x - r, y - r * 0.55, x - r * 0.45, apexY, x - r * 0.12, apexY + r * 0.02);
    ctx.quadraticCurveTo(x, apexY - r * 0.07, x + r * 0.12, apexY + r * 0.02);
    ctx.bezierCurveTo(x + r * 0.45, apexY, x + r, y - r * 0.55, x + r, y);
    ctx.quadraticCurveTo(x, y + r * 0.12, x - r, y);
  } else {
    // A pointed cone with a nipple on top and a thin, see-through edge.
    ctx.moveTo(x - r * 0.85, y + r * 0.05);
    ctx.quadraticCurveTo(x - r * 0.6, apexY + r * 0.35, x - r * 0.1, apexY + r * 0.05);
    ctx.quadraticCurveTo(x, apexY - r * 0.12, x + r * 0.1, apexY + r * 0.05);
    ctx.quadraticCurveTo(x + r * 0.6, apexY + r * 0.35, x + r * 0.85, y + r * 0.05);
    ctx.quadraticCurveTo(x, y + r * 0.15, x - r * 0.85, y + r * 0.05);
  }
  ctx.closePath();
  ctx.fill();
  // Streaks from the top to the edge.
  ctx.strokeStyle = m.kind === 'cubensis' ? 'rgba(255,236,200,0.18)' : 'rgba(60,40,20,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let s = -3; s <= 3; s++) {
    ctx.moveTo(x + s * r * 0.04, apexY + r * 0.1);
    ctx.quadraticCurveTo(x + s * r * 0.2, (apexY + y) / 2, x + s * r * 0.3, y - r * 0.02);
  }
  ctx.stroke();
  // Glow along the edge after a beat.
  if (glow > 0.05) {
    ctx.strokeStyle = mix(tint, [255, 255, 255], 0.3, glow * 0.8);
    ctx.lineWidth = 1.5 + glow * 2;
    ctx.stroke();
  }
  if (underside) drawGills(x, y, r, tint, trip);
}

function drawSpores(dt: number): void {
  for (let i = spores.length - 1; i >= 0; i--) {
    const s = spores[i];
    s.life -= dt * 0.35;
    if (s.life <= 0) {
      spores.splice(i, 1);
      continue;
    }
    s.vx += Math.sin(clock.time * 2 + s.y * 0.05) * 6 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    ctx.fillStyle = color(s.k, s.life * 0.9, 85);
    fillCircle(ctx, s.x, s.y, 1 + s.life * 1.5);
  }
}

function releaseSpores(count: number): void {
  for (let n = 0; n < count && mushrooms.length; n++) {
    const m = mushrooms[Math.floor(Math.random() * mushrooms.length)];
    const p = project(m);
    spores.push({
      x: p.x + rnd(-1, 1) * p.scale * 0.1,
      y: p.y + rnd(-1, 1) * p.scale * 0.1,
      vx: rnd(-14, 14),
      vy: rnd(-24, 8),
      life: rnd(0.6, 1),
      k: Math.random() * 4,
    });
  }
  while (spores.length > 400) spores.shift();
}

export const shroom: Mode = {
  name: 'shroom',
  fade: 0.6,
  zoom: 1.006,
  bloom: 0.5,
  blend: 'source-over',
  beatRings: false,
  palettes: ['mushroom', 'forest', 'sepia', 'wine', 'ultraviolet', 'toxic', 'lava', 'void'],

  beat() {
    glow = 1;
    surge = Math.max(surge, 0.5 + audio.bass * 0.5);
    for (const m of mushrooms) if (Math.random() < 0.6) m.pulse = 0;
    releaseSpores(10 + Math.floor(audio.bass * 30));
  },

  resize() {
    mushrooms = [];
  },

  draw(dt) {
    const { width, height, cx, cy, min } = view;
    const time = clock.time;
    if (!mushrooms.length) mushrooms = Array.from({ length: COUNT }, () => spawn(false));
    glow = Math.max(0, glow - dt * 1.8);
    surge = Math.max(0, surge - dt * 1.2);

    // A soft aura in the middle of the space.
    const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, min * 0.8);
    aura.addColorStop(0, color(time * 0.1, 0.12 + audio.bass * 0.2 + glow * 0.1, 60));
    aura.addColorStop(1, color(time * 0.1 + 1, 0, 60));
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < mushrooms.length; i++) {
      const m = mushrooms[i];
      crawl(m, dt);
      const p = project(m);
      const gone = m.z < NEAR || Math.abs(p.x - cx) > width || Math.abs(p.y - cy) > height;
      if (gone) mushrooms[i] = spawn(true);
    }
    // The far ones first, so the near ones are drawn over them.
    mushrooms.sort((a, b) => b.z - a.z);
    drawMycelium();
    if (Math.random() < 0.3 + audio.high) releaseSpores(1);
    const trip = Math.min(1, 0.12 + audio.bass * 0.55 + glow * 0.25);
    for (const m of mushrooms) drawMushroom(m, trip);
    drawSpores(dt);
  },
};
