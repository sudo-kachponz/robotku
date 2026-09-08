// src/components/blockcoding/sim/oledAnimations.ts
//
// Wokwi-Animator-style OLED animations library for 0.96" SSD1306 OLED screens.
// Authored procedurally so frames can render crisply at 32x32, 48x48, 64x32, 64x64, or 128x64.
// Default resolution is AW=64, AH=32 (2048 chars) for ultra-fast serial streaming (~4.5 fps)
// via DISPLAY_BITMAP while scaling seamlessly to full screen.

import type { BlockSpec } from '../../../templates/authoring';

export const AW = 64;
export const AH = 32;

export type OledCategory =
  | 'loaders'
  | 'gestures'
  | 'emoji'
  | 'weather'
  | 'ui'
  | 'web'
  | 'social'
  | 'media'
  | 'ecommerce'
  | 'game'
  | 'custom';

export interface CategoryInfo {
  id: OledCategory;
  label: string;
  icon: string;
}

export const OLED_CATEGORIES: CategoryInfo[] = [
  { id: 'loaders', label: 'Indikator & Loading', icon: '⏳' },
  { id: 'gestures', label: 'Gerakan Tangan', icon: '✋' },
  { id: 'emoji', label: 'Wajah & Emosi', icon: '😃' },
  { id: 'weather', label: 'Cuaca & Alam', icon: '☀️' },
  { id: 'ui', label: 'UI & Sistem', icon: '📁' },
  { id: 'web', label: 'Web & Jaringan', icon: '🌐' },
  { id: 'social', label: 'Sosial & Pesan', icon: '💬' },
  { id: 'media', label: 'Media & Suara', icon: '🎵' },
  { id: 'ecommerce', label: 'Toko & Belanja', icon: '🛍️' },
  { id: 'game', label: 'Game & Karakter', icon: '👾' },
  { id: 'custom', label: 'Kustom & Gambar', icon: '✏️' },
];

export interface OledAnim {
  id: string;
  name: string;
  category: OledCategory;
  frames: number;
  fps: number;
  frame: (i: number, w?: number, h?: number) => string;
  description?: string;
  toBlockSpec?: () => BlockSpec[];
}

// ── Blockly Block Spec Helpers ──
export const lcdText = (text: string, secs = 1): BlockSpec => ({
  type: 'lcd_text',
  fields: { TEXT: text },
  inputs: { DURATION: secs },
});
export const lcdShape = (shape: string, secs = 1): BlockSpec => ({
  type: 'lcd_shape',
  fields: { SHAPE: shape },
  inputs: { DURATION: secs },
});
export const lcdClear = (): BlockSpec => ({
  type: 'lcd_clear',
});
export const kaomoji = (face: string): BlockSpec => ({
  type: 'display_kaomoji',
  fields: { FACE: face },
});
export const sleep = (secs: number): BlockSpec => ({
  type: 'time_sleep',
  inputs: { SECONDS: secs },
});
export const tone = (note: string, beats = 0.5): BlockSpec => ({
  type: 'audio_play_tone_beat',
  fields: { NOTE: note, WAIT: 'true' },
  inputs: { BEATS: beats },
});
export const setBpm = (bpm: number): BlockSpec => ({
  type: 'audio_set_bpm',
  fields: { BPM: String(bpm) },
});
export const repeat = (times: number, body: BlockSpec[]): BlockSpec => ({
  type: 'controls_repeat_ext',
  inputs: { TIMES: times },
  statements: { DO: body },
});

type SetPixel = (x: number, y: number) => void;
type DrawFn = (set: SetPixel, i: number, w: number, h: number) => void;

function build(draw: DrawFn, i: number, w = AW, h = AH): string {
  const px = new Uint8Array(w * h);
  const set: SetPixel = (x: number, y: number) => {
    const xr = Math.round(x);
    const yr = Math.round(y);
    if (xr >= 0 && xr < w && yr >= 0 && yr < h) {
      px[yr * w + xr] = 1;
    }
  };
  draw(set, i, w, h);
  let s = '';
  for (let k = 0; k < px.length; k++) {
    s += px[k] ? '1' : '0';
  }
  return s;
}

// ── Ultra-Sharp Geometry & Pixel Drawing Utilities ──
function disc(set: SetPixel, cx: number, cy: number, r: number): void {
  const icx = Math.round(cx);
  const icy = Math.round(cy);
  const ir = Math.round(r);
  const r2 = ir * ir;
  for (let y = -ir; y <= ir; y++) {
    for (let x = -ir; x <= ir; x++) {
      if (x * x + y * y <= r2) set(icx + x, icy + y);
    }
  }
}

function ring(set: SetPixel, cx: number, cy: number, r: number, thickness = 1): void {
  const icx = Math.round(cx);
  const icy = Math.round(cy);
  const ir = Math.round(r);
  const rOut2 = ir * ir;
  const rIn = Math.max(0, ir - Math.round(thickness));
  const rIn2 = rIn * rIn;
  for (let y = -ir; y <= ir; y++) {
    for (let x = -ir; x <= ir; x++) {
      const d2 = x * x + y * y;
      if (d2 <= rOut2 && d2 >= rIn2) set(icx + x, icy + y);
    }
  }
}

function arc(
  set: SetPixel,
  cx: number,
  cy: number,
  r: number,
  startA: number,
  endA: number,
  thickness = 1,
): void {
  const step = 0.5 / Math.max(1, r);
  for (let t = 0; t < thickness; t++) {
    const curR = r - t;
    if (curR <= 0) continue;
    for (let a = startA; a <= endA; a += step) {
      set(cx + Math.cos(a) * curR, cy + Math.sin(a) * curR);
    }
  }
}

function line(set: SetPixel, x0: number, y0: number, x1: number, y1: number, width = 1): void {
  const ix0 = Math.round(x0);
  const iy0 = Math.round(y0);
  const ix1 = Math.round(x1);
  const iy1 = Math.round(y1);
  const dx = Math.abs(ix1 - ix0);
  const dy = Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1;
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx - dy;
  let cx = ix0;
  let cy = iy0;
  const hw = Math.max(0, Math.floor((width - 1) / 2));
  const maxSteps = (dx + dy + 2) * 2;
  let steps = 0;

  while (steps++ < maxSteps) {
    if (hw === 0) {
      set(cx, cy);
    } else {
      disc(set, cx, cy, hw);
    }
    if (cx === ix1 && cy === iy1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
}

function rect(
  set: SetPixel,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = true,
  strokeWidth = 1,
): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  const iw = Math.max(1, Math.round(w));
  const ih = Math.max(1, Math.round(h));
  const st = Math.max(1, Math.round(strokeWidth));

  if (fill) {
    for (let dy = 0; dy < ih; dy++) {
      for (let dx = 0; dx < iw; dx++) {
        set(ix + dx, iy + dy);
      }
    }
  } else {
    for (let t = 0; t < st; t++) {
      for (let dx = 0; dx < iw; dx++) {
        set(ix + dx, iy + t);
        set(ix + dx, iy + ih - 1 - t);
      }
      for (let dy = 0; dy < ih; dy++) {
        set(ix + t, iy + dy);
        set(ix + iw - 1 - t, iy + dy);
      }
    }
  }
}

function roundedRect(
  set: SetPixel,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill = false,
  strokeWidth = 1,
): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  const iw = Math.max(1, Math.round(w));
  const ih = Math.max(1, Math.round(h));
  const ir = Math.min(Math.round(r), Math.floor(Math.min(iw, ih) / 2));

  if (fill) {
    for (let dy = 0; dy < ih; dy++) {
      for (let dx = 0; dx < iw; dx++) {
        const cx = dx < ir ? ir : dx > iw - 1 - ir ? iw - 1 - ir : dx;
        const cy = dy < ir ? ir : dy > ih - 1 - ir ? ih - 1 - ir : dy;
        const ddx = dx - cx;
        const ddy = dy - cy;
        if (ddx * ddx + ddy * ddy <= ir * ir) set(ix + dx, iy + dy);
      }
    }
  } else {
    for (let dx = ir; dx < iw - ir; dx++) {
      for (let t = 0; t < strokeWidth; t++) {
        set(ix + dx, iy + t);
        set(ix + dx, iy + ih - 1 - t);
      }
    }
    for (let dy = ir; dy < ih - ir; dy++) {
      for (let t = 0; t < strokeWidth; t++) {
        set(ix + t, iy + dy);
        set(ix + iw - 1 - t, iy + dy);
      }
    }
    ring(set, ix + ir, iy + ir, ir, strokeWidth);
    ring(set, ix + iw - 1 - ir, iy + ir, ir, strokeWidth);
    ring(set, ix + ir, iy + ih - 1 - ir, ir, strokeWidth);
    ring(set, ix + iw - 1 - ir, iy + ih - 1 - ir, ir, strokeWidth);
  }
}

function ellipse(
  set: SetPixel,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill = true,
  strokeWidth = 1,
): void {
  const irx = Math.max(1, Math.round(rx));
  const iry = Math.max(1, Math.round(ry));
  const icx = Math.round(cx);
  const icy = Math.round(cy);

  if (fill) {
    for (let y = -iry; y <= iry; y++) {
      const xSpan = Math.round(irx * Math.sqrt(Math.max(0, 1 - (y * y) / (iry * iry))));
      for (let x = -xSpan; x <= xSpan; x++) {
        set(icx + x, icy + y);
      }
    }
  } else {
    for (let a = 0; a <= Math.PI * 2; a += 0.05) {
      for (let t = 0; t < strokeWidth; t++) {
        set(icx + Math.cos(a) * (irx - t), icy + Math.sin(a) * (iry - t));
      }
    }
  }
}

function sprite(set: SetPixel, x: number, y: number, rows: string[], scale = 1): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '1' || row[c] === 'X' || row[c] === '#') {
        if (scale === 1) {
          set(ix + c, iy + r);
        } else {
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              set(ix + c * scale + sx, iy + r * scale + sy);
            }
          }
        }
      }
    }
  }
}

