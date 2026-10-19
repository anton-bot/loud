/**
 * Turns the analyser data into the `audio` features once per frame: noise gate,
 * automatic gain, band levels and beat detection. With no source (or a quiet room)
 * a synthetic pulse keeps the screen moving.
 */
import { clamp, follow } from '../core/math';
import { audio, clock } from '../core/state';
import { onBeat } from '../scene';
import { engine } from './engine';
import { trackHarmony, updateHarmonyColors } from './harmony';
import { trackSections } from './sections';
import { isListening } from './mic';

/** Input level and noise gate threshold in dBFS, for the meter. */
export const levels = {
  inputDb: -60,
  gateDb: -50,
};

/** Frequency bands in Hz. */
const BASS: [number, number] = [20, 150];
const MID: [number, number] = [150, 2000];
const HIGH: [number, number] = [2000, 9000];
/** Mid and high are quieter than bass in most music; these weights even them out. */
const MID_WEIGHT = 1.3;
const HIGH_WEIGHT = 2.2;
/** No two beats closer than this. */
const MIN_BEAT_GAP_MS = 200;

/** Noise gate, 0 closed .. 1 open. */
let gate = 1;
/** Recent loudest band level, for the automatic gain. */
let peak = 0.5;
/** Recent waveform level, for the waveform gain. */
let waveLevel = 0.1;
let lastBass = 0;
let lastBeatMs = 0;
/** The last 40 bass levels, for the beat threshold. */
const bassHistory = new Float32Array(40);
let bassHistoryIndex = 0;
let idleFreq = new Uint8Array(0);
let idleWave = new Uint8Array(0);

/** A synthetic signal: a soft 120 bpm pulse with some texture. */
function writeIdleSignal(freq: Uint8Array, wave: Uint8Array): void {
  const t = clock.time;
  const pulse = Math.pow(1 - (t % 0.5) / 0.5, 3);
  const offbeat = Math.pow(1 - ((t + 0.25) % 0.5) / 0.5, 2);
  for (let i = 0; i < freq.length; i++) {
    const f = i / freq.length;
    freq[i] = Math.max(
      0,
      Math.min(
        255,
        Math.exp(-f * 16) * 220 * (0.25 + 0.75 * pulse) +
          Math.exp(-f * 3) * 70 * (0.5 + 0.5 * Math.sin(i * 0.4 + t * 3)) +
          Math.exp(-f * 1.2) * 40 * offbeat * Math.random(),
      ),
    );
  }
  for (let i = 0; i < wave.length; i++) {
    wave[i] =
      128 +
      60 * Math.sin(i * 0.015 + t * 2) * Math.sin(t * 0.9) +
      22 * Math.sin(i * 0.09 + t * 6) * offbeat;
  }
}

/** Mean spectrum level (0..1) in a band. */
function band([lo, hi]: [number, number]): number {
  const freq = audio.freq;
  const a = Math.max(1, Math.floor(lo / engine.binHz));
  const b = Math.min(freq.length - 1, Math.ceil(hi / engine.binHz));
  let sum = 0;
  for (let i = a; i <= b; i++) sum += freq[i];
  return sum / ((b - a + 1) * 255);
}

/** Root mean square of the waveform, every 4th sample. */
function waveRms(): number {
  const wave = audio.wave;
  let energy = 0;
  for (let i = 0; i < wave.length; i += 4) {
    const v = (wave[i] - 128) / 128;
    energy += v * v;
  }
  return Math.sqrt(energy / (wave.length / 4));
}

/** Spectral centroid of the lowest 300 bins, 0..1: how bright the sound is. */
function brightness(): number {
  const freq = audio.freq;
  let weighted = 0;
  let total = 0;
  for (let i = 1; i < 300; i++) {
    weighted += i * freq[i];
    total += freq[i];
  }
  return total > 0 ? weighted / total / 300 : 0;
}

