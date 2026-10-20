/**
 * Psychedelic pool caustics: the net of light on the floor of a pool at night, computed
 * per pixel in a WebGL shader. Red, green and blue light are bent by slightly different
 * amounts, so every line of light has rainbow edges, and the colours of the light run
 * through the palette. Each kick drops a stone: a ring ripples through the light.
 * Strong beats glitch the water: bands slide sideways and some flip to negative.
 * Every 16 beats the pool folds into a mirror.
 */
import { rnd } from '../core/math';
import { audio, clock, view } from '../core/state';
import { ctx } from '../render/canvases';
import { colorRgb } from '../render/color';
import { glPass, type Pass } from '../render/gl';
import type { Mode } from './mode';

const SHADER = `
uniform vec2 u_res;
uniform float u_time, u_bass, u_split, u_glitch, u_seed, u_mirror;
uniform vec3 u_c0, u_c1, u_c2;
uniform vec4 u_r0, u_r1, u_r2, u_r3;

float hash(float n) { return fract(sin(n) * 43758.5453); }

// The classic iterated caustic pattern: thin bright lines where light bunches up.
float caustic(vec2 uv, float time) {
  vec2 p = uv * 5.0 - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 5; n++) {
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 5.0;
  c = 1.17 - pow(c, 1.4);
  return pow(abs(c), 8.0);
}

// A ring rippling out from a stone: x, y, age in seconds, strength.
vec2 ripple(vec2 uv, vec4 r) {
  if (r.w <= 0.0) return uv;
  vec2 d = uv - r.xy;
  float dist = length(d);
  float front = r.z * 0.5;
  float wave = sin((dist - front) * 60.0) * exp(-abs(dist - front) * 14.0) * exp(-r.z * 1.2) * r.w;
  return uv + normalize(d + 1e-5) * wave * 0.025;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  // Glitch: bands slide sideways.
  float band = floor(frag.y / u_res.y * 24.0);
  float h = hash(band * 7.3 + u_seed);
  if (h < u_glitch * 0.3) frag.x += (hash(band + u_seed * 3.1) - 0.5) * u_res.x * 0.25 * u_glitch;
  vec2 uv = frag / u_res.y;
  float aspect = u_res.x / u_res.y;
  if (u_mirror > 0.5) uv.x = abs(uv.x - aspect * 0.5) + aspect * 0.5;
  uv = ripple(uv, u_r0);
  uv = ripple(uv, u_r1);
  uv = ripple(uv, u_r2);
  uv = ripple(uv, u_r3);
  float t = u_time;
  vec3 light = vec3(
    caustic(uv + vec2(u_split, 0.0), t),
    caustic(uv, t + 0.02),
    caustic(uv - vec2(u_split, 0.0), t + 0.04)
  );
  float m = 0.5 + 0.5 * sin(uv.x * 2.3 + uv.y * 3.1 + t * 0.6);
  vec3 tint = mix(u_c1, u_c2, m);
  vec3 bed = u_c0 * (0.16 + 0.1 * sin(uv.y * 4.0 + t * 0.8));
  vec3 col = bed + light * tint * (1.3 + u_bass * 1.2);
  // Glitch: a few bands flip to negative.
  if (h > 1.0 - u_glitch * 0.12) col = 1.0 - clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
}`;

interface Ring {
  x: number;
  y: number;
  age: number;
  strength: number;
}

let pass: Pass | null | undefined;
let time = 0;
let rings: Ring[] = [];
let glitch = 0;
let seed = 0;
let nextSeed = 0;
let beats = 0;

const unit = (k: number, lightness: number): number[] => colorRgb(k, lightness).map((c) => c / 255);

export const caustics: Mode = {
  name: 'caustics',
  fade: 1,
  bloom: 0.6,
  blend: 'source-over',
  beatRings: false,
  palettes: ['deep sea', 'vapor', 'acid', 'technicolor', 'ultraviolet', 'neon', 'toxic'],

  beat() {
    beats++;
    const aspect = view.width / view.height;
    rings.push({
      x: rnd(0.1, aspect - 0.1),
      y: rnd(0.1, 0.9),
      age: 0,
      strength: 0.6 + audio.bass * 0.8,
    });
    if (rings.length > 4) rings.shift();
    // Only some strong beats glitch, so the light can be seen.
    if (audio.bass > 0.7 && Math.random() < 0.35) glitch = 1;
  },

  draw(dt) {
    const { width, height } = view;
    if (pass === undefined) pass = glPass(SHADER);
    time += dt * (0.45 + audio.mid * 0.6);
    for (const ring of rings) ring.age += dt;
    rings = rings.filter((ring) => ring.age < 3);
    glitch = Math.max(0, glitch - dt * 4);
    if (clock.time > nextSeed) {
      seed = Math.random() * 100;
      nextSeed = clock.time + 0.08;
    }
    if (!pass) {
      // No WebGL: a calm gradient instead.
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(
        0,
        `rgb(${unit(0, 30)
          .map((c) => (c * 255) | 0)
          .join(',')})`,
      );
      g.addColorStop(1, '#02060a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      return;
    }
    const ring = (i: number): number[] => {
      const r = rings[i];
      return r ? [r.x, r.y, r.age, r.strength] : [0, 0, 0, 0];
    };
    const scale = Math.min(view.dpr, 1.5) * 0.75;
    const shift = clock.time * 0.15;
    const canvas = pass.render(width * scale, height * scale, {
      u_time: time,
      u_bass: audio.bass,
      u_split: 0.004 + audio.beat * 0.012 + audio.high * 0.004,
      u_glitch: glitch,
      u_seed: seed,
      u_mirror: Math.floor(beats / 16) % 2,
      u_c0: unit(shift, 35),
      u_c1: unit(shift + 1, 70),
      u_c2: unit(shift + 2.5, 70),
      u_r0: ring(0),
      u_r1: ring(1),
      u_r2: ring(2),
      u_r3: ring(3),
    });
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(canvas, 0, 0, width, height);
  },
};
