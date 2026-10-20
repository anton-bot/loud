/** Three dancing figures under stage lights: the stand-in for the camera in the camera modes. */
import { TAU } from '../core/math';
import { audio, clock } from '../core/state';

function limb(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

/** Three dancing figures under stage lights, for when there is no camera. */
export function drawDancers(g: CanvasRenderingContext2D, w: number, h: number): void {
  const t = clock.time;
  const beat = audio.beats + (1 - audio.beat) * 0.5;
  g.fillStyle = '#0a0710';
  g.fillRect(0, 0, w, h);
  for (let k = 0; k < 3; k++) {
    const x = w * (0.2 + k * 0.3) + Math.sin(t * 0.7 + k) * w * 0.15;
    const light = g.createLinearGradient(x, 0, x, h);
    light.addColorStop(0, `hsla(${k * 120 + t * 20},100%,60%,${0.35 + audio.beat * 0.3})`);
    light.addColorStop(1, 'hsla(0,0%,0%,0)');
    g.fillStyle = light;
    g.beginPath();
    g.moveTo(x - 3, 0);
    g.lineTo(x + 3, 0);
    g.lineTo(x + w * 0.18, h);
    g.lineTo(x - w * 0.18, h);
    g.closePath();
    g.fill();
  }
  [
    [0.24, 0.55, 0, 330],
    [0.52, 0.6, 1.3, 190],
    [0.79, 0.52, 2.6, 50],
  ].forEach(([px, py, offset, hue], i) => {
    const s = h * 0.2;
    const swing = Math.sin(beat * Math.PI + offset);
    g.save();
    g.translate(w * px + Math.sin(t * (0.6 + i * 0.25) + i * 2) * w * 0.05, h * py);
    g.translate(0, -Math.abs(Math.sin(beat * Math.PI)) * s * 0.18);
    g.rotate(swing * 0.12);
    g.strokeStyle = g.fillStyle = `hsl(${hue},95%,72%)`;
    g.lineWidth = s * 0.24;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(0, -s * 1.1, s * 0.28, 0, TAU);
    g.fill();
    limb(g, 0, -s * 0.8, 0, s * 0.2);
    const left = -2.3 + swing * 0.9;
    const right = -0.85 - swing * 0.9;
    limb(g, 0, -s * 0.62, Math.cos(left) * s * 0.8, -s * 0.62 + Math.sin(left) * s * 0.8);
    limb(g, 0, -s * 0.62, Math.cos(right) * s * 0.8, -s * 0.62 + Math.sin(right) * s * 0.8);
    limb(g, 0, s * 0.2, -s * 0.35 - swing * s * 0.15, s * 0.95);
    limb(g, 0, s * 0.2, s * 0.35 - swing * s * 0.15, s * 0.95);
    g.restore();
  });
}
