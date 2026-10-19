/**
 * Heard words: every 45 s while the mic is on, 8 s of sound go to ElevenLabs speech to
 * text, and the words it hears are shown over the picture (render/heardWords.ts).
 *
 * Off by default, because it sends recordings of the room to a third party; the choice
 * is kept in this browser. The API key is in the page on purpose: an experiment key
 * with a small balance and no automatic top-up, so anyone who opens the page can read
 * and use it.
 */
import { setRecordingLight, setStatus } from '../ui/status';
import { currentMicStream } from './mic';

const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const ELEVENLABS_KEY = 'sk_2c12406b220bee699afe376e1ccefef432eb06f8c6a69e0b';
const MODEL = 'scribe_v2';
/** The first recording starts this long after the mic is on; then one every PERIOD_MS. */
const FIRST_AFTER_MS = 5000;
const PERIOD_MS = 45000;
const RECORD_MS = 8000;
/** Longest text that is shown. */
const MAX_WORDS = 10;
const SETTING = 'loud.heardWords';

export const speech = { enabled: readSetting() };

const listeners: ((text: string) => void)[] = [];
let listeningSince = 0;
let lastCapture = 0;
let busy = false;

/** Calls `listener` with each text that ElevenLabs hears. */
export function onHeard(listener: (text: string) => void): void {
  listeners.push(listener);
}

function readSetting(): boolean {
  try {
    return localStorage.getItem(SETTING) === 'on';
  } catch {
    return false;
  }
}

export function setSpeechEnabled(on: boolean): void {
  speech.enabled = on;
  try {
    localStorage.setItem(SETTING, on ? 'on' : 'off');
  } catch {
    // No storage (private window): the choice lasts until the page closes.
  }
}

/** Starts a recording when one is due. Call once per frame. */
export function tickSpeech(): void {
  const stream = currentMicStream();
  if (!speech.enabled || !stream) {
    listeningSince = 0;
    return;
  }
  const now = Date.now();
  if (!listeningSince) {
    listeningSince = now;
    lastCapture = 0;
  }
  if (busy) return;
  const due = lastCapture ? now - lastCapture >= PERIOD_MS : now - listeningSince >= FIRST_AFTER_MS;
  if (!due) return;
  lastCapture = now;
  void capture(stream);
}

async function capture(stream: MediaStream): Promise<void> {
  busy = true;
  try {
    const recording = await record(stream, RECORD_MS);
    if (!recording) return;
    const text = await transcribe(recording.blob, recording.extension);
    if (text) for (const listener of listeners) listener(text);
  } catch (error) {
    console.warn('loud: speech to text failed', error);
    setStatus(`Words: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    busy = false;
  }
}

/** A container that this browser can record, and the file extension for it. */
function recordingFormat(): { mimeType: string; extension: string } | null {
  const formats = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/mp4', extension: 'm4a' },
    { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  ];
  if (typeof MediaRecorder === 'undefined') return null;
  return formats.find((f) => MediaRecorder.isTypeSupported(f.mimeType)) ?? null;
}

/** Records `ms` of the mic. Null when the browser cannot record or the mic stops. */
function record(
  stream: MediaStream,
  ms: number,
): Promise<{ blob: Blob; extension: string } | null> {
  const format = recordingFormat();
  if (!format) return Promise.resolve(null);
  return new Promise((resolve) => {
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      audioBitsPerSecond: 64000,
    });
    recorder.addEventListener('dataavailable', (e) => chunks.push(e.data));
    recorder.addEventListener('stop', () => {
      setRecordingLight(false);
      const stillListening = currentMicStream() === stream;
      resolve(
        stillListening && chunks.length
          ? { blob: new Blob(chunks, { type: format.mimeType }), extension: format.extension }
          : null,
      );
    });
    recorder.start();
    setRecordingLight(true);
    setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, ms);
  });
}

async function transcribe(audio: Blob, extension: string): Promise<string> {
  const form = new FormData();
  form.append('model_id', MODEL);
  // No "(music)" or "(laughter)" tags: only words.
  form.append('tag_audio_events', 'false');
  form.append('file', audio, `room.${extension}`);
  const response = await fetch(ELEVENLABS_URL, {
    method: 'POST',
    headers: { 'xi-api-key': ELEVENLABS_KEY },
    body: form,
  });
  if (!response.ok) throw new Error(`ElevenLabs answered ${response.status}`);
  const result = (await response.json()) as { text?: string };
  return cleanText(result.text ?? '');
}

/** The heard text without bracketed sound tags, at most MAX_WORDS words. */
function cleanText(text: string): string {
  return text
    .replace(/[([][^)\]]*[)\]]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_WORDS)
    .join(' ');
}
