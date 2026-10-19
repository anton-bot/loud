/** The status line, and the parts of the controls that follow the mic state. */
import { byId } from '../core/dom';

const statusLine = byId('status');
const micButton = byId('micBtn');
const gateRow = byId('gateRow');

export function setStatus(text: string): void {
  statusLine.textContent = text;
}

/** Lights the Mic button and shows the noise gate while the mic is on. */
export function showMicState(on: boolean): void {
  micButton.classList.toggle('on', on);
  micButton.setAttribute('aria-pressed', String(on));
  gateRow.hidden = !on;
}
