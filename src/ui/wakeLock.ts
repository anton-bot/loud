/** Keeps the screen on while something plays. */
let lock: WakeLockSentinel | null = null;

export async function keepAwake(): Promise<void> {
  if (!('wakeLock' in navigator) || lock) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => {
      lock = null;
    });
  } catch {
    // Not allowed now (for example the page is hidden): try again on the next play.
  }
}
