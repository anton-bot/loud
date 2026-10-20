/**
 * Phone motion: tilt pushes the image, shaking adds hits, twisting bends the image,
 * a hard shake changes the scene. On iOS the user must allow motion access first.
 */
import { clamp } from '../core/math';
import { audio, clock, motion, scene } from '../core/state';
import { autoSwitchAllowed, shuffle } from '../scene';
import { setStatus } from '../ui/status';

type MotionPermission = { requestPermission?: () => Promise<string> };

const needsPermission =
  typeof DeviceMotionEvent !== 'undefined' &&
  typeof (DeviceMotionEvent as MotionPermission).requestPermission === 'function';

/** Raw sensor readings. */
const sensor = {
  /** Orientation in degrees (front-back and left-right tilt). */
  beta: null as number | null,
  gamma: null as number | null,
  /** Resting orientation: follows the real one slowly, so tilt is relative to how the phone is held. */
  restBeta: null as number | null,
  restGamma: null as number | null,
  /** Acceleration without gravity, m/s². */
  ax: 0,
  ay: 0,
  az: 0,
  /** Rotation speed in deg/s: total, and around the screen axis. */
  rotation: 0,
  rotationZ: 0,
  /** clock.time of the last shake that changed the scene. */
  lastShuffle: 0,
};

let listening = false;
/** The user has pressed the Motion button. After that, motion never turns itself on. */
let userChose = false;
const listeners: (() => void)[] = [];

/** Calls `listener` when motion turns on or off. */
export function onMotionChange(listener: () => void): void {
  listeners.push(listener);
}

function setEnabled(enabled: boolean): void {
  motion.enabled = enabled;
  for (const listener of listeners) listener();
}

function dataArrived(): void {
  motion.available = true;
  // Where no permission is needed (Android), motion turns on by itself the first time data arrives.
  if (!motion.enabled && !needsPermission && !userChose) setEnabled(true);
}

function onOrientation(e: DeviceOrientationEvent): void {
  if (e.beta == null || e.gamma == null) return;
  sensor.beta = e.beta;
  sensor.gamma = e.gamma;
  dataArrived();
}

function onMotion(e: DeviceMotionEvent): void {
  const a = e.acceleration;
  const r = e.rotationRate;
  if (a && a.x != null) {
    sensor.ax = a.x;
    sensor.ay = a.y ?? 0;
    sensor.az = a.z || 0;
    dataArrived();
  }
  if (r && r.alpha != null) {
    sensor.rotation = Math.hypot(r.alpha, r.beta || 0, r.gamma || 0);
    sensor.rotationZ = r.alpha;
  }
}

function listen(): void {
  if (listening) return;
  listening = true;
  addEventListener('deviceorientation', onOrientation);
  addEventListener('devicemotion', onMotion);
}

/** Starts listening where no permission is needed. */
export function initMotion(): void {
  if (!needsPermission) listen();
}

/** The Motion button. */
export async function toggleMotion(): Promise<void> {
  userChose = true;
  if (motion.enabled) {
    setEnabled(false);
    return;
  }
  if (typeof DeviceMotionEvent === 'undefined') {
    setStatus('No motion sensors in this browser.');
    return;
  }
  try {
    if (needsPermission) {
      const answer = await (DeviceMotionEvent as MotionPermission).requestPermission?.();
      if (answer !== 'granted') {
        setStatus('Motion access was denied.');
        return;
      }
      const orientation = DeviceOrientationEvent as MotionPermission;
      if (typeof orientation.requestPermission === 'function') {
        try {
          await orientation.requestPermission();
        } catch {
          // Orientation is optional: shake and twist still work without it.
        }
      }
    }
  } catch {
    setStatus('Motion access was denied.');
    return;
  }
  listen();
  setEnabled(true);
  setStatus('Tilt, twist or shake the phone.');
  setTimeout(() => {
    if (motion.enabled && !motion.available) {
      setStatus('No motion data is arriving: it needs https and a phone with sensors.');
    }
  }, 2500);
}

/** Smooths the sensor data into `motion`, once per frame. */
export function updateMotion(dt: number): void {
  if (!motion.enabled || !motion.available) {
    motion.tiltX *= 0.9;
    motion.tiltY *= 0.9;
    motion.shake *= 0.9;
    motion.twist *= 0.9;
    motion.spin *= 0.9;
    return;
  }
  if (sensor.beta != null && sensor.gamma != null) {
    if (sensor.restBeta == null || sensor.restGamma == null) {
      sensor.restBeta = sensor.beta;
      sensor.restGamma = sensor.gamma;
    }
    sensor.restBeta += (sensor.beta - sensor.restBeta) * Math.min(1, dt * 0.6);
    sensor.restGamma += (sensor.gamma - sensor.restGamma) * Math.min(1, dt * 0.6);
    const tiltX = clamp((sensor.gamma - sensor.restGamma) / 35, -1, 1);
    const tiltY = clamp((sensor.beta - sensor.restBeta) / 35, -1, 1);
    motion.tiltX += (tiltX - motion.tiltX) * Math.min(1, dt * 8);
    motion.tiltY += (tiltY - motion.tiltY) * Math.min(1, dt * 8);
    motion.gravityX = clamp(Math.sin((sensor.gamma * Math.PI) / 180), -1, 1);
    motion.gravityY = clamp(Math.sin((sensor.beta * Math.PI) / 180), -1, 1);
  }
  const acceleration = Math.hypot(sensor.ax, sensor.ay, sensor.az);
  motion.shake = Math.max(motion.shake * (1 - dt * 2.5), clamp((acceleration - 2) / 14, 0, 1));
  motion.twist += (clamp(sensor.rotation / 250, 0, 1) - motion.twist) * Math.min(1, dt * 6);
  motion.spin += (clamp(sensor.rotationZ / 250, -1, 1) - motion.spin) * Math.min(1, dt * 6);
  sensor.rotation *= Math.pow(0.05, dt);
  sensor.rotationZ *= Math.pow(0.05, dt);

  if (motion.shake > 0.15) {
    audio.beat = Math.max(audio.beat, motion.shake);
    scene.hue = (scene.hue + motion.shake * dt * 300) % 360;
  }
  // A camera mode asks to move the phone: a shake must not end it before its time.
  if (motion.shake > 0.85 && clock.time - sensor.lastShuffle > 1.5 && autoSwitchAllowed()) {
    sensor.lastShuffle = clock.time;
    shuffle();
  }
}

/** True when motion is on and the phone is moving enough to matter. */
export function motionIsActive(): boolean {
  return (
    motion.enabled &&
    motion.available &&
    (Math.abs(motion.tiltX) > 0.02 ||
      Math.abs(motion.tiltY) > 0.02 ||
      motion.shake > 0.02 ||
      motion.twist > 0.02)
  );
}
