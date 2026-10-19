/** The status line under the controls, and the highlight of the active sound source. */
import { byId } from '../core/dom';

const statusLine = byId('status');

export function setStatus(text: string): void {
  statusLine.textContent = text;
}

/** Highlights the button of the active source ('demo', 'mic', 'file'), or none. */
export function markSource(source: string | null): void {
  for (const button of document.querySelectorAll<HTMLElement>('.src')) {
    const on = button.dataset.src === source;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
  }
}
