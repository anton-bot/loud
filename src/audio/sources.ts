/** The sound sources: the built-in demo beat, the microphone, or an audio file. */
import { createDemoBeat, type DemoBeat } from './demoBeat';
import { closeAudio, ensureAudio } from './engine';
import { inFrame, offerDirectLink } from '../ui/directLink';
import { markSource, setStatus } from '../ui/status';

export type SourceKind = 'none' | 'demo' | 'mic' | 'file';

let kind: SourceKind = 'none';
let micStream: MediaStream | null = null;
let input: AudioBufferSourceNode | MediaStreamAudioSourceNode | null = null;
let demo: DemoBeat | null = null;
/**
 * Each choice of source gets a new number. An async step (mic prompt, file decoding)
 * that ends after a newer choice sees a different number and gives up.
 */
let request = 0;
/** The mic was on when the page was hidden: turn it on again when the page is visible. */
let micWanted = false;

export function currentSource(): SourceKind {
  return kind;
}

export function stopSource(): void {
  const wasMic = kind === 'mic' || !!micStream;
  if (demo) {
    demo.stop();
    demo = null;
  }
  if (micStream) {
    for (const track of micStream.getTracks()) track.stop();
    micStream = null;
  }
  if (input) {
    if (input instanceof AudioBufferSourceNode) {
      try {
        input.stop();
      } catch {
        // Already stopped.
      }
    }
    input.disconnect();
    input = null;
  }
  // Closing the mic context gives the audio session back to other apps at once.
  if (wasMic) closeAudio();
  kind = 'none';
  markSource(null);
}

export function playDemo(): void {
  request++;
  micWanted = false;
  stopSource();
  const graph = ensureAudio(true);
  demo = createDemoBeat(graph.context, graph.analyser);
  demo.start();
  kind = 'demo';
  markSource('demo');
  setStatus('Built-in beat. Shuffle for a new mode, palette and look.');
}

export async function playFile(file: File): Promise<void> {
  const myRequest = ++request;
  micWanted = false;
  stopSource();
  const { context } = ensureAudio(true);
  setStatus(`Decoding ${file.name}…`);
  let buffer: AudioBuffer;
  try {
    buffer = await context.decodeAudioData(await file.arrayBuffer());
  } catch (error) {
    if (myRequest === request) setStatus(`Could not decode ${file.name} (${errorName(error)}).`);
    return;
  }
  if (myRequest !== request) return; // another source was picked while the file was decoding
  stopSource();
  const graph = ensureAudio(true);
  const source = graph.context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(graph.analyser);
  graph.monitor.gain.value = 1;
  source.start();
  input = source;
  kind = 'file';
  markSource('file');
  setStatus(`Playing ${file.name}`);
  if (graph.context.state !== 'running') {
    // The browser wants a tap before it plays sound.
    setStatus(`Tap the screen to start ${file.name}`);
    addEventListener(
      'pointerdown',
      () => {
        graph.context.resume().catch(() => {});
        setStatus(`Playing ${file.name}`);
      },
      { once: true },
    );
  }
}

/** The error's name (DOMException names like 'NotAllowedError'), or the error as text. */
function errorName(error: unknown): string {
  const name = typeof error === 'object' && error && 'name' in error ? error.name : null;
  return typeof name === 'string' && name ? name : String(error);
}

/** The mic can only work here when this is true. Otherwise it sets a status that says why. */
function micCanWork(): boolean {
  if (!/^https?:$/.test(location.protocol)) {
    setStatus(
      `Chrome never grants the mic to a local file (${location.protocol}//). The page needs an http(s) address: serve loud.html with a local web server (Termux: python -m http.server 8000) and open http://localhost:8000/loud.html.`,
    );
    return false;
  }
  if (!window.isSecureContext) {
    setStatus(`The mic needs https or localhost. This page is on plain http://${location.host}.`);
    return false;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('This frame has no mic access.');
    offerDirectLink();
    return false;
  }
  if (micBlockedByFrame()) {
    setStatus('The frame around this page blocks the mic, so the browser never shows a prompt.');
    offerDirectLink();
    return false;
  }
  return true;
}

function micBlockedByFrame(): boolean {
  try {
    const policy = document.permissionsPolicy || document.featurePolicy;
    if (policy && typeof policy.allowsFeature === 'function')
      return !policy.allowsFeature('microphone');
  } catch {
    // No policy API: assume the mic is allowed and let getUserMedia decide.
  }
  return false;
}

/** Raw sound for analysis: browser voice processing would remove the music. */
const RAW_AUDIO = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

