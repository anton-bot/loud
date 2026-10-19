/** The element with this id. Throws when index.html does not have it. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`index.html has no element #${id}`);
  return element as T;
}

/** The 2D context of `canvas`. Throws when the browser has no 2D canvas. */
export function context2d(
  canvas: HTMLCanvasElement,
  settings?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', settings);
  if (!ctx) throw new Error('This browser has no 2D canvas');
  return ctx;
}

/** An off-screen canvas and its 2D context. */
export interface Layer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
}

export function createLayer(): Layer {
  const canvas = document.createElement('canvas');
  return { canvas, ctx: context2d(canvas) };
}

/** Sets the pixel size of `canvas`. Does nothing when the size is already correct (a resize clears it). */
export function setCanvasSize(canvas: HTMLCanvasElement, width: number, height: number): void {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}
