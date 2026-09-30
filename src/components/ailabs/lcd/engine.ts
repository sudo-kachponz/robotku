// src/components/ailabs/lcd/engine.ts
//
// LCD pixel engine — ported 1:1 from mametchi-monitor.html (§1: pertahankan mesin
// gambar piksel; kalau butuh huruf, perluas mini-font yang sudah ada). Canvas-only,
// zero DOM. All drawing goes through px(); everything on the 128x128 screen is pixels.

import { MAME, PET_COLORS, type Mood } from './sprites';

export const INK = 'rgba(40,52,64,.92)';
export const INK2 = 'rgba(40,52,64,.45)';

// 7-segment table: a b c d e f g
const SEG: Record<string, number[]> = {
  '0': [1, 1, 1, 1, 1, 1, 0], '1': [0, 1, 1, 0, 0, 0, 0], '2': [1, 1, 0, 1, 1, 0, 1], '3': [1, 1, 1, 1, 0, 0, 1],
  '4': [0, 1, 1, 0, 0, 1, 1], '5': [1, 0, 1, 1, 0, 1, 1], '6': [1, 0, 1, 1, 1, 1, 1], '7': [1, 1, 1, 0, 0, 0, 0],
  '8': [1, 1, 1, 1, 1, 1, 1], '9': [1, 1, 1, 1, 0, 1, 1], '-': [0, 0, 0, 0, 0, 0, 1], ' ': [0, 0, 0, 0, 0, 0, 0],
};

// mini font 3x5 (15 bits, row-major)
const F35: Record<string, string> = {
  A: '111101111101101', B: '110101110101110', C: '111100100100111', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '111100101101111', H: '101101111101101',
  I: '111010010010111', J: '001001001101111', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '101111111111101', O: '111101101101111', P: '111101111100100',
  Q: '111101101111011', R: '111101110101101', S: '111100111001111', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101111010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111',
  '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
  '%': '101001010100101', '/': '001001010100100', ':': '000010000010000', '.': '000000000000010',
  '-': '000000111000000', ' ': '000000000000000', '!': '010010010000010', '?': '110001010000010',
};

export const PETW = 28;
export const PETH = 32;

export class Lcd {
  readonly ctx: CanvasRenderingContext2D;
  readonly W: number;
  readonly H: number;

