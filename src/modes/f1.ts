/**
 * F1 onboard: the view from the driver's seat of a Formula 1 car on a neon night
 * circuit. The eye sits low behind the halo; the front tyres, the nose and the
 * steering wheel (with its shift lights and gear display) frame the road.
 *
 * The track is pseudo-3D (as in old arcade racers): a chain of short segments, each
 * with a curvature, projected from the eye. Straights and corners (sometimes a
 * chicane) come one after another. The car brakes hard before each corner, rolls into
 * it with the head pushed to the outside, and accelerates sharply out of it. Louder
 * music raises the top speed, beats kick the throttle, and a drop opens the DRS.
 */
import { clamp, hash01, rnd, TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { neonStroke } from '../render/neon';
import type { Mode } from './mode';

interface Section {
  start: number;
  length: number;
  /** Change of direction per segment; the sign is the side (+ right). */
  curve: number;
}

/** Segments drawn ahead. */
const DRAW = 150;
/** Half width of the road, in world units (a segment is 1 unit long). */
const ROAD = 1;
/** Eye height above the road: low, as in a real F1 car. */
const EYE = 0.3;
const TOP_SPEED = 110;
/** km/h shown per segment per second: 110 is about 340 km/h. */
const KMH = 3.1;
const BRAKE = 150;
const MAX_CURVE = 0.0045;
const GEARS = 8;
const LEDS = 15;
const PIXEL_FONT = '"Press Start 2P", monospace';

let sections: Section[] = [];
let distance = 0;
let speed = 45;
let longG = 0;
let latG = 0;
let camX = 0;
let steer = 0;
let heading = 0;
let gear = 1;
let shiftFlash = 0;
let kick = 0;

const px = new Float32Array(DRAW + 1);
const py = new Float32Array(DRAW + 1);
const ps = new Float32Array(DRAW + 1);
const pc = new Float32Array(DRAW + 1);

/** Adds straights and corners until the track reaches `z`. */
function buildTo(z: number): void {
  while (!sections.length || sections[sections.length - 1].start < z + DRAW * 2) {
    const last = sections[sections.length - 1];
    let start = last ? last.start + last.length : 0;
    const add = (length: number, curve: number): void => {
      sections.push({ start, length, curve });
      start += length;
    };
    add(rnd(30, 85), 0);
    const side = Math.random() < 0.5 ? 1 : -1;
    if (Math.random() < 0.25) {
      // A chicane: left-right (or right-left), short and sharp.
      add(18, side * MAX_CURVE * 0.9);
      add(18, -side * MAX_CURVE * 0.9);
    } else add(rnd(25, 70), side * rnd(0.25, 1) * MAX_CURVE);
  }
  // Forget what is far behind.
  while (sections.length > 2 && sections[1].start + sections[1].length < z - 10) sections.shift();
}

function sectionAt(z: number): Section {
  for (let i = sections.length - 1; i >= 0; i--) if (sections[i].start <= z) return sections[i];
  return sections[0];
}

/** The curvature at `z`, eased in and out at the ends of a corner. */
function curveAt(z: number): number {
  const s = sectionAt(z);
  if (!s.curve) return 0;
  const p = (z - s.start) / s.length;
  return s.curve * clamp(Math.min(p, 1 - p) / 0.22, 0, 1);
}

/** The next corner ahead of `z`, if it starts within `range`. */
function nextCorner(z: number, range: number): Section | null {
  for (const s of sections) if (s.curve && s.start > z && s.start < z + range) return s;
  return null;
}

/** The speed a corner allows: sharper corners are slower. */
function cornerSpeed(curve: number, flatOut: number): number {
  return flatOut * (1 - (Math.abs(curve) / MAX_CURVE) * 0.55);
}

function drive(dt: number): void {
  buildTo(distance);
  const energy = clamp(audio.bass * 0.6 + audio.mid * 0.4, 0, 1);
  const drs = audio.drop > 0.3;
  const flatOut = TOP_SPEED * (0.55 + energy * 0.45) * (drs ? 1.15 : 1);
  let target = flatOut;
  const here = sectionAt(distance);
  if (here.curve) {
    const p = (distance - here.start) / here.length;
    // Slow to the apex, then back on the power.
    target = cornerSpeed(here.curve, flatOut) * (p > 0.5 ? 1 + (p - 0.5) * 0.6 : 1);
  }
  const ahead = nextCorner(distance, 120);
  if (ahead) {
    const v = cornerSpeed(ahead.curve, flatOut);
    const brakingDistance = (speed * speed - v * v) / (2 * BRAKE);
    if (ahead.start - distance < brakingDistance + 4) target = Math.min(target, v);
  }
  const before = speed;
  if (speed > target + 1) speed = Math.max(target, speed - BRAKE * dt);
  else speed += ((target - speed) * 1.8 + kick * 40) * dt;
  speed = clamp(speed, 15, TOP_SPEED * 1.2);
  kick = Math.max(0, kick - dt * 3);
  distance += speed * dt;

  // G forces, smoothed: braking is negative.
  const accel = (speed - before) / Math.max(dt, 1e-3);
  longG += (clamp(accel / BRAKE, -1, 1) - longG) * Math.min(1, dt * 8);
  const curve = curveAt(distance + 3);
  latG += (clamp((curve * speed * speed) / 28, -1.2, 1.2) - latG) * Math.min(1, dt * 6);
  heading += curve * speed * dt;

  // The racing line: outside, inside at the apex, outside again.
  const p = here.curve ? (distance - here.start) / here.length : 0;
  const line = here.curve ? Math.sign(here.curve) * 0.55 * -Math.cos(p * TAU) : 0;
  camX += (line - camX) * Math.min(1, dt * 2);
  steer += (clamp(curve * 260, -1.1, 1.1) - steer) * Math.min(1, dt * 8);

  // Gears follow the speed; an upshift flashes the lights.
  const next = clamp(Math.floor((speed / (TOP_SPEED * 1.15)) * GEARS) + 1, 1, GEARS);
  if (next > gear) shiftFlash = 1;
  gear = next;
  shiftFlash = Math.max(0, shiftFlash - dt * 6);
}

/** Projects the segment boundaries ahead into px, py, ps (scale) and pc (curvature). */
function project(horizon: number, focal: number): void {
  const { cx } = view;
  const base = Math.floor(distance);
  const frac = distance - base;
  let x = 0;
  let dx = -curveAt(base) * frac;
  for (let n = 0; n <= DRAW; n++) {
    const z = n + 1 - frac;
    const c = curveAt(base + 1 + n);
    dx += c;
    x += dx;
    const s = focal / z;
    px[n] = cx + (x - camX) * s;
    py[n] = horizon + EYE * s;
    ps[n] = s;
    pc[n] = c;
  }
}

function quad(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

function drawSky(horizon: number): void {
  const { width, height } = view;
  const sky = ctx.createLinearGradient(0, -height * 0.2, 0, horizon);
  sky.addColorStop(0, '#05040a');
  sky.addColorStop(1, color(1, 1, 22));
  ctx.fillStyle = sky;
  ctx.fillRect(-width * 0.2, -height * 0.2, width * 1.4, horizon + height * 0.2);

  // A striped sun on the horizon; it swings with the turns.
  const r = Math.min(width, height) * 0.22;
  const sx = width / 2 + Math.sin(heading * 0.25) * width * 0.9;
  const sy = horizon - r * 0.35;
  const sun = ctx.createLinearGradient(0, sy - r, 0, sy + r);
  sun.addColorStop(0, color(2, 1, 70));
  sun.addColorStop(1, color(0, 1, 55));
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color(1, 1, 22);
  for (let i = 0; i < 6; i++) {
    const y = sy + r * (0.05 + i * 0.16);
    ctx.fillRect(sx - r, y, r * 2, r * (0.02 + i * 0.022));
  }

  // City skyline, scrolling with the heading.
  const unit = width / 18;
  const shift = (((heading * width * 0.5) % (unit * 40)) + unit * 40) % (unit * 40);
  ctx.fillStyle = '#07060c';
  ctx.beginPath();
  for (let i = -2; i < 42; i++) {
    const x = i * unit - shift;
    if (x > width * 1.2 || x < -width * 0.2 - unit) continue;
    const h = (0.25 + hash01((((i % 40) + 40) % 40) * 3.7) * 0.9) * unit * 1.6;
    ctx.rect(x, horizon - h, unit * 0.86, h);
  }
  ctx.fill();
  ctx.strokeStyle = color(3, 0.5, 60);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawGround(horizon: number): void {
  const { width, height } = view;
  ctx.fillStyle = '#050409';
  ctx.fillRect(-width * 0.2, horizon, width * 1.4, height);
  // Neon grid on the ground, following the curve of the road.
  ctx.beginPath();
  for (const side of [-1, 1]) {
    for (const off of [2.8, 4, 6, 9, 14, 22]) {
      for (let n = 0; n <= DRAW; n += 2) {
        const x = px[n] + side * off * ps[n];
        if (n) ctx.lineTo(x, py[n]);
        else ctx.moveTo(x, py[n]);
      }
    }
  }
  const base = Math.floor(distance);
  for (let n = 0; n < DRAW; n++) {
    if ((base + 1 + n) % 4) continue;
    ctx.moveTo(-width * 0.2, py[n]);
    ctx.lineTo(width * 1.2, py[n]);
  }
  ctx.strokeStyle = color(2, 0.22, 55);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color(2, 0.5, 70);
  ctx.fillRect(-width * 0.2, horizon - 1, width * 1.4, 2);
}

function drawRoad(): void {
  const base = Math.floor(distance);
  for (let n = DRAW - 1; n >= 0; n--) {
    const index = base + 1 + n;
    const w1 = ROAD * ps[n];
    const w2 = ROAD * ps[n + 1];
    ctx.globalAlpha = clamp(1.5 - (n / DRAW) * 1.3, 0, 1);
    ctx.fillStyle = index % 2 ? '#13121b' : '#17161f';
    quad(
      px[n] - w1,
      py[n],
      px[n] + w1,
      py[n],
      px[n + 1] + w2,
      py[n + 1],
      px[n + 1] - w2,
      py[n + 1],
    );
    // Kerbs in the corners: team colour and white.
    if (Math.abs(pc[n]) > 0.0006) {
      const k1 = 0.17 * ps[n];
      const k2 = 0.17 * ps[n + 1];
      ctx.fillStyle = index % 2 ? color(0, 1, 50) : '#f1eff5';
      for (const side of [-1, 1]) {
        quad(
          px[n] + side * w1,
          py[n],
          px[n] + side * (w1 + k1),
          py[n],
          px[n + 1] + side * (w2 + k2),
          py[n + 1],
          px[n + 1] + side * w2,
          py[n + 1],
        );
      }
    }
    // Low walls beside the track.
    ctx.fillStyle = '#0b0a12';
    for (const side of [-1, 1]) {
      const a = px[n] + side * 1.8 * ps[n];
      const b = px[n + 1] + side * 1.8 * ps[n + 1];
      quad(a, py[n], a, py[n] - 0.32 * ps[n], b, py[n + 1] - 0.32 * ps[n + 1], b, py[n + 1]);
    }
  }
  ctx.globalAlpha = 1;
  // Neon road edges and wall tops.
  const { width } = view;
  for (const [offset, lift, k, w] of [
    [ROAD, 0, 0, 0.003],
    [1.8, 0.32, 1, 0.0018],
  ]) {
    ctx.beginPath();
    for (const side of [-1, 1]) {
      for (let n = 0; n <= DRAW; n++) {
        const x = px[n] + side * offset * ps[n];
        const y = py[n] - lift * ps[n];
        if (n) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
    }
    neonStroke(ctx, k + clock.time * 0.05, width * w, 0.9);
  }
}

function drawTrackside(): void {
  const base = Math.floor(distance);
  ctx.lineCap = 'round';
  for (let n = DRAW - 1; n >= 0; n--) {
    const index = base + 1 + n;
    const s = ps[n];
    const fade = clamp(1.5 - (n / DRAW) * 1.4, 0, 1);
    if (fade <= 0) continue;
    // Light poles.
    if (index % 8 === 0) {
      ctx.beginPath();
      for (const side of [-1, 1]) {
        const x = px[n] + side * 2.1 * s;
        ctx.moveTo(x, py[n]);
        ctx.lineTo(x, py[n] - 1.4 * s);
        ctx.lineTo(x - side * 0.25 * s, py[n] - 1.45 * s);
      }
      neonStroke(ctx, 2, Math.max(0.6, 0.025 * s), fade);
    }
    // Chevron boards on the outside of corners.
    if (index % 3 === 0 && Math.abs(pc[n]) > 0.0012) {
      const turn = Math.sign(pc[n]);
      const x = px[n] - turn * 1.8 * s;
      const top = py[n] - 0.75 * s;
      const w = 0.6 * s;
      const h = 0.4 * s;
      ctx.globalAlpha = fade;
      ctx.fillStyle = color(0, 1, 48);
      ctx.fillRect(x - w / 2, top, w, h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 0.06 * s);
      ctx.beginPath();
      for (const o of [-0.16, 0.12]) {
        const cxv = x + o * s * turn;
        ctx.moveTo(cxv - turn * 0.07 * s, top + h * 0.2);
        ctx.lineTo(cxv + turn * 0.07 * s, top + h * 0.5);
        ctx.lineTo(cxv - turn * 0.07 * s, top + h * 0.8);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // A gantry over the track now and then.
    if (index % 60 === 0) {
      const l = px[n] - 2.2 * s;
      const r = px[n] + 2.2 * s;
      const top = py[n] - 1.9 * s;
      ctx.beginPath();
      ctx.moveTo(l, py[n]);
      ctx.lineTo(l, top);
      ctx.lineTo(r, top);
      ctx.lineTo(r, py[n]);
      neonStroke(ctx, 3, Math.max(0.8, 0.04 * s), fade);
      const size = 0.26 * s;
      if (size > 5) {
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#08070d';
        ctx.fillRect(l + 0.3 * s, top + 0.05 * s, r - l - 0.6 * s, 0.38 * s);
        ctx.fillStyle = color(0, 1, 70);
        ctx.font = `${size}px ${PIXEL_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LOUD GP', px[n], top + 0.24 * s);
        ctx.globalAlpha = 1;
      }
    }
  }
}

function drawSpeedLines(horizon: number): void {
  const amount = clamp((speed - 60) / 50, 0, 1) + audio.drop;
  if (amount <= 0.02) return;
  const { width, height } = view;
  const vx = px[DRAW];
  const R = Math.hypot(width, height);
  const count = Math.round(amount * 50);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(255,255,255,${0.12 + amount * 0.15})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const a = hash01(i * 7.3) * TAU;
    const t = (hash01(i * 1.9) + clock.time * (0.6 + speed * 0.02)) % 1;
    const r = t * t * R;
    ctx.moveTo(vx + Math.cos(a) * r, horizon + Math.sin(a) * r);
    ctx.lineTo(vx + Math.cos(a) * r * 1.25, horizon + Math.sin(a) * r * 1.25);
  }
  ctx.stroke();
  ctx.restore();
}

/** The size unit of the cockpit, and the line it stands on (the screen bottom, or higher on a tall screen). */
function cockpitFrame(horizon: number): { u: number; floor: number } {
  const u = Math.min(view.width, view.height * 1.4);
  return { u, floor: Math.min(view.height, horizon + u * 0.75) };
}

/**
 * The car around the eye: the tub, tyres, nose, halo, mirrors and the steering wheel,
 * standing on `floor` (the screen bottom, or higher on a tall screen).
 */
function drawCockpit(horizon: number): void {
  const { width: W, height: screenH, cx } = view;
  const { u, floor: H } = cockpitFrame(horizon);
  const body = '#07070b';
  const rim = (k: number, w: number, a = 0.8): void => neonStroke(ctx, k, w, a);

  // On a tall screen, the tub of the car fills the space under the cockpit.
  if (H < screenH - 4) {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-W * 0.1, H - u * 0.14);
    ctx.quadraticCurveTo(cx, H + u * 0.1, W * 1.1, H - u * 0.14);
    ctx.lineTo(W * 1.1, screenH + u);
    ctx.lineTo(-W * 0.1, screenH + u);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-W * 0.1, H - u * 0.14);
    ctx.quadraticCurveTo(cx, H + u * 0.1, W * 1.1, H - u * 0.14);
    rim(0, u * 0.004, 0.7);
  }

  // Front tyres: a sheen on top, tread blur and the compound stripe on the inner sidewall.
  for (const side of [-1, 1]) {
    const inner = cx + side * (W * 0.5 - u * 0.2);
    const tyreW = u * 0.25;
    const left = side < 0 ? inner - tyreW : inner;
    const top = H - u * 0.33;
    const sheen = ctx.createLinearGradient(0, top, 0, top + u * 0.22);
    sheen.addColorStop(0, '#2a2833');
    sheen.addColorStop(1, '#060609');
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.roundRect(left, top, tyreW, u * 0.5, u * 0.06);
    ctx.fill();
    rim(1, u * 0.003, 0.6);
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const y = top + u * 0.03 + ((((i / 6 - distance * 0.37) % 1) + 1) % 1) * u * 0.3;
      ctx.moveTo(left + u * 0.03, y);
      ctx.lineTo(left + tyreW - u * 0.03, y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(inner - side * u * 0.025, top + u * 0.06);
    ctx.lineTo(inner - side * u * 0.025, H + 5);
    rim(1, u * 0.006, 0.9);
    // Suspension arms from the chassis to the wheel.
    ctx.beginPath();
    ctx.moveTo(cx + side * u * 0.07, H - u * 0.13);
    ctx.lineTo(inner, top + u * 0.1);
    ctx.moveTo(cx + side * u * 0.09, H - u * 0.05);
    ctx.lineTo(inner, top + u * 0.2);
    ctx.strokeStyle = body;
    ctx.lineWidth = u * 0.009;
    ctx.stroke();
    rim(4, 1, 0.35);
  }

  // The nose, low between the tyres, with a stripe in the team colour.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - u * 0.014, H - u * 0.19);
  ctx.lineTo(cx + u * 0.014, H - u * 0.19);
  ctx.lineTo(cx + u * 0.13, H + 2);
  ctx.lineTo(cx - u * 0.13, H + 2);
  ctx.closePath();
  ctx.fill();
  rim(0, u * 0.003, 0.6);
  ctx.fillStyle = color(0, 1, 50);
  ctx.beginPath();
  ctx.moveTo(cx - u * 0.005, H - u * 0.185);
  ctx.lineTo(cx + u * 0.005, H - u * 0.185);
  ctx.lineTo(cx + u * 0.035, H + 2);
  ctx.lineTo(cx - u * 0.035, H + 2);
  ctx.closePath();
  ctx.fill();

  // Mirrors on stalks.
  for (const side of [-1, 1]) {
    const mx = cx + side * Math.min(W * 0.4, u * 0.42);
    const my = H - u * 0.42;
    ctx.strokeStyle = body;
    ctx.lineWidth = u * 0.01;
    ctx.beginPath();
    ctx.moveTo(mx - side * u * 0.03, my + u * 0.02);
    ctx.lineTo(cx + side * u * 0.2, H - u * 0.25);
    ctx.stroke();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(mx, my, u * 0.065, u * 0.03, 0, 0, TAU);
    ctx.fill();
    const glass = ctx.createLinearGradient(mx, my - u * 0.025, mx, my + u * 0.025);
    glass.addColorStop(0, color(1, 1, 30));
    glass.addColorStop(1, '#050409');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.ellipse(mx, my, u * 0.055, u * 0.022, 0, 0, TAU);
    ctx.fill();
  }

  // The halo: a hoop over the head and a pillar in front of the eyes.
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(8,8,12,0.94)';
  ctx.lineWidth = u * 0.045;
  ctx.beginPath();
  // The hoop: from the sides at the horizon to its top above the eyes.
  const hoopTop = horizon - u * 0.3;
  const hoopControl = 2 * hoopTop - horizon;
  ctx.moveTo(cx - W * 0.62, horizon);
  ctx.quadraticCurveTo(cx, hoopControl, cx + W * 0.62, horizon);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.62, horizon + u * 0.022);
  ctx.quadraticCurveTo(cx, hoopControl + u * 0.022, cx + W * 0.62, horizon + u * 0.022);
  rim(3, u * 0.004, 0.55);
  ctx.fillStyle = 'rgba(8,8,12,0.94)';
  ctx.beginPath();
  ctx.moveTo(cx - u * 0.006, hoopTop);
  ctx.lineTo(cx + u * 0.006, hoopTop);
  ctx.lineTo(cx + u * 0.016, H - u * 0.17);
  ctx.lineTo(cx - u * 0.016, H - u * 0.17);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + u * 0.006, hoopTop);
  ctx.lineTo(cx + u * 0.016, H - u * 0.17);
  rim(3, u * 0.0025, 0.5);

  // The steering wheel, turned into the corner.
  ctx.save();
  ctx.translate(cx, H - u * 0.07);
  ctx.rotate(steer * 0.55);
  const gloves = color(4, 1, 28);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-u * 0.21, -u * 0.08, u * 0.42, u * 0.17, u * 0.04);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-u * 0.21, -u * 0.08, u * 0.42, u * 0.17, u * 0.04);
  rim(2, u * 0.004, 0.7);
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#030305';
    ctx.beginPath();
    ctx.roundRect(side > 0 ? u * 0.16 : -u * 0.26, -u * 0.1, u * 0.1, u * 0.22, u * 0.04);
    ctx.fill();
    // Gloved hands on the grips.
    ctx.fillStyle = gloves;
    ctx.beginPath();
    ctx.ellipse(side * u * 0.215, -u * 0.01, u * 0.03, u * 0.05, side * 0.25, 0, TAU);
    ctx.fill();
    rim(4, 1, 0.4);
  }
  // Knobs and buttons.
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = color(i, 1, 55);
    ctx.beginPath();
    ctx.arc((i < 3 ? -1 : 1) * u * (0.1 + (i % 3) * 0.022), u * 0.045, u * 0.009, 0, TAU);
    ctx.fill();
  }
  // Shift lights: green, red, blue; all blue at the limiter.
  const rpm = clamp((speed / (TOP_SPEED * 1.15)) * GEARS - (gear - 1), 0, 1);
  const lit = Math.round(rpm * LEDS);
  for (let i = 0; i < LEDS; i++) {
    const on = i < lit || shiftFlash > 0.5;
    const tone = i < 5 ? '#2bff6a' : i < 10 ? '#ff2a3a' : '#3a7bff';
    ctx.fillStyle = on ? (lit >= LEDS - 1 && i < LEDS ? '#5aa0ff' : tone) : '#16161c';
    ctx.beginPath();
    ctx.arc(-u * 0.14 + (i / (LEDS - 1)) * u * 0.28, -u * 0.064, u * 0.0075, 0, TAU);
    ctx.fill();
  }
  // The display: gear, speed and G.
  ctx.fillStyle = '#020306';
  ctx.beginPath();
  ctx.roundRect(-u * 0.07, -u * 0.05, u * 0.14, u * 0.085, u * 0.01);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color(0, 1, 75);
  ctx.font = `${u * 0.045}px ${PIXEL_FONT}`;
  ctx.fillText(String(gear), 0, -u * 0.016);
  ctx.font = `${u * 0.012}px ${PIXEL_FONT}`;
  ctx.fillStyle = '#e8e6f0';
  ctx.fillText(`${Math.round(speed * KMH)} KM/H`, 0, u * 0.017);
  const g = Math.hypot(latG, longG) * 5;
  ctx.fillStyle = audio.drop > 0.3 ? '#2bff6a' : color(2, 1, 70);
  ctx.fillText(audio.drop > 0.3 ? 'DRS OPEN' : `${g.toFixed(1)} G`, 0, u * 0.029);
  ctx.restore();
}

export const f1: Mode = {
  name: 'f1',
  fade: 1,
  bloom: 0.8,
  blend: 'source-over',
  beatRings: false,
  palettes: ['noir', 'neon', 'vapor', 'sunset', 'ultraviolet', 'lava', 'technicolor'],

  beat() {
    kick = Math.min(1, kick + 0.5 + audio.bass * 0.5);
  },

  resize() {
    // The track does not depend on the screen size.
  },

  draw(dt) {
    const { width, height, cx } = view;
    const step = Math.min(dt, 1 / 20);
    drive(step);

    // Braking pitches the view down (the horizon rises); accelerating, up.
    const horizon = height * 0.46 + longG * height * 0.045;
    // A wider view at speed.
    const focal = height * (1.05 - (speed / TOP_SPEED) * 0.25);
    project(horizon, focal);

    // Shake: speed, bass, and the kerbs when the car runs over them.
    const kerb = Math.abs(camX) > 0.7 && Math.abs(curveAt(distance)) > 0.0006 ? 1 : 0;
    const shake = (speed / TOP_SPEED) * 1.5 + audio.bass * 3 + kerb * 5 + audio.beat * 2;
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;

    // The world leans out of the turn and slides with the head.
    ctx.save();
    ctx.translate(cx + sx + latG * width * 0.015, horizon + sy);
    ctx.rotate(-latG * 0.09);
    ctx.translate(-cx, -horizon);
    drawSky(horizon);
    drawGround(horizon);
    drawRoad();
    drawTrackside();
    drawSpeedLines(horizon);
    ctx.restore();

    // The car moves less: the head is pushed to the outside and forward under braking.
    ctx.save();
    const lean = -latG * width * 0.035;
    const pitch = -longG * height * 0.035;
    const zoom = 1 - longG * 0.03;
    const { floor } = cockpitFrame(horizon);
    ctx.translate(cx + sx * 1.5 + lean, floor + sy * 1.5 + pitch);
    ctx.rotate(-latG * 0.03);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -floor);
    drawCockpit(horizon);
    ctx.restore();

    // Hard braking: a red glow at the edges.
    if (longG < -0.3) {
      const glow = ctx.createRadialGradient(
        cx,
        height / 2,
        height * 0.3,
        cx,
        height / 2,
        height * 0.9,
      );
      glow.addColorStop(0, 'rgba(255,0,40,0)');
      glow.addColorStop(1, `rgba(255,0,40,${(-longG - 0.3) * 0.35})`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
    }
  },
};