function polygonFill(set: SetPixel, points: [number, number][]): void {
  if (points.length < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const iy0 = Math.round(minY);
  const iy1 = Math.round(maxY);

  for (let y = iy0; y <= iy1; y++) {
    const nodeX: number[] = [];
    let j = points.length - 1;
    for (let k = 0; k < points.length; k++) {
      const [x0, y0] = points[k];
      const [x1, y1] = points[j];
      if ((y0 < y && y1 >= y) || (y1 < y && y0 >= y)) {
        nodeX.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
      }
      j = k;
    }
    nodeX.sort((a, b) => a - b);
    for (let n = 0; n < nodeX.length; n += 2) {
      if (n + 1 < nodeX.length) {
        const xStart = Math.round(nodeX[n]);
        const xEnd = Math.round(nodeX[n + 1]);
        for (let x = xStart; x <= xEnd; x++) {
          set(x, y);
        }
      }
    }
  }
}

function tri(i: number, period: number, range: number): number {
  const p = ((i % period) + period) % period;
  const half = period / 2;
  return (p < half ? p / half : (period - p) / half) * range;
}

// ── Category: INDIKATOR & LOADING (Loaders) ──
const LOADERS_ANIMS: OledAnim[] = [
  {
    id: 'heartbeat',
    name: 'Detak Jantung (ECG)',
    category: 'loaders',
    frames: 36,
    fps: 15,
    description: 'Grafik denyut elektrokardiogram presisi dengan grid monitor dan pulsa denyut.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cy = h / 2;
        // Background subtle grid ticks
        for (let x = 4; x < w; x += 8) {
          for (let y = 4; y < h; y += 8) {
            set(x, y);
          }
        }
        const speed = 2;
        const shift = (i * speed) % 48;
        const scanHead = (i * speed * 1.5) % w;

        for (let x = 0; x < w; x++) {
          const px = (x + shift) % 48;
          let y = cy;
          if (px >= 12 && px <= 14) y = cy - (px - 12) * 2; // P wave
          else if (px > 14 && px <= 16) y = cy - 4 + (px - 14) * 2;
          else if (px > 16 && px <= 18) y = cy + (px - 16) * 3; // Q dip
          else if (px > 18 && px <= 21) y = cy + 6 - (px - 18) * 9; // R peak
          else if (px > 21 && px <= 24) y = cy - 21 + (px - 21) * 10; // S dip
          else if (px > 24 && px <= 26) y = cy + 9 - (px - 24) * 4.5;
          else if (px >= 30 && px <= 33) y = cy - (px - 30) * 3; // T wave
          else if (px > 33 && px <= 36) y = cy - 9 + (px - 33) * 3;

          line(set, x, cy, x, y, 1);
          disc(set, x, y, 0.8);
        }

        // Leading glowing monitor cursor
        disc(set, scanHead, cy, 2);
        disc(set, scanHead - 2, cy, 1.2);
        disc(set, scanHead - 4, cy, 0.8);

        // Pulsing top-right mini heart indicator
        const hp = (i % 12 < 4 ? 2 : 1.5);
        disc(set, w - 8 - hp, 6, hp);
        disc(set, w - 8 + hp, 6, hp);
        line(set, w - 8 - hp * 2, 6, w - 8, 6 + hp * 2, 1);
        line(set, w - 8 + hp * 2, 6, w - 8, 6 + hp * 2, 1);
      }, i, w, h),
    toBlockSpec: () => [repeat(3, [lcdText('BPM: 75 Normal', 1), sleep(0.5)])],
  },
  {
    id: 'airplane',
    name: 'Pesawat Terbang',
    category: 'loaders',
    frames: 36,
    fps: 12,
    description: 'Pesawat jet bersayap menyusuri awan bertingkat dengan jejak asap.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const posX = ((i * 2.2) % (w + 40)) - 20;
        const posY = h / 2 - 3 + Math.sin((i / 36) * Math.PI * 4) * 2;

        // Background scrolling clouds
        const c1X = (w - ((i * 0.8) % w)) % w;
        disc(set, c1X, h - 4, 7);
        disc(set, c1X + 10, h - 7, 9);
        disc(set, c1X + 22, h - 5, 6);
        rect(set, c1X - 6, h - 3, 36, 4, true);

        // Jet aircraft fuselage & swept wings
        line(set, posX - 16, posY, posX + 12, posY, 2.5); // Fuselage body
        line(set, posX + 12, posY, posX + 16, posY - 1, 1.5); // Cockpit nose
        disc(set, posX + 12, posY - 1, 1.2); // Cockpit glass window

        // Main Swept Wings
        line(set, posX - 2, posY - 1, posX - 8, posY - 9, 2.5); // Upper wing
        line(set, posX - 8, posY - 9, posX - 5, posY - 9, 1.5); // Wingtip
        line(set, posX - 2, posY + 1, posX - 8, posY + 9, 2.5); // Lower wing
        line(set, posX - 8, posY + 9, posX - 5, posY + 9, 1.5); // Wingtip

        // Jet Engine Turbines
        rect(set, posX - 4, posY - 5, 5, 2, true);
        rect(set, posX - 4, posY + 4, 5, 2, true);

        // Tailfin & Rudder
        line(set, posX - 12, posY, posX - 17, posY - 6, 2);
        line(set, posX - 17, posY - 6, posX - 14, posY - 6, 1.5);
        line(set, posX - 13, posY, posX - 16, posY + 4, 1.5);

        // Jet Engine Contrails (exhaust trail)
        for (let t = 1; t < 16; t += 3) {
          const fade = t / 16;
          set(posX - 17 - t, Math.round(posY - 5 + Math.sin(t * 0.5) * fade));
          set(posX - 17 - t, Math.round(posY + 4 + Math.sin(t * 0.5) * fade));
        }
      }, i, w, h),
  },
  {
    id: 'basketball',
    name: 'Bola Basket',
    category: 'loaders',
    frames: 28,
    fps: 14,
    description: 'Bola basket realistis memantul dengan kurva jahitan berputar dan bayangan lantai.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const groundY = h - 3;
        const jumpH = h - 18;
        const progress = (i % 28) / 28;
        // Parabolic physics bounce
        const tVal = (progress * 2 - 1);
        const cy = 9 + (tVal * tVal) * jumpH;
        const isImpact = cy > groundY - 8;
        const squashX = isImpact ? 1.3 : 1.0;
        const squashY = isImpact ? 0.75 : 1.0;
        const r = 8;

        // Ground contact shadow
        const shadowW = Math.max(3, Math.round(r * (1.6 - (groundY - cy) / jumpH)));
        ellipse(set, cx, groundY, shadowW, 1.5, true);

        // Basketball Outer Sphere
        ellipse(set, cx, cy, r * squashX, r * squashY, false, 1.5);

        // Rotating Seam lines
        const spin = (i / 28) * Math.PI * 2;
        const cos = Math.cos(spin);
        const sin = Math.sin(spin);

        // Horizontal equator
        for (let dx = -r * 0.8; dx <= r * 0.8; dx += 1) {
          const dy = sin * 3 * Math.sqrt(Math.max(0, 1 - (dx / r) * (dx / r)));
          set(cx + dx * squashX, cy + dy * squashY);
        }

        // Vertical meridian
        for (let dy = -r * 0.8; dy <= r * 0.8; dy += 1) {
          const dx = cos * r * 0.8 * Math.sqrt(Math.max(0, 1 - (dy / r) * (dy / r)));
          set(cx + dx * squashX, cy + dy * squashY);
        }

        // Side curved ribs
        arc(set, cx - 6 * squashX, cy, r * 0.7 * squashX, -Math.PI * 0.4, Math.PI * 0.4, 1);
        arc(set, cx + 6 * squashX, cy, r * 0.7 * squashX, Math.PI * 0.6, Math.PI * 1.4, 1);
      }, i, w, h),
  },
  {
    id: 'clock',
    name: 'Jam Berputar',
    category: 'loaders',
    frames: 36,
    fps: 12,
    description: 'Jam dinding presisi dengan 12 penanda angka dan jarum berputar mulus.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 2;

        // Outer Bezel & Inner Dial
        ring(set, cx, cy, r, 1.5);
        ring(set, cx, cy, r - 2, 0.8);

        // 12 Hour tick marks
        for (let hTick = 0; hTick < 12; hTick++) {
          const a = (hTick / 12) * Math.PI * 2 - Math.PI / 2;
          const isMajor = hTick % 3 === 0;
          const innerR = isMajor ? r - 4.5 : r - 3;
          line(
            set,
            cx + Math.cos(a) * innerR,
            cy + Math.sin(a) * innerR,
            cx + Math.cos(a) * (r - 1.5),
            cy + Math.sin(a) * (r - 1.5),
            isMajor ? 1.5 : 1,
          );
        }

        // Hour Hand
        const hA = (i / 36) * Math.PI * 0.6 - Math.PI / 2;
        line(set, cx, cy, cx + Math.cos(hA) * (r * 0.48), cy + Math.sin(hA) * (r * 0.48), 2);

        // Minute Hand with Counterweight
        const mA = (i / 36) * Math.PI * 4 - Math.PI / 2;
        line(set, cx - Math.cos(mA) * 2, cy - Math.sin(mA) * 2, cx + Math.cos(mA) * (r * 0.72), cy + Math.sin(mA) * (r * 0.72), 1.5);

        // Center Pin Cap
        disc(set, cx, cy, 2);
      }, i, w, h),
  },
  {
    id: 'compass',
    name: 'Kompas Arah',
    category: 'loaders',
    frames: 36,
    fps: 12,
    description: 'Kompas navigasi dengan bintang 8 arah dan jarum magnetik berosilasi realistis.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 2;

        // Outer Nautical Dial with Cardinal Ticks
        ring(set, cx, cy, r, 1.5);
        for (let c = 0; c < 8; c++) {
          const ca = (c / 8) * Math.PI * 2;
          const len = c % 2 === 0 ? 3 : 1.5;
          line(set, cx + Math.cos(ca) * (r - len), cy + Math.sin(ca) * (r - len), cx + Math.cos(ca) * (r - 0.5), cy + Math.sin(ca) * (r - 0.5), 1);
        }

        // Cardinal Letter Indicators (N at top)
        set(cx, cy - r + 4);
        set(cx - 1, cy - r + 4);
        set(cx + 1, cy - r + 4);

        // Damped magnetic needle angle
        const targetA = Math.sin((i / 36) * Math.PI * 2) * 0.9 - Math.PI / 2;
        const tipX = cx + Math.cos(targetA) * (r - 4);
        const tipY = cy + Math.sin(targetA) * (r - 4);
        const tailX = cx - Math.cos(targetA) * (r - 4);
        const tailY = cy - Math.sin(targetA) * (r - 4);
        const side1X = cx + Math.cos(targetA + Math.PI / 2) * 3;
        const side1Y = cy + Math.sin(targetA + Math.PI / 2) * 3;
        const side2X = cx + Math.cos(targetA - Math.PI / 2) * 3;
        const side2Y = cy + Math.sin(targetA - Math.PI / 2) * 3;

        // North Point (Solid Arrow)
        line(set, tipX, tipY, side1X, side1Y, 1.5);
        line(set, tipX, tipY, side2X, side2Y, 1.5);
        line(set, cx, cy, tipX, tipY, 2);

        // South Point (Hollow Arrow)
        line(set, tailX, tailY, side1X, side1Y, 1);
        line(set, tailX, tailY, side2X, side2Y, 1);

        // Center Jewel Pivot
        disc(set, cx, cy, 2);
      }, i, w, h),
  },
  {
    id: 'spinner_dots',
    name: 'Titik Putar Loading',
    category: 'loaders',
    frames: 24,
    fps: 12,
    description: '12 titik orbit berputar memudar mulus dengan efek cahaya rotasi dinamis.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 3;
        const numDots = 12;

        for (let d = 0; d < numDots; d++) {
          const a = (d / numDots) * Math.PI * 2;
          const lead = (i % 24) / 24;
          const dist = (d / numDots - lead + 1) % 1;
          const dotR = dist < 0.15 ? 2.8 : dist < 0.3 ? 2.2 : dist < 0.5 ? 1.6 : dist < 0.7 ? 1.0 : 0.6;
          disc(set, cx + Math.cos(a) * r, cy + Math.sin(a) * r, dotR);
        }
        disc(set, cx, cy, 1.2);
      }, i, w, h),
  },
  {
    id: 'hourglass',
    name: 'Jam Pasir',
    category: 'loaders',
    frames: 32,
    fps: 12,
    description: 'Jam pasir klasik ornamen kayu dengan aliran butiran pasir mengalir halus.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const progress = (i % 32) / 32;

        // Ornate Wooden Plates Top & Bottom
        rect(set, cx - 13, cy - 13, 26, 3, true);
        rect(set, cx - 13, cy + 11, 26, 3, true);
        // Vertical Side Pillars
        line(set, cx - 11, cy - 10, cx - 11, cy + 10, 1.5);
        line(set, cx + 11, cy - 10, cx + 11, cy + 10, 1.5);

        // Glass Bulbs Contour
        line(set, cx - 9, cy - 10, cx - 2, cy, 1);
        line(set, cx + 9, cy - 10, cx + 2, cy, 1);
        line(set, cx - 9, cy + 10, cx - 2, cy, 1);
        line(set, cx + 9, cy + 10, cx + 2, cy, 1);

        // Top Chamber Sand draining down
        const topH = Math.max(0, Math.round((1 - progress) * 8));
        for (let y = 0; y < topH; y++) {
          const sw = Math.round(((8 - y) / 8) * 7);
          line(set, cx - sw, cy - 2 - y, cx + sw, cy - 2 - y, 1);
        }

        // Falling Sand stream & dropping particles
        line(set, cx, cy, cx, cy + 8, 1);
        if (i % 2 === 0) {
          set(cx, cy + 3);
          set(cx, cy + 6);
        }

        // Bottom Chamber Sand Cone accumulation
        const botH = Math.min(8, Math.round(progress * 8));
        for (let y = 0; y < botH; y++) {
          const sw = Math.round(((y + 1) / 8) * 7);
          line(set, cx - sw, cy + 10 - y, cx + sw, cy + 10 - y, 1);
        }
      }, i, w, h),
  },
  {
    id: 'walking_man',
    name: 'Orang Berjalan',
    category: 'loaders',
    frames: 24,
    fps: 12,
    description: 'Sosok terartikulasi melangkah anggun dengan ayunan tangan dan sendi lutut.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const posX = 10 + ((i * 1.8) % (w - 20));
        const groundY = h - 3;
        const cy = groundY - 15;
        const stepCycle = (i / 24) * Math.PI * 2;
        const legSwing = Math.sin(stepCycle) * 7;
        const armSwing = -Math.sin(stepCycle) * 6;
        const bob = Math.abs(Math.cos(stepCycle)) * 1.5;

        // Ground Sidewalk Line
        for (let gx = 0; gx < w; gx += 4) {
          set(gx, groundY + 1);
          set(gx + 1, groundY + 1);
        }

        // Head with Hat/Hair details
        disc(set, posX, cy - 8 - bob, 3);

        // Torso & Spine
        line(set, posX, cy - 5 - bob, posX, cy + 4 - bob, 2);

        // Arms (Back arm and Front arm)
        line(set, posX, cy - 3 - bob, posX + armSwing * 0.7, cy + 3 - bob, 1.5);
        line(set, posX, cy - 3 - bob, posX - armSwing * 0.7, cy + 3 - bob, 1.5);

        // Left Leg & Knee & Foot
        const lKneeX = posX + legSwing * 0.5;
        const lKneeY = cy + 9 - bob;
        const lFootX = posX + legSwing;
        const lFootY = groundY;
        line(set, posX, cy + 4 - bob, lKneeX, lKneeY, 2);
        line(set, lKneeX, lKneeY, lFootX, lFootY, 1.5);
        line(set, lFootX, lFootY, lFootX + 2, lFootY, 1.5); // Shoe toe

        // Right Leg & Knee & Foot
        const rKneeX = posX - legSwing * 0.5;
        const rKneeY = cy + 9 - bob;
        const rFootX = posX - legSwing;
        const rFootY = groundY;
        line(set, posX, cy + 4 - bob, rKneeX, rKneeY, 2);
        line(set, rKneeX, rKneeY, rFootX, rFootY, 1.5);
        line(set, rFootX, rFootY, rFootX + 2, rFootY, 1.5);
      }, i, w, h),
  },
  {
    id: 'car_drive',
    name: 'Mobil Melaju',
    category: 'loaders',
    frames: 24,
    fps: 12,
    description: 'Mobil sport aerodinamis melaju kencang dengan sorot lampu dan roda berputar.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 1;
        const bounce = i % 4 < 2 ? 0.8 : 0;
        const carY = cy - bounce;

        // Ground rushing road stripes
        const roadShift = (i * 4) % 16;
        line(set, 0, cy + 11, w, cy + 11, 1);
        for (let rx = -roadShift; rx < w; rx += 16) {
          line(set, rx, cy + 13, rx + 8, cy + 13, 1);
        }

        // Aerodynamic Sports Car Chassis
        roundedRect(set, cx - 18, carY - 2, 36, 8, 2, true);
        // Cabin Glass Canopy
        polygonFill(set, [
          [cx - 10, carY - 2],
          [cx - 4, carY - 9],
          [cx + 8, carY - 9],
          [cx + 14, carY - 2],
        ]);
        // Windows (Driver cutout)
        rect(set, cx - 3, carY - 7, 4, 4, false);
        rect(set, cx + 3, carY - 7, 5, 4, false);

        // Rear Spoiler Wing
        line(set, cx - 17, carY - 2, cx - 17, carY - 7, 1.5);
        line(set, cx - 20, carY - 7, cx - 14, carY - 7, 2);

        // Front Headlight beam
        disc(set, cx + 18, carY + 1, 2);
        for (let bx = 1; bx <= 12; bx += 3) {
          line(set, cx + 18 + bx, carY - 1 - bx * 0.4, cx + 18 + bx, carY + 3 + bx * 0.4, 1);
        }

        // Rotating Spoke Wheels
        const spin = (i / 24) * Math.PI * 4;
        for (const wx of [cx - 10, cx + 10]) {
          const wy = carY + 6;
          ring(set, wx, wy, 4, 1.5);
          disc(set, wx, wy, 1.5);
          line(set, wx - Math.cos(spin) * 3, wy - Math.sin(spin) * 3, wx + Math.cos(spin) * 3, wy + Math.sin(spin) * 3, 1);
          line(set, wx - Math.sin(spin) * 3, wy + Math.cos(spin) * 3, wx + Math.sin(spin) * 3, wy - Math.cos(spin) * 3, 1);
        }
      }, i, w, h),
  },
  {
    id: 'rocket',
    name: 'Roket Luar Angkasa',
    category: 'loaders',
    frames: 30,
    fps: 12,
    description: 'Roket luar angkasa futuristik meluncur menembus bintang dengan semburan api.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 2 + Math.sin(i * 0.3) * 1.5;

        // Cosmic Stars streaming downward
        for (let s = 0; s < 8; s++) {
          const sx = (cx - 24 + s * 7) % w;
          const sy = (i * 3 + s * 9) % h;
          set(sx, sy);
          if (s % 2 === 0) set(sx, sy + 1);
        }

        // Rocket Nosecone (Sharply pointed)
        polygonFill(set, [
          [cx, cy - 14],
          [cx - 5, cy - 6],
          [cx + 5, cy - 6],
        ]);

        // Rocket Cylindrical Fuselage
        rect(set, cx - 5, cy - 6, 10, 14, true);

        // Circular Porthole Window
        ring(set, cx, cy - 1, 3, 1);
        disc(set, cx - 1, cy - 2, 1); // Specular gleam

        // Delta Side Booster Fins
        polygonFill(set, [
          [cx - 5, cy + 2],
          [cx - 11, cy + 8],
          [cx - 5, cy + 8],
        ]);
        polygonFill(set, [
          [cx + 5, cy + 2],
          [cx + 11, cy + 8],
          [cx + 5, cy + 8],
        ]);

        // Engine Propulsion Nozzle Bell
        rect(set, cx - 3, cy + 8, 6, 2, true);

        // Turbulent Roaring Flame Exhaust
        const flH = 6 + (i % 6) * 1.8;
        polygonFill(set, [
          [cx - 3, cy + 10],
          [cx + 3, cy + 10],
          [cx, cy + 10 + flH],
        ]);
        const innerFlH = flH * 0.6;
        polygonFill(set, [
          [cx - 1.5, cy + 10],
          [cx + 1.5, cy + 10],
          [cx, cy + 10 + innerFlH],
        ]);
      }, i, w, h),
    toBlockSpec: () => [lcdText('Launch 3.. 2.. 1.. 🚀', 2)],
  },
  {
    id: 'sync_cloud',
    name: 'Sinkronisasi Cloud',
    category: 'loaders',
    frames: 32,
    fps: 12,
    description: 'Awan data berawan halus dengan dual panah siklus sinkronisasi memutar mulus.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 2;

        // Puffy Cloud Outline
        disc(set, cx - 11, cy + 1, 6);
        disc(set, cx + 11, cy + 1, 5.5);
        disc(set, cx - 3, cy - 5, 7.5);
        disc(set, cx + 5, cy - 3, 6.5);
        rect(set, cx - 14, cy + 1, 28, 6, true);

        // Inner cutout for sync arrows
        const rot = (i / 32) * Math.PI * 2;
        const arrowR = 6;
        const arrowY = cy + 1;

        for (let side = 0; side < 2; side++) {
          const a0 = rot + side * Math.PI;
          const a1 = a0 + Math.PI * 0.75;
          arc(set, cx, arrowY, arrowR, a0, a1, 1.5);

          // Arrowhead
          const tipX = cx + Math.cos(a1) * arrowR;
          const tipY = arrowY + Math.sin(a1) * arrowR;
          const nx = Math.cos(a1 + Math.PI * 0.7) * 3;
          const ny = Math.sin(a1 + Math.PI * 0.7) * 3;
          line(set, tipX, tipY, tipX + nx, tipY + ny, 1.5);
          line(set, tipX, tipY, tipX - ny * 0.8, tipY + nx * 0.8, 1.5);
        }
      }, i, w, h),
  },
];