/**
 * The built-in microphone on Android Chrome, if the browser shows its label.
 *
 * Chrome on Android does not open a mic stream on its own: it selects a "communication
 * device" (the input/output pair that a voice call would use). With no device asked
 * for, it prefers a wired headset, then USB, then Bluetooth. A Bluetooth headset or
 * speaker then leaves music mode (A2DP) for call mode (SCO), so the music app stops.
 * Chrome resets that choice only for mic streams with echo cancellation, and echo
 * cancellation must stay off here, so the Bluetooth device stays in call mode until
 * the browser is closed. Asking for the built-in mic ("Speakerphone" in Chrome's
 * Android device list) keeps headsets and Bluetooth out of it.
 *
 * See Chromium: media/audio/android/audio_manager_android.cc (MakeLowLatencyInputStream,
 * ReleaseInputStream) and media/base/android/java/.../CommunicationDeviceSelector.java.
 */
async function builtInMicId(): Promise<string | null> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return (
      devices.find((d) => d.kind === 'audioinput' && d.label === 'Speakerphone')?.deviceId || null
    );
  } catch {
    return null;
  }
}

function getMic(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { ...RAW_AUDIO, deviceId: { exact: deviceId } } : RAW_AUDIO,
  });
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

async function openMic(): Promise<MediaStream> {
  // Device labels are only visible once the mic has been allowed for this site.
  const knownId = await builtInMicId();
  if (knownId) {
    try {
      return await getMic(knownId);
    } catch (error) {
      // The device is gone (for example a new phone with the old permission): use the default.
      if (errorName(error) !== 'OverconstrainedError') throw error;
    }
  }
  const stream = await getMic();
  // First use: now that the mic is allowed, switch to the built-in mic if this stream is on another device.
  const builtInId = knownId ? null : await builtInMicId();
  if (!builtInId || stream.getAudioTracks()[0]?.getSettings().deviceId === builtInId) return stream;
  try {
    const builtIn = await getMic(builtInId);
    stopStream(stream);
    return builtIn;
  } catch {
    return stream;
  }
}

/** The Mic button: turns the mic on, or off when it is on. */
export async function toggleMic(): Promise<void> {
  if (kind === 'mic' || micStream) {
    request++;
    micWanted = false;
    stopSource();
    setStatus('Mic off.');
    return;
  }
  const myRequest = ++request;
  stopSource();
  if (!micCanWork()) return;
  // Create the context now, inside the tap, so that the browser lets it run.
  ensureAudio(false);
  setStatus('Asking for the mic. Allow it in the browser prompt.');
  let stream: MediaStream;
  try {
    stream = await openMic();
  } catch (error) {
    if (myRequest === request) explainMicError(error);
    return;
  }
  // Another source was picked meanwhile, or the page was hidden.
  if (myRequest !== request || kind !== 'none' || document.visibilityState === 'hidden') {
    stopStream(stream);
    return;
  }
  const graph = ensureAudio(false);
  micStream = stream;
  const source = graph.context.createMediaStreamSource(stream);
  source.connect(graph.analyser);
  input = source;
  for (const track of stream.getTracks()) {
    track.addEventListener('ended', () => {
      if (micStream !== stream) return;
      stopSource();
      setStatus('The mic was taken by another app. Tap Mic to listen again.');
    });
  }
  kind = 'mic';
  micWanted = true;
  markSource('mic');
  setStatus(
    "Listening. Set the noise gate so the red mark sits just above the room's quiet level.",
  );
}

function explainMicError(error: unknown): void {
  const name = errorName(error);
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    if (inFrame) {
      setStatus(`Mic blocked by the page host (${name}).`);
      offerDirectLink();
    } else {
      setStatus(
        `Mic permission denied (${name}). Allow it via the lock icon in the address bar, then try again.`,
      );
    }
  } else if (name === 'NotFoundError') setStatus('No microphone found on this device.');
  else if (name === 'NotReadableError')
    setStatus('Another app is holding the mic. Close it and try again.');
  else setStatus(`Mic failed: ${name}`);
}

/**
 * Page hidden: release the mic, so other apps get the audio session back.
 * Page visible again: turn the mic back on if it was on.
 */
export function onPageVisibility(visible: boolean): void {
  if (!visible) {
    if (kind === 'mic' || micStream) {
      request++;
      stopSource();
    }
  } else if (micWanted && kind === 'none') {
    micWanted = false;
    void toggleMic();
  }
}

/** The page is closing. */
export function releaseAll(): void {
  request++;
  stopSource();
}
