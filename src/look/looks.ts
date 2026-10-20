/** A look is a stack of camera and post effects on top of the mode. */
export interface Look {
  readonly name: string;
  /** Film grain. */
  readonly grain?: boolean;
  /** Dark edges. */
  readonly vignette?: boolean;
  /** CRT scan lines. */
  readonly scanlines?: boolean;
  /** Chance (0..1) per frame on a strong beat to tear horizontal strips. */
  readonly glitch?: number;
  /** Frame-rate cap for a stop-motion feel. */
  readonly fps?: number;
  /** Hand-held camera shake strength. */
  readonly jitter?: number;
  /** Left half mirrored onto the right half. */
  readonly mirror?: boolean;
  /** Double image on beats. */
  readonly ghost?: boolean;
  /** Mirrored in both directions. */
  readonly quad?: boolean;
  /** Wavy horizontal displacement. */
  readonly liquid?: boolean;
  /** Pixel size for the pixelate effect. */
  readonly pixel?: number;
  /** The picture as an LED wall: round lamps with dark gaps. */
  readonly ledWall?: boolean;
  /** The picture as Rutt/Etra scanlines (render/lookSource.ts). */
  readonly rutt?: boolean;
  /** The picture wound into a Droste spiral (render/lookSource.ts). */
  readonly droste?: boolean;
  /** A second mode shown through glitchy masks (render/mashup.ts). */
  readonly mashup?: boolean;
}

export const LOOKS: readonly Look[] = [
  { name: 'clean' },
  { name: 'film', grain: true, vignette: true },
  { name: 'crt', scanlines: true, glitch: 0.5, vignette: true },
  { name: 'stop-motion', fps: 8, jitter: 1, grain: true },
  { name: 'mirror', mirror: true, vignette: true },
  { name: 'glitch', glitch: 1, ghost: true },
  { name: 'dream', ghost: true, vignette: true },
  { name: 'choppy', fps: 14, jitter: 0.3 },
  { name: 'quad', quad: true },
  { name: 'liquid', liquid: true, vignette: true },
  { name: 'trip', quad: true, liquid: true, ghost: true },
  { name: 'pixel', pixel: 6 },
  { name: 'glitchpix', pixel: 5, glitch: 1, scanlines: true },
  { name: 'led wall', ledWall: true },
  { name: 'rutt-etra', rutt: true },
  { name: 'droste', droste: true },
  { name: 'mashup', mashup: true },
];