// ── Category: GERAKAN TANGAN (Gestures) ──
const GESTURES_ANIMS: OledAnim[] = [
  {
    id: 'tap_hand',
    name: 'Ketuk Jari (Tap)',
    category: 'gestures',
    frames: 24,
    fps: 12,
    description: 'Jari telunjuk anatomis mengetuk layar memicu gelombang riak sentuhan.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 1;
        const tap = tri(i, 24, 5);
        const tapY = cy - 7 + tap;

        // Extended Index Finger
        roundedRect(set, cx - 2, tapY, 5, 14, 2, true);

        // Folded Middle, Ring, Pinky Fingers
        roundedRect(set, cx + 3, tapY + 5, 4, 9, 1.5, true);
        roundedRect(set, cx + 7, tapY + 6, 3.5, 8, 1.5, true);

        // Folded Thumb
        roundedRect(set, cx - 6, tapY + 7, 5, 7, 2, true);

        // Palm & Wrist
        roundedRect(set, cx - 4, tapY + 11, 14, 8, 2, true);
        rect(set, cx - 2, tapY + 17, 10, 6, true);

        // Touch Shockwave Ripples when finger taps down
        if (tap >= 3.5) {
          const ripR = (tap - 3.5) * 4 + 3;
          ellipse(set, cx, cy + 9, ripR * 1.5, ripR * 0.6, false, 1.2);
          ellipse(set, cx, cy + 9, (ripR + 3) * 1.5, (ripR + 3) * 0.6, false, 0.8);
          // Tap sparkle stars
          disc(set, cx - ripR * 1.4, cy + 6, 1);
          disc(set, cx + ripR * 1.4, cy + 6, 1);
        }
      }, i, w, h),
  },
  {
    id: 'swipe_hand',
    name: 'Geser Tangan (Swipe)',
    category: 'gestures',
    frames: 28,
    fps: 14,
    description: 'Telapak tangan menggeser horizontal dengan garis akselerasi kecepatan.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const shiftX = tri(i, 28, 24) - 12;
        const cx = w / 2 + shiftX;
        const cy = h / 2;

        // 4 Extended Fingers (Index, Middle, Ring, Pinky)
        roundedRect(set, cx - 6, cy - 11, 3.5, 12, 1.5, true);
        roundedRect(set, cx - 2, cy - 13, 3.5, 14, 1.5, true);
        roundedRect(set, cx + 2, cy - 12, 3.5, 13, 1.5, true);
        roundedRect(set, cx + 6, cy - 9, 3, 10, 1.5, true);

        // Thumb spread out
        line(set, cx - 8, cy - 1, cx - 13, cy - 4, 3);

        // Palm & Wrist
        roundedRect(set, cx - 7, cy - 1, 16, 11, 3, true);
        rect(set, cx - 5, cy + 9, 12, 6, true);

        // Speed Motion Streaks trailing behind
        const dir = Math.sin((i / 28) * Math.PI * 2) > 0 ? -1 : 1;
        for (let l = 1; l <= 3; l++) {
          const sy = cy - 8 + l * 6;
          const sx = cx + dir * (12 + l * 3);
          line(set, sx, sy, sx + dir * (8 + l * 4), sy, 1.5);
        }
      }, i, w, h),
  },
  {
    id: 'peace_sign',
    name: 'Jari Damai (Peace/V)',
    category: 'gestures',
    frames: 24,
    fps: 12,
    description: 'Pose dua jari V kemenangan dengan bintang kilau gembira.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + Math.sin((i / 24) * Math.PI * 2) * 1.5;

        // Index Finger (Slanted Left)
        line(set, cx - 2, cy - 1, cx - 6, cy - 13, 3.5);
        disc(set, cx - 6, cy - 13, 1.8);

        // Middle Finger (Slanted Right)
        line(set, cx + 2, cy - 1, cx + 6, cy - 14, 3.5);
        disc(set, cx + 6, cy - 14, 1.8);

        // Folded Ring & Pinky Fingers
        roundedRect(set, cx - 6, cy - 1, 14, 10, 3, true);

        // Folded Thumb across knuckles
        line(set, cx - 5, cy + 2, cx + 3, cy + 2, 3);

        // Wrist Sleeve
        rect(set, cx - 4, cy + 9, 10, 5, true);

        // Celebration Sparkles
        if (i % 6 < 4) {
          disc(set, cx - 11, cy - 11, 1.2);
          disc(set, cx + 11, cy - 12, 1.2);
          line(set, cx, cy - 16, cx, cy - 19, 1);
        }
      }, i, w, h),
  },
  {
    id: 'handshake',
    name: 'Jabat Tangan',
    category: 'gestures',
    frames: 24,
    fps: 12,
    description: 'Dua tangan bersalaman hangat dengan ayunan jabat tangan dinamis.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + Math.sin((i / 24) * Math.PI * 4) * 2;

        // Left Arm & Shirt Cuff
        rect(set, cx - 24, cy - 2, 10, 8, true);
        line(set, cx - 14, cy + 2, cx - 4, cy + 2, 4);

        // Right Arm & Shirt Cuff
        rect(set, cx + 14, cy - 2, 10, 8, true);
        line(set, cx + 14, cy + 2, cx + 4, cy + 2, 4);

        // Interlocking Hands & Thumbs Clasp
        roundedRect(set, cx - 6, cy - 4, 12, 10, 3, true);
        // Thumb Clasping Over Top
        line(set, cx - 4, cy - 5, cx + 3, cy - 3, 2.5);
        line(set, cx + 4, cy - 5, cx - 3, cy - 3, 2.5);

        // Knuckle Creases
        line(set, cx - 3, cy + 4, cx + 3, cy + 4, 1.5);
        line(set, cx - 2, cy + 6, cx + 2, cy + 6, 1);
      }, i, w, h),
  },
  {
    id: 'fist_bump',
    name: 'Tinju Semangat (Fist)',
    category: 'gestures',
    frames: 20,
    fps: 10,
    description: 'Kepalan tangan saling bertumbukan memicu ledakan bintang impak.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const progress = (i % 20) / 20;
        const bumpDist = Math.abs(Math.sin(progress * Math.PI)) * 8;
        const cy = h / 2;

        // Left Fist
        const lx = w / 2 - 4 - (8 - bumpDist);
        roundedRect(set, lx - 10, cy - 6, 12, 12, 3, true);
        // Knuckles & Thumb
        line(set, lx - 9, cy - 2, lx + 1, cy - 2, 1.5);
        line(set, lx - 9, cy + 2, lx + 1, cy + 2, 1.5);
        disc(set, lx - 2, cy - 5, 2.5); // Thumb folded over

        // Right Fist
        const rx = w / 2 + 4 + (8 - bumpDist);
        roundedRect(set, rx - 2, cy - 6, 12, 12, 3, true);
        line(set, rx - 1, cy - 2, rx + 9, cy - 2, 1.5);
        line(set, rx - 1, cy + 2, rx + 9, cy + 2, 1.5);
        disc(set, rx + 2, cy - 5, 2.5);

        // Impact Shockwave Spark Burst on collision
        if (bumpDist > 6.5) {
          const cx = w / 2;
          disc(set, cx, cy, 3);
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            line(set, cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 1.5);
          }
        }
      }, i, w, h),
  },
  {
    id: 'ok_sign',
    name: 'Tanda OK Mantap',
    category: 'gestures',
    frames: 24,
    fps: 12,
    description: 'Gesture tanda OK dengan lingkaran jari sempurna dan 3 jari tegak.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2 - 2;
        const cy = h / 2 + Math.sin((i / 24) * Math.PI * 2) * 1.5;

        // Perfect "O" loop formed by Thumb & Index finger
        ring(set, cx - 4, cy + 1, 5.5, 2);

        // 3 Extended Upright Fingers (Middle, Ring, Pinky)
        line(set, cx + 2, cy - 1, cx + 4, cy - 12, 2.5);
        disc(set, cx + 4, cy - 12, 1.2);

        line(set, cx + 5, cy - 1, cx + 8, cy - 11, 2.5);
        disc(set, cx + 8, cy - 11, 1.2);

        line(set, cx + 8, cy - 1, cx + 12, cy - 9, 2.2);
        disc(set, cx + 12, cy - 9, 1.1);

        // Palm & Wrist
        roundedRect(set, cx - 6, cy + 3, 14, 9, 2.5, true);
        rect(set, cx - 4, cy + 11, 10, 5, true);
      }, i, w, h),
  },
  {
    id: 'wash_hands',
    name: 'Cuci Tangan Bersih',
    category: 'gestures',
    frames: 24,
    fps: 12,
    description: 'Dua tangan mencuci di bawah kran air dengan busa gelembung sabun berputar.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 3;
        const rub = Math.sin((i / 24) * Math.PI * 4) * 3;

        // Water Faucet Tap at Top
        rect(set, cx - 14, 2, 10, 3, true);
        rect(set, cx - 6, 2, 4, 6, true);

        // Water Stream Drops Falling
        const dropY = (i * 1.5) % 10;
        line(set, cx - 4, 8 + dropY, cx - 4, 11 + dropY, 1.5);
        disc(set, cx - 4, 13 + ((dropY + 5) % 10), 1.2);

        // Left and Right Washing Palms Rubbing
        ellipse(set, cx - 5 + rub, cy, 7, 5, true);
        ellipse(set, cx + 5 - rub, cy, 7, 5, true);

        // Soap Lather Bubbles Popping
        for (let b = 0; b < 5; b++) {
          const ba = (b / 5) * Math.PI * 2 + (i / 24) * Math.PI * 2;
          const bx = cx + Math.cos(ba) * 9;
          const by = cy + Math.sin(ba) * 6;
          ring(set, bx, by, 1.8, 1);
        }
      }, i, w, h),
  },
  {
    id: 'wave_hand',
    name: 'Lambaian Tangan',
    category: 'gestures',
    frames: 24,
    fps: 12,
    description: 'Telapak tangan terbuka melambai anggun ke kiri dan kanan menyapa ramah.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 5;
        const tilt = Math.sin((i / 24) * Math.PI * 2) * 0.4;
        const cos = Math.cos(tilt);
        const sin = Math.sin(tilt);

        // Transform helper for wrist pivot
        const rot = (ox: number, oy: number): [number, number] => [
          cx + ox * cos - oy * sin,
          cy + ox * sin + oy * cos,
        ];

        // Palm Base
        const [px, py] = rot(0, -6);
        ellipse(set, px, py, 7, 6, true);

        // 5 Fingers (Thumb + 4 Fingers)
        const fingers = [
          { ox: -8, oy: -6, len: 6, w: 2.5 }, // Thumb
          { ox: -5, oy: -13, len: 9, w: 2.2 }, // Index
          { ox: -1.5, oy: -15, len: 11, w: 2.2 }, // Middle
          { ox: 2, oy: -14, len: 10, w: 2.2 }, // Ring
          { ox: 5.5, oy: -11, len: 7, w: 2.0 }, // Pinky
        ];

        for (const f of fingers) {
          const [f0x, f0y] = rot(f.ox, -6);
          const [f1x, f1y] = rot(f.ox, f.oy);
          line(set, f0x, f0y, f1x, f1y, f.w);
          disc(set, f1x, f1y, f.w * 0.5);
        }

        // Wrist Sleeve at bottom
        rect(set, cx - 5, cy - 1, 10, 6, true);

        // Friendly Motion Waves
        const rip = (i % 8) / 8;
        arc(set, cx + (tilt > 0 ? 12 : -12), cy - 8, 5 + rip * 4, -Math.PI * 0.4, Math.PI * 0.4, 1);
      }, i, w, h),
  },
];

