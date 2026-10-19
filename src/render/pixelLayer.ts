/** A small canvas that a mode fills pixel by pixel and then scales up to the screen. */
import { createLayer } from '../core/dom';

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
