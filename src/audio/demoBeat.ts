/** The built-in beat: a procedural 128 bpm track made with oscillators and noise. */

export interface DemoBeat {
  start(): void;
  stop(): void;
}

const BPM = 128;
/** Bass roots of the four-bar loop, Hz. */
const ROOTS = [55, 43.65, 65.41, 49];
/** Minor pentatonic scale over two octaves, in semitones. */
const PENTATONIC = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
/** Lead rhythms, one 16-step bar each. */
const LEAD_PATTERNS = [
  [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
  [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
  [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1],
  [1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0],
];
/** How far ahead notes are scheduled, and how often the scheduler runs. */
const LOOKAHEAD_S = 0.15;
const SCHEDULER_MS = 25;

const semitones = (n: number): number => Math.pow(2, n / 12);

export function createDemoBeat(ac: AudioContext, out: AudioNode): DemoBeat {
  /** Length of one 16th note in seconds. */
  const step = 60 / BPM / 4;
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;

  const bus = ac.createGain();
  bus.gain.value = 0.9;
  const compressor = ac.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.ratio.value = 5;
  bus.connect(compressor);
  compressor.connect(out);

  // Dotted-eighth echo for the lead.
  const delay = ac.createDelay(1);
  delay.delayTime.value = step * 3;
  const feedback = ac.createGain();
  feedback.gain.value = 0.38;
  const wet = ac.createGain();
  wet.gain.value = 0.28;
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(bus);

  function kick(t: number): void {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.setValueAtTime(170, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    gain.gain.setValueAtTime(1.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  /** Filtered noise burst: hi-hats and claps. */
  function noiseHit(
    t: number,
    type: BiquadFilterType,
    frequency: number,
    q: number | null,
    level: number,
    decay: number,
  ): void {
    const source = ac.createBufferSource();
    source.buffer = noise;
    const filter = ac.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    if (q != null) filter.Q.value = q;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(level, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    source.start(t);
    source.stop(t + decay + 0.02);
  }

  function hat(t: number, open: boolean): void {
    noiseHit(t, 'highpass', 7500, null, open ? 0.3 : 0.22, open ? 0.22 : 0.05);
  }

  function clap(t: number): void {
    noiseHit(t, 'bandpass', 1800, 0.8, 0.7, 0.18);
  }

  function bass(t: number, frequency: number): void {
    const saw = ac.createOscillator();
    const sub = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    saw.type = 'sawtooth';
    sub.type = 'square';
    saw.frequency.value = frequency;
    sub.frequency.value = frequency * 0.5;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + step * 0.9);
    filter.Q.value = 6;
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.setTargetAtTime(0.0001, t + step * 0.6, 0.03);
    saw.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    for (const osc of [saw, sub]) {
      osc.start(t);
      osc.stop(t + step);
    }
  }

  function lead(t: number, frequency: number): void {
    const osc = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + step * 0.8);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    gain.connect(delay);
    osc.start(t);
    osc.stop(t + step);
  }

  /** Plays step `s` (0..15) of bar `bar`. The song is 16 bars: 14 of groove, then a 2-bar riser. */
  function playStep(t: number, s: number, bar: number): void {
    const phrase = bar % 16;
    const root = ROOTS[bar % 4];
    if (phrase < 14) {
      if (s % 4 === 0) kick(t);
      if (s === 4 || s === 12) clap(t);
      if (s % 2 === 0) hat(t, s % 4 === 2);
      if (phrase >= 4 && s === 15 && bar % 2) kick(t);
      if (s % 4 === 2 || s === 7) bass(t, s === 7 ? root : root * 2);
      if (phrase >= 2 && LEAD_PATTERNS[phrase % LEAD_PATTERNS.length][s]) {
        lead(t, 220 * semitones(PENTATONIC[(s * 3 + bar * 2) % PENTATONIC.length]));
      }
    } else {
      hat(t, false);
      if (phrase === 14 ? s % 4 === 0 : s % 2 === 0) clap(t);
      lead(
        t,
        220 *
          semitones(PENTATONIC[((phrase - 14) * 16 + s) % PENTATONIC.length]) *
          (phrase === 15 ? 2 : 1),
      );
      if (phrase === 15 && s === 15) kick(t);
    }
  }

  let stepIndex = 0;
  let nextTime = ac.currentTime + 0.05;
  let timer: ReturnType<typeof setInterval> | undefined;

  function schedule(): void {
    const horizon = ac.currentTime + LOOKAHEAD_S;
    while (nextTime < horizon) {
      playStep(nextTime, stepIndex % 16, Math.floor(stepIndex / 16));
      nextTime += step;
      stepIndex++;
    }
  }

  return {
    start() {
      schedule();
      timer = setInterval(schedule, SCHEDULER_MS);
    },
    stop() {
      clearInterval(timer);
      bus.gain.setTargetAtTime(0, ac.currentTime, 0.04);
      setTimeout(() => compressor.disconnect(), 400);
    },
  };
}