// ── Category: UI & SISTEM ──
const UI_ANIMS: OledAnim[] = [
  {
    id: 'folder',
    name: 'Folder Terbuka',
    category: 'ui',
    frames: 36,
    fps: 12,
    description: 'Folder berkas 3D membuka tab dengan lembar dokumen keluar masuk.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const open = tri(i, 36, 1);

        // Back Folder Shell & Tab
        rect(set, cx - 16, cy - 8, 12, 5, true); // Folder Tab
        roundedRect(set, cx - 18, cy - 6, 36, 20, 2, false, 1.5);

        // Rising Paper Document with Content Lines
        const paperY = cy - 5 - open * 7;
        rect(set, cx - 12, paperY, 24, 15, true);
        // Folded Corner on Document
        rect(set, cx + 8, paperY, 4, 4, false);
        // Document text lines
        line(set, cx - 9, paperY + 3, cx + 6, paperY + 3, 1);
        line(set, cx - 9, paperY + 6, cx + 9, paperY + 6, 1);
        line(set, cx - 9, paperY + 9, cx + 4, paperY + 9, 1);

        // Front Flap in 3D Perspective Opening Forward
        polygonFill(set, [
          [cx - 18, cy + 14],
          [cx - 21 + open * 4, cy + 2 + open * 6],
          [cx + 21 - open * 4, cy + 2 + open * 6],
          [cx + 18, cy + 14],
        ]);
        line(set, cx - 21 + open * 4, cy + 2 + open * 6, cx + 21 - open * 4, cy + 2 + open * 6, 1.5);
      }, i, w, h),
  },
  {
    id: 'bell',
    name: 'Lonceng Berdering',
    category: 'ui',
    frames: 30,
    fps: 15,
    description: 'Lonceng notifikasi berayun dengan pemukul dan gelombang akustik.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 2;
        const angle = Math.sin((i / 30) * Math.PI * 4) * 0.35;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        // Top Mounting Ring Loop
        ring(set, cx, cy - 11, 3, 1.2);

        // Bell Body Profile with Flared Lip
        for (let r = 0; r <= 12; r++) {
          const bw = 3 + (r / 12) * (r / 12) * 11;
          for (let dx = -bw; dx <= bw; dx++) {
            const dy = -8 + r;
            const rx = cx + dx * cos - dy * sin;
            const ry = cy + dx * sin + dy * cos;
            if (r >= 10 || Math.abs(dx) >= bw - 1.2) set(rx, ry);
          }
        }

        // Swinging Clapper inside
        const clapperX = cx - sin * 13;
        const clapperY = cy + cos * 13;
        disc(set, clapperX, clapperY, 2.5);

        // Radiating Sound Acoustic Waves
        const rip = (i % 10) / 10;
        arc(set, cx - 16, cy - 2, 4 + rip * 5, Math.PI * 0.65, Math.PI * 1.35, 1.2);
        arc(set, cx + 16, cy - 2, 4 + rip * 5, -Math.PI * 0.35, Math.PI * 0.35, 1.2);
      }, i, w, h),
  },
  {
    id: 'battery',
    name: 'Baterai Mengisi',
    category: 'ui',
    frames: 32,
    fps: 10,
    description: 'Baterai bertenaga tinggi dengan 4 segmen pengisian dan kilat petir.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;

        // Battery Outer Case & Positive Terminal Cap
        roundedRect(set, cx - 22, cy - 9, 40, 18, 2.5, false, 1.8);
        rect(set, cx + 18, cy - 4, 4, 8, true);

        // 4 Charging Segment Bars
        const fillLevel = Math.floor(((i % 32) / 32) * 4.99);
        for (let b = 0; b < fillLevel; b++) {
          rect(set, cx - 19 + b * 9, cy - 6, 7, 12, true);
        }

        // Glowing Lightning Bolt Overlay
        if (i % 6 < 4) {
          polygonFill(set, [
            [cx - 3, cy - 8],
            [cx - 10, cy],
            [cx - 5, cy],
            [cx - 7, cy + 8],
            [cx + 1, cy - 1],
            [cx - 3, cy - 1],
          ]);
        }
      }, i, w, h),
  },
  {
    id: 'wifi',
    name: 'Sinyal WiFi',
    category: 'ui',
    frames: 24,
    fps: 8,
    description: 'Pemancar WiFi dengan busur sinyal menyala bertingkat dinamis.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 8;

        // Base Transmitter Dot
        disc(set, cx, cy, 2.5);

        // 3 Expanding Signal Arc Waves
        const step = i % 24;
        for (let arcIdx = 1; arcIdx <= 3; arcIdx++) {
          const r = arcIdx * 6.5;
          const active = step >= (arcIdx - 1) * 6;
          if (active) {
            arc(set, cx, cy, r, -Math.PI * 0.75, -Math.PI * 0.25, 2);
          }
        }
      }, i, w, h),
  },
  {
    id: 'gear',
    name: 'Roda Gigi Berputar',
    category: 'ui',
    frames: 36,
    fps: 12,
    description: 'Roda gigi industri 8 gigi dengan poros kunci dan 4 spoke berputar presisi.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 3;
        const angle = (i / 36) * Math.PI * 2;

        // Outer Gear Rim & Involute Teeth
        ring(set, cx, cy, r - 3, 2);
        for (let t = 0; t < 8; t++) {
          const a = angle + (t / 8) * Math.PI * 2;
          const tx = cx + Math.cos(a) * (r - 1.5);
          const ty = cy + Math.sin(a) * (r - 1.5);
          disc(set, tx, ty, 2.2);
        }

        // 4 Spokes
        for (let s = 0; s < 4; s++) {
          const sa = angle + (s / 4) * Math.PI * 2;
          line(set, cx, cy, cx + Math.cos(sa) * (r - 3), cy + Math.sin(sa) * (r - 3), 1.5);
        }

        // Center Axle Hub & Keyway
        disc(set, cx, cy, 3.5);
        rect(set, cx - 1, cy - 1, 2, 2, false);
      }, i, w, h),
  },
  {
    id: 'search',
    name: 'Kaca Pembesar',
    category: 'ui',
    frames: 30,
    fps: 12,
    description: 'Kaca pembesar optik memindai dengan teks membesar di bawah lensa.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const offX = Math.sin((i / 30) * Math.PI * 2) * 8;
        const offY = Math.cos((i / 30) * Math.PI * 2) * 3;
        const cx = w / 2 + offX - 3;
        const cy = h / 2 + offY - 2;

        // Background Document Text Lines
        for (let l = -2; l <= 2; l++) {
          const ly = h / 2 + l * 5;
          line(set, w / 2 - 22, ly, w / 2 + 18, ly, 1);
        }

        // Lens Optical Ring with Bezel
        ring(set, cx, cy, 9, 2);
        // Specular Glint on Lens
        arc(set, cx, cy, 7, -Math.PI * 0.8, -Math.PI * 0.3, 1);

        // Magnified Text under the lens
        line(set, cx - 5, cy, cx + 5, cy, 2);
        line(set, cx - 4, cy + 3, cx + 4, cy + 3, 2);

        // Angled Ergonomic Handle
        line(set, cx + 6.5, cy + 6.5, cx + 16, cy + 16, 3.5);
        disc(set, cx + 16, cy + 16, 2);
      }, i, w, h),
  },
  {
    id: 'lock',
    name: 'Gembok Membuka',
    category: 'ui',
    frames: 32,
    fps: 10,
    description: 'Gembok kuningan dengan shackle berputar membuka dan terkunci kembali.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const open = tri(i, 32, 1);

        // Solid Lock Body with Beveled Corners
        roundedRect(set, cx - 13, cy - 2, 26, 17, 3, true);

        // Keyhole & Mechanism
        disc(set, cx, cy + 4, 2.5);
        polygonFill(set, [
          [cx - 1.5, cy + 4],
          [cx + 1.5, cy + 4],
          [cx + 2.5, cy + 9],
          [cx - 2.5, cy + 9],
        ]);

        // Hardened Steel U-Shackle
        const shackleY = cy - 2 - open * 6;
        arc(set, cx, shackleY, 7.5, Math.PI, Math.PI * 2, 2.5);
        line(set, cx - 7.5, shackleY, cx - 7.5, cy - 2, 2.5);
        line(set, cx + 7.5, shackleY, cx + 7.5, cy - (open > 0.3 ? 7 : 2), 2.5);
      }, i, w, h),
  },
  {
    id: 'load',
    name: 'Loading Spin',
    category: 'ui',
    frames: 24,
    fps: 12,
    description: 'Indikator aktivitas berputar 12 segmen dengan gradasi putaran dinamis.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 3;
        const numBars = 12;

        for (let b = 0; b < numBars; b++) {
          const a = (b / numBars) * Math.PI * 2;
          const lead = (i % 24) / 24;
          const dist = (b / numBars - lead + 1) % 1;
          const thick = dist < 0.25 ? 2.5 : dist < 0.5 ? 1.8 : dist < 0.75 ? 1.2 : 0.8;
          const on = dist < 0.8;
          if (on) {
            line(
              set,
              cx + Math.cos(a) * (r - 5),
              cy + Math.sin(a) * (r - 5),
              cx + Math.cos(a) * r,
              cy + Math.sin(a) * r,
              thick,
            );
          }
        }
      }, i, w, h),
  },
];

