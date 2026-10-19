/**
 * Glitchy neon solids in 3D: a Platonic solid (dodecahedron, icosahedron, cube,
 * octahedron, tetrahedron) with its dual turning the other way inside it, or a 4D
 * tesseract turning through the fourth dimension; small octahedra circle around it.
 * Faces glow in colours that never stop moving, the vertices vibrate with the treble,
 * beats blow the faces apart along their normals, and now and then the picture
 * glitches: vertices jump, the image splits into colours and strips slip sideways.
 * Every 8 beats the next solid takes over at the peak of an explosion. Tilting the
 * phone turns the view.
 */
import { rnd, rndInt, TAU } from '../core/math';
import { audio, clock, motion, view } from '../core/state';
import { ctx, drawStrip, snapshot, takeSnapshot } from '../render/canvases';
import { color } from '../render/color';
import { neonStroke } from '../render/neon';
import type { Mode } from './mode';

type Vec3 = [number, number, number];

interface Solid {
  vertices: Vec3[];
  faces: number[][];
  edges: [number, number][];
}

const PHI = (1 + Math.sqrt(5)) / 2;

function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** All sign combinations of the non-zero coordinates of `v`. */
function signs(v: Vec3): Vec3[] {
  let out: Vec3[] = [v];
  for (let axis = 0; axis < 3; axis++) {
    if (!v[axis]) continue;
    out = out.flatMap((p) => {
      const flipped: Vec3 = [...p];
      flipped[axis] = -flipped[axis];
      return [p, flipped];
    });
  }
  return out;
}

/** The three cyclic rotations of the coordinates of `v`. */
function cycles([x, y, z]: Vec3): Vec3[] {
  return [
    [x, y, z],
    [z, x, y],
    [y, z, x],
  ];
}

/**
 * A solid from its vertices and the vertices of its dual: each dual vertex points at
 * one face, made of the vertices that lie furthest in its direction.
 */
function solid(vertices: Vec3[], dual: Vec3[]): Solid {
  const unit = vertices.map(normalize);
  const faces = dual.map((d) => {
    const n = normalize(d);
    const reach = Math.max(...unit.map((v) => dot(v, n)));
    const face = unit.flatMap((v, i) => (dot(v, n) > reach - 1e-6 ? [i] : []));
    // Order the corners around the face normal.
    const first = unit[face[0]];
    const u = normalize([
      first[0] - n[0] * dot(first, n),
      first[1] - n[1] * dot(first, n),
      first[2] - n[2] * dot(first, n),
    ]);
    const w = cross(n, u);
    return face.sort(
      (a, b) =>
        Math.atan2(dot(unit[a], w), dot(unit[a], u)) - Math.atan2(dot(unit[b], w), dot(unit[b], u)),
    );
  });
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (const face of faces) {
    face.forEach((a, i) => {
      const b = face[(i + 1) % face.length];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([a, b]);
      }
    });
  }
  return { vertices: unit, faces, edges };
}

const TETRA: Vec3[] = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
];
const CUBE = signs([1, 1, 1]);
const OCTA = cycles([1, 0, 0]).flatMap(signs);
const ICOSA = cycles([0, 1, PHI]).flatMap(signs);
const DODECA = [...signs([1, 1, 1]), ...cycles([0, 1 / PHI, PHI]).flatMap(signs)];

interface Shape {
  outer: Solid;
  inner: Solid | null;
}

const SHAPES: readonly (Shape | 'tesseract')[] = [
  { outer: solid(DODECA, ICOSA), inner: solid(ICOSA, DODECA) },
  { outer: solid(ICOSA, DODECA), inner: solid(DODECA, ICOSA) },
  'tesseract',
  { outer: solid(CUBE, OCTA), inner: solid(OCTA, CUBE) },
  {
    outer: solid(
      TETRA,
      TETRA.map(([x, y, z]) => [-x, -y, -z] as Vec3),
    ),
    inner: solid(
      TETRA.map(([x, y, z]) => [-x, -y, -z] as Vec3),
      TETRA,
    ),
  },
  { outer: solid(OCTA, CUBE), inner: solid(CUBE, OCTA) },
];
const SATELLITE = solid(OCTA, CUBE);
const SATELLITES = 6;