  constructor(ctx: CanvasRenderingContext2D, w: number, h: number) {
    this.ctx = ctx;
    this.W = w;
    this.H = h;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.W, this.H);
  }

  px(x: number, y: number, w: number, h: number, c?: string): void {
    this.ctx.fillStyle = c || INK;
    this.ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  // s = tebal segmen (skala). Returns the digit width.
  seg7(x: number, y: number, ch: string, s: number, col?: string): number {
    const g = SEG[ch] || SEG[' '];
    const w = s * 5, h = s * 9, t = s;
    const c = col || INK;
    if (g[0]) this.px(x + t, y, w - 2 * t, t, c); // a atas
    if (g[1]) this.px(x + w - t, y + t, t, h / 2 - 1.5 * t, c); // b kanan atas
    if (g[2]) this.px(x + w - t, y + h / 2 + 0.5 * t, t, h / 2 - 1.5 * t, c); // c kanan bawah
    if (g[3]) this.px(x + t, y + h - t, w - 2 * t, t, c); // d bawah
    if (g[4]) this.px(x, y + h / 2 + 0.5 * t, t, h / 2 - 1.5 * t, c); // e kiri bawah
    if (g[5]) this.px(x, y + t, t, h / 2 - 1.5 * t, c); // f kiri atas
    if (g[6]) this.px(x + t, y + h / 2 - 0.5 * t, w - 2 * t, t, c); // g tengah
    return w;
  }

  seg7text(x: number, y: number, str: string, s: number, gap: number, col?: string): number {
    let cx = x;
    for (const ch of str) {
      if (ch === ':') {
        this.px(cx + s, y + s * 2.5, s, s, col);
        this.px(cx + s, y + s * 6, s, s, col);
        cx += s * 3 + gap;
        continue;
      }
      cx += this.seg7(cx, y, ch, s, col) + gap;
    }
    return cx - x - gap;
  }

  mini(x: number, y: number, str: string, col?: string, scale?: number): number {
    const s = scale || 1;
    let cx = x;
    for (const ch of String(str).toUpperCase()) {
      const g = F35[ch];
      if (g) {
        for (let i = 0; i < 15; i++) {
          if (g[i] === '1') this.px(cx + (i % 3) * s, y + ((i / 3) | 0) * s, s, s, col || INK);
        }
      }
      cx += 4 * s;
    }
    return cx - x;
  }

  miniW(str: string, scale?: number): number {
    return String(str).length * 4 * (scale || 1);
  }

  miniCenter(y: number, str: string, col?: string, scale?: number): void {
    this.mini(((this.W - this.miniW(str, scale)) / 2) | 0, y, str, col, scale);
  }

  // small dot-matrix progress bar
  bar(x: number, y: number, w: number, h: number, pct: number, label: string): void {
    this.mini(x, y + 1, label, INK, 1);
    const bx = x + 18, bw = w - 18;
    this.px(bx, y, bw, h, 'rgba(40,52,64,.16)');
    const fill = Math.round((bw * Math.max(0, Math.min(100, pct))) / 100);
    for (let i = 0; i < fill; i += 2) this.px(bx + i, y, 1.4, h, INK);
    this.px(bx, y, 1, h, INK2);
    this.px(bx + bw - 1, y, 1, h, INK2);
  }

  // faint dot frame so it reads like an LCD panel
  drawBackdrop(): void {
    for (let y = 2; y < this.H; y += 4) for (let x = 2; x < this.W; x += 4) this.px(x, y, 1, 1, 'rgba(40,52,64,.05)');
  }

  // header/footer chrome: brand label + RUN/ECO + battery + date/time
  drawChrome(powerSave: boolean, brand = 'FIRA'): void {
    const d = new Date();
    const hh = d.getHours(), h12 = ((hh + 11) % 12) + 1;
    const tgl =
      d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0');
    this.mini(4, 4, brand, INK, 1);
    this.mini(this.W - 4 - this.miniW(powerSave ? 'ECO' : 'RUN', 1), 4, powerSave ? 'ECO' : 'RUN', INK, 1);
    // ikon baterai kecil
    this.px(this.W - 30, 4, 10, 5, INK2);
    this.px(this.W - 20, 5.5, 1.5, 2, INK2);
    this.px(this.W - 29, 5, powerSave ? 4 : 8, 3, INK);
    this.mini(4, this.H - 8, tgl, INK2, 1);
    const jam = String(h12).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + (hh < 12 ? ' AM' : ' PM');
    this.mini(this.W - 4 - this.miniW(jam, 1), this.H - 8, jam, INK2, 1);
  }

  drawPet(ox: number, oy: number, s: number, m: Mood, f: number): void {
    const g = (MAME[m] || MAME.ok)[f % 2];
    for (let y = 0; y < g.length; y++) {
      const row = g[y];
      for (let x = 0; x < row.length; x++) {
        const c = row[x];
        if (c === 'N') this.px(ox + x * s, oy + y * s, s, s, PET_COLORS.C_B);
        else if (c === 'Y') this.px(ox + x * s, oy + y * s, s, s, PET_COLORS.C_Y);
        else if (c === 'L') this.px(ox + x * s, oy + y * s, s, s, PET_COLORS.C_L);
        else if (c === 'W') this.px(ox + x * s, oy + y * s, s, s, PET_COLORS.C_W);
        else if (c === 'P') this.px(ox + x * s, oy + y * s, s, s, PET_COLORS.C_P);
      }
    }
  }
}