// ── Category: WEB & JARINGAN ──
const WEB_ANIMS: OledAnim[] = [
  {
    id: 'globe',
    name: 'Bola Dunia Berputar',
    category: 'web',
    frames: 36,
    fps: 12,
    description: 'Bola dunia 3D berputar dengan garis ekuator dan meridian melengkung.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 2;

        // Circular Horizon Ring
        ring(set, cx, cy, r, 1.5);

        // Horizontal Equator & Parallels
        for (let x = -r + 1; x <= r - 1; x++) set(cx + x, cy);
        ellipse(set, cx, cy - r * 0.45, r * 0.85, 2.5, false, 1);
        ellipse(set, cx, cy + r * 0.45, r * 0.85, 2.5, false, 1);

        // Rotating Longitudinal Meridians
        const shift = ((i % 36) / 36) * Math.PI * 2;
        for (let a = 0; a < Math.PI; a += Math.PI / 3) {
          const curA = a + shift;
          const cos = Math.cos(curA);
          ellipse(set, cx, cy, Math.abs(cos) * r, r, false, 1);
        }
      }, i, w, h),
  },
  {
    id: 'cloud_upload',
    name: 'Unggah Cloud',
    category: 'web',
    frames: 28,
    fps: 14,
    description: 'Server cloud dengan panah unggah meluncur naik dan paket data berpendar.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 2;

        // Puffy Cloud Enclosure
        disc(set, cx - 11, cy + 2, 7);
        disc(set, cx + 11, cy + 2, 6.5);
        disc(set, cx - 3, cy - 5, 8.5);
        disc(set, cx + 5, cy - 3, 7.5);
        rect(set, cx - 15, cy + 2, 30, 8, true);

        // Upload Arrow with Chevron Head Pulsing Upward
        const arrowOffset = (i % 14) - 7;
        const ay = cy + arrowOffset + 3;

        line(set, cx, ay + 7, cx, ay - 4, 2.5);
        line(set, cx - 5, ay, cx, ay - 4, 2);
        line(set, cx + 5, ay, cx, ay - 4, 2);

        // Ascending Data Byte Packets
        disc(set, cx - 7, ay + 6, 1);
        disc(set, cx + 7, ay + 6, 1);
      }, i, w, h),
  },
  {
    id: 'browser',
    name: 'Jendela Browser',
    category: 'web',
    frames: 30,
    fps: 10,
    description: 'Tampilan browser web modern dengan tombol navigasi, URL bar, dan progress loading.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;

        // Window Frame
        roundedRect(set, cx - 24, cy - 13, 48, 26, 2, false, 1.5);
        // Header Bar Line
        line(set, cx - 24, cy - 7, cx + 24, cy - 7, 1.2);

        // 3 Traffic Light Buttons (Close, Min, Max)
        disc(set, cx - 20, cy - 10, 1.2);
        disc(set, cx - 16, cy - 10, 1.2);
        disc(set, cx - 12, cy - 10, 1.2);

        // URL Search Bar Pill
        roundedRect(set, cx - 8, cy - 12, 28, 4, 1.5, false, 1);
        disc(set, cx - 6, cy - 10, 0.8); // Lock icon in URL

        // Loading Progress Bar
        const progress = (i % 30) / 30;
        rect(set, cx - 20, cy - 2, Math.round(40 * progress), 3, true);

        // Web Page Content Layout Mockup
        rect(set, cx - 20, cy + 3, 10, 7, false); // Image box
        line(set, cx - 7, cy + 4, cx + 18, cy + 4, 1);
        line(set, cx - 7, cy + 7, cx + 14, cy + 7, 1);
      }, i, w, h),
  },
  {
    id: 'network_nodes',
    name: 'Jaringan Server',
    category: 'web',
    frames: 30,
    fps: 12,
    description: 'Server pusat terhubung ke node terminal dengan transmisi paket data aktif.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;

        // Central Server Hub Node
        disc(set, cx, cy, 5);
        ring(set, cx, cy, 7, 1);

        // 4 Peripheral Client Nodes
        for (let n = 0; n < 4; n++) {
          const a = (n / 4) * Math.PI * 2 + (i / 30) * Math.PI * 0.5;
          const nx = cx + Math.cos(a) * 16;
          const ny = cy + Math.sin(a) * 11;

          // Connection Bus Line
          line(set, cx, cy, nx, ny, 1);

          // Client Terminal Node
          disc(set, nx, ny, 3);
          ring(set, nx, ny, 4.5, 0.8);

          // Animated Traveling Data Packet
          const packetT = ((i * 2 + n * 8) % 30) / 30;
          const px = cx + (nx - cx) * packetT;
          const py = cy + (ny - cy) * packetT;
          disc(set, px, py, 1.5);
        }
      }, i, w, h),
  },
];

// ── Category: SOSIAL & PESAN ──
const SOCIAL_ANIMS: OledAnim[] = [
  {
    id: 'chat',
    name: 'Gelembung Chat',
    category: 'social',
    frames: 24,
    fps: 8,
    description: 'Pesan obrolan dua arah dengan 3 titik indikator mengetik berdenyut.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 1;

        // Background Incoming Chat Bubble (Left, Outlined)
        roundedRect(set, cx - 23, cy - 12, 22, 13, 3, false, 1.2);
        line(set, cx - 19, cy + 1, cx - 23, cy + 5, 1.5);
        line(set, cx - 23, cy + 5, cx - 15, cy + 1, 1.5);
        // Static text preview lines in left bubble
        line(set, cx - 19, cy - 8, cx - 8, cy - 8, 1);
        line(set, cx - 19, cy - 5, cx - 11, cy - 5, 1);

        // Foreground Active Chat Bubble (Right, Outlined)
        roundedRect(set, cx - 5, cy - 3, 26, 14, 3, false, 1.2);
        line(set, cx + 13, cy + 11, cx + 18, cy + 15, 1.5);
        line(set, cx + 18, cy + 15, cx + 10, cy + 11, 1.5);

        // 3 Animated Typing Dots (Jumping within right bubble)
        const activeDot = Math.floor((i % 24) / 6);
        for (let d = 0; d < 3; d++) {
          const dx = cx + 1 + d * 5;
          const jump = (d === activeDot) ? 2.5 : 0;
          disc(set, dx, cy + 4 - jump, 1.3);
        }
      }, i, w, h),
  },
  {
    id: 'heart_beat',
    name: 'Hati Berdenyut',
    category: 'social',
    frames: 30,
    fps: 12,
    description: 'Detak jantung anatomis dua fase (lub-dub) dengan partikel kilau kasih sayang.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 1;

        // Double-beat cardiac rhythm
        const p = (i % 30) / 30;
        let scale = 1.0;
        if (p < 0.15) scale = 1.0 + (p / 0.15) * 0.35; // First beat
        else if (p < 0.3) scale = 1.35 - ((p - 0.15) / 0.15) * 0.25;
        else if (p < 0.45) scale = 1.1 + ((p - 0.3) / 0.15) * 0.28; // Second beat
        else scale = 1.38 - ((p - 0.45) / 0.55) * 0.38;

        const s = 6 * scale;
        // Two upper heart lobes
        disc(set, cx - s * 0.85, cy - s * 0.3, s);
        disc(set, cx + s * 0.85, cy - s * 0.3, s);

        // Lower heart triangle
        polygonFill(set, [
          [cx - s * 1.7, cy - s * 0.2],
          [cx + s * 1.7, cy - s * 0.2],
          [cx, cy + s * 1.8],
        ]);

        // Radiating love sparkles when heart pulses big
        if (scale > 1.2) {
          disc(set, cx - s * 2, cy - s, 1.2);
          disc(set, cx + s * 2, cy - s, 1.2);
          disc(set, cx, cy - s * 1.6, 1.2);
        }
      }, i, w, h),
  },
  {
    id: 'thumbs_up',
    name: 'Jempol Suka',
    category: 'social',
    frames: 24,
    fps: 12,
    description: 'Jempol apresiasi kontur presisi dengan lengan dan ledakan bintang perayaan.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2 - 3;
        const cy = h / 2 + Math.sin((i / 24) * Math.PI * 2) * 1.8;

        // Upright Thumb with knuckle curve
        roundedRect(set, cx - 4, cy - 13, 6, 14, 2.5, true);

        // Clenched Fist Fingers (Index, Middle, Ring, Pinky)
        roundedRect(set, cx - 4, cy - 1, 14, 13, 3, true);
        line(set, cx - 3, cy + 3, cx + 8, cy + 3, 1.5);
        line(set, cx - 3, cy + 7, cx + 8, cy + 7, 1.5);

        // Wrist Sleeve
        rect(set, cx - 12, cy + 2, 8, 10, true);

        // Celebratory Starbursts
        if (i % 8 < 5) {
          disc(set, cx + 14, cy - 10, 1.8);
          disc(set, cx + 18, cy - 4, 1.2);
          disc(set, cx + 14, cy + 2, 1.5);
        }
      }, i, w, h),
  },
  {
    id: 'mail_envelope',
    name: 'Surat Masuk',
    category: 'social',
    frames: 28,
    fps: 12,
    description: 'Amplop pos membuka tutupnya dengan lembaran surat bersegel meluncur keluar.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 2;
        const open = tri(i, 28, 1);

        // Envelope Base Rectangle
        roundedRect(set, cx - 18, cy - 7, 36, 18, 2, false, 1.5);

        // Letter Document sliding out upwards
        const letterY = cy - 5 - open * 8;
        rect(set, cx - 14, letterY, 28, 14, true);
        // Letter text lines
        line(set, cx - 11, letterY + 3, cx + 7, letterY + 3, 1);
        line(set, cx - 11, letterY + 6, cx + 11, letterY + 6, 1);
        line(set, cx - 11, letterY + 9, cx + 4, letterY + 9, 1);
        // Stamp wax seal
        disc(set, cx + 8, letterY + 9, 1.5);

        // Envelope V-Flap folding
        line(set, cx - 18, cy - 7, cx, cy + 3, 1.5);
        line(set, cx + 18, cy - 7, cx, cy + 3, 1.5);
      }, i, w, h),
  },
];

