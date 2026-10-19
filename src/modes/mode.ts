import type { PaletteName } from '../look/palettes';

/** One visual style. Modes draw on the scene canvas (`ctx` in render/canvases.ts). */
export interface Mode {
  /** Name shown in the UI. */
  readonly name: string;
  /** Draws one frame. `dt` is the time since the last drawn frame, in seconds. */
  draw(dt: number): void;
  /** Reacts to a beat. */
  beat?(): void;
  /** Forgets state that depends on the screen size. Called after each resize. */
  resize?(): void;
  /**
   * How much of the last frame is painted over with the background per 1/60 s.
   * 1 clears every frame; lower values leave trails.
   */
  readonly fade: number;
  /** Feedback zoom: the last frame is scaled by this per 1/60 s before drawing. 1 = off. */
  readonly zoom?: number;
  /** Feedback rotation in radians per 1/60 s. */
  readonly rotate?: number;
  /** Bloom strength. Default 1. */
  readonly bloom?: number;
  /** How the mode's shapes blend onto the scene. Default: the palette's blend. */
  readonly blend?: GlobalCompositeOperation;
  /** Draw the beat rings over this mode. Default true. */
  readonly beatRings?: boolean;
  /** Frame-rate cap for a stop-motion feel. */
  readonly fps?: number;
  /** Palettes that suit this mode. A name can repeat to make it more likely. */
  readonly palettes?: readonly PaletteName[];
}
