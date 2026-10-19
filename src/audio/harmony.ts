/**
 * Harmony: which notes are playing, the chord and the key. Each frame the spectrum
 * from 400 to 4000 Hz is folded into 12 pitch classes (a "chroma"). The chord is the
 * major or minor triad that best fits the last half second; the key is the best fit of
 * the Krumhansl key profiles to the last 8 seconds.
 *
 * The "scriabin" palette takes its colours from here: the chord's root, third and
 * fifth and the key's tonic, in the colours that Scriabin gave the keys.
 */
import { hexToRgb, type Rgb } from '../core/rgb';
import { audio, clock, scene } from '../core/state';
import { setStatus } from '../ui/status';
import { engine } from './engine';

export const NOTES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/** Scriabin's colours for C, C♯ ... B: C red, G orange, D yellow, A green, E pale blue... */
// prettier-ignore
const SCRIABIN = [
  '#ff2a1a', '#8f3df2', '#ffe11a', '#8a9bb8', '#bfe9ff', '#b3112e',
  '#2f6bff', '#ff8a1a', '#b44de0', '#27d35a', '#9aa6bd', '#9fd3ff',
].map(hexToRgb);

// prettier-ignore
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
// prettier-ignore
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export const harmony = {
  /** Chord root (pitch class 0..11) and whether the chord is minor. */
  root: 9,
  minorChord: true,
  /** Key tonic (pitch class) and mode. */
  key: 9,
  minorKey: true,
};

/** The key last shown in the status line, and when. */
let shownKey = '';
let shownAt = -1e9;

const shortChroma = new Float32Array(12);
const longChroma = new Float32Array(12);
const frame = new Float32Array(12);
/** The palette colours now; they ease toward the target colours. */
const colors: number[][] = [0, 4, 7, 0].map((n) => [...SCRIABIN[(n + 9) % 12]]);

/** The four colours of the "scriabin" palette. */
export function harmonyColors(): readonly Rgb[] {
  return colors as unknown as readonly Rgb[];
}

function correlation(chroma: Float32Array, profile: readonly number[], tonic: number): number {
  let meanC = 0;
  let meanP = 0;
  for (let i = 0; i < 12; i++) {
    meanC += chroma[i] / 12;
    meanP += profile[i] / 12;
  }
  let top = 0;
  let c2 = 0;
  let p2 = 0;
  for (let i = 0; i < 12; i++) {
    const c = chroma[(tonic + i) % 12] - meanC;
    const p = profile[i] - meanP;
    top += c * p;
    c2 += c * c;
    p2 += p * p;
  }
  return top / (Math.sqrt(c2 * p2) || 1);
}

/** Called every frame while the mic is on. */
export function trackHarmony(dt: number): void {
  const freq = audio.freq;
  const binHz = engine.binHz;
  frame.fill(0);
  const from = Math.ceil(400 / binHz);
  const to = Math.min(freq.length - 1, Math.floor(4000 / binHz));
  for (let i = from; i <= to; i++) {
    const level = freq[i] / 255;
    if (level < 0.05) continue;
    const midi = 69 + 12 * Math.log2((i * binHz) / 440);
    frame[((Math.round(midi) % 12) + 12) % 12] += level * level;
  }
  let max = 0;
  for (let i = 0; i < 12; i++) max = Math.max(max, frame[i]);
  if (max < 0.5) return; // Too quiet to judge.
  const fast = Math.min(1, dt * 2);
  const slow = Math.min(1, dt / 8);
  for (let i = 0; i < 12; i++) {
    shortChroma[i] += (frame[i] / max - shortChroma[i]) * fast;
    longChroma[i] += (frame[i] / max - longChroma[i]) * slow;
  }

  // The chord: the triad whose three notes stand out most.
  let best = -Infinity;
  for (let root = 0; root < 12; root++) {
    for (const minor of [false, true]) {
      const notes = [root, (root + (minor ? 3 : 4)) % 12, (root + 7) % 12];
      let inside = 0;
      let outside = 0;
      for (let i = 0; i < 12; i++) {
        if (notes.includes(i)) inside += shortChroma[i];
        else outside += shortChroma[i];
      }
      const score = inside - outside * 0.33;
      if (score > best) {
        best = score;
        harmony.root = root;
        harmony.minorChord = minor;
      }
    }
  }

  // The key: the best of the 24 key profiles.
  let bestKey = -Infinity;
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const minor of [false, true]) {
      const r = correlation(longChroma, minor ? MINOR_PROFILE : MAJOR_PROFILE, tonic);
      if (r > bestKey) {
        bestKey = r;
        harmony.key = tonic;
        harmony.minorKey = minor;
      }
    }
  }
  // With the "scriabin" palette on, say the key when it changes (at most every 10 s).
  const name = keyName();
  if (scene.palette.key && name !== shownKey && clock.time - shownAt > 10) {
    shownKey = name;
    shownAt = clock.time;
    setStatus(`Key: ${name}`);
  }
}

/** Eases the palette colours toward the chord and key. Called every frame. */
export function updateHarmonyColors(dt: number): void {
  const { root, minorChord, key } = harmony;
  const targets = [root, (root + (minorChord ? 3 : 4)) % 12, (root + 7) % 12, key];
  const k = Math.min(1, dt * 4);
  targets.forEach((note, i) => {
    const target = SCRIABIN[note];
    for (let c = 0; c < 3; c++) colors[i][c] += (target[c] - colors[i][c]) * k;
  });
}

/** The key as text, for example "A minor". */
export function keyName(): string {
  return `${NOTES[harmony.key]} ${harmony.minorKey ? 'minor' : 'major'}`;
}