// ── Category: MEDIA & SUARA ──
const MEDIA_ANIMS: OledAnim[] = [
  {
    id: 'soundwave',
    name: 'Equalizer Musik',
    category: 'media',
    frames: 24,
    fps: 12,
    description: 'Equalizer spektrum audio 9 band dengan floating peak hold bar responsif.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 11;
        const bars = 9;
        const barW = 3;
        const gap = 2;
        const totalW = bars * (barW + gap) - gap;
        const startX = cx - totalW / 2;

        for (let b = 0; b < bars; b++) {
          const phase = i * 0.45 + b * 0.85;
          const bh = 4 + Math.round((Math.sin(phase) * 0.5 + 0.5) * 19);
          const bx = startX + b * (barW + gap);

          // Equalizer Solid Bar
          rect(set, bx, cy - bh, barW, bh, true);

          // Floating Peak Cap Indicator
          const peakY = cy - bh - 2 - (i % 3);
          rect(set, bx, peakY, barW, 1, true);
        }
      }, i, w, h),
  },
  {
    id: 'music',
    name: 'Not Balok Nada',
    category: 'media',
    frames: 32,
    fps: 12,
    description: 'Not balok melodi ganda (♫) melayang anggun dengan kilatan bintang nada.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const shiftY = (i % 32) * 0.5;

        // Beamed Eighth Notes (♫)
        const n1X = cx - 10;
        const n1Y = h / 2 + 7 - shiftY;

        // Two note heads (angled ellipses)
        ellipse(set, n1X, n1Y, 3.5, 2.5, true);
        ellipse(set, n1X + 14, n1Y - 4, 3.5, 2.5, true);

        // Note stems
        line(set, n1X + 2.5, n1Y, n1X + 2.5, n1Y - 15, 2);
        line(set, n1X + 16.5, n1Y - 4, n1X + 16.5, n1Y - 19, 2);

        // Connecting Beam
        line(set, n1X + 2.5, n1Y - 15, n1X + 16.5, n1Y - 19, 3);

        // Floating single note with flag
        const n2X = cx + 15;
        const n2Y = h / 2 - 3 + Math.sin(i * 0.3) * 3;
        ellipse(set, n2X, n2Y, 3, 2, true);
        line(set, n2X + 2, n2Y, n2X + 2, n2Y - 11, 1.5);
        arc(set, n2X + 5, n2Y - 9, 3.5, -Math.PI * 0.5, 0, 1.8);

        // Melodic Sparkles
        disc(set, cx - 16, n1Y - 10, 1);
        disc(set, cx + 6, n1Y - 18, 1.2);
      }, i, w, h),
  },
  {
    id: 'speaker',
    name: 'Speaker Suara',
    category: 'media',
    frames: 24,
    fps: 12,
    description: 'Speaker audio kabinet dengan getaran kerucut dan gelombang suara memancar.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2 - 5;
        const cy = h / 2;

        // Speaker Magnet / Back Body
        rect(set, cx - 13, cy - 6, 6, 12, true);

        // Speaker Cone Flaring Outward
        polygonFill(set, [
          [cx - 7, cy - 6],
          [cx + 2, cy - 12],
          [cx + 2, cy + 12],
          [cx - 7, cy + 6],
        ]);

        // Speaker Front Membrane Trim
        line(set, cx + 2, cy - 12, cx + 2, cy + 12, 2.5);

        // Center Vibrating Dust Cap
        const pulse = i % 8;
        disc(set, cx - 2, cy, 2.5);

        // Sonic Acoustic Pressure Waves Expanding
        for (let waveIdx = 1; waveIdx <= 3; waveIdx++) {
          const wr = 4 + waveIdx * 4 + pulse * 1.2;
          arc(set, cx + 4, cy, wr, -Math.PI * 0.35, Math.PI * 0.35, 1.8);
        }
      }, i, w, h),
  },
];

// ── Category: CUACA & ALAM ──
const WEATHER_ANIMS: OledAnim[] = [
  {
    id: 'sun',
    name: 'Matahari Bersinar',
    category: 'weather',
    frames: 36,
    fps: 12,
    description: 'Matahari cerah berputar dengan 12 sinar pancaran bergantian panjang-pendek.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const rot = (i / 36) * Math.PI * 2;

        // Radiant Sun Core & Inner Halo
        disc(set, cx, cy, 7);
        ring(set, cx, cy, 8.5, 0.8);

        // 12 Alternating Sun Ray Flares
        for (let r = 0; r < 12; r++) {
          const a = rot + (r / 12) * Math.PI * 2;
          const isLong = r % 2 === 0;
          const r0 = 10;
          const r1 = isLong ? 15 : 12.5;
          line(set, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, isLong ? 2 : 1.2);
        }
      }, i, w, h),
  },
  {
    id: 'rain',
    name: 'Awan Hujan',
    category: 'weather',
    frames: 24,
    fps: 12,
    description: 'Awan mendung lebat dengan tetesan rintik hujan miring membasahi bumi.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 4;

        // Volumetric Cumulonimbus Cloud
        disc(set, cx - 11, cy + 1, 7.5);
        disc(set, cx + 10, cy + 1, 6.5);
        disc(set, cx - 2, cy - 6, 8.5);
        disc(set, cx + 6, cy - 3, 7.5);
        rect(set, cx - 15, cy + 1, 30, 8, true);

        // Slanted Falling Rain Streaks
        const dropStep = i % 8;
        for (let col = -3; col <= 3; col++) {
          const rx = cx + col * 6 - 2;
          const ry = cy + 9 + ((dropStep * 2 + col * 3 + 24) % 14);
          line(set, rx, ry, rx - 2, ry + 4, 1.8);
        }

        // Ground Splash Ripples
        for (let sp = -2; sp <= 2; sp += 2) {
          ellipse(set, cx + sp * 8, h - 2, 2.5, 1, false);
        }
      }, i, w, h),
  },
  {
    id: 'flame',
    name: 'Kobaran Api',
    category: 'weather',
    frames: 24,
    fps: 12,
    description: 'Lidah api menyala berkobar meliuk-liuk dengan partikel percikan bara api.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 9;
        const sway = Math.sin((i / 24) * Math.PI * 4) * 3;

        // Outer Flame Body
        disc(set, cx, cy - 3, 9);
        for (let y = 0; y < 20; y++) {
          const fw = Math.max(1, 9 - (y / 20) * 9);
          const fx = cx + (sway * y) / 20;
          line(set, fx - fw, cy - y, fx + fw, cy - y, 1);
        }

        // Inner Bright Core
        disc(set, cx + sway * 0.3, cy - 4, 4);
        for (let y = 0; y < 11; y++) {
          const ifw = Math.max(1, 4 - (y / 11) * 4);
          const ifx = cx + (sway * y * 0.7) / 11;
          line(set, ifx - ifw, cy - y, ifx + ifw, cy - y, 1);
        }

        // Rising Fire Spark Embers
        for (let e = 0; e < 4; e++) {
          const ey = (cy - 12 - (i * 1.5 + e * 5) % 16);
          const ex = cx + Math.sin(ey * 0.4 + e) * 6;
          disc(set, ex, ey, 1);
        }
      }, i, w, h),
  },
  {
    id: 'snow_flake',
    name: 'Kepingan Salju',
    category: 'weather',
    frames: 36,
    fps: 12,
    description: 'Kepingan kristal salju simetris heksagonal berputar anggun.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const rot = (i / 36) * Math.PI * 2;
        const r = Math.min(w, h) / 2 - 2;

        // Central Hexagonal Core
        disc(set, cx, cy, 2.5);
        ring(set, cx, cy, 4, 1);

        // 6 Symmetric Main Dendrite Arms
        for (let a = 0; a < 6; a++) {
          const angle = rot + (a / 6) * Math.PI * 2;
          const x1 = cx + Math.cos(angle) * r;
          const y1 = cy + Math.sin(angle) * r;
          line(set, cx, cy, x1, y1, 1.8);

          // Secondary & Tertiary Needles
          for (const frac of [0.45, 0.75]) {
            const mx = cx + Math.cos(angle) * (r * frac);
            const my = cy + Math.sin(angle) * (r * frac);
            const b1 = angle + Math.PI / 4;
            const b2 = angle - Math.PI / 4;
            const bLen = r * 0.25;
            line(set, mx, my, mx + Math.cos(b1) * bLen, my + Math.sin(b1) * bLen, 1.2);
            line(set, mx, my, mx + Math.cos(b2) * bLen, my + Math.sin(b2) * bLen, 1.2);
          }
        }
      }, i, w, h),
  },
  {
    id: 'moon_stars',
    name: 'Bulan & Bintang',
    category: 'weather',
    frames: 30,
    fps: 10,
    description: 'Bulan sabit malam hari ditemani 3 bintang berkelip berkilau.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2 - 4;
        const cy = h / 2;

        // Crescent Moon Contour
        disc(set, cx, cy, 11);
        // Exact Crescent Ring & Arc
        ring(set, cx, cy, 11, 2.5);
        arc(set, cx + 5, cy - 2, 9.5, Math.PI * 0.5, Math.PI * 1.5, 2);

        // 3 Twinkling 4-Point Stars
        const stars = [
          { x: cx + 18, y: cy - 7, phase: 0 },
          { x: cx + 12, y: cy + 7, phase: 10 },
          { x: cx + 22, y: cy + 2, phase: 20 },
        ];

        for (const st of stars) {
          const twinkle = (i + st.phase) % 30 < 15;
          disc(set, st.x, st.y, twinkle ? 2 : 1);
          if (twinkle) {
            line(set, st.x - 3, st.y, st.x + 3, st.y, 1);
            line(set, st.x, st.y - 3, st.x, st.y + 3, 1);
          }
        }
      }, i, w, h),
  },
  {
    id: 'wind_breeze',
    name: 'Angin Semilir',
    category: 'weather',
    frames: 24,
    fps: 12,
    description: 'Garis angin bertiup kencang meliuk dengan pusaran eddy dan partikel daun.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const shift = (i % 24) * 2.5;

        // 3 Aerodynamic Wind Streams with Spirals
        for (let lineIdx = 0; lineIdx < 3; lineIdx++) {
          const baseCy = h / 2 - 7 + lineIdx * 7;
          for (let x = 0; x < w; x++) {
            const wave = Math.sin((x + shift + lineIdx * 12) * 0.18) * 2.5;
            if ((x + shift) % 24 < 17) {
              set(x, Math.round(baseCy + wave));
              set(x, Math.round(baseCy + wave + 0.6));
            }
          }

          // Wind Swirl Spiral Loop
          const swirlX = ((shift * 1.5 + lineIdx * 20) % (w + 10)) - 5;
          arc(set, swirlX, baseCy - 2, 3.5, 0, Math.PI * 1.6, 1.2);
        }

        // Floating Wind Dust / Leaf Particles
        for (let lf = 0; lf < 4; lf++) {
          const lx = ((i * 3 + lf * 16) % w);
          const ly = h / 2 - 5 + Math.sin(lx * 0.2) * 6;
          disc(set, lx, ly, 1);
        }
      }, i, w, h),
  },
];

