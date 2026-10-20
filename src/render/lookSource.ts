/**
 * Looks that rebuild the whole picture on its way to the screen. The compositor shows
 * their canvas in place of the scene, so they never feed back into the trails.
 *
 *   rutt-etra  the 1972 Rutt/Etra video synthesizer: the picture as rows of glowing
 *              scanlines, each lifted by the brightness under it, in a tilted 3D relief
 *   droste     Escher's "Print Gallery" trick: the picture inside itself, wound into an
 *              endless spiral that zooms on the beat, each nested copy in turned colours
 */
import { context2d, createLayer, setCanvasSize } from '../core/dom';
import { audio, clock, scene, view } from '../core/state';
import { sceneCanvas } from './canvases';
import { background, colorRgb } from './color';
import { glPass, type Pass } from './gl';

// Rutt/Etra --------------------------------------------------------------------------

const SAMPLE_W = 160;
const sample = document.createElement('canvas');
const sampleCtx = context2d(sample, { willReadFrequently: true });
const rutt = createLayer();

function ruttEtra(): HTMLCanvasElement {
  const { width, height, dpr, cx } = view;
  const W = SAMPLE_W;
  const H = Math.max(40, Math.round((W * height) / width));
  setCanvasSize(sample, W, H);
  sampleCtx.drawImage(sceneCanvas, 0, 0, W, H);
  const data = sampleCtx.getImageData(0, 0, W, H).data;
  setCanvasSize(rutt.canvas, sceneCanvas.width, sceneCanvas.height);
  const g = rutt.ctx;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = background();
  g.fillRect(0, 0, width, height);
  g.globalCompositeOperation = scene.palette.light ? 'source-over' : 'lighter';
  g.lineJoin = 'round';
  const rows = Math.min(H, 72);
  // Far rows narrow (the tilt sways with the mids); bright parts lift with the bass.
  const tilt = 0.28 + Math.sin(clock.time * 0.4) * 0.08 + audio.mid * 0.1;
  const lift = height * (0.07 + audio.bass * 0.09);
  const xs = new Float32Array(W / 2);
  const ys = new Float32Array(W / 2);
  const piece = 10;
  for (let r = 0; r < rows; r++) {
    const sy = Math.floor((r / rows) * H);
    const depth = r / (rows - 1);
    const spread = 1 - tilt * (1 - depth);
    const baseY = height * (0.1 + depth * 0.84);
    for (let x = 0, n = 0; x < W; x += 2, n++) {
      const i = (sy * W + x) * 4;
      const lum = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
      xs[n] = cx + (x / (W - 1) - 0.5) * width * 1.06 * spread;
      ys[n] = baseY - lum * lift;
    }
    const tint = colorRgb(r * 0.08 + clock.time * 0.1, 65);
    const width1 = 0.8 + depth * 1.4 + audio.beat * 1.4;
    // Short pieces, each in the colour under it mixed with the palette.
    for (let start = 0; start < xs.length - 1; start += piece) {
      const stop = Math.min(xs.length - 1, start + piece);
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let n = start; n <= stop; n++) {
        const i = (sy * W + n * 2) * 4;
        red += data[i];
        green += data[i + 1];
        blue += data[i + 2];
      }
      const count = stop - start + 1;
      const mix = (c: number, t: number): number =>
        Math.min(255, (c / count) * 1.8 * 0.6 + t * 0.55);
      g.strokeStyle = `rgb(${mix(red, tint[0])},${mix(green, tint[1])},${mix(blue, tint[2])})`;
      g.beginPath();
      g.moveTo(xs[start], ys[start]);
      for (let n = start + 1; n <= stop; n++) g.lineTo(xs[n], ys[n]);
      // A wide faint glow, then the line.
      g.globalAlpha = 0.12 + depth * 0.1;
      g.lineWidth = width1 * 4;
      g.stroke();
      g.globalAlpha = 0.55 + depth * 0.45;
      g.lineWidth = width1;
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  return rutt.canvas;
}

// Droste -------------------------------------------------------------------------------

const DROSTE = `
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_zoom, u_arms, u_scale, u_hue, u_split, u_fold, u_glow;
const float PI = 3.14159265;

vec2 cmul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }

// Turns the colour around the grey axis.
vec3 turn(vec3 c, float a) {
  const vec3 k = vec3(0.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
}

// The scene at z, in units of the short side from the middle.
vec3 scene(vec2 z) {
  vec2 uv = z * min(u_res.x, u_res.y) / u_res + 0.5;
  return texture2D(u_tex, clamp(uv, 0.001, 0.999)).rgb;
}

void main() {
  vec2 z = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  // Sometimes a kaleidoscope fold first.
  if (u_fold > 0.5) {
    float seg = 2.0 * PI / u_fold;
    float a = abs(mod(atan(z.y, z.x), seg) - seg * 0.5);
    z = length(z) * vec2(cos(a), sin(a));
  }
  float r2 = 0.5;
  float L = log(u_scale);
  vec2 w = vec2(log(max(length(z), 1e-6) / r2), atan(z.y, z.x));
  // One turn around the middle = u_arms copies inward: the spiral.
  w = cmul(w, vec2(1.0, -u_arms * L / (2.0 * PI)));
  float x = w.x + u_zoom;
  float level = floor(x / L);
  float inRing = x / L - level;
  w.x = (inRing - 1.0) * L;
  vec2 p = exp(w.x) * r2 * vec2(cos(w.y), sin(w.y));
  // Red and blue from slightly other zooms: colour fringes on the beat.
  vec3 col = vec3(scene(p * (1.0 + u_split)).r, scene(p).g, scene(p * (1.0 - u_split)).b);
  // Each nested copy turns the colours further.
  col = turn(col, level * u_hue);
  // The seam between two copies: a thin frame of light.
  float seam = smoothstep(0.035, 0.0, inRing) + smoothstep(0.965, 1.0, inRing);
  col += seam * u_glow * vec3(1.0, 0.82, 0.95);
  gl_FragColor = vec4(col, 1.0);
}`;

let drostePass: Pass | null | undefined;
const droste = { zoom: 0, direction: 1, lastDrop: 0 };
/** Arms of the spiral per section (negative: the other way round), and the fold. */
// prettier-ignore
const DROSTE_SECTIONS = [{ arms: 1, fold: 0 }, { arms: 2, fold: 0 }, { arms: -1, fold: 6 }, { arms: 1, fold: 0 }, { arms: 3, fold: 0 }, { arms: -2, fold: 8 }];

function drosteSpiral(dt: number): HTMLCanvasElement {
  if (drostePass === undefined) drostePass = glPass(DROSTE);
  if (!drostePass) return sceneCanvas;
  // A drop turns the zoom around.
  if (audio.drop > 0.9 && droste.lastDrop <= 0.9) droste.direction *= -1;
  droste.lastDrop = audio.drop;
  droste.zoom += dt * droste.direction * (0.3 + audio.bass * 0.5 + audio.beat * 1.4);
  const section = DROSTE_SECTIONS[Math.floor(audio.beats / 32) % DROSTE_SECTIONS.length];
  const scale = Math.min(view.dpr, 1.25);
  return drostePass.render(
    view.width * scale,
    view.height * scale,
    {
      u_zoom: droste.zoom,
      u_arms: section.arms,
      u_scale: 3,
      u_hue: 0.45,
      u_split: 0.004 + audio.beat * 0.025,
      u_fold: section.fold,
      u_glow: 0.12 + audio.beat * 0.5,
    },
    sceneCanvas,
  );
}

/** The canvas the compositor shows: the scene, or what the look makes of it. */
export function lookSource(dt: number): HTMLCanvasElement {
  if (scene.look.rutt) return ruttEtra();
  if (scene.look.droste) return drosteSpiral(dt);
  return sceneCanvas;
}