/** The 16 corners of a 4D cube, and its 32 edges (corners that differ in one sign). */
const TESSERACT = Array.from({ length: 16 }, (_, i) =>
  [0, 1, 2, 3].map((bit) => ((i >> bit) & 1 ? 1 : -1)),
);
const TESSERACT_EDGES: [number, number][] = [];
for (let i = 0; i < 16; i++) {
  for (let bit = 0; bit < 4; bit++)
    if (!(i & (1 << bit))) TESSERACT_EDGES.push([i, i | (1 << bit)]);
}

let shape = 0;
let beats = 0;
const angles = { x: 0.4, y: 0.2, z: 0, w: 0 };
/** 1 after a beat, falling: how far the faces fly apart. */
let explode = 0;
/** clock.time until which the glitches run. */
let glitchUntil = 0;
/** Vertices that jumped in the current glitch, and where to. */
let broken: { index: number; offset: Vec3 }[] = [];

/** 3D rotation by the current angles (plus the phone tilt), then perspective. */
function projector(spin: number, radius: number): (v: Vec3, out: number[]) => number {
  const ax = angles.x * spin + motion.tiltY * 0.8;
  const ay = angles.y * spin + motion.tiltX * 0.8;
  const az = angles.z * spin;
  const [sx, cx] = [Math.sin(ax), Math.cos(ax)];
  const [sy, cy] = [Math.sin(ay), Math.cos(ay)];
  const [sz, cz] = [Math.sin(az), Math.cos(az)];
  return ([x, y, z], out) => {
    const y1 = y * cx - z * sx;
    const z1 = y * sx + z * cx;
    const x2 = x * cy + z1 * sy;
    const z2 = -x * sy + z1 * cy;
    const x3 = x2 * cz - y1 * sz;
    const y3 = x2 * sz + y1 * cz;
    const perspective = 3.2 / (3.2 - z2);
    out[0] = view.cx + x3 * radius * perspective;
    out[1] = view.cy + y3 * radius * perspective;
    return z2;
  };
}

/** Each vertex, moved by the vibration, the glitch and the explosion of `face`. */
function shaken(v: Vec3, index: number, amount: number): Vec3 {
  let [x, y, z] = v;
  x += (Math.random() - 0.5) * amount;
  y += (Math.random() - 0.5) * amount;
  z += (Math.random() - 0.5) * amount;
  for (const b of broken) {
    if (b.index === index) {
      x += b.offset[0];
      y += b.offset[1];
      z += b.offset[2];
    }
  }
  return [x, y, z];
}

function drawSolid(s: Solid, radius: number, spin: number, k: number, filled: boolean): void {
  const project = projector(spin, radius);
  const jitter = 0.012 + audio.high * 0.07;
  const corners = s.vertices.map((v, i) => shaken(v, i, jitter));
  const point = [0, 0];
  // Faces far to near, each pushed out along its normal by the explosion.
  const order = s.faces.map((face, f) => {
    const centre: Vec3 = [0, 0, 0];
    for (const i of face) for (let a = 0; a < 3; a++) centre[a] += corners[i][a] / face.length;
    const push = normalize(centre).map((c) => c * explode * 0.4) as Vec3;
    const depth = project([centre[0] + push[0], centre[1] + push[1], centre[2] + push[2]], point);
    return { face, f, push, depth };
  });
  order.sort((a, b) => a.depth - b.depth);
  ctx.lineJoin = 'round';
  for (const { face, f, push, depth } of order) {
    ctx.beginPath();
    face.forEach((i, n) => {
      const c = corners[i];
      project([c[0] + push[0], c[1] + push[1], c[2] + push[2]], point);
      if (n) ctx.lineTo(point[0], point[1]);
      else ctx.moveTo(point[0], point[1]);
    });
    ctx.closePath();
    const near = (depth + 1.2) / 2.4;
    const hue = k + f * 0.37 + clock.time * 0.6;
    if (filled) {
      ctx.fillStyle = color(hue, 0.06 + near * 0.12 + audio.beat * 0.08, 55);
      ctx.fill();
    }
    neonStroke(ctx, hue, view.min * 0.004 * (1 + audio.bass * 0.8), 0.35 + near * 0.65);
  }
}