// ── Category: TOKO & BELANJA (Ecommerce) ──
const ECOMMERCE_ANIMS: OledAnim[] = [
  {
    id: 'gift',
    name: 'Kotak Kado Hadiah',
    category: 'ecommerce',
    frames: 32,
    fps: 12,
    description: 'Kotak kado membuka tutupnya dengan taburan pita dan bintang kejutan.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 2;
        const open = tri(i, 32, 1);

        // Gift Box Body
        roundedRect(set, cx - 13, cy - 2, 26, 15, 2, false, 1.5);
        // Vertical Ribbon Band
        line(set, cx, cy - 2, cx, cy + 13, 3);

        // Gift Lid Popping Open Upward
        const lidY = cy - 4 - open * 7;
        roundedRect(set, cx - 15, lidY - 3, 30, 5, 1.5, true);

        // 3D Fluffy Ribbon Bow
        ring(set, cx - 5, lidY - 7, 3.5, 1.5);
        ring(set, cx + 5, lidY - 7, 3.5, 1.5);
        disc(set, cx, lidY - 5, 2);

        // Floating Surprise Confetti Stars
        if (open > 0.3) {
          disc(set, cx - 10, lidY - 7, 1.5);
          disc(set, cx + 10, lidY - 7, 1.5);
          disc(set, cx, lidY - 12, 1.8);
        }
      }, i, w, h),
  },
  {
    id: 'shopping_cart',
    name: 'Keranjang Belanja',
    category: 'ecommerce',
    frames: 24,
    fps: 12,
    description: 'Keranjang belanja supermarket terisi barang meluncur maju lincah.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2 + Math.sin((i / 24) * Math.PI * 2) * 2.5;
        const cy = h / 2;

        // Cart Basket Outer Wireframe
        line(set, cx - 15, cy - 8, cx - 11, cy + 5, 2);
        line(set, cx - 11, cy + 5, cx + 13, cy + 5, 2);
        line(set, cx + 13, cy + 5, cx + 17, cy - 8, 2);
        line(set, cx - 15, cy - 8, cx + 17, cy - 8, 2);

        // Basket Mesh Grid Lines
        line(set, cx - 13, cy - 1.5, cx + 15, cy - 1.5, 1);
        line(set, cx - 5, cy - 8, cx - 4, cy + 5, 1);
        line(set, cx + 3, cy - 8, cx + 4, cy + 5, 1);

        // Cart Push Handle
        line(set, cx - 15, cy - 8, cx - 19, cy - 11, 2.5);
        disc(set, cx - 19, cy - 11, 1.5);

        // Lower Chassis & 2 Caster Wheels
        line(set, cx - 8, cy + 5, cx - 8, cy + 8, 2);
        line(set, cx + 10, cy + 5, cx + 10, cy + 8, 2);
        disc(set, cx - 8, cy + 9, 2.5);
        disc(set, cx + 10, cy + 9, 2.5);

        // Bouncing Items inside Cart
        const pop = tri(i, 24, 3);
        rect(set, cx - 2, cy - 8 - pop, 9, 7, true);
        disc(set, cx + 10, cy - 6 - pop, 3);
      }, i, w, h),
  },
  {
    id: 'credit_card',
    name: 'Kartu Pembayaran',
    category: 'ecommerce',
    frames: 30,
    fps: 10,
    description: 'Kartu debit chip pintar melayang dengan garis magnetik dan sinyal contactless.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + Math.sin((i / 30) * Math.PI * 2) * 1.8;

        // Card Body with Rounded Edges
        roundedRect(set, cx - 20, cy - 11, 40, 22, 3, false, 1.8);

        // Magnetic Stripe
        line(set, cx - 20, cy - 5, cx + 20, cy - 5, 2.5);

        // EMV Smart Chip Contact Matrix
        roundedRect(set, cx - 15, cy + 1, 8, 6, 1, true);
        line(set, cx - 11, cy + 1, cx - 11, cy + 7, 1);
        line(set, cx - 15, cy + 4, cx - 7, cy + 4, 1);

        // Contactless NFC Wave Symbol
        arc(set, cx - 3, cy + 4, 3, -Math.PI * 0.35, Math.PI * 0.35, 1);
        arc(set, cx - 3, cy + 4, 5, -Math.PI * 0.35, Math.PI * 0.35, 1);

        // Holographic Security Crest / Brand Logo
        disc(set, cx + 11, cy + 4, 2.8);
        disc(set, cx + 14, cy + 4, 2.8);
      }, i, w, h),
  },
  {
    id: 'coin_spin',
    name: 'Koin Berputar',
    category: 'ecommerce',
    frames: 24,
    fps: 12,
    description: 'Koin emas 3D berputar mulus dengan lambang bintang dan kilau cahaya tepi.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const scale = Math.cos((i / 24) * Math.PI * 2);
        const r = 12;
        const rx = Math.max(1.5, Math.abs(scale) * r);

        // 3D Coin Outer Rim & Milled Edges
        ellipse(set, cx, cy, rx, r, false, 1.8);

        // Coin Inner Embossed Star / Dollar
        if (rx > 5) {
          ellipse(set, cx, cy, rx - 3, r - 3, false, 1);
          line(set, cx, cy - 6, cx, cy + 6, 2);
          line(set, cx - 3 * (rx / r), cy - 3, cx + 3 * (rx / r), cy - 3, 1.5);
          line(set, cx - 3 * (rx / r), cy + 3, cx + 3 * (rx / r), cy + 3, 1.5);
        }

        // Gleam Sparkle sweep
        if (Math.abs(scale) > 0.8) {
          disc(set, cx + rx * 0.7, cy - r * 0.6, 1.5);
        }
      }, i, w, h),
  },
];

// ── Category: WAJAH & EMOSI (Emoji) ──
const EMOJI_ANIMS: OledAnim[] = [
  {
    id: 'smile_wink',
    name: 'Kedip Senyum',
    category: 'emoji',
    frames: 36,
    fps: 12,
    description: 'Wajah emoji bundar tersenyum ramah memberikan kedipan mata lucu.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 2;

        // Head Contour
        ring(set, cx, cy, r, 1.8);

        // Left Eye (Open with Sparkling Pupil)
        disc(set, cx - 6, cy - 4, 3);
        set(cx - 7, cy - 5); // Specular gleam

        // Right Eye (Winking animation)
        const winking = (i % 36) >= 16 && (i % 36) <= 28;
        if (winking) {
          arc(set, cx + 6, cy - 2, 4, Math.PI * 1.1, Math.PI * 1.9, 2);
        } else {
          disc(set, cx + 6, cy - 4, 3);
          set(cx + 5, cy - 5);
        }

        // Happy Smile with Rosy Cheek Dimples
        arc(set, cx, cy + 1, 8, Math.PI * 0.2, Math.PI * 0.8, 2);
        disc(set, cx - 9, cy + 2, 1.5);
        disc(set, cx + 9, cy + 2, 1.5);
      }, i, w, h),
  },
  {
    id: 'heart_eyes',
    name: 'Mata Hati Kasmaran',
    category: 'emoji',
    frames: 24,
    fps: 10,
    description: 'Wajah gembira kasmaran dengan mata berbentuk hati berdenyut jatuh cinta.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 2;

        ring(set, cx, cy, r, 1.8);

        // Two Heart Eyes Pulsing
        const hs = 2.5 + (i % 8 < 4 ? 0.8 : 0);
        for (const ecx of [cx - 6, cx + 6]) {
          disc(set, ecx - hs * 0.8, cy - 5, hs);
          disc(set, ecx + hs * 0.8, cy - 5, hs);
          polygonFill(set, [
            [ecx - hs * 1.6, cy - 4],
            [ecx + hs * 1.6, cy - 4],
            [ecx, cy - 4 + hs * 2],
          ]);
        }

        // Wide Grinning Open Mouth
        arc(set, cx, cy + 2, 8, Math.PI * 0.15, Math.PI * 0.85, 2);
        line(set, cx - 7, cy + 4, cx + 7, cy + 4, 1.5);
      }, i, w, h),
  },
  {
    id: 'cool_glasses',
    name: 'Kacamata Keren',
    category: 'emoji',
    frames: 24,
    fps: 10,
    description: 'Wajah emoji keren memakai kacamata hitam gaya dengan kilauan cahaya.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 2;

        ring(set, cx, cy, r, 1.8);

        // Dark Wayfarer Sunglasses with Temple Hinges
        const gy = cy - 4 + Math.sin((i / 24) * Math.PI * 2) * 1.2;
        roundedRect(set, cx - 12, gy, 10, 7, 2, true);
        roundedRect(set, cx + 2, gy, 10, 7, 2, true);
        line(set, cx - 14, gy, cx + 14, gy, 2.5); // Brow bar
        line(set, cx - 2, gy + 1, cx + 2, gy + 1, 2); // Bridge

        // White Gloss Reflection Streak across dark lenses
        line(set, cx - 10, gy + 2, cx - 4, gy + 2, 1);
        line(set, cx + 4, gy + 2, cx + 10, gy + 2, 1);

        // Confident Smirk
        arc(set, cx + 2, cy + 3, 7, Math.PI * 0.2, Math.PI * 0.6, 2);
      }, i, w, h),
  },
  {
    id: 'laughing_tears',
    name: 'Tertawa Lepas',
    category: 'emoji',
    frames: 24,
    fps: 12,
    description: 'Emoji tertawa terbahak-bahak bahagia dengan air mata sukacita.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + Math.sin((i / 24) * Math.PI * 4) * 1.5;
        const r = Math.min(w, h) / 2 - 2;

        ring(set, cx, cy, r, 1.8);

        // Squeezed Laughing Eyes > <
        line(set, cx - 9, cy - 6, cx - 3, cy - 3, 2.5);
        line(set, cx - 9, cy, cx - 3, cy - 3, 2.5);
        line(set, cx + 9, cy - 6, cx + 3, cy - 3, 2.5);
        line(set, cx + 9, cy, cx + 3, cy - 3, 2.5);

        // Open Laughing Mouth with Tongue
        polygonFill(set, [
          [cx - 8, cy + 2],
          [cx + 8, cy + 2],
          [cx, cy + 10],
        ]);
        arc(set, cx, cy + 2, 8, 0, Math.PI, 1.5);

        // Tears of Joy Splashing Out
        disc(set, cx - 13, cy - 1, 2);
        disc(set, cx + 13, cy - 1, 2);
        line(set, cx - 13, cy - 3, cx - 16, cy + 1, 1.5);
        line(set, cx + 13, cy - 3, cx + 16, cy + 1, 1.5);
      }, i, w, h),
  },
  {
    id: 'surprised_face',
    name: 'Kaget Melotot',
    category: 'emoji',
    frames: 24,
    fps: 10,
    description: 'Wajah terkejut dengan alis melengkung, mata melotot, dan mulut terbuka.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 2;

        ring(set, cx, cy, r, 1.8);

        // High Raised Eyebrows
        arc(set, cx - 6, cy - 8, 4, Math.PI * 1.1, Math.PI * 1.9, 1.8);
        arc(set, cx + 6, cy - 8, 4, Math.PI * 1.1, Math.PI * 1.9, 1.8);

        // Wide Open Eyes with Centered Pupils
        disc(set, cx - 6, cy - 3, 3.5);
        disc(set, cx + 6, cy - 3, 3.5);

        // Big Surprised "O" Mouth
        const mouthR = 3.5 + tri(i, 24, 2.5);
        ellipse(set, cx, cy + 5, mouthR * 0.8, mouthR, true);
      }, i, w, h),
  },
  {
    id: 'robot_face',
    name: 'Wajah Robotku',
    category: 'emoji',
    frames: 32,
    fps: 10,
    description: 'Wajah robot canggih dengan antena LED, visor mata pemindai, dan grill mulut suara.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;

        // Robot Rectangular Head Chassis
        roundedRect(set, cx - 18, cy - 11, 36, 23, 3.5, false, 2);

        // Top Antenna Mast & Glowing Signal Bulb
        line(set, cx, cy - 11, cx, cy - 15, 2);
        const bulbP = i % 8 < 4 ? 2.5 : 1.5;
        disc(set, cx, cy - 16, bulbP);

        // Side Ear Bolts
        rect(set, cx - 21, cy - 3, 3, 6, true);
        rect(set, cx + 18, cy - 3, 3, 6, true);

        // Digital Visor Eye Screens with Glowing Pixels
        roundedRect(set, cx - 14, cy - 6, 28, 8, 2, false, 1.5);
        const scanX = cx - 10 + tri(i, 32, 20);
        rect(set, scanX - 3, cy - 5, 6, 6, true);

        // Mouth Audio Visualizer Grill
        for (let mg = -3; mg <= 3; mg++) {
          const mgh = 2 + (Math.abs(Math.sin(i * 0.4 + mg)) * 3);
          line(set, cx + mg * 3, cy + 6 - mgh * 0.5, cx + mg * 3, cy + 6 + mgh * 0.5, 1.5);
        }
      }, i, w, h),
  },
  {
    id: 'eyes',
    name: 'Mata Berkedip',
    category: 'emoji',
    frames: 40,
    fps: 10,
    description: 'Sepasang mata anime ekspresif dengan iris berkilau dan kedipan kelopak mata mulus.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const blink = i % 40 >= 35;
        for (const ecx of [w / 2 - 13, w / 2 + 13]) {
          const ecy = h / 2;
          if (blink) {
            line(set, ecx - 9, ecy, ecx + 9, ecy, 2.5);
          } else {
            // Expressive Eye Contour
            ellipse(set, ecx, ecy, 9, 7, false, 1.8);
            // Iris & Specular Highlights
            disc(set, ecx, ecy, 4.5);
            set(ecx - 1.5, ecy - 1.5); // Big glint
            set(ecx - 1.5, ecy - 0.5);
            set(ecx + 1.5, ecy + 1.5); // Little secondary glint
          }
        }
      }, i, w, h),
  },
  {
    id: 'party_cake',
    name: 'Kue Ulang Tahun',
    category: 'emoji',
    frames: 24,
    fps: 10,
    description: 'Kue tart ulang tahun manis bertingkat dengan lilin dan api menari hangat.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 3;

        // Serving Platter Plate
        ellipse(set, cx, cy + 10, 18, 2.5, true);

        // Two-Tier Cake Base & Frosting
        roundedRect(set, cx - 15, cy - 1, 30, 10, 2, true);
        roundedRect(set, cx - 10, cy - 8, 20, 8, 2, true);

        // Striped Candle
        rect(set, cx - 1.5, cy - 13, 3, 6, true);

        // Animated Dancing Candle Flame
        const flameSway = Math.sin((i / 24) * Math.PI * 4) * 1.5;
        polygonFill(set, [
          [cx - 1.5 + flameSway, cy - 13],
          [cx + 1.5 + flameSway, cy - 13],
          [cx + flameSway, cy - 18],
        ]);
        disc(set, cx + flameSway, cy - 15, 1.8);

        // Celebration Sparkles
        if (i % 6 < 4) {
          disc(set, cx - 14, cy - 10, 1.2);
          disc(set, cx + 14, cy - 10, 1.2);
        }
      }, i, w, h),
  },
  {
    id: 'lightbulb',
    name: 'Lampu Ide Cemerlang',
    category: 'emoji',
    frames: 24,
    fps: 10,
    description: 'Bohlam lampu ide dengan filamen wolfram berpendar dan sinar inspirasi menyala.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 2;

        // Pear-shaped Glass Bulb
        disc(set, cx, cy - 3, 8.5);
        polygonFill(set, [
          [cx - 7, cy - 1],
          [cx + 7, cy - 1],
          [cx + 4, cy + 6],
          [cx - 4, cy + 6],
        ]);

        // Tungsten Coiled Filament inside
        line(set, cx - 2, cy + 4, cx - 2, cy - 2, 1);
        line(set, cx + 2, cy + 4, cx + 2, cy - 2, 1);
        arc(set, cx, cy - 3, 3, Math.PI, Math.PI * 2, 1.5);

        // Threaded Screw Base (E27)
        rect(set, cx - 4, cy + 6, 8, 5, true);
        line(set, cx - 4, cy + 8, cx + 4, cy + 8, 1);
        disc(set, cx, cy + 11, 2); // Contact foot

        // Radiating Idea Brightness Rays
        if (i % 6 < 4) {
          for (let a = 0; a < 8; a++) {
            const angle = (a / 8) * Math.PI * 2;
            const r0 = 11;
            const r1 = 15;
            line(set, cx + Math.cos(angle) * r0, cy - 3 + Math.sin(angle) * r0, cx + Math.cos(angle) * r1, cy - 3 + Math.sin(angle) * r1, 1.5);
          }
        }
      }, i, w, h),
  },
  {
    id: 'cat_walk',
    name: 'Kucing Melangkah',
    category: 'emoji',
    frames: 24,
    fps: 10,
    description: 'Kucing imut melangkah dengan telinga runcing, kumis, dan ekor meliuk gemulai.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const posX = ((i * 1.6) % (w + 24)) - 12;
        const cy = h / 2 + 1;

        // Cat Torso Body
        ellipse(set, posX, cy, 8, 5, true);

        // Cat Head with Pointed Ears
        disc(set, posX + 8, cy - 4, 4.5);
        polygonFill(set, [
          [posX + 6, cy - 7],
          [posX + 8, cy - 11],
          [posX + 9, cy - 6],
        ]);
        polygonFill(set, [
          [posX + 9, cy - 6],
          [posX + 11, cy - 11],
          [posX + 12, cy - 7],
        ]);

        // Whiskers
        line(set, posX + 11, cy - 3, posX + 15, cy - 4, 1);
        line(set, posX + 11, cy - 2, posX + 15, cy - 1, 1);

        // Swishing Curved Tail
        const tailSway = Math.sin((i / 24) * Math.PI * 4) * 4;
        arc(set, posX - 9, cy - 4 + tailSway * 0.5, 6, Math.PI * 0.6, Math.PI * 1.5, 2);

        // 4 Walking Paws
        const leg = i % 6 < 3 ? 2.5 : -2.5;
        line(set, posX - 4, cy + 4, posX - 4 + leg, cy + 9, 2);
        line(set, posX + 4, cy + 4, posX + 4 - leg, cy + 9, 2);
      }, i, w, h),
  },
];

