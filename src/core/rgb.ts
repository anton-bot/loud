/** RGB colour, channels 0..255. Channels can be fractional. */
export type Rgb = readonly [r: number, g: number, b: number];

/** '#rrggbb' → [r, g, b]. */
export function hexToRgb(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Fully saturated HSL colour. `hue` in degrees, `lightness` 0..100. */
export function hslToRgb(hue: number, lightness: number): Rgb {
  const h = ((hue % 360) + 360) % 360;
  const l = lightness / 100;
  const c = 1 - Math.abs(2 * l - 1);
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** CSS `rgb()` with the channels cut to integers. */
export function cssRgb(r: number, g: number, b: number): string {
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/** CSS `rgba()` with the channels cut to integers. */
export function cssRgba(color: Rgb, alpha: number): string {
  return `rgba(${color[0] | 0},${color[1] | 0},${color[2] | 0},${alpha})`;
}
