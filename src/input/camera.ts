/**
 * The phone's back camera, for the camera modes. It starts when such a mode first asks
 * for a picture, turns off when no mode has asked for 2.5 s (so the camera light goes
 * out), and turns off after 1 hour in case it was forgotten; leaving the mode and
 * coming back turns it on again.
 */
import { setStatus } from '../ui/status';

const LIMIT_MS = 60 * 60 * 1000;
const IDLE_MS = 2500;

type State = 'off' | 'asking' | 'on' | 'failed' | 'expired';
let state: State = 'off';
let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let startedAt = 0;
let lastUse = 0;

export const camera = {
  /** The camera worked once in this page, so auto-switch may pick camera modes. */
  allowed: false,
};

function stop(next: State): void {
  for (const track of stream?.getTracks() ?? []) track.stop();
  stream = null;
  video = null;
  state = next;
}

async function start(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) {
    state = 'failed';
    return;
  }
  state = 'asking';
  setStatus('Allow the camera for this mode.');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
  } catch {
    state = 'failed';
    setStatus('No camera: this mode shows its own dancers instead.');
    return;
  }
  // The mode was left while the browser asked.
  if (performance.now() - lastUse > IDLE_MS) {
    stop('off');
    return;
  }
  video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play().catch(() => {});
  state = 'on';
  camera.allowed = true;
  startedAt = performance.now();
  setStatus('Camera on. Point it at the dance floor.');
}

/** The live camera picture, or null (not ready, not allowed, or no camera). */
export function cameraVideo(): HTMLVideoElement | null {
  const now = performance.now();
  // Back after a break: an expired camera may start again.
  if (state === 'expired' && now - lastUse > IDLE_MS) state = 'off';
  lastUse = now;
  if (state === 'off') void start();
  return state === 'on' && video && video.readyState >= 2 ? video : null;
}

setInterval(() => {
  if (state !== 'on') return;
  const now = performance.now();
  if (now - lastUse > IDLE_MS) stop('off');
  else if (now - startedAt > LIMIT_MS) {
    stop('expired');
    setStatus('Camera turned off after 1 hour. Leave the mode and come back to turn it on.');
  }
}, 1000);