/**
 * Noise gate (fast to open, slow to close) and automatic gain: the loudest band is
 * pulled to about 0.9, however loud the source is. While the gate is closing, the
 * idle pulse fades in, so the screen keeps breathing in a quiet room.
 */
function applyGateAndGain(
  dt: number,
  rawBass: number,
  rawMid: number,
  rawHigh: number,
  rms: number,
): void {
  const db = 20 * Math.log10(rms + 1e-5);
  levels.inputDb = follow(levels.inputDb, db, 0.5, Math.min(1, dt * 4));
  const open = clamp((levels.inputDb - levels.gateDb + 6) / 12, 0, 1);
  gate = follow(gate, open, 0.35, Math.min(1, dt * 1.5));

  const loudest = Math.max(rawBass, rawMid * MID_WEIGHT, rawHigh * HIGH_WEIGHT);
  if (gate > 0.5) peak = Math.max(peak * (1 - dt * 0.12), loudest, 0.05);
  const gain = Math.min(18, 0.9 / peak) * gate;
  waveLevel = follow(waveLevel, rms, 0.3, Math.min(1, dt * 0.5));
  const waveGain = clamp(0.25 / (waveLevel + 1e-4), 0.3, 12) * gate;

  const { freq, wave } = audio;
  if (gate < 0.98) {
    if (idleFreq.length !== freq.length) {
      idleFreq = new Uint8Array(freq.length);
      idleWave = new Uint8Array(wave.length);
    }
    writeIdleSignal(idleFreq, idleWave);
    const idle = (1 - gate) * 0.6;
    for (let i = 0; i < freq.length; i++)
      freq[i] = Math.min(255, freq[i] * gain + idleFreq[i] * idle);
    for (let i = 0; i < wave.length; i++)
      wave[i] = clamp(128 + (wave[i] - 128) * waveGain + (idleWave[i] - 128) * idle, 0, 255);
  } else {
    for (let i = 0; i < freq.length; i++) freq[i] = Math.min(255, freq[i] * gain);
    for (let i = 0; i < wave.length; i++) wave[i] = clamp(128 + (wave[i] - 128) * waveGain, 0, 255);
  }
}

export function analyze(dt: number): void {
  const analyser = isListening() ? engine.graph?.analyser : undefined;
  if (analyser) {
    analyser.getByteFrequencyData(audio.freq);
    analyser.getByteTimeDomainData(audio.wave);
  } else writeIdleSignal(audio.freq, audio.wave);

  // Raw measurements (before the gain): the section detector uses these.
  const rawBass = band(BASS);
  const rawMid = band(MID);
  const rawHigh = band(HIGH);
  const rms = waveRms();
  const centroid = brightness();
  if (analyser) applyGateAndGain(dt, rawBass, rawMid, rawHigh, rms);

  const bass = Math.min(1, band(BASS));
  const mid = Math.min(1, band(MID) * MID_WEIGHT);
  const high = Math.min(1, band(HIGH) * HIGH_WEIGHT);
  audio.bass = follow(audio.bass, bass, 0.6, 0.15);
  audio.mid = follow(audio.mid, mid, 0.5, 0.12);
  audio.high = follow(audio.high, high, 0.5, 0.15);

  // Beat: bass well above its recent average, or a sharp rise.
  bassHistory[bassHistoryIndex] = bass;
  bassHistoryIndex = (bassHistoryIndex + 1) % bassHistory.length;
  let average = 0;
  for (let i = 0; i < bassHistory.length; i++) average += bassHistory[i];
  average /= bassHistory.length;
  const now = performance.now();
  const onset = bass - lastBass;
  lastBass = bass;
  if (now - lastBeatMs > MIN_BEAT_GAP_MS && bass > 0.2 && (bass > average * 1.25 || onset > 0.12)) {
    lastBeatMs = now;
    onBeat();
  }
  audio.beat = Math.max(0, audio.beat - dt * 3.2);

  trackSections(dt, rawBass, rawMid, rawHigh, rms, centroid);
  if (analyser) trackHarmony(dt);
  updateHarmonyColors(dt);
}
