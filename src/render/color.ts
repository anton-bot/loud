/** Colours from the current palette. */
import { cssRgb, cssRgba, hslToRgb, type Rgb } from '../core/rgb';
import { audio, scene, view } from '../core/state';

/**
 * Colour number `k` of the current palette, as RGB.
 *
 * `k` is continuous: 1.5 is halfway between colours 1 and 2. The scene hue turns
 * the whole palette slowly. `lightness` (0..100, 60 = the colour as it is) moves
 * the colour toward white or black; on light palettes the direction is reversed,
 * so that "light" always means "stands out from the background".
 */
export function colorRgb(k: number, lightness?: number): Rgb {
  const { palette, hue } = scene;
  if (!palette.rgb) return hslToRgb(hue + k * 40, lightness == null ? 60 : lightness);

  const n = palette.rgb.length;
  const f = (((k + hue / 90) % n) + n) % n;
  const i = Math.floor(f);
  const t = f - i;
  const c1 = palette.rgb[i];
  const c2 = palette.rgb[(i + 1) % n];
  let r = c1[0] + (c2[0] - c1[0]) * t;
  let g = c1[1] + (c2[1] - c1[1]) * t;
  let b = c1[2] + (c2[2] - c1[2]) * t;
  if (lightness != null) {
    const m = palette.light ? -(lightness - 60) / 60 : (lightness - 60) / 40;
    if (m > 0) {
      r += (255 - r) * m;
      g += (255 - g) * m;
      b += (255 - b) * m;
    } else {
      r *= 1 + m;
      g *= 1 + m;
      b *= 1 + m;
    }
  }
  return [r, g, b];
}

/** Colour number `k` of the current palette as a CSS colour. See `colorRgb`. */
export function color(k: number, alpha = 1, lightness?: number): string {
  return cssRgba(colorRgb(k, lightness), alpha);
}

/** The palette background as a CSS colour. */
export function background(alpha = 1): string {
  const c = scene.palette.bgRgb;
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

/** The palette background with a soft glow in the middle, for clearing the scene. */
export function backgroundGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
  const { cx, cy } = view;
  const { palette } = scene;
  const b = palette.bgRgb;
  const gradient = ctx.createRadialGradient(cx, cy * 0.85, 0, cx, cy, Math.hypot(cx, cy) * 1.05);
  if (palette.light) {
    gradient.addColorStop(
      0,
      cssRgb(Math.min(255, b[0] + 10), Math.min(255, b[1] + 10), Math.min(255, b[2] + 10)),
    );
    gradient.addColorStop(1, cssRgb(b[0] * 0.86, b[1] * 0.86, b[2] * 0.86));
  } else {
    const tint = colorRgb(0, 35);
    const m = 0.13 + audio.bass * 0.06;
    gradient.addColorStop(
      0,
      cssRgb(
        b[0] * (1 - m) + tint[0] * m,
        b[1] * (1 - m) + tint[1] * m,
        b[2] * (1 - m) + tint[2] * m,
      ),
    );
    gradient.addColorStop(0.55, palette.bg);
    gradient.addColorStop(1, cssRgb(b[0] * 0.5, b[1] * 0.5, b[2] * 0.5));
  }
  return gradient;
}
