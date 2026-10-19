/**
 * Live state that many modules read every frame. Each object here is written by
 * one owner (named in its comment) and read by everyone else.
 */
import { LOOKS, type Look } from '../look/looks';
import { PALETTES, type Palette } from '../look/palettes';

/** Drawing area in CSS pixels. Written by render/canvases.ts on resize. */
export const view = {
  width: 1,
  height: 1,
  /** Centre of the screen. */
  cx: 0,
  cy: 0,
  /** Canvas pixels per CSS pixel. */
  dpr: 1,
  /** The shorter side. */
  min: 1,
};

/** The music, as the modes see it. Written by audio/analysis.ts. */
export const audio = {
  /** Smoothed band levels, about 0..1. */
  bass: 0,
  mid: 0,
  high: 0,
  /** 1 on a beat, then decays to 0. Scene changes, shakes and fireworks also kick it. */
  beat: 0,
  /** Beats since the last section change. */
  beats: 0,
  /** Spectrum, one byte (0..255) per frequency bin, after automatic gain. */
  freq: new Uint8Array(1024),
  /** Waveform bytes. 128 is silence. */
  wave: new Uint8Array(2048),
};

/** Animation time in seconds. Written by loop.ts. */
export const clock = { time: 0 };

/** What is on screen. Written by scene.ts. */
export const scene = {
  modeIndex: 0,
  palette: PALETTES[0] as Palette,
  paletteIndex: 0,
  look: LOOKS[0] as Look,
  lookIndex: 0,
  /** Slowly turning hue in degrees. It rotates the palette colours. */
  hue: 290,
  /** Change the scene on its own every 30 s and on some beats. */
  autoSwitch: true,
  /** `clock.time` of the last mode change. */
  lastSwitch: 0,
};

/** Phone movement, smoothed. Written by input/motion.ts. */
export const motion = {
  /** The user wants motion effects. */
  enabled: false,
  /** Sensor data has arrived. */
  available: false,
  /** Tilt away from the resting position, -1..1. */
  tiltX: 0,
  tiltY: 0,
  /** Shake strength, 0..1. */
  shake: 0,
  /** Rotation speed, 0..1. */
  twist: 0,
  /** Signed rotation speed around the screen axis, -1..1. */
  spin: 0,
  /** Direction of gravity in screen coordinates, -1..1. */
  gravityX: 0,
  gravityY: 1,
};