function drawTesseract(radius: number, k: number): void {
  const project = projector(1, radius * 0.62);
  const [sw, cw] = [Math.sin(angles.w), Math.cos(angles.w)];
  const [sv, cv] = [Math.sin(angles.w * 0.7), Math.cos(angles.w * 0.7)];
  const jitter = 0.015 + audio.high * 0.08;
  const points = TESSERACT.map(([x, y, z, w], i) => {
    // Turn through the fourth dimension (planes x-w and y-w), then look at it from w.
    const x1 = x * cw - w * sw;
    const w1 = x * sw + w * cw;
    const y1 = y * cv - w1 * sv;
    const w2 = y * sv + w1 * cv;
    const scale = (2.4 / (3 - w2)) * (1 + explode * 0.4);
    const out = [0, 0];
    project(shaken([x1 * scale, y1 * scale, z * scale], i, jitter), out);
    return out;
  });
  // One path per edge direction: four colours.
  for (let bit = 0; bit < 4; bit++) {
    ctx.beginPath();
    for (const [a, b] of TESSERACT_EDGES) {
      if (((a ^ b) >> bit) & 1) {
        ctx.moveTo(points[a][0], points[a][1]);
        ctx.lineTo(points[b][0], points[b][1]);
      }
    }
    neonStroke(ctx, k + bit * 0.9 + clock.time * 0.6, view.min * 0.0045 * (1 + audio.bass), 1);
  }
}

/** Strips of the picture slip sideways, and a ghost copy of it jumps aside. */
function glitchPicture(): void {
  takeSnapshot();
  const { height, width } = view;
  for (let i = 0; i < 6; i++) {
    const y = Math.random() * height;
    drawStrip(snapshot, y, rnd(4, 40), rnd(-1, 1) * width * 0.08, y);
  }
  // A plain (not glowing) copy, so that the glitch does not add light.
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 0.25;
  const shift = view.min * rnd(-0.03, 0.03);
  ctx.drawImage(
    snapshot,
    0,
    0,
    snapshot.width,
    snapshot.height,
    shift,
    -shift * 0.5,
    width,
    height,
  );
  ctx.restore();
}

export const solids: Mode = {
  name: 'solids',
  fade: 0.22,
  zoom: 1.01,
  rotate: 0.003,
  beatRings: false,
  palettes: ['neon', 'ultraviolet', 'vapor', 'acid', 'void', 'technicolor', 'deep sea'],

  beat() {
    explode = Math.max(explode, 0.35 + audio.bass * 0.5);
    if (++beats % 8 === 0) {
      explode = 1.1;
      shape = (shape + 1 + rndInt(2)) % SHAPES.length;
    }
    if (Math.random() < 0.3) {
      glitchUntil = clock.time + rnd(0.1, 0.25);
      const count = SHAPES[shape] === 'tesseract' ? 16 : 20;
      broken = Array.from({ length: 1 + rndInt(3) }, () => ({
        index: rndInt(count),
        offset: [rnd(-0.6, 0.6), rnd(-0.6, 0.6), rnd(-0.6, 0.6)] as Vec3,
      }));
    }
  },

  draw(dt) {
    const spin = dt * (0.35 + audio.mid * 1.2);
    angles.x += spin * 0.5;
    angles.y += spin;
    angles.z += spin * 0.3;
    angles.w += dt * (0.5 + audio.mid * 1.5);
    explode = Math.max(0, explode - dt * 2.2);
    if (clock.time > glitchUntil) broken = [];
    const radius = view.min * 0.3 * (1 + audio.bass * 0.15 + audio.beat * 0.06);
    const k = clock.time * 0.2;

    const current = SHAPES[shape];
    if (current === 'tesseract') drawTesseract(radius, k);
    else {
      if (current.inner) drawSolid(current.inner, radius * 0.5, -1.4, k + 2, false);
      drawSolid(current.outer, radius, 1, k, true);
    }

    // Small octahedra circle around on a tilted ring.
    for (let i = 0; i < SATELLITES; i++) {
      const a = (i / SATELLITES) * TAU + clock.time * 0.4;
      const ring = view.min * 0.44;
      ctx.save();
      ctx.translate(Math.cos(a) * ring, Math.sin(a) * ring * 0.45);
      drawSolid(SATELLITE, radius * 0.12, 2 + i * 0.3, k + i, false);
      ctx.restore();
    }

    if (clock.time < glitchUntil) glitchPicture();
  },
};