// ── Category: GAME & KARAKTER ──
const GAME_ANIMS: OledAnim[] = [
  {
    id: 'pacman',
    name: 'Pac-Man Arkade',
    category: 'game',
    frames: 24,
    fps: 12,
    description: 'Karakter arkade klasik melahap pelet makanan di labirin dengan animasi mulut mulus.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const posX = 12 + ((i * 1.8) % (w - 24));
        const cy = h / 2;
        const mouth = tri(i, 12, 0.42) + 0.04;
        const r = 9;

        // Pac-Man Pie Slice with Animated Chomp Mouth
        for (let cr = 0; cr <= r; cr++) {
          for (let a = mouth * Math.PI; a <= (2 - mouth) * Math.PI; a += 0.08) {
            set(posX + Math.cos(a) * cr, cy + Math.sin(a) * cr);
          }
        }

        // Power Pellets & Dots ahead on the path
        for (let dot = 0; dot < w; dot += 12) {
          if (dot > posX + 9) {
            disc(set, dot, cy, dot % 24 === 0 ? 2.5 : 1.5);
          }
        }
      }, i, w, h),
  },
  {
    id: 'ghost',
    name: 'Hantu Arkade',
    category: 'game',
    frames: 20,
    fps: 10,
    description: 'Hantu arkade klasik (Blinky) dengan tentakel melayang dan mata melirik.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + Math.sin((i / 20) * Math.PI * 2) * 1.5;

        // Dome Head & Main Body
        disc(set, cx, cy - 3, 10);
        rect(set, cx - 10, cy - 3, 20, 10, true);

        // 3 Wavy Bottom Tentacles
        const shift = (i % 2) * 2;
        polygonFill(set, [
          [cx - 10, cy + 7],
          [cx - 6, cy + 10 + shift],
          [cx - 3, cy + 7],
        ]);
        polygonFill(set, [
          [cx - 3, cy + 7],
          [cx, cy + 10 - shift],
          [cx + 3, cy + 7],
        ]);
        polygonFill(set, [
          [cx + 3, cy + 7],
          [cx + 6, cy + 10 + shift],
          [cx + 10, cy + 7],
        ]);

        // Big White Eyes with Pupils looking around
        for (const ecx of [cx - 4, cx + 4]) {
          disc(set, ecx, cy - 3, 3);
          disc(set, ecx + 1, cy - 3, 1.5); // Pupil looking right
        }
      }, i, w, h),
  },
  {
    id: 'ball',
    name: 'Bola Memantul',
    category: 'game',
    frames: 48,
    fps: 14,
    description: 'Bola elastis 3D memantul dengan gravitasi presisi, pantulan squash, dan bayangan.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const bx = 8 + tri(i, 48, w - 16);
        const groundY = h - 3;
        const jumpH = h - 14;
        const progress = (i % 24) / 24;
        const tVal = (progress * 2 - 1);
        const by = 6 + (tVal * tVal) * jumpH;

        const isImpact = by > groundY - 6;
        const squashX = isImpact ? 1.4 : 1.0;
        const squashY = isImpact ? 0.7 : 1.0;
        const r = 5.5;

        // Contact Ground Shadow
        ellipse(set, bx, groundY, r * 1.5, 1.2, true);

        // 3D Shaded Sphere
        ellipse(set, bx, by, r * squashX, r * squashY, true);
        // Specular highlight gleam
        disc(set, bx - 1.5 * squashX, by - 1.5 * squashY, 1.2);
      }, i, w, h),
  },
  {
    id: 'space_invader',
    name: 'Alien Space Invader',
    category: 'game',
    frames: 24,
    fps: 8,
    description: 'Alien pixel art legendaris 8-bit berbaris mengayunkan capit dengan animasi 2-frame.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const posX = w / 2 - 12 + Math.sin((i / 24) * Math.PI * 2) * 8;
        const cy = h / 2 - 8;
        const frameA = (i % 2) === 0;

        // Authentic 8-bit Classic Space Invader Sprite (11x8 grid, 2x scale)
        const SPRITE_FRAME_1 = [
          '..X.....X..',
          '...X...X...',
          '..XXXXXXX..',
          '.XX.XXX.XX.',
          'XXXXXXXXXXX',
          'X.XXXXXXX.X',
          'X.X.....X.X',
          '...XX.XX...',
        ];

        const SPRITE_FRAME_2 = [
          '..X.....X..',
          'X..X...X..X',
          'X.XXXXXXX.X',
          'XXX.XXX.XXX',
          'XXXXXXXXXXX',
          '.XXXXXXXXX.',
          '..X.....X..',
          '.X.......X.',
        ];

        sprite(set, posX, cy, frameA ? SPRITE_FRAME_1 : SPRITE_FRAME_2, 2);

        // Laser Projectile firing downward
        const laserY = (cy + 18 + (i * 3) % 18);
        line(set, posX + 11, laserY, posX + 11, laserY + 4, 1.5);
      }, i, w, h),
  },
  {
    id: 'sword_clash',
    name: 'Pertarungan Pedang',
    category: 'game',
    frames: 20,
    fps: 10,
    description: 'Dua bilah pedang ksatria beradu dengan kilatan percikan bunga api bertaburan.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const clash = tri(i, 20, 4);

        // Left Broadsword (Crossguard, Fuller, Pommel)
        const lx0 = cx - 14 + clash;
        const ly0 = cy - 11;
        const lx1 = cx + 14 - clash;
        const ly1 = cy + 11;
        line(set, lx0, ly0, lx1, ly1, 2.5); // Blade
        line(set, lx1 - 4, ly1, lx1, ly1 - 4, 3); // Crossguard
        disc(set, lx1 + 2, ly1 + 2, 2); // Pommel

        // Right Broadsword
        const rx0 = cx + 14 - clash;
        const ry0 = cy - 11;
        const rx1 = cx - 14 + clash;
        const ry1 = cy + 11;
        line(set, rx0, ry0, rx1, ry1, 2.5);
        line(set, rx1 + 4, ry1, rx1, ry1 - 4, 3);
        disc(set, rx1 - 2, ry1 + 2, 2);

        // Explosive Clash Sparks on contact
        if (clash < 1.5) {
          disc(set, cx, cy, 3.5);
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            line(set, cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 1.5);
          }
        }
      }, i, w, h),
  },
];

// Complete animation catalogue
export const OLED_ANIMS: OledAnim[] = [
  ...LOADERS_ANIMS,
  ...GESTURES_ANIMS,
  ...EMOJI_ANIMS,
  ...WEATHER_ANIMS,
  ...UI_ANIMS,
  ...WEB_ANIMS,
  ...SOCIAL_ANIMS,
  ...MEDIA_ANIMS,
  ...ECOMMERCE_ANIMS,
  ...GAME_ANIMS,
];

// Helper to find anim by ID
export function getOledAnim(id: string): OledAnim | undefined {
  return OLED_ANIMS.find((a) => a.id === id);
}

// Get anims by category
export function getOledAnimsByCategory(cat: OledCategory): OledAnim[] {
  return OLED_ANIMS.filter((a) => a.category === cat);
}
