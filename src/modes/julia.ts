/** A Julia set fractal that morphs: its seed walks along the edge of the Mandelbrot set. */
import { clamp } from '../core/math';
import type { Rgb } from '../core/rgb';
import { audio, clock, scene, view } from '../core/state';
import { ctx } from '../render/canvases';
import { colorRgb } from '../render/color';
import { PixelLayer } from '../render/pixelLayer';
import type { Mode } from './mode';

const MAX_ITERATIONS = 42;
const SHADES = 256;
const pixels = new PixelLayer();

export const julia: Mode = {
  name: 'julia',
  fade: 1,
  bloom: 0.35,
  blend: 'source-over',
  beatRings: false,
  palettes: ['acid', 'ultraviolet', 'lava', 'toxic', 'void'],

  draw() {
    const { width, height } = view;
    const time = clock.time;
    // Low resolution (about 130 pixels across), scaled up smoothly.
    const scale = Math.max(3, Math.round(width / 130));
    const w = Math.ceil(width / scale);
    const h = Math.ceil(height / scale);
    pixels.setSize(w, h);

    const shades: Rgb[] = new Array(SHADES);
    for (let i = 0; i < SHADES; i++) {
      const t = i / (SHADES - 1);
      shades[i] = colorRgb(t * 5 + time * 0.25, 22 + 70 * Math.pow(t, 0.6));
    }

    // The seed c walks the edge of the Mandelbrot main cardioid: every point there
    // gives an intricate, almost connected set.
    const theta = time * 0.11 + audio.beats * 0.035;
    const radius = 1.0 + 0.025 * Math.sin(time * 0.37) + audio.bass * 0.02;
    const cr = radius * (0.5 * Math.cos(theta) - 0.25 * Math.cos(2 * theta));
    const ci = radius * (0.5 * Math.sin(theta) - 0.25 * Math.sin(2 * theta));

    const zoom = 1.45 * (1 - audio.beat * 0.06);
    const aspect = w / h;
    const rotation = time * 0.05;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const bg = scene.palette.bgRgb;
    const data = pixels.pixels;
    let p = 0;
    for (let j = 0; j < h; j++) {
      const v = ((j / h) * 2 - 1) * zoom;
      for (let i = 0; i < w; i++) {
        const u = ((i / w) * 2 - 1) * zoom * aspect;
        let x = u * cos - v * sin;
        let y = u * sin + v * cos;
        let iteration = 0;
        let m2 = x * x + y * y;
        while (iteration < MAX_ITERATIONS && m2 < 256) {
          const xt = x * x - y * y + cr;
          y = 2 * x * y + ci;
          x = xt;
          m2 = x * x + y * y;
          iteration++;
        }
        let c: Rgb;
        if (iteration === MAX_ITERATIONS) c = bg;
        else {
          // Smooth iteration count, so the bands do not step.
          const mu = iteration + 1 - Math.log((Math.log(m2) * 0.5) / Math.LN2) / Math.LN2;
          const t = clamp(mu / MAX_ITERATIONS, 0, 1);
          c = shades[Math.floor(Math.sqrt(t) * (SHADES - 1))];
        }
        data[p] = c[0];
        data[p + 1] = c[1];
        data[p + 2] = c[2];
        data[p + 3] = 255;
        p += 4;
      }
    }
    pixels.flush();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(pixels.canvas, 0, 0, width, height);
  },
};
