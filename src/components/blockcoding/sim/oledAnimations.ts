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

// ── Drawing Geometry Utilities ──
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
      set(ix + dx, iy);
      set(ix + dx, iy + ih - 1);
    }
    for (let dy = ir; dy < ih - ir; dy++) {
      set(ix, iy + dy);
      set(ix + iw - 1, iy + dy);
    }
    ring(set, ix + ir, iy + ir, ir, 1);
    ring(set, ix + iw - 1 - ir, iy + ir, ir, 1);
    ring(set, ix + ir, iy + ih - 1 - ir, ir, 1);
    ring(set, ix + iw - 1 - ir, iy + ih - 1 - ir, ir, 1);
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
    frames: 30,
    fps: 15,
    description: 'Grafik denyut elektrokardiogram bergerak dinamis.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cy = h / 2;
        const shift = (i % 30) * 2;
        for (let x = 0; x < w; x++) {
          const px = (x + shift) % 40;
          let y = cy;
          if (px > 15 && px <= 18) y = cy - (px - 15) * 3;
          else if (px > 18 && px <= 22) y = cy - 9 + (px - 18) * 6;
          else if (px > 22 && px <= 26) y = cy + 15 - (px - 22) * 4;
          else if (px > 26 && px <= 30) y = cy - 1 - (px - 26) * 1;
          line(set, x, cy, x, y, 1);
          disc(set, x, y, 1);
        }
      }, i, w, h),
    toBlockSpec: () => [repeat(3, [lcdText('BPM: 75 Normal', 1), sleep(0.5)])],
  },
  {
    id: 'airplane',
    name: 'Pesawat Terbang',
    category: 'loaders',
    frames: 36,
    fps: 12,
    description: 'Pesawat terbang melintasi awan di angkasa.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const posX = ((i * 2) % (w + 24)) - 12;
        const posY = h / 2 - 2 + Math.sin(i * 0.3) * 2;
        const c1X = (w - ((i * 1.5) % w)) % w;
        disc(set, c1X, h - 5, 5);
        disc(set, c1X + 8, h - 7, 7);
        disc(set, c1X + 16, h - 5, 4);

        line(set, posX - 10, posY, posX + 8, posY, 2);
        line(set, posX + 8, posY, posX + 12, posY - 2, 2);
        line(set, posX - 4, posY, posX - 1, posY - 6, 2);
        line(set, posX - 4, posY, posX - 1, posY + 6, 2);
        line(set, posX - 9, posY, posX - 12, posY - 4, 1.5);
      }, i, w, h),
  },
  {
    id: 'basketball',
    name: 'Bola Basket',
    category: 'loaders',
    frames: 24,
    fps: 12,
    description: 'Bola basket memantul dengan putaran garis dinamis.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cy = 8 + tri(i, 24, h - 16);
        const cx = w / 2;
        const r = 7;
        ring(set, cx, cy, r, 1.5);
        line(set, cx - r, cy, cx + r, cy, 1);
        const spin = (i / 24) * Math.PI;
        for (let y = -r; y <= r; y++) {
          const factor = Math.sqrt(Math.max(0, 1 - (y / r) * (y / r)));
          set(cx + Math.sin(spin) * r * factor, cy + y);
        }
        if (cy > h - 12) {
          const sw = Math.round((cy - (h - 12)) * 2);
          line(set, cx - sw, h - 2, cx + sw, h - 2, 1);
        }
      }, i, w, h),
  },
  {
    id: 'clock',
    name: 'Jam Berputar',
    category: 'loaders',
    frames: 36,
    fps: 12,
    description: 'Jarum jam analog berputar menunjukkan waktu.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        ring(set, cx, cy, 12, 1.5);
        disc(set, cx, cy, 2);
        const hA = (i / 36) * Math.PI * 0.5 - Math.PI / 2;
        line(set, cx, cy, cx + Math.cos(hA) * 6, cy + Math.sin(hA) * 6, 2);
        const mA = (i / 36) * Math.PI * 4 - Math.PI / 2;
        line(set, cx, cy, cx + Math.cos(mA) * 9, cy + Math.sin(mA) * 9, 1.5);
      }, i, w, h),
  },
  {
    id: 'compass',
    name: 'Kompas Arah',
    category: 'loaders',
    frames: 36,
    fps: 12,
    description: 'Jarum kompas berputar mencari arah utara.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        ring(set, cx, cy, 12, 1.5);
        disc(set, cx, cy, 2);
        const a = Math.sin((i / 36) * Math.PI * 2) * 0.8 - Math.PI / 2;
        const tipX = cx + Math.cos(a) * 9;
        const tipY = cy + Math.sin(a) * 9;
        const tailX = cx - Math.cos(a) * 9;
        const tailY = cy - Math.sin(a) * 9;
        const sideX = cx + Math.cos(a + Math.PI / 2) * 3;
        const sideY = cy + Math.sin(a + Math.PI / 2) * 3;
        line(set, tipX, tipY, sideX, sideY, 1);
        line(set, tipX, tipY, cx - Math.cos(a + Math.PI / 2) * 3, cy - Math.sin(a + Math.PI / 2) * 3, 1);
        line(set, tailX, tailY, sideX, sideY, 1);
        line(set, tailX, tailY, cx - Math.cos(a + Math.PI / 2) * 3, cy - Math.sin(a + Math.PI / 2) * 3, 1);
      }, i, w, h),
  },
  {
    id: 'spinner_dots',
    name: 'Titik Putar Loading',
    category: 'loaders',
    frames: 24,
    fps: 12,
    description: 'Lingkaran 8 titik berputar memudar bergantian.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        for (let d = 0; d < 8; d++) {
          const a = (d / 8) * Math.PI * 2;
          const lead = (i % 24) / 24;
          const dist = (d / 8 - lead + 1) % 1;
          const r = dist < 0.25 ? 2.5 : dist < 0.5 ? 1.8 : 1;
          disc(set, cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, r);
        }
      }, i, w, h),
  },
  {
    id: 'hourglass',
    name: 'Jam Pasir',
    category: 'loaders',
    frames: 32,
    fps: 10,
    description: 'Jam pasir klasik butiran pasir mengalir turun.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const progress = (i % 32) / 32;
        line(set, cx - 10, cy - 12, cx + 10, cy - 12, 2);
        line(set, cx - 10, cy + 12, cx + 10, cy + 12, 2);
        line(set, cx - 9, cy - 11, cx, cy, 1);
        line(set, cx + 9, cy - 11, cx, cy, 1);
        line(set, cx - 9, cy + 11, cx, cy, 1);
        line(set, cx + 9, cy + 11, cx, cy, 1);
        line(set, cx, cy, cx, cy + 10, 1);
        const topH = Math.max(0, Math.round((1 - progress) * 7));
        for (let y = 0; y < topH; y++) {
          const sw = Math.round((y / 7) * 7);
          line(set, cx - sw, cy - 10 + y, cx + sw, cy - 10 + y, 1);
        }
        const botH = Math.min(8, Math.round(progress * 8));
        for (let y = 0; y < botH; y++) {
          const sw = Math.round((y / 8) * 8);
          line(set, cx - sw, cy + 11 - y, cx + sw, cy + 11 - y, 1);
        }
      }, i, w, h),
  },
  {
    id: 'walking_man',
    name: 'Orang Berjalan',
    category: 'loaders',
    frames: 24,
    fps: 12,
    description: 'Sosok orang melangkah berjalan dengan ayunan tangan.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const posX = 12 + ((i * 2) % (w - 24));
        const cy = h / 2;
        const step = Math.sin((i / 24) * Math.PI * 4);
        disc(set, posX, cy - 9, 3);
        line(set, posX, cy - 6, posX, cy + 2, 2);
        line(set, posX, cy - 4, posX - step * 5, cy + 1, 1.5);
        line(set, posX, cy - 4, posX + step * 5, cy + 1, 1.5);
        line(set, posX, cy + 2, posX + step * 6, cy + 11, 2);
        line(set, posX, cy + 2, posX - step * 6, cy + 11, 2);
      }, i, w, h),
  },
  {
    id: 'car_drive',
    name: 'Mobil Melaju',
    category: 'loaders',
    frames: 24,
    fps: 12,
    description: 'Mobil melaju kencang dengan roda berputar.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 2;
        const bounce = i % 4 < 2 ? 1 : 0;
        roundedRect(set, cx - 14, cy - 6 - bounce, 28, 9, 2, true);
        rect(set, cx - 6, cy - 12 - bounce, 14, 7, true);
        rect(set, cx - 4, cy - 11 - bounce, 5, 4, false);
        rect(set, cx + 2, cy - 11 - bounce, 4, 4, false);
        disc(set, cx - 8, cy + 4 - bounce, 3);
        disc(set, cx + 8, cy + 4 - bounce, 3);
        const roadShift = (i * 3) % 12;
        for (let x = -roadShift; x < w; x += 12) {
          line(set, x, cy + 9, x + 6, cy + 9, 1);
        }
      }, i, w, h),
  },
  {
    id: 'rocket',
    name: 'Roket Luar Angkasa',
    category: 'loaders',
    frames: 30,
    fps: 12,
    description: 'Roket luar angkasa meluncur dengan semburan api roket.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 2 + Math.sin(i * 0.4) * 2;
        disc(set, cx, cy - 6, 5);
        rect(set, cx - 4, cy - 6, 8, 12, true);
        disc(set, cx, cy - 2, 2);
        line(set, cx - 4, cy + 2, cx - 8, cy + 8, 2);
        line(set, cx + 4, cy + 2, cx + 8, cy + 8, 2);
        const flameL = 4 + (i % 6) * 1.5;
        line(set, cx - 2, cy + 6, cx, cy + 6 + flameL, 2);
        line(set, cx + 2, cy + 6, cx, cy + 6 + flameL, 2);
      }, i, w, h),
    toBlockSpec: () => [lcdText('Launch 3.. 2.. 1.. 🚀', 2)],
  },
  {
    id: 'sync_cloud',
    name: 'Sinkronisasi Cloud',
    category: 'loaders',
    frames: 32,
    fps: 12,
    description: 'Awan data dengan panah melingkar berputar.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 4;
        disc(set, cx - 10, cy, 6);
        disc(set, cx + 10, cy, 5);
        disc(set, cx, cy - 5, 7);
        rect(set, cx - 12, cy, 24, 6, true);
        const a = (i / 32) * Math.PI * 2;
        const arrowY = cy + 10;
        for (let arc = 0; arc < 2; arc++) {
          const startA = a + arc * Math.PI;
          for (let step = 0; step < 6; step++) {
            const curA = startA + (step / 8) * Math.PI;
            set(cx + Math.cos(curA) * 5, arrowY + Math.sin(curA) * 5);
          }
          const tipA = startA + (6 / 8) * Math.PI;
          disc(set, cx + Math.cos(tipA) * 5, arrowY + Math.sin(tipA) * 5, 1.5);
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
    description: 'Jari telunjuk mengetuk layar dengan gelombang sentuh.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 2;
        const tap = tri(i, 24, 4);
        const tapX = cx - 2;
        const tapY = cy - 6 + tap;
        line(set, tapX, tapY, tapX, tapY + 12, 3);
        roundedRect(set, tapX - 4, tapY + 8, 12, 10, 3, true);
        if (tap < 1.5) {
          ring(set, tapX, tapY - 2, 4 + (i % 8), 1);
        }
      }, i, w, h),
  },
  {
    id: 'swipe_hand',
    name: 'Geser Tangan (Swipe)',
    category: 'gestures',
    frames: 30,
    fps: 12,
    description: 'Tangan menggeser ke samping dengan garis jejak gerakan.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const shiftX = tri(i, 30, 20) - 10;
        const cx = w / 2 + shiftX;
        const cy = h / 2;
        line(set, cx - 4, cy - 8, cx - 4, cy + 4, 3);
        roundedRect(set, cx - 8, cy, 14, 10, 2, true);
        line(set, cx - 16, cy - 4, cx - 8, cy - 4, 1);
        line(set, cx - 20, cy, cx - 10, cy, 1);
      }, i, w, h),
  },
  {
    id: 'peace_sign',
    name: 'Jari Damai (Peace/V)',
    category: 'gestures',
    frames: 24,
    fps: 10,
    description: 'Pose dua jari V kemenangan memantul gembira.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + Math.sin((i / 24) * Math.PI * 2) * 2;
        line(set, cx - 3, cy, cx - 6, cy - 12, 2.5);
        line(set, cx + 3, cy, cx + 6, cy - 12, 2.5);
        roundedRect(set, cx - 7, cy - 2, 14, 12, 3, true);
      }, i, w, h),
  },
  {
    id: 'handshake',
    name: 'Jabat Tangan',
    category: 'gestures',
    frames: 24,
    fps: 12,
    description: 'Dua tangan bersalaman hangat tanda persahabatan.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + Math.sin((i / 24) * Math.PI * 4) * 2;
        line(set, cx - 18, cy + 4, cx - 4, cy, 3);
        line(set, cx + 18, cy + 4, cx + 4, cy, 3);
        disc(set, cx - 2, cy - 1, 4);
        disc(set, cx + 2, cy - 1, 4);
        line(set, cx - 4, cy + 3, cx + 4, cy + 3, 2);
      }, i, w, h),
  },
  {
    id: 'fist_bump',
    name: 'Tinju Semangat (Fist)',
    category: 'gestures',
    frames: 20,
    fps: 10,
    description: 'Kepalan tangan tinju memantul berenergi penuh.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const punch = Math.sin((i / 20) * Math.PI * 2) * 4;
        const cx = w / 2 + punch;
        const cy = h / 2;
        roundedRect(set, cx - 8, cy - 7, 16, 14, 3, true);
        line(set, cx - 8, cy - 2, cx + 4, cy - 2, 1.5);
        line(set, cx - 8, cy + 2, cx + 4, cy + 2, 1.5);
        disc(set, cx - 6, cy - 4, 2);
      }, i, w, h),
  },
  {
    id: 'ok_sign',
    name: 'Tanda OK Mantap',
    category: 'gestures',
    frames: 24,
    fps: 12,
    description: 'Gesture tangan tanda OK dengan jari melingkar sempurna.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + Math.sin((i / 24) * Math.PI * 2) * 1.5;
        ring(set, cx - 3, cy + 1, 5, 2);
        line(set, cx + 2, cy, cx + 4, cy - 10, 2);
        line(set, cx + 5, cy, cx + 8, cy - 9, 2);
        line(set, cx + 8, cy, cx + 11, cy - 7, 2);
        roundedRect(set, cx - 7, cy + 2, 12, 8, 2, true);
      }, i, w, h),
  },
  {
    id: 'wash_hands',
    name: 'Cuci Tangan Bersih',
    category: 'gestures',
    frames: 24,
    fps: 12,
    description: 'Dua telapak tangan mencuci di bawah tetesan air.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 3;
        const rub = Math.sin((i / 24) * Math.PI * 4) * 3;
        disc(set, cx - 4 + rub, cy, 6);
        disc(set, cx + 4 - rub, cy, 6);
        const dropY = i % 12;
        disc(set, cx - 2, cy - 14 + dropY, 1.5);
        disc(set, cx + 3, cy - 10 + ((dropY + 6) % 12), 1.5);
      }, i, w, h),
  },
  {
    id: 'wave_hand',
    name: 'Lambaian Tangan',
    category: 'gestures',
    frames: 24,
    fps: 12,
    description: 'Telapak tangan melambai ke kiri dan ke kanan menyapa.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 2;
        const tilt = Math.sin((i / 24) * Math.PI * 4) * 0.35;
        const cos = Math.cos(tilt);
        const sin = Math.sin(tilt);
        for (let f = -6; f <= 6; f += 4) {
          const fx = cx + f * cos - -10 * sin;
          const fy = cy + f * sin + -10 * cos;
          line(set, cx, cy, fx, fy, 2);
        }
        disc(set, cx, cy, 5);
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
    description: 'Animasi folder membuka tab dan berkas keluar masuk.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const open = tri(i, 36, 1);
        rect(set, cx - 16, cy - 8, 32, 20, false);
        rect(set, cx - 16, cy - 12, 12, 5, true);
        const paperY = cy - 6 - open * 6;
        rect(set, cx - 11, paperY, 22, 14, true);
        rect(set, cx - 9, paperY + 2, 18, 10, false);
        line(set, cx - 16, cy + 12, cx - 18 + open * 3, cy - 3 + open * 7, 2);
        line(set, cx + 16, cy + 12, cx + 18 - open * 3, cy - 3 + open * 7, 2);
        line(set, cx - 18 + open * 3, cy - 3 + open * 7, cx + 18 - open * 3, cy - 3 + open * 7, 2);
      }, i, w, h),
  },
  {
    id: 'bell',
    name: 'Lonceng Berdering',
    category: 'ui',
    frames: 30,
    fps: 15,
    description: 'Lonceng notifikasi berayun dengan gelombang bunyi.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 2;
        const angle = Math.sin((i / 30) * Math.PI * 4) * 0.35;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);
        ring(set, cx, cy - 10, 3, 1);
        for (let r = 0; r <= 10; r++) {
          const bw = 3 + (r / 10) * 11;
          for (let dx = -bw; dx <= bw; dx++) {
            const dy = -6 + r;
            const rx = cx + dx * cos - dy * sin;
            const ry = cy + dx * sin + dy * cos;
            if (r === 10 || Math.abs(dx) >= bw - 1) set(rx, ry);
          }
        }
        const clapperX = cx - sin * 12;
        const clapperY = cy + cos * 12;
        disc(set, clapperX, clapperY, 2.5);
        const rip = (i % 10) / 10;
        ring(set, cx - 18 - rip * 4, cy - 2, 4 + rip * 5, 1);
        ring(set, cx + 18 + rip * 4, cy - 2, 4 + rip * 5, 1);
      }, i, w, h),
  },
  {
    id: 'battery',
    name: 'Baterai Mengisi',
    category: 'ui',
    frames: 32,
    fps: 10,
    description: 'Indikator pengisian daya baterai bertingkat dengan petir.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        rect(set, cx - 20, cy - 8, 38, 16, false, 2);
        rect(set, cx + 18, cy - 4, 4, 8, true);
        const level = Math.floor(((i % 32) / 32) * 4);
        for (let b = 0; b <= level; b++) {
          rect(set, cx - 17 + b * 8, cy - 5, 6, 10, true);
        }
        if (i % 6 < 4) {
          line(set, cx - 3, cy - 6, cx - 8, cy, 2);
          line(set, cx - 8, cy, cx - 4, cy, 2);
          line(set, cx - 4, cy, cx - 9, cy + 6, 2);
        }
      }, i, w, h),
  },
  {
    id: 'wifi',
    name: 'Sinyal WiFi',
    category: 'ui',
    frames: 24,
    fps: 8,
    description: 'Gelombang pemancar sinyal nirkabel WiFi memancar keluar.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 8;
        disc(set, cx, cy, 2.5);
        const step = i % 24;
        for (let arc = 1; arc <= 3; arc++) {
          const r = arc * 7;
          const active = step >= (arc - 1) * 6;
          if (active) {
            for (let a = -Math.PI * 0.75; a <= -Math.PI * 0.25; a += 0.05) {
              set(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
              set(cx + Math.cos(a) * (r + 0.8), cy + Math.sin(a) * (r + 0.8));
            }
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
    description: 'Roda gigi mekanis berputar dengan gerigi presisi.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const angle = (i / 36) * Math.PI * 2;
        ring(set, cx, cy, 10, 3);
        disc(set, cx, cy, 3);
        for (let t = 0; t < 6; t++) {
          const a = angle + (t / 6) * Math.PI * 2;
          const tx = cx + Math.cos(a) * 12;
          const ty = cy + Math.sin(a) * 12;
          disc(set, tx, ty, 2.5);
        }
      }, i, w, h),
  },
  {
    id: 'search',
    name: 'Kaca Pembesar',
    category: 'ui',
    frames: 30,
    fps: 12,
    description: 'Kaca pembesar mencari dan memindai area layar.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const offX = Math.sin((i / 30) * Math.PI * 2) * 8;
        const offY = Math.cos((i / 30) * Math.PI * 2) * 3;
        const cx = w / 2 + offX - 3;
        const cy = h / 2 + offY - 2;
        ring(set, cx, cy, 8, 2);
        line(set, cx + 6, cy + 6, cx + 14, cy + 14, 3);
        line(set, w / 2 - 20, h / 2 - 6, w / 2 + 10, h / 2 - 6, 1);
        line(set, w / 2 - 20, h / 2, w / 2 + 6, h / 2, 1);
        line(set, w / 2 - 20, h / 2 + 6, w / 2 + 16, h / 2 + 6, 1);
      }, i, w, h),
  },
  {
    id: 'lock',
    name: 'Gembok Membuka',
    category: 'ui',
    frames: 32,
    fps: 10,
    description: 'Gembok keamanan terbuka dan terkunci kembali.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const open = tri(i, 32, 1);
        roundedRect(set, cx - 12, cy - 2, 24, 16, 2, true);
        disc(set, cx, cy + 4, 2);
        line(set, cx, cy + 4, cx, cy + 8, 2);
        const shackleY = cy - 2 - open * 6;
        for (let a = Math.PI; a <= Math.PI * 2; a += 0.1) {
          const sx = cx + Math.cos(a) * 7;
          const sy = shackleY + Math.sin(a) * 7;
          disc(set, sx, sy, 1.5);
        }
        line(set, cx - 7, shackleY, cx - 7, cy - 2, 2);
        line(set, cx + 7, shackleY, cx + 7, cy - (open > 0.4 ? 6 : 2), 2);
      }, i, w, h),
  },
  {
    id: 'load',
    name: 'Loading Spin',
    category: 'ui',
    frames: 24,
    fps: 12,
    description: 'Lingkaran indikator pemuatan memutar 8 titik cahaya.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        for (let d = 0; d < 8; d++) {
          const a = (d / 8) * Math.PI * 2;
          const lead = (i % 24) / 24;
          const on = (d / 8 - lead + 1) % 1 < 0.55;
          if (on) disc(set, cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 2);
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
    description: 'Rotasi bumi dengan garis lintang dan bujur 3D.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const r = 12;
        ring(set, cx, cy, r, 1.5);
        for (let x = -r; x <= r; x++) set(cx + x, cy);
        const shift = ((i % 36) / 36) * Math.PI * 2;
        for (let angle = 0; angle < Math.PI; angle += Math.PI / 3) {
          const cur = angle + shift;
          const rx = Math.cos(cur) * r;
          for (let y = -r; y <= r; y++) {
            const factor = Math.sqrt(Math.max(0, 1 - (y / r) * (y / r)));
            set(cx + rx * factor, cy + y);
          }
        }
      }, i, w, h),
  },
  {
    id: 'cloud_upload',
    name: 'Unggah Cloud',
    category: 'web',
    frames: 28,
    fps: 14,
    description: 'Awan berkas dengan panah meluncur naik ke atas.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 2;
        disc(set, cx - 8, cy + 2, 7);
        disc(set, cx + 8, cy + 2, 6);
        disc(set, cx, cy - 4, 8);
        rect(set, cx - 12, cy + 2, 24, 7, true);
        const arrowOffset = (i % 14) - 7;
        const ax = cx;
        const ay = cy + arrowOffset + 4;
        line(set, ax, ay + 6, ax, ay - 4, 2);
        line(set, ax - 4, ay, ax, ay - 4, 2);
        line(set, ax + 4, ay, ax, ay - 4, 2);
      }, i, w, h),
  },
  {
    id: 'browser',
    name: 'Jendela Browser',
    category: 'web',
    frames: 30,
    fps: 10,
    description: 'Tampilan browser web dengan bilah kemajuan memuat situs.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        rect(set, cx - 22, cy - 11, 44, 22, false);
        line(set, cx - 22, cy - 6, cx + 22, cy - 6, 1);
        disc(set, cx - 18, cy - 8.5, 1);
        disc(set, cx - 14, cy - 8.5, 1);
        disc(set, cx - 10, cy - 8.5, 1);
        const progress = (i % 30) / 30;
        rect(set, cx - 18, cy - 1, Math.round(36 * progress), 4, true);
        line(set, cx - 18, cy + 6, cx + 18, cy + 6, 1);
      }, i, w, h),
  },
  {
    id: 'network_nodes',
    name: 'Jaringan Server',
    category: 'web',
    frames: 30,
    fps: 12,
    description: 'Simpul node jaringan terhubung dan bertukar data.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        disc(set, cx, cy, 4);
        for (let n = 0; n < 4; n++) {
          const a = (n / 4) * Math.PI * 2 + (i / 30) * Math.PI * 0.5;
          const nx = cx + Math.cos(a) * 14;
          const ny = cy + Math.sin(a) * 10;
          line(set, cx, cy, nx, ny, 1);
          disc(set, nx, ny, 2.5);
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
    description: 'Pesan obrolan dengan 3 titik mengetik bergantian.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 2;
        roundedRect(set, cx - 18, cy - 9, 36, 18, 5, false);
        line(set, cx - 10, cy + 9, cx - 15, cy + 14, 2);
        line(set, cx - 15, cy + 14, cx - 4, cy + 9, 2);
        const activeDot = Math.floor((i % 24) / 6);
        for (let d = 0; d < 3; d++) {
          const dx = cx - 8 + d * 8;
          const dy = cy - (d === activeDot ? 2 : 0);
          disc(set, dx, dy, 2);
        }
      }, i, w, h),
  },
  {
    id: 'heart_beat',
    name: 'Hati Berdenyut',
    category: 'social',
    frames: 30,
    fps: 12,
    description: 'Detak jantung berdenyut membesar dan mengecil.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const s = 5 + Math.round(tri(i, 30, 3));
        const cx = w / 2;
        const cy = h / 2 - 2;
        disc(set, cx - s, cy, s);
        disc(set, cx + s, cy, s);
        for (let y = 0; y <= s * 2; y++) {
          const bw = s * 2 - y;
          for (let x = -bw; x <= bw; x++) set(cx + x, cy + y);
        }
      }, i, w, h),
  },
  {
    id: 'thumbs_up',
    name: 'Jempol Suka',
    category: 'social',
    frames: 24,
    fps: 12,
    description: 'Jempol apresiasi memantul dengan bintang sukacita.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2 - 2;
        const cy = h / 2 + Math.sin((i / 24) * Math.PI * 2) * 2;
        roundedRect(set, cx - 6, cy - 2, 14, 12, 2, true);
        rect(set, cx - 10, cy - 10, 6, 12, true);
        disc(set, cx - 7, cy - 10, 3);
        rect(set, cx - 12, cy + 2, 6, 8, true);
        if (i % 8 < 5) {
          disc(set, cx + 12, cy - 8, 1.5);
          disc(set, cx + 16, cy - 3, 1);
          disc(set, cx + 12, cy + 2, 1.5);
        }
      }, i, w, h),
  },
  {
    id: 'mail_envelope',
    name: 'Surat Masuk',
    category: 'social',
    frames: 28,
    fps: 12,
    description: 'Amplop surat membuka dan surat meluncur naik.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 1;
        const open = tri(i, 28, 1);
        rect(set, cx - 18, cy - 7, 36, 18, false, 1.5);
        const letterY = cy - 4 - open * 7;
        rect(set, cx - 14, letterY, 28, 12, true);
        rect(set, cx - 12, letterY + 2, 24, 8, false);
        line(set, cx - 18, cy - 7, cx, cy + 2, 1.5);
        line(set, cx + 18, cy - 7, cx, cy + 2, 1.5);
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
    description: 'Spektrum frekuensi audio memantul dinamis.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 10;
        const bars = 7;
        const barW = 4;
        const gap = 2;
        const totalW = bars * (barW + gap) - gap;
        const startX = cx - totalW / 2;
        for (let b = 0; b < bars; b++) {
          const phase = i * 0.4 + b * 0.9;
          const bh = 4 + Math.round((Math.sin(phase) * 0.5 + 0.5) * 18);
          rect(set, startX + b * (barW + gap), cy - bh, barW, bh, true);
        }
      }, i, w, h),
  },
  {
    id: 'music',
    name: 'Not Balok Nada',
    category: 'media',
    frames: 32,
    fps: 12,
    description: 'Not nada musik melayang naik ke angkasa bergoyang.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const shiftY = (i % 32) * 0.4;
        const n1X = cx - 8;
        const n1Y = h / 2 + 6 - shiftY;
        disc(set, n1X, n1Y, 3);
        disc(set, n1X + 12, n1Y - 4, 3);
        line(set, n1X + 2, n1Y, n1X + 2, n1Y - 14, 2);
        line(set, n1X + 14, n1Y - 4, n1X + 14, n1Y - 18, 2);
        line(set, n1X + 2, n1Y - 14, n1X + 14, n1Y - 18, 3);
        const n2X = cx + 14;
        const n2Y = h / 2 - 2 + Math.sin(i * 0.3) * 3;
        disc(set, n2X, n2Y, 2.5);
        line(set, n2X + 2, n2Y, n2X + 2, n2Y - 10, 1.5);
        line(set, n2X + 2, n2Y - 10, n2X + 7, n2Y - 8, 2);
      }, i, w, h),
  },
  {
    id: 'speaker',
    name: 'Speaker Suara',
    category: 'media',
    frames: 24,
    fps: 12,
    description: 'Speaker audio bergetar mengeluarkan gelombang bunyi.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2 - 4;
        const cy = h / 2;
        rect(set, cx - 12, cy - 5, 6, 10, true);
        line(set, cx - 6, cy - 5, cx + 2, cy - 10, 2);
        line(set, cx - 6, cy + 5, cx + 2, cy + 10, 2);
        line(set, cx + 2, cy - 10, cx + 2, cy + 10, 2);
        for (let y = -9; y <= 9; y++) line(set, cx - 6, cy + y * 0.5, cx + 2, cy + y, 1);
        const pulse = i % 8;
        ring(set, cx + 8, cy, 4 + pulse * 1.5, 1.5);
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
    description: 'Matahari cerah berputar dengan sinar pancaran hangat.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        disc(set, cx, cy, 6);
        const rot = (i / 36) * Math.PI * 2;
        for (let r = 0; r < 8; r++) {
          const a = rot + (r / 8) * Math.PI * 2;
          const x0 = cx + Math.cos(a) * 9;
          const y0 = cy + Math.sin(a) * 9;
          const x1 = cx + Math.cos(a) * 14;
          const y1 = cy + Math.sin(a) * 14;
          line(set, x0, y0, x1, y1, 1.5);
        }
      }, i, w, h),
  },
  {
    id: 'rain',
    name: 'Awan Hujan',
    category: 'weather',
    frames: 24,
    fps: 12,
    description: 'Awan mendung dengan butiran rintik hujan turun deras.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 4;
        disc(set, cx - 10, cy, 7);
        disc(set, cx + 8, cy, 6);
        disc(set, cx, cy - 6, 8);
        rect(set, cx - 14, cy, 26, 7, true);
        const dropStep = i % 8;
        for (let c = -2; c <= 2; c++) {
          const rx = cx + c * 7 - 2;
          const ry = cy + 8 + ((dropStep + c * 3 + 24) % 12);
          line(set, rx, ry, rx - 2, ry + 4, 1.5);
        }
      }, i, w, h),
  },
  {
    id: 'flame',
    name: 'Kobaran Api',
    category: 'weather',
    frames: 24,
    fps: 12,
    description: 'Lidah api menyala berkobar meliuk-liuk hangat.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 8;
        const sway = Math.sin((i / 24) * Math.PI * 4) * 3;
        disc(set, cx, cy - 2, 8);
        for (let y = 0; y < 18; y++) {
          const fw = Math.max(1, 8 - (y / 18) * 8);
          const fx = cx + (sway * y) / 18;
          line(set, fx - fw, cy - y, fx + fw, cy - y, 1);
        }
        disc(set, cx + sway * 0.3, cy - 4, 3);
      }, i, w, h),
  },
  {
    id: 'snow_flake',
    name: 'Kepingan Salju',
    category: 'weather',
    frames: 36,
    fps: 12,
    description: 'Kepingan kristal salju putih berputar anggun.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const rot = (i / 36) * Math.PI * 2;
        disc(set, cx, cy, 2);
        for (let a = 0; a < 6; a++) {
          const angle = rot + (a / 6) * Math.PI * 2;
          const x1 = cx + Math.cos(angle) * 12;
          const y1 = cy + Math.sin(angle) * 12;
          line(set, cx, cy, x1, y1, 1.5);
          const mx = cx + Math.cos(angle) * 8;
          const my = cy + Math.sin(angle) * 8;
          const b1 = angle + Math.PI / 4;
          const b2 = angle - Math.PI / 4;
          line(set, mx, my, mx + Math.cos(b1) * 4, my + Math.sin(b1) * 4, 1);
          line(set, mx, my, mx + Math.cos(b2) * 4, my + Math.sin(b2) * 4, 1);
        }
      }, i, w, h),
  },
  {
    id: 'moon_stars',
    name: 'Bulan & Bintang',
    category: 'weather',
    frames: 30,
    fps: 10,
    description: 'Bulan sabit malam hari ditemani bintang berkelip.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2 - 4;
        const cy = h / 2;
        ring(set, cx, cy, 11, 2);
        disc(set, cx - 4, cy, 4);
        const twinkle = i % 10 < 5;
        if (twinkle) {
          disc(set, cx + 16, cy - 6, 1.5);
          line(set, cx + 14, cy - 6, cx + 18, cy - 6, 1);
          line(set, cx + 16, cy - 8, cx + 16, cy - 4, 1);
        } else {
          disc(set, cx + 16, cy - 6, 1);
        }
      }, i, w, h),
  },
  {
    id: 'wind_breeze',
    name: 'Angin Semilir',
    category: 'weather',
    frames: 24,
    fps: 12,
    description: 'Hembusan garis angin bertiup kencang melengkung.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const shift = (i % 24) * 2;
        for (let lineIdx = 0; lineIdx < 3; lineIdx++) {
          const y = h / 2 - 6 + lineIdx * 6;
          for (let x = 0; x < w; x++) {
            const wave = Math.sin((x + shift + lineIdx * 10) * 0.15) * 2;
            if ((x + shift) % 20 < 14) {
              set(x, Math.round(y + wave));
            }
          }
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
    description: 'Kotak kado membuka tutupnya dengan taburan pita.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 2;
        const open = tri(i, 32, 1);
        rect(set, cx - 12, cy - 2, 24, 14, false, 1.5);
        line(set, cx, cy - 2, cx, cy + 12, 2);
        const lidY = cy - 4 - open * 6;
        rect(set, cx - 14, lidY - 3, 28, 4, true);
        ring(set, cx - 4, lidY - 7, 3, 1);
        ring(set, cx + 4, lidY - 7, 3, 1);
      }, i, w, h),
  },
  {
    id: 'shopping_cart',
    name: 'Keranjang Belanja',
    category: 'ecommerce',
    frames: 24,
    fps: 12,
    description: 'Keranjang belanja belanjaan meluncur maju.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2 + Math.sin((i / 24) * Math.PI * 2) * 3;
        const cy = h / 2;
        line(set, cx - 14, cy - 8, cx - 10, cy + 4, 2);
        line(set, cx - 10, cy + 4, cx + 12, cy + 4, 2);
        line(set, cx + 12, cy + 4, cx + 16, cy - 8, 2);
        line(set, cx - 14, cy - 8, cx + 16, cy - 8, 1.5);
        line(set, cx - 14, cy - 8, cx - 18, cy - 10, 2);
        disc(set, cx - 6, cy + 8, 2.5);
        disc(set, cx + 8, cy + 8, 2.5);
        const itemPop = tri(i, 24, 3);
        rect(set, cx - 2, cy - 7 - itemPop, 8, 6, true);
      }, i, w, h),
  },
  {
    id: 'credit_card',
    name: 'Kartu Pembayaran',
    category: 'ecommerce',
    frames: 30,
    fps: 10,
    description: 'Kartu kredit chip melayang dengan garis magnetik.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + Math.sin((i / 30) * Math.PI * 2) * 2;
        roundedRect(set, cx - 18, cy - 10, 36, 20, 2, false);
        line(set, cx - 18, cy - 4, cx + 18, cy - 4, 2);
        rect(set, cx - 14, cy + 1, 6, 5, true);
        disc(set, cx + 10, cy + 3, 2);
        disc(set, cx + 13, cy + 3, 2);
      }, i, w, h),
  },
  {
    id: 'coin_spin',
    name: 'Koin Berputar',
    category: 'ecommerce',
    frames: 24,
    fps: 12,
    description: 'Koin emas berputar 3D memantulkan kilau cahaya.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const scale = Math.cos((i / 24) * Math.PI * 2);
        const r = 11;
        const rx = Math.max(1, Math.round(Math.abs(scale) * r));
        for (let dy = -r; dy <= r; dy++) {
          const wRow = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / r) * (dy / r))));
          line(set, cx - wRow, cy + dy, cx + wRow, cy + dy, 1);
        }
        if (rx > 5) {
          line(set, cx, cy - 6, cx, cy + 6, 2);
          line(set, cx - 3, cy - 3, cx + 3, cy - 3, 1.5);
          line(set, cx - 3, cy + 3, cx + 3, cy + 3, 1.5);
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
    description: 'Wajah tersenyum ramah memberikan kedipan mata lucu.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        ring(set, cx, cy, 14, 1.5);
        disc(set, cx - 5, cy - 4, 2.5);
        const winking = (i % 36) >= 18 && (i % 36) <= 28;
        if (winking) {
          line(set, cx + 2, cy - 4, cx + 8, cy - 4, 2);
        } else {
          disc(set, cx + 5, cy - 4, 2.5);
        }
        for (let a = 0.2; a <= Math.PI - 0.2; a += 0.1) {
          set(cx + Math.cos(a) * 8, cy + Math.sin(a) * 7);
        }
      }, i, w, h),
  },
  {
    id: 'heart_eyes',
    name: 'Mata Hati Kasmaran',
    category: 'emoji',
    frames: 24,
    fps: 10,
    description: 'Wajah gembira dengan mata berbentuk hati berdenyut.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        ring(set, cx, cy, 14, 1.5);
        const hs = 2 + (i % 8 < 4 ? 1 : 0);
        for (const ecx of [cx - 6, cx + 6]) {
          disc(set, ecx - hs, cy - 4, hs);
          disc(set, ecx + hs, cy - 4, hs);
          line(set, ecx - hs * 2, cy - 4, ecx, cy - 4 + hs * 2, 1);
          line(set, ecx + hs * 2, cy - 4, ecx, cy - 4 + hs * 2, 1);
        }
        for (let a = 0.2; a <= Math.PI - 0.2; a += 0.1) {
          set(cx + Math.cos(a) * 8, cy + Math.sin(a) * 7);
        }
      }, i, w, h),
  },
  {
    id: 'cool_glasses',
    name: 'Kacamata Keren',
    category: 'emoji',
    frames: 24,
    fps: 10,
    description: 'Wajah emoji keren memakai kacamata hitam gaya.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        ring(set, cx, cy, 14, 1.5);
        const glassesY = cy - 4 + Math.sin((i / 24) * Math.PI * 2) * 1.5;
        rect(set, cx - 11, glassesY, 9, 6, true);
        rect(set, cx + 2, glassesY, 9, 6, true);
        line(set, cx - 13, glassesY, cx + 13, glassesY, 2);
        for (let a = 0.3; a <= Math.PI - 0.3; a += 0.15) {
          set(cx + Math.cos(a) * 7, cy + Math.sin(a) * 6 + 2);
        }
      }, i, w, h),
  },
  {
    id: 'laughing_tears',
    name: 'Tertawa Lepas',
    category: 'emoji',
    frames: 24,
    fps: 12,
    description: 'Emoji tertawa terbahak-bahak bahagia.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + Math.sin((i / 24) * Math.PI * 4) * 1.5;
        ring(set, cx, cy, 14, 1.5);
        line(set, cx - 8, cy - 5, cx - 3, cy - 3, 2);
        line(set, cx - 8, cy - 1, cx - 3, cy - 3, 2);
        line(set, cx + 8, cy - 5, cx + 3, cy - 3, 2);
        line(set, cx + 8, cy - 1, cx + 3, cy - 3, 2);
        for (let a = 0; a <= Math.PI; a += 0.1) {
          line(set, cx, cy + 2, cx + Math.cos(a) * 8, cy + 2 + Math.sin(a) * 8, 1);
        }
      }, i, w, h),
  },
  {
    id: 'surprised_face',
    name: 'Kaget Melotot',
    category: 'emoji',
    frames: 24,
    fps: 10,
    description: 'Wajah terkejut dengan mulut menganga dan mata besar.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        ring(set, cx, cy, 14, 1.5);
        disc(set, cx - 6, cy - 4, 3);
        disc(set, cx + 6, cy - 4, 3);
        const mouthR = 3 + tri(i, 24, 3);
        disc(set, cx, cy + 5, mouthR);
      }, i, w, h),
  },
  {
    id: 'robot_face',
    name: 'Wajah Robotku',
    category: 'emoji',
    frames: 32,
    fps: 10,
    description: 'Wajah robot dengan visor pemindai futuristik.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        roundedRect(set, cx - 16, cy - 10, 32, 22, 3, false);
        line(set, cx, cy - 10, cx, cy - 14, 2);
        disc(set, cx, cy - 15, 2);
        const scanX = cx - 10 + tri(i, 32, 20);
        rect(set, cx - 12, cy - 4, 24, 6, false);
        rect(set, scanX - 3, cy - 3, 6, 4, true);
        line(set, cx - 8, cy + 6, cx + 8, cy + 6, 2);
        disc(set, cx - 8, cy + 6, 1.5);
        disc(set, cx + 8, cy + 6, 1.5);
      }, i, w, h),
  },
  {
    id: 'eyes',
    name: 'Mata Berkedip',
    category: 'emoji',
    frames: 40,
    fps: 10,
    description: 'Sepasang mata OLED berkedip ramah ke penonton.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const blink = i % 40 >= 36;
        for (const ecx of [w / 2 - 12, w / 2 + 12]) {
          if (blink) {
            for (let x = -7; x <= 7; x++) set(ecx + x, h / 2);
          } else {
            disc(set, ecx, h / 2, 7);
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
    description: 'Kue tart ulang tahun manis dengan lilin menyala.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + 4;
        roundedRect(set, cx - 14, cy - 4, 28, 12, 2, true);
        line(set, cx, cy - 4, cx, cy - 10, 2);
        const flameSway = Math.sin((i / 24) * Math.PI * 4) * 1.5;
        disc(set, cx + flameSway, cy - 12, 2);
      }, i, w, h),
  },
  {
    id: 'lightbulb',
    name: 'Lampu Ide Cemerlang',
    category: 'emoji',
    frames: 24,
    fps: 10,
    description: 'Bohlam lampu menyala terang memancarkan ide.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 - 2;
        disc(set, cx, cy - 2, 7);
        rect(set, cx - 4, cy + 4, 8, 5, true);
        line(set, cx - 3, cy + 10, cx + 3, cy + 10, 2);
        if (i % 6 < 4) {
          for (let a = 0; a < 6; a++) {
            const angle = (a / 6) * Math.PI * 2;
            line(set, cx + Math.cos(angle) * 10, cy - 2 + Math.sin(angle) * 10, cx + Math.cos(angle) * 14, cy - 2 + Math.sin(angle) * 14, 1.5);
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
    description: 'Kucing imut melangkah dengan ekor bergoyang.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const posX = ((i * 1.5) % (w + 20)) - 10;
        const cy = h / 2 + 2;
        disc(set, posX, cy, 7);
        disc(set, posX + 8, cy - 4, 4);
        line(set, posX + 6, cy - 8, posX + 7, cy - 5, 2);
        line(set, posX + 10, cy - 8, posX + 9, cy - 5, 2);
        const tailSway = Math.sin((i / 24) * Math.PI * 4) * 4;
        line(set, posX - 6, cy - 2, posX - 12, cy - 8 + tailSway, 2);
        const leg = i % 6 < 3 ? 2 : -2;
        line(set, posX - 3, cy + 6, posX - 3 + leg, cy + 10, 2);
        line(set, posX + 4, cy + 6, posX + 4 - leg, cy + 10, 2);
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
    description: 'Karakter arkade retro melahap pelet makanan di labirin.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const posX = 12 + ((i * 2) % (w - 20));
        const cy = h / 2;
        const mouth = tri(i, 12, 0.4) + 0.05;
        for (let r = 0; r <= 8; r++) {
          for (let a = mouth * Math.PI; a <= (2 - mouth) * Math.PI; a += 0.08) {
            set(posX + Math.cos(a) * r, cy + Math.sin(a) * r);
          }
        }
        for (let dot = 0; dot < w; dot += 12) {
          if (dot > posX + 8) {
            disc(set, dot, cy, 1.5);
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
    description: 'Hantu imut melayang dengan rok bergelombang.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2 + Math.sin((i / 20) * Math.PI * 2) * 2;
        disc(set, cx, cy - 3, 9);
        rect(set, cx - 9, cy - 3, 18, 9, true);
        const shift = (i % 2) * 2;
        disc(set, cx - 6, cy + 6 + shift, 2.5);
        disc(set, cx, cy + 6 - shift, 2.5);
        disc(set, cx + 6, cy + 6 + shift, 2.5);
        disc(set, cx - 4, cy - 3, 2.5);
        disc(set, cx + 4, cy - 3, 2.5);
      }, i, w, h),
  },
  {
    id: 'ball',
    name: 'Bola Memantul',
    category: 'game',
    frames: 48,
    fps: 12,
    description: 'Bola elastis memantul dengan gravitasi dan elastisitas.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        disc(set, 6 + tri(i, 48, w - 12), 5 + tri(i * 2 + 8, 32, h - 10), 4);
      }, i, w, h),
  },
  {
    id: 'space_invader',
    name: 'Alien Space Invader',
    category: 'game',
    frames: 24,
    fps: 8,
    description: 'Alien pixel art legendaris berbaris dan mengayunkan capit.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const posX = w / 2 + Math.sin((i / 24) * Math.PI * 2) * 6;
        const cy = h / 2;
        const f = i % 2;
        rect(set, posX - 8, cy - 4, 16, 8, true);
        disc(set, posX - 4, cy - 1, 1.5);
        disc(set, posX + 4, cy - 1, 1.5);
        line(set, posX - 6, cy - 4, posX - 9, cy - 8, 2);
        line(set, posX + 6, cy - 4, posX + 9, cy - 8, 2);
        if (f === 0) {
          line(set, posX - 6, cy + 4, posX - 9, cy + 9, 2);
          line(set, posX + 6, cy + 4, posX + 9, cy + 9, 2);
        } else {
          line(set, posX - 4, cy + 4, posX - 4, cy + 9, 2);
          line(set, posX + 4, cy + 4, posX + 4, cy + 9, 2);
        }
      }, i, w, h),
  },
  {
    id: 'sword_clash',
    name: 'Pertarungan Pedang',
    category: 'game',
    frames: 20,
    fps: 10,
    description: 'Dua bilah pedang beradu dengan kilatan percikan api.',
    frame: (i, w = AW, h = AH) =>
      build((set) => {
        const cx = w / 2;
        const cy = h / 2;
        const clash = tri(i, 20, 3);
        line(set, cx - 12 + clash, cy - 10, cx + 12 - clash, cy + 10, 2);
        line(set, cx + 12 - clash, cy - 10, cx - 12 + clash, cy + 10, 2);
        if (clash < 1) {
          disc(set, cx, cy, 3);
          line(set, cx - 5, cy, cx + 5, cy, 1);
          line(set, cx, cy - 5, cx, cy + 5, 1);
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
