/** Helpers that read the spectrum and waveform in `audio`. */
import { audio } from './state';

/** Waveform at position `t` (0..1), as -1..1. */
export function waveAt(t: number): number {
  const wave = audio.wave;
  return (wave[Math.floor(t * (wave.length - 1))] - 128) / 128;
}

/**
 * Spectrum level 0..1 at position `t` (0..1). `t` covers the lowest `span` part of
 * the spectrum (bin 0, the DC offset, is skipped). A `curve` above 1 gives the bass
 * more room.
 */
export function spectrumAt(t: number, span: number, curve = 1): number {
  const freq = audio.freq;
  const position = curve === 1 ? t : Math.pow(t, curve);
  return freq[1 + Math.floor(position * freq.length * span)] / 255;
}

/** Band level by number: 0 bass, 1 mid, 2 high. */
export function bandLevel(band: number): number {
  return band === 0 ? audio.bass : band === 1 ? audio.mid : audio.high;
}
