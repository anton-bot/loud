/**
 * The Web Audio graph for the mic: mic → analyser → silent gain → output.
 *
 * The context is for analysis only. It renders to no output device where the browser
 * can do that (`sinkId: { type: 'none' }`, Chrome 110+), or else to a muted output.
 * It is closed as soon as the mic is released.
 */
import { audio } from '../core/state';

export interface AudioGraph {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;
}

export const engine = {
  graph: null as AudioGraph | null,
  /** Width of one spectrum bin in Hz. */
  binHz: 44100 / 2048,
};

export function closeAudio(): void {
  const graph = engine.graph;
  if (!graph) return;
  engine.graph = null;
  graph.context.close().catch(() => {});
}

function createContext(): AudioContext {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('This browser has no Web Audio');
  try {
    return new AudioContextClass({
      sinkId: { type: 'none' },
      latencyHint: 'playback',
    } as AudioContextOptions);
  } catch {
    return new AudioContextClass();
  }
}

/** The audio graph, created when needed. */
export function ensureAudio(): AudioGraph {
  let graph = engine.graph;
  if (!graph || graph.context.state === 'closed') {
    const context = createContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -5;
    // The graph must reach the destination, or the browser does not process it.
    const silent = context.createGain();
    silent.gain.value = 0;
    analyser.connect(silent);
    silent.connect(context.destination);
    audio.freq = new Uint8Array(analyser.frequencyBinCount);
    audio.wave = new Uint8Array(analyser.fftSize);
    engine.binHz = context.sampleRate / analyser.fftSize;
    graph = { context, analyser };
    engine.graph = graph;
  }
  if (graph.context.state === 'suspended') graph.context.resume().catch(() => {});
  return graph;
}

/** Resumes a context that the browser suspended (autoplay rules). Call from a user gesture. */
export function resumeAudio(): void {
  const context = engine.graph?.context;
  if (context?.state === 'suspended') context.resume().catch(() => {});
}
