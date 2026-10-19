/**
 * Section-change detection. Compares the last ~1 s of audio texture (loudness,
 * bass, mid, high, brightness) with 1 s blocks from 2.5 to 10.5 s ago. A sustained
 * jump starts a new scene; a bass drop that returns after a breakdown starts one at
 * once. Tuned to miss a change rather than fire falsely.
 */
import { audio, clock, scene } from '../core/state';
import { shuffle } from '../scene';
import { setStatus } from '../ui/status';
import { currentSource } from './sources';

/** Feature frames: [loudness, bass, mid, high, brightness], one per 0.1 s. */
type Frame = number[];
const FEATURES = 5;
const FRAME_S = 0.1;
/** 12 s of frames. */
const MAX_FRAMES = 120;

export const sections = { enabled: true };

const frames: Frame[] = [];
const sum = [0, 0, 0, 0, 0];
let samples = 0;
let frameTime = 0;
/** Seconds that a rise or fall has lasted. */
let rising = 0;
let falling = 0;
/** No texture changes for this many seconds after a change. */
let cooldown = 0;
/** Seconds that the bass has been gone. */
let bassGoneFor = 0;
/** Recent bass peak, decaying slowly. */
let bassReference = 0;
let lastFire = -1e9;

window.loudEvents = [];

const mean = (list: Frame[], feature: number): number =>
  list.reduce((a, f) => a + f[feature], 0) / list.length;

function fire(why: 'drop' | 'rise' | 'breakdown'): void {
  rising = 0;
  falling = 0;
  cooldown = 6;
  // Never two changes within 1.5 s, and only a drop may cut a fresh mode short.
  if (clock.time - lastFire < 1.5 || (why !== 'drop' && clock.time - scene.lastSwitch < 1.5))
    return;
  lastFire = clock.time;
  window.loudEvents.push({ t: +clock.time.toFixed(1), why });
  audio.beats = 0;
  shuffle();
  setStatus(`Section change (${why}): new scene`);
}

/** Bass gone for 2 s or more (against its recent peak), then back: the drop. Returns true when it fired. */
function detectDrop(): boolean {
  const bassNow = mean(frames.slice(-2), 1);
  bassReference = Math.max(bassReference * 0.999, mean(frames.slice(-10), 1));
  if (bassReference <= 0.15) return false;
  if (bassNow < 0.4 * bassReference) bassGoneFor += FRAME_S;
  else if (bassGoneFor >= 2 && bassNow > 0.75 * bassReference) {
    bassGoneFor = 0;
    fire('drop');
    return true;
  } else if (bassNow > 0.6 * bassReference) bassGoneFor = 0;
  return false;
}

/** The last second against 1 s blocks from 2.5 to 10.5 s ago. */
function detectTextureChange(): void {
  const recent = frames.slice(-10);
  const older = frames.slice(-105, -25);
  const blocks: Frame[][] = [];
  for (let k = 0; k + 10 <= older.length; k += 10) blocks.push(older.slice(k, k + 10));
  let distance = 0;
  let direction = 0;
  let level = 0;
  for (let i = 0; i < FEATURES; i++) {
    const now = mean(recent, i);
    const blockMeans = blocks.map((block) => mean(block, i));
    const before = blockMeans.reduce((a, v) => a + v, 0) / blockMeans.length;
    const spread = Math.sqrt(
      blockMeans.reduce((a, v) => a + (v - before) * (v - before), 0) / blockMeans.length,
    );
    // How many "normal variations" the last second is away from before.
    distance += Math.abs(now - before) / (spread + 0.04);
    // Loudness and bass tell whether the music got bigger or smaller.
    if (i < 2) {
      direction += now - before;
      level = Math.max(level, now, before);
    }
  }
  distance /= FEATURES;
  if (level < 0.08) {
    // Too quiet to judge.
    rising = 0;
    falling = 0;
    return;
  }
  if (distance > 2.2) {
    if (direction > 0) {
      rising += FRAME_S;
      falling = 0;
    } else {
      falling += FRAME_S;
      rising = 0;
    }
  } else {
    rising = Math.max(0, rising - 0.2);
    falling = Math.max(0, falling - 0.2);
  }
  if (rising >= 0.6) fire('rise');
  else if (falling >= 4) fire('breakdown');
}

/** Called every frame with the raw (before gain) measurements. */
export function trackSections(
  dt: number,
  bass: number,
  mid: number,
  high: number,
  rms: number,
  brightness: number,
): void {
  if (!sections.enabled || currentSource() === 'none') return;
  const features = [Math.min(1, rms * 3), bass, mid, high, brightness];
  for (let i = 0; i < FEATURES; i++) sum[i] += features[i];
  samples++;
  frameTime += dt;
  if (frameTime < FRAME_S) return;

  frames.push(sum.map((v) => v / samples));
  if (frames.length > MAX_FRAMES) frames.shift();
  sum.fill(0);
  samples = 0;
  frameTime = 0;
  if (cooldown > 0) cooldown -= FRAME_S;

  if (detectDrop()) return;
  if (cooldown > 0 || frames.length < 70) return;
  detectTextureChange();
}
