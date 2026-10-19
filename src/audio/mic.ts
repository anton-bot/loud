/** The microphone: the only sound source. */
import { closeAudio, ensureAudio } from './engine';
import { inFrame, offerDirectLink } from '../ui/directLink';
import { setStatus, showMicState } from '../ui/status';

let micStream: MediaStream | null = null;
let input: MediaStreamAudioSourceNode | null = null;
/**
 * Each mic request gets a new number. A request that ends after a newer one (or
 * after the mic was turned off) sees a different number and gives up.
 */
let request = 0;
/** The mic was on when the page was hidden: turn it on again when the page is visible. */
let micWanted = false;

export function isListening(): boolean {
  return micStream !== null;
}

/** The live mic stream, or null when the mic is off. */
export function currentMicStream(): MediaStream | null {
  return micStream;
}

function stopMic(): void {
  if (micStream) {
    for (const track of micStream.getTracks()) track.stop();
    micStream = null;
  }
  input?.disconnect();
  input = null;
  // Closing the context gives the audio session back to other apps at once.
  closeAudio();
  showMicState(false);
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
      `The mic needs an http(s) address, not ${location.protocol}//. Serve loud.html, for example with: python -m http.server 8000`,
    );
    return false;
  }
  if (!window.isSecureContext) {
    setStatus(`The mic needs https or localhost, not plain http://${location.host}.`);
    return false;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus('This frame has no mic access.');
    offerDirectLink();
    return false;
  }
  if (micBlockedByFrame()) {
    setStatus('The frame around this page blocks the mic.');
    offerDirectLink();
    return false;
  }
  return true;
}

function micBlockedByFrame(): boolean {
  try {
    const policy = document.permissionsPolicy || document.featurePolicy;
    if (policy && typeof policy.allowsFeature === 'function') {
      return !policy.allowsFeature('microphone');
    }
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

function explainMicError(error: unknown): void {
  const name = errorName(error);
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    if (inFrame) {
      setStatus(`The page host blocks the mic (${name}).`);
      offerDirectLink();
    } else {
      setStatus('Mic not allowed. Allow it with the lock icon in the address bar, then try again.');
    }
  } else if (name === 'NotFoundError') setStatus('No microphone found on this device.');
  else if (name === 'NotReadableError')
    setStatus('Another app is using the mic. Close it and try again.');
  else setStatus(`Mic failed: ${name}`);
}

async function startMic(): Promise<void> {
  const myRequest = ++request;
  if (!micCanWork()) return;
  // Create the context now, inside the tap, so that the browser lets it run.
  ensureAudio();
  setStatus('Allow the mic in the browser prompt.');
  let stream: MediaStream;
  try {
    stream = await openMic();
  } catch (error) {
    if (myRequest === request) explainMicError(error);
    return;
  }
  // The mic was turned off meanwhile, or the page was hidden.
  if (myRequest !== request || document.visibilityState === 'hidden') {
    stopStream(stream);
    return;
  }
  const graph = ensureAudio();
  micStream = stream;
  input = graph.context.createMediaStreamSource(stream);
  input.connect(graph.analyser);
  for (const track of stream.getTracks()) {
    track.addEventListener('ended', () => {
      if (micStream !== stream) return;
      stopMic();
      setStatus('Another app took the mic. Tap Mic to listen again.');
    });
  }
  micWanted = true;
  showMicState(true);
  setStatus("Listening. Put the gate just above the red mark when it's quiet.");
}

/** The Mic button: turns the mic on, or off when it is on. */
export async function toggleMic(): Promise<void> {
  if (micStream) {
    request++;
    micWanted = false;
    stopMic();
    setStatus('Mic off.');
    return;
  }
  await startMic();
}

/**
 * Page hidden: release the mic, so other apps get the audio session back.
 * Page visible again: turn the mic back on if it was on.
 */
export async function onPageVisibility(visible: boolean): Promise<void> {
  if (!visible) {
    if (micStream) {
      request++;
      stopMic();
    }
  } else if (micWanted && !micStream) {
    await startMic();
  }
}

/** The page is closing. */
export function releaseMic(): void {
  request++;
  stopMic();
}
