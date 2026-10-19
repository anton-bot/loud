/** The last 28 spectrum rows, newest first. Shared by the terrain and ridges modes. */
import { clamp } from '../core/math';
import { spectrumAt } from '../core/signal';

/** Number of rows kept. */
export const HISTORY_ROWS = 28;
/** Spectrum points per row. */
export const HISTORY_POINTS = 48;

export const spectrumHistory: Float32Array[] = [];
let sinceLastRow = 0;

/** Adds a row about every 45 ms. */
export function recordSpectrum(dt: number): void {
  sinceLastRow += dt;
  if (sinceLastRow < 0.045 && spectrumHistory.length) return;
  sinceLastRow = 0;
  const row = new Float32Array(HISTORY_POINTS);
  for (let i = 0; i < HISTORY_POINTS; i++)
    row[i] = clamp(spectrumAt(i / HISTORY_POINTS, 0.45, 1.6), 0, 1);
  spectrumHistory.unshift(row);
  if (spectrumHistory.length > HISTORY_ROWS) spectrumHistory.pop();
}
