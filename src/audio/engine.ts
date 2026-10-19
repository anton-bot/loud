/**
 * The Web Audio graph: source → analyser → monitor gain → output.
 *
 * There are two kinds of AudioContext. For the demo beat and files, a normal one that
 * plays to the speakers. For the mic, one for analysis only: it renders to no output
 * device where the browser can do that (`sinkId: { type: 'none' }`, Chrome 110+), or
 * else to a muted output. The mic context is closed as soon as the mic is released.
 */
import { audio } from '../core/state';

export interface AudioGraph {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;
  /** Gain between the analyser and the output: 1 to hear the source, 0 for the mic. */
  readonly monitor: GainNode;
  readonly withOutput: boolean;
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

function createContext(withOutput: boolean): AudioContext {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('This browser has no Web Audio');
  if (withOutput) return new AudioContextClass();
  try {
    return new AudioContextClass({
      sinkId: { type: 'none' },
      latencyHint: 'playback',
    } as AudioContextOptions);
  } catch {
    return new AudioContextClass();
  }
}

/** The audio graph, created (or re-created with the other kind of output) when needed. */
export function ensureAudio(withOutput = true): AudioGraph {
  let graph = engine.graph;
  if (!graph || graph.withOutput !== withOutput || graph.context.state === 'closed') {
    closeAudio();
    const context = createContext(withOutput);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -5;
    const monitor = context.createGain();
    analyser.connect(monitor);
    monitor.gain.value = withOutput ? 1 : 0;
    // The graph must reach the destination, or the browser does not process it.
    monitor.connect(context.destination);
    audio.freq = new Uint8Array(analyser.frequencyBinCount);
    audio.wave = new Uint8Array(analyser.fftSize);
    engine.binHz = context.sampleRate / analyser.fftSize;
    graph = { context, analyser, monitor, withOutput };
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
