/** Neon tubes: drifting glowing outlines and a spinning wireframe solid. */
import { rnd, rndInt, TAU } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { color } from '../render/color';
import { neonStroke } from '../render/neon';
import { fillCircle, polygonPath, starPath } from '../render/shapes';
import type { Mode } from './mode';

type Vec3 = readonly [number, number, number];

interface Solid {
  readonly vertices: readonly Vec3[];
  readonly edges: readonly (readonly [number, number])[];
}

interface Tube {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  /** 0 circle, 7 star, else a polygon with this many sides. */
  sides: number;
  r: number;
  k: number;
  phase: number;
  age: number;
  life: number;
}

/** All vertex pairs at distance 2: the edges of a solid with edge length 2. */
function edgesOfLength2(vertices: readonly Vec3[]): [number, number][] {
  const edges: [number, number][] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const a = vertices[i];
      const b = vertices[j];
      if (Math.abs(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) - 2) < 0.01)
        edges.push([i, j]);
    }
  }
  return edges;
}

const SOLIDS: readonly Solid[] = (() => {
  const phi = (1 + Math.sqrt(5)) / 2;
  const icosahedron: Vec3[] = [];
  for (const a of [-1, 1]) {
    for (const b of [-phi, phi]) {
      icosahedron.push([0, a, b], [a, b, 0], [b, 0, a]);
    }
  }
  // prettier-ignore
  const cube: Vec3[] = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
  ];
  // prettier-ignore
  const octahedron: Vec3[] = [[1.4, 0, 0], [-1.4, 0, 0], [0, 1.4, 0], [0, -1.4, 0], [0, 0, 1.4], [0, 0, -1.4]];
  // prettier-ignore
  const octahedronEdges: [number, number][] = [
    [0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2],
  ];
  // prettier-ignore
  const tetrahedron: Vec3[] = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  // prettier-ignore
  const tetrahedronEdges: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  return [
    { vertices: cube, edges: edgesOfLength2(cube) },
    { vertices: octahedron, edges: octahedronEdges },
    { vertices: tetrahedron, edges: tetrahedronEdges },
    {
      vertices: icosahedron.map(([x, y, z]) => [x / phi, y / phi, z / phi] as const),
      edges: edgesOfLength2(icosahedron),
    },
  ];
})();

const tubes: Tube[] = [];
let solidIndex = 0;
const angles: [number, number, number] = [0.3, 0.6, 0.1];
/** Extra spin after a beat, 1..0. */
let kick = 0;

function addTubes(count: number): void {
  const { width, height, min } = view;
  for (let i = 0; i < count; i++) {
    tubes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: rnd(-25, 25),
      vy: rnd(-25, 25),
      rot: Math.random() * TAU,
      spin: rnd(-1, 1),
      sides: [0, 3, 4, 5, 6, 7][rndInt(6)],
      r: min * rnd(0.05, 0.16),
      k: Math.random() * 4,
      phase: Math.random() * TAU,
      age: 0,
      life: rnd(4, 9),
    });
  }
  while (tubes.length > 16) tubes.shift();
}

function drawTubes(dt: number): void {
  const { width, height } = view;
  const time = clock.time;
  for (let i = tubes.length - 1; i >= 0; i--) {
    const s = tubes[i];
    s.age += dt;
    if (s.age > s.life) {
      tubes.splice(i, 1);
      continue;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.rot += s.spin * dt * (1 + audio.mid);
    // Wrap around the screen edges.
    if (s.x < -s.r) s.x = width + s.r;
    if (s.x > width + s.r) s.x = -s.r;
    if (s.y < -s.r) s.y = height + s.r;
    if (s.y > height + s.r) s.y = -s.r;
    // Fade in and out, hum, and now and then a flicker like a failing tube.
    let alpha =
      Math.min(1, s.age * 2, (s.life - s.age) * 1.5) *
      (0.75 + 0.25 * Math.sin(time * 17 + s.phase));
    if (Math.sin(time * 1.3 + s.phase * 7) > 0.985) alpha *= 0.2;
    const r = s.r * (1 + audio.bass * 0.25 + audio.beat * 0.1);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    if (s.sides === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
    } else if (s.sides === 7) starPath(ctx, r, 0.45);
    else polygonPath(ctx, s.sides, r);
    neonStroke(ctx, s.k, 2.2, alpha);
    ctx.restore();
  }
}

function drawSolid(dt: number): void {
  const { cx, cy, min } = view;
  const time = clock.time;
  kick = Math.max(0, kick - dt * 2);
  const speed = 0.3 + audio.mid * 1.2 + kick * 3;
  angles[0] += dt * speed * 0.7;
  angles[1] += dt * speed;
  angles[2] += dt * speed * 0.35;

  const solid = SOLIDS[solidIndex];
  const [ax, ay, az] = angles;
  const size = min * 0.2 * (1 + audio.bass * 0.45 + audio.beat * 0.1);
  const cosX = Math.cos(ax);
  const sinX = Math.sin(ax);
  const cosY = Math.cos(ay);
  const sinY = Math.sin(ay);
  const cosZ = Math.cos(az);
  const sinZ = Math.sin(az);
  // Rotate around x, y, then z; then a simple perspective divide.
  const points = solid.vertices.map(([x, y, z]) => {
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    const x2 = x * cosY + z1 * sinY;
    const z2 = -x * sinY + z1 * cosY;
    const x3 = x2 * cosZ - y1 * sinZ;
    const y3 = x2 * sinZ + y1 * cosZ;
    const perspective = 3 / (3 + z2);
    return [cx + x3 * perspective * size, cy + y3 * perspective * size, perspective] as const;
  });
  solid.edges.forEach(([i, j], n) => {
    ctx.beginPath();
    ctx.moveTo(points[i][0], points[i][1]);
    ctx.lineTo(points[j][0], points[j][1]);
    neonStroke(
      ctx,
      n * 0.37 + time * 0.2,
      2 + (points[i][2] + points[j][2]),
      0.7 + 0.3 * Math.sin(time * 9 + n),
    );
  });
  for (const p of points) {
    ctx.fillStyle = color(1, 1, 95);
    fillCircle(ctx, p[0], p[1], 1.5 + p[2] * 1.5 + audio.high * 3);
  }
}

export const neon: Mode = {
  name: 'zeds-neon',
  fade: 0.5,
  palettes: ['neon', 'vapor', 'acid', 'void', 'ultraviolet', 'deep sea', 'noir', 'candy'],

  beat() {
    addTubes(1 + Math.floor(audio.bass * 3));
    if (Math.random() < 0.25) solidIndex = rndInt(SOLIDS.length);
    kick = 1;
  },

  draw(dt) {
    if (!tubes.length) addTubes(8);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    drawTubes(dt);
    drawSolid(dt);
  },
};
