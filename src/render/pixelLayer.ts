/** A small canvas that a mode fills pixel by pixel and then scales up to the screen. */
import { createLayer } from '../core/dom';
import type { Rgb } from '../core/rgb';

export class PixelLayer {
  private readonly layer = createLayer();
  private data: ImageData | null = null;

  get width(): number {
    return this.layer.canvas.width;
  }

  get height(): number {
    return this.layer.canvas.height;
  }

  get canvas(): HTMLCanvasElement {
    return this.layer.canvas;
  }

  /** Sets the size. Returns true when the size changed (the pixels are then new and black). */
  setSize(width: number, height: number): boolean {
    if (this.data && this.width === width && this.height === height) return false;
    this.layer.canvas.width = width;
    this.layer.canvas.height = height;
    this.data = this.layer.ctx.createImageData(width, height);
    return true;
  }

  /** RGBA bytes, 4 per pixel, row by row. Call `setSize` first. */
  get pixels(): Uint8ClampedArray {
    if (!this.data) throw new Error('PixelLayer: call setSize first');
    return this.data.data;
  }

  /** Puts the pixels on the canvas. */
  flush(): void {
    if (this.data) this.layer.ctx.putImageData(this.data, 0, 0);
  }
}

/** `size` colours for the values 0..1, as RGB byte triples, for writing pixels fast. */
export function colorRamp(size: number, colorAt: (t: number) => Rgb): Uint8ClampedArray {
  const ramp = new Uint8ClampedArray(size * 3);
  for (let i = 0; i < size; i++) {
    const c = colorAt(i / (size - 1));
    ramp[i * 3] = c[0];
    ramp[i * 3 + 1] = c[1];
    ramp[i * 3 + 2] = c[2];
  }
  return ramp;
}

/**
 * Writes one value per pixel into `layer` through `ramp`. `toRamp` turns a value into
 * 0..1 (a tone curve); the layer must have the size of the value grid.
 */
export function paintField(
  layer: PixelLayer,
  values: ArrayLike<number>,
  ramp: Uint8ClampedArray,
  toRamp: (value: number) => number,
): void {
  const pixels = layer.pixels;
  const last = ramp.length / 3 - 1;
  for (let i = 0, p = 0; i < values.length; i++, p += 4) {
    const t = toRamp(values[i]);
    const r = (t <= 0 ? 0 : t >= 1 ? last : (t * last) | 0) * 3;
    pixels[p] = ramp[r];
    pixels[p + 1] = ramp[r + 1];
    pixels[p + 2] = ramp[r + 2];
    pixels[p + 3] = 255;
  }
  layer.flush();
}
