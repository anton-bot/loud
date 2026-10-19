/**
 * Frame-time governor. When frames are slow, it steps the quality down. It never
 * steps back up.
 *   2: everything on.
 *   1: no chromatic aberration.
 *   0: also a 2-level bloom and a resolution of 1 canvas pixel per CSS pixel.
 */
export const quality = { level: 2 };

let averageMs = 16.7;
let sinceCheckMs = 0;

/** Records one frame time. Returns true when the canvas must be resized for the new level. */
export function trackFrameTime(ms: number): boolean {
  averageMs += (ms - averageMs) * 0.05;
  sinceCheckMs += ms;
  if (sinceCheckMs < 3000) return false;
  sinceCheckMs = 0;
  if (averageMs > 24 && quality.level > 0) {
    quality.level--;
    return quality.level === 0;
  }
  return false;
}
