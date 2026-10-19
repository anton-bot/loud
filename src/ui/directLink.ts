/**
 * When the page runs inside a frame that blocks the mic (an HTML viewer, an embed),
 * the mic only works on the page's own address. This row shows that address with
 * Copy and New tab buttons.
 */
import { byId } from '../core/dom';
import { setStatus } from './status';

const linkRow = byId('linkRow');
const linkBox = byId<HTMLInputElement>('linkBox');

/** The page is in a frame (or the browser does not let us check). */
export const inFrame = (() => {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
})();

export function offerDirectLink(): void {
  if (!inFrame) return;
  const href = location.href;
  if (!/^https?:/.test(href)) {
    setStatus(
      'This viewer gives the page no address of its own, so the mic cannot be granted here. Use the demo beat or a file, or serve loud.html over http(s).',
    );
    return;
  }
  linkBox.value = href;
  linkRow.hidden = false;
  setStatus("Open this page's own link in a new Chrome tab and tap Mic there.");
}

export function initDirectLink(): void {
  byId('copyBtn').addEventListener('click', () => {
    const fallback = (): void => {
      linkBox.focus();
      linkBox.select();
      setStatus('Long-press the link to copy it, then paste it into a new Chrome tab.');
    };
    if (!navigator.clipboard?.writeText) {
      fallback();
      return;
    }
    navigator.clipboard
      .writeText(linkBox.value)
      .then(() => setStatus('Link copied. Paste it into a new Chrome tab and tap Mic there.'))
      .catch(fallback);
  });
  byId('tabBtn').addEventListener('click', () => {
    // No 'noopener' feature here: with it, window.open always returns null, and a blocked
    // tab would look the same as an opened one.
    let opened: Window | null = null;
    try {
      opened = window.open(linkBox.value, '_blank');
    } catch {
      // Some viewers throw instead of returning null.
    }
    if (opened) opened.opener = null;
    else setStatus('This viewer blocks new tabs. Copy the link instead and paste it into Chrome.');
  });
}
