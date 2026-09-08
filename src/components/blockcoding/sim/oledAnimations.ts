// src/components/blockcoding/sim/oledAnimations.ts
//
// Wokwi-Animator-style OLED animations. Each is a pure function frame(i) -> a
// W*H '0'/'1' bitmap string, the SAME format DISPLAY_BITMAP already takes. Authored
// at 64x32 (not the full 128x64) on purpose: the firmware scales a bitmap to fill
// the screen, and 64x32 = 2048 chars/frame streams ~4x faster over 115200 baud.
// ponytail: programmatic frames, not hand-drawn sprite sheets — swap in real sprites
// only if a designer hands us pixel art.

export const AW = 64;
export const AH = 32;

type Draw = (set: (x: number, y: number) => void, i: number) => void;

function build(draw: Draw, i: number): string {
  const px = new Uint8Array(AW * AH);
  const set = (x: number, y: number) => {
    const xr = Math.round(x);
    const yr = Math.round(y);
    if (xr >= 0 && xr < AW && yr >= 0 && yr < AH) px[yr * AW + xr] = 1;
  };
  draw(set, i);
  let s = '';
  for (let k = 0; k < px.length; k++) s += px[k] ? '1' : '0';
  return s;
}

function disc(set: (x: number, y: number) => void, cx: number, cy: number, r: number): void {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) set(cx + x, cy + y);
}
// Triangle wave 0..range..0 with the given period — a bounce with no easing libs.
function tri(i: number, period: number, range: number): number {
  const p = ((i % period) + period) % period;
  const half = period / 2;
  return (p < half ? p / half : (period - p) / half) * range;
}

export interface OledAnim {
  id: string;
  name: string;
  frames: number; // loop length
  fps: number;
  frame: (i: number) => string;
}

export const OLED_ANIMS: OledAnim[] = [
  {
    id: 'ball',
    name: 'Bola Memantul',
    frames: 48,
    fps: 12,
    frame: (i) => build((set) => disc(set, 6 + tri(i, 48, AW - 12), 5 + tri(i * 2 + 8, 32, AH - 10), 4), i),
  },
  {
    id: 'eyes',
    name: 'Mata Berkedip',
    frames: 40,
    fps: 10,
    frame: (i) =>
      build((set) => {
        const blink = i % 40 >= 36; // shut for the last 4 frames of the loop
        for (const cx of [AW / 2 - 12, AW / 2 + 12]) {
          if (blink) for (let x = -7; x <= 7; x++) set(cx + x, AH / 2); // eyelid line
          else disc(set, cx, AH / 2, 7);
        }
      }, i),
  },
  {
    id: 'heart',
    name: 'Hati Berdenyut',
    frames: 30,
    fps: 12,
    frame: (i) =>
      build((set) => {
        const s = 5 + Math.round(tri(i, 30, 3)); // pulse size
        const cx = AW / 2;
        const cy = AH / 2 - 2;
        disc(set, cx - s, cy, s); // two lobes...
        disc(set, cx + s, cy, s);
        for (let y = 0; y <= s * 2; y++) {
          const w = s * 2 - y; // ...into a point
          for (let x = -w; x <= w; x++) set(cx + x, cy + y);
        }
      }, i),
  },
  {
    id: 'load',
    name: 'Loading',
    frames: 24,
    fps: 12,
    frame: (i) =>
      build((set) => {
        for (let d = 0; d < 8; d++) {
          const a = (d / 8) * Math.PI * 2;
          const lead = (i % 24) / 24; // brightest dot sweeps around
          const on = ((d / 8 - lead + 1) % 1) < 0.55;
          if (on) disc(set, AW / 2 + Math.cos(a) * 11, AH / 2 + Math.sin(a) * 11, 2);
        }
      }, i),
  },
];
