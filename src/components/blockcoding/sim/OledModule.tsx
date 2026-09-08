// src/components/blockcoding/sim/OledModule.tsx
//
// Wokwi Animator Clone for 0.96" SSD1306 OLED Screen (128x64):
// Features:
// 1. Full Icons8/Wokwi-style categorized animated icons library (UI, WEB, SOCIAL, MEDIA, WEATHER, ECOMMERCE, EMOJI, GAME, KUSTOM)
// 2. Multi-resolution support: 32px, 48px, 64px, 128px
// 3. Live animated preview in the photorealistic 3D mint enclosure
// 4. "🧩 Pasang ke Block Code" -> Direct Blockly LCD sequence block insertion
// 5. "🚀 Kirim ke OLED" -> Live serial stream over DISPLAY_BITMAP to physical robot
// 6. Interactive 128x64 drawing canvas & classic templates (♥ Hati, 🎂 Birthday, 🎤 Hatsune Miku)

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDrive } from '../../../hooks/useDrive';
import {
  OLED_ANIMS,
  OLED_CATEGORIES,
  AW,
  AH,
  type OledCategory,
  getOledAnimsByCategory,
} from './oledAnimations';
import { insertLcdBlock } from '../../../templates/galleryBridge';
import type { BlockSpec } from '../../../templates/authoring';
import styles from './SimBoard.module.css';

export interface Bitmap {
  w: number;
  h: number;
  pixels: string;
}

export type OledSize = 32 | 48 | 64 | 128;

// Colors matched to the real 0.96" OLED module
const C = {
  casing: '#2FC49A',
  casingLight: '#4DE6BC',
  casingDark: '#1FA680',
  pcb: '#154284',
  pcbEdge: '#0C2A56',
  screen: '#05070C',
  on: '#38BDF8', // vivid OLED cyan-blue lit pixels
  off: '#05070C',
  screwHead: '#CBD5E1',
  screwSlot: '#475569',
  washer: '#94A3B8',
  flexGold: '#D97706',
  flexBlack: '#18181B',
  wires: [
    { core: '#2563EB', light: '#60A5FA', dark: '#1D4ED8' },
    { core: '#16A34A', light: '#4ADE80', dark: '#15803D' },
    { core: '#EAB308', light: '#FDE047', dark: '#CA8A04' },
    { core: '#EA580C', light: '#FB923C', dark: '#C2410C' },
  ],
} as const;

const W = 128;
const H = 64;

// ── Template builders (128x64 grid) ──
function blank(): Uint8Array {
  return new Uint8Array(W * H);
}

function fit(src: Uint8Array, sw: number, sh: number): Uint8Array {
  const out = new Uint8Array(W * H);
  const scale = Math.min(W / sw, H / sh);
  const dw = Math.floor(sw * scale);
  const dh = Math.floor(sh * scale);
  const ox = Math.floor((W - dw) / 2);
  const oy = Math.floor((H - dh) / 2);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = Math.floor(x / scale);
      const sy = Math.floor(y / scale);
      if (src[sy * sw + sx]) out[(oy + y) * W + (ox + x)] = 1;
    }
  }
  return out;
}

function fromStr(str: string, sw: number, sh: number): Uint8Array {
  const src = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) src[i] = str[i] === '1' ? 1 : 0;
  return fit(src, sw, sh);
}

const BRAILLE_DOT: [number, number][] = [
  [0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [0, 3], [1, 3],
];

function fromBraille(lines: string[]): Uint8Array {
  const cols = Math.max(...lines.map((l) => [...l].length));
  const dw = cols * 2;
  const dh = lines.length * 4;
  const src = new Uint8Array(dw * dh);
  lines.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      const code = (ch.codePointAt(0) ?? 0) - 0x2800;
      if (code < 0 || code > 0xff) return;
      for (let b = 0; b < 8; b++) {
        if (code & (1 << b)) {
          const [dx, dy] = BRAILLE_DOT[b];
          src[(r * 4 + dy) * dw + (c * 2 + dx)] = 1;
        }
      }
    });
  });
  return fit(src, dw, dh);
}

const HEART_16 =
  '0001100000011000001111000011110001111110011111100111111111111110001111111111110000011111111110000000011111100000000000011000000000';
const CAKE_16 =
  '0001000100010000000100010001000001111111111111001111111111111110111111111111111111111111111111111101101101101101111111111111111111';
const MIKU_BRAILLE = [
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠿⢿⣿⣿⣿⣿⣿⡿⠟⢛⣋⣩⣥⣤⣤⣤⣤⣍⣉⠛⠻⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⡿⠋⣠⣴⣶⡤⠈⣡⠌⢉⣥⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣤⡉⠛⢛⠛⠋⣡⣤⣉⠙⢿⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⡿⠋⣠⣾⣿⣿⠟⣡⠞⢁⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣌⠳⣄⠹⣿⣿⣷⣄⠙⢿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⠟⢁⣼⣿⣿⡿⠋⡴⢁⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⡈⢣⡈⢿⣿⣿⣷⣄⠻⣿⣿⣿⣿⣿',
  '⣿⡿⠃⣴⣿⣿⣿⡿⢁⠎⢠⣿⣿⣿⣿⣿⣿⣿⡟⣿⣿⣿⣿⣿⡟⣿⣿⣿⣿⣿⣿⣿⣿⢿⣿⣿⣿⣄⠹⡄⠹⣿⣿⣿⣦⡈⢿⣿⣿⣿',
  '⡟⢁⣾⣿⣿⣿⣿⣧⠈⣰⡟⣹⣿⣿⣿⣿⣿⣿⠃⢹⣿⣿⣿⣿⣷⠘⣿⣿⣿⣿⣿⣿⣿⣶⣝⢿⣿⣿⣆⠙⠀⣿⣿⣿⣿⣷⡄⠹⣿⣿',
  '⢠⣿⣿⣿⣿⣿⣿⠇⣰⡟⠀⣿⣿⣿⣿⣿⣿⡟⢠⠈⣿⣿⣿⣿⣿⡀⡈⢻⣿⣿⣿⣿⣿⣿⣿⣧⡈⠻⣿⡆⢸⣿⣿⣿⣿⣿⣿⣆⠙⣿',
  '⣿⣿⣿⣿⣿⣿⡟⢰⡟⠀⢸⣿⣿⣿⣿⣿⢣⡇⣼⣇⠸⣿⣿⣿⣿⣇⠹⣆⠙⢿⣿⣿⣿⣿⣿⣿⣿⡄⠙⢿⡄⢿⣿⣿⣿⣿⣿⣿⣧⠘',
  '⣿⣿⣿⣿⣿⣿⠁⡾⢠⡇⣸⣿⣿⣿⣿⡿⠈⠀⣿⣿⣆⠹⣿⣿⣿⣿⡄⢻⣧⣄⠹⣿⣿⣿⣿⣿⣿⣿⣄⠀⠁⢸⣿⣿⣿⣿⣿⣿⣿⣧',
  '⣿⣿⣿⣿⣿⣿⠠⠃⣾⡇⢻⣿⣿⣿⣿⡇⠀⢈⣭⣭⣽⣆⠘⢿⣿⣿⣷⡈⢿⣿⠇⠀⠙⢿⣿⣿⣿⣿⣿⡄⢠⠀⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⠀⢸⣿⠃⢸⣿⣿⣿⣿⠇⠇⠸⠿⠿⢿⣿⣷⣄⠙⢿⣿⣧⠈⠃⠀⠀⠀⡄⠙⠻⣿⣿⣿⣷⠈⣷⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⠀⣿⣿⠀⠈⣿⣿⣿⣿⠀⢰⣴⢡⠀⠀⠈⠹⣿⣷⣄⠙⠻⣷⡀⢢⣀⣠⠇⣿⣦⢈⠙⢿⣿⡇⢸⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣷⣿⣿⡆⣄⠹⣿⣿⣿⡄⠀⢻⡸⡄⠀⠀⡆⣿⣿⣿⣿⣦⣄⣉⠂⠉⢥⣾⣿⡟⢸⣿⣦⣈⠛⢸⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⢸⡄⠹⣿⣿⡇⢂⠹⣷⣜⣳⣟⣡⣿⣿⣿⣟⣿⣿⣿⣿⣶⣤⣽⡿⢁⣿⣿⣿⣿⠀⣾⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣇⠸⣿⣆⠙⣿⣧⠈⢧⡈⢿⣿⣿⣿⣿⣿⣿⡿⠿⠛⠛⠛⣿⣿⡿⠁⣾⣿⣿⣿⡟⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⣿⣿⣧⡈⠻⠀⣄⠙⠀⠙⠿⠟⠉⣟⠁⢀⣤⣴⡖⣸⣿⠏⣠⠀⣿⣿⣿⣿⠇⣸⣿⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⢸⣿⣿⣿⣦⣄⣻⣷⣦⣤⣤⣄⡘⠛⠷⢬⣭⣩⡴⠟⣁⣼⡿⠂⣠⣤⣉⠛⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠆⠐⣶⣤⣤⣴⣾⡿⢋⣤⡾⢋⣴⣌⠁⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿',
  '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠈⢻⣿⣿⣿⣿⣿⣿⣿⣿⠟⡡⣰⠀⣿⣿⣿⠿⢋⣴⠾⣋⣴⣿⡿⠃⣸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿',
];

const TEMPLATES: Record<string, () => Uint8Array> = {
  '— Pilih Template —': blank,
  '♥ Hati': () => fromStr(HEART_16, 16, 8),
  '🎂 Happy Birthday': () => fromStr(CAKE_16, 16, 8),
  '🎤 Hatsune Miku': () => fromBraille(MIKU_BRAILLE),
};

const BLANK_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function toPreviewUrl(pixels: string, w = AW, h = AH): string {
  if (typeof document === 'undefined') return BLANK_PIXEL;
  try {
    const cv = document.createElement('canvas');
    if (!cv || typeof cv.getContext !== 'function') return BLANK_PIXEL;
    const cx = cv.getContext('2d');
    if (!cx) return BLANK_PIXEL;
    cv.width = w;
    cv.height = h;
    const img = cx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      img.data[o] = 56;
      img.data[o + 1] = 189;
      img.data[o + 2] = 248;
      img.data[o + 3] = pixels[i] === '1' ? 255 : 0;
    }
    cx.putImageData(img, 0, 0);
    return cv.toDataURL();
  } catch {
    return BLANK_PIXEL;
  }
}

interface Props {
  text?: string;
  line2?: string;
  matrix?: boolean[];
  shape?: string | null;
  bitmap?: Bitmap | null;
  dimmed?: boolean;
  onBitmapChange?: (b: Bitmap | null) => void;
}

export default function OledModule({
  text,
  line2,
  matrix,
  shape,
  bitmap,
  dimmed,
  onBitmapChange,
}: Props) {
  const { sendCommand } = useDrive();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grid = useRef<Uint8Array>(new Uint8Array(W * H));
  const painting = useRef(false);
  const paintVal = useRef(1);

  // Wokwi Animator State
  const [activeCategory, setActiveCategory] = useState<OledCategory>('ui');
  const [selectedAnimId, setSelectedAnimId] = useState<string>('folder');
  const [selectedSize, setSelectedSize] = useState<OledSize>(64);
  const [selectedTemplate, setSelectedTemplate] = useState('— Pilih Template —');
  const [playing, setPlaying] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const lastSend = useRef(0);
  const hasDrawn = useRef(false);
  const frameRef = useRef(0);

  // Current active animation
  const currentAnim = useMemo(
    () => OLED_ANIMS.find((a) => a.id === selectedAnimId) || OLED_ANIMS[0],
    [selectedAnimId],
  );

  // Filtered animations based on category and search query
  const displayedAnims = useMemo(() => {
    if (activeCategory === 'custom') return [];
    let list = getOledAnimsByCategory(activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = OLED_ANIMS.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [activeCategory, searchQuery]);

  // Precomputed thumbnail previews for the active list
  const animThumbnails = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of OLED_ANIMS) {
      map[a.id] = toPreviewUrl(a.frame(0, AW, AH), AW, AH);
    }
    return map;
  }, []);

  const snapshot = (): Bitmap => {
    let s = '';
    for (let i = 0; i < W * H; i++) s += grid.current[i] ? '1' : '0';
    return { w: W, h: H, pixels: s };
  };

  const redrawCanvas = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = C.off;
    ctx.fillRect(0, 0, W, H);

    if (hasDrawn.current || activeCategory !== 'custom' || playing) {
      // Draw pixel grid
      ctx.fillStyle = C.on;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (grid.current[y * W + x]) ctx.fillRect(x, y, 1, 1);
        }
      }
    } else if (bitmap && bitmap.w > 0 && bitmap.h > 0) {
      ctx.fillStyle = C.on;
      for (let i = 0; i < bitmap.w * bitmap.h; i++) {
        if (bitmap.pixels[i] === '1') {
          const x = i % bitmap.w;
          const y = Math.floor(i / bitmap.w);
          ctx.fillRect(x, y, 1, 1);
        }
      }
    } else if (matrix && matrix.some(Boolean)) {
      ctx.fillStyle = C.on;
      for (let i = 0; i < 25; i++) {
        if (matrix[i]) {
          const mx = 24 + (i % 5) * 16;
          const my = 4 + Math.floor(i / 5) * 12;
          ctx.fillRect(mx, my, 12, 9);
        }
      }
    } else if (text || line2) {
      ctx.fillStyle = C.on;
      ctx.font = 'bold 16px monospace';
      ctx.fillText(text || 'Robotku', 6, 28);
      if (line2) {
        ctx.font = '13px monospace';
        ctx.fillText(line2.slice(0, 14), 6, 50);
      }
    } else {
      ctx.fillStyle = C.on;
      ctx.font = 'bold 15px monospace';
      ctx.fillText('Robotku OLED', 8, 36);
    }
  };

  useEffect(() => {
    redrawCanvas();
  }, [text, line2, matrix, shape, bitmap, playing, activeCategory]);

  // Main animation tick loop
  useEffect(() => {
    if (!playing || activeCategory === 'custom' || !currentAnim) return;

    let localFrame = frameRef.current;
    const tick = () => {
      // Generate frame bitmap
      const sw = selectedSize === 32 ? 32 : selectedSize === 48 ? 48 : AW;
      const sh = selectedSize === 32 ? 32 : selectedSize === 48 ? 48 : AH;
      const rawPixels = currentAnim.frame(localFrame, sw, sh);

      // Fit into 128x64 grid
      const pxArr = new Uint8Array(sw * sh);
      for (let k = 0; k < sw * sh; k++) pxArr[k] = rawPixels[k] === '1' ? 1 : 0;
      const fitted = fit(pxArr, sw, sh);
      grid.current = fitted;
      hasDrawn.current = true;
      redrawCanvas();

      // Mirror to schematic BoardSvg
      const b: Bitmap = { w: W, h: H, pixels: snapshot().pixels };
      onBitmapChange?.(b);

      // Throttle real serial transmission to ~4.5 fps
      const now = Date.now();
      if (now - lastSend.current >= 220) {
        lastSend.current = now;
        sendCommand('DISPLAY_BITMAP', { ...b });
      }

      localFrame = (localFrame + 1) % currentAnim.frames;
      frameRef.current = localFrame;
    };

    tick();
    const interval = setInterval(tick, Math.round(1000 / (currentAnim.fps || 12)));
    return () => clearInterval(interval);
  }, [playing, activeCategory, currentAnim, selectedSize, onBitmapChange, sendCommand]);

  // Pointer event handlers for drawing pixels directly
  const getCell = (e: React.PointerEvent): number | null => {
    const cv = canvasRef.current;
    if (!cv) return null;
    const rectCv = cv.getBoundingClientRect();
    const cx = Math.floor(((e.clientX - rectCv.left) / rectCv.width) * W);
    const cy = Math.floor(((e.clientY - rectCv.top) / rectCv.height) * H);
    if (cx < 0 || cx >= W || cy < 0 || cy >= H) return null;
    return cy * W + cx;
  };

  const paintPixel = (e: React.PointerEvent) => {
    const i = getCell(e);
    if (i == null || grid.current[i] === paintVal.current) return;
    grid.current[i] = paintVal.current;
    hasDrawn.current = true;
    redrawCanvas();
  };

  // Selection handlers
  const handleSelectAnim = (animId: string) => {
    setSelectedAnimId(animId);
    setPlaying(true);
    hasDrawn.current = false;
    frameRef.current = 0;
    setSelectedTemplate('— Pilih Template —');
  };

  const handleTemplateChange = (tmplKey: string) => {
    setSelectedTemplate(tmplKey);
    setPlaying(false);
    if (tmplKey === '— Pilih Template —') {
      grid.current = blank();
      hasDrawn.current = false;
      redrawCanvas();
      onBitmapChange?.(null);
      return;
    }
    const builder = TEMPLATES[tmplKey];
    if (builder) {
      grid.current = builder();
      hasDrawn.current = true;
      redrawCanvas();
      const b = snapshot();
      onBitmapChange?.(b);
      sendCommand('DISPLAY_BITMAP', { ...b });
    }
  };

  const handleClear = () => {
    grid.current = blank();
    hasDrawn.current = false;
    setPlaying(false);
    setSelectedTemplate('— Pilih Template —');
    redrawCanvas();
    onBitmapChange?.(null);
  };

  const handleInsertToBlockly = () => {
    if (activeCategory !== 'custom' && currentAnim) {
      if (currentAnim.toBlockSpec) {
        insertLcdBlock(currentAnim.toBlockSpec());
      } else {
        const spec: BlockSpec[] = [
          {
            type: 'controls_repeat_ext',
            inputs: { TIMES: 3 },
            statements: {
              DO: [
                { type: 'lcd_text', fields: { TEXT: currentAnim.name.slice(0, 16) }, inputs: { DURATION: 1 } },
                { type: 'lcd_shape', fields: { SHAPE: 'star' }, inputs: { DURATION: 0.6 } },
                { type: 'lcd_clear' },
              ],
            },
          },
        ];
        insertLcdBlock(spec);
      }
    } else {
      const title = selectedTemplate !== '— Pilih Template —' ? selectedTemplate : 'Pixel Art';
      const spec: BlockSpec[] = [
        { type: 'lcd_text', fields: { TEXT: title.slice(0, 16) }, inputs: { DURATION: 2 } },
      ];
      insertLcdBlock(spec);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12, opacity: dimmed ? 0.5 : 1 }}>
      {/* ── Wokwi Animator Header & Breadcrumbs ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          padding: '8px 12px',
          background: '#ffffff',
          borderRadius: 8,
          border: '1px solid #e0e3ff',
          boxShadow: '0 1px 3px rgba(27,24,64,0.04)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#1e1b4b', letterSpacing: '-0.01em' }}>
              Wokwi Animator
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: 999,
                background: '#e0e7ff',
                color: '#4338ca',
              }}
            >
              {'SSD1306 0.96"'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: '#6b7194' }}>
            Buat & pasang animasi OLED untuk Arduino & Robotku
          </p>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#4338ca' }}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#4f46e5',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              1
            </span>
            Pilih Animasi
          </span>
          <span style={{ color: '#c6caff' }}>➔</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6b7194' }}>
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#e0e3ff',
                color: '#6b7194',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 900,
              }}
            >
              2
            </span>
            Pasang Blok Kode
          </span>
        </div>
      </div>

      {/* ── Main Animator Layout (Catalogue + Live Preview) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 14,
          alignItems: 'stretch',
        }}
      >
        {/* ── Left Column: Icon Catalogue & Categories ── */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 8,
            border: '1px solid #e0e3ff',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            boxShadow: '0 1px 3px rgba(27,24,64,0.03)',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Header Row: Title & Size Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#1e1b4b' }}>
              Pustaka Animasi Icons8
            </span>

            {/* Size Selector: 32, 48, 64, 128 */}
            <div style={{ display: 'flex', gap: 3, background: '#f1f3ff', padding: 2, borderRadius: 6 }}>
              {([32, 48, 64, 128] as OledSize[]).map((sz) => {
                const active = selectedSize === sz;
                return (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    style={{
                      border: 'none',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '3px 7px',
                      borderRadius: 4,
                      background: active ? '#ffffff' : 'transparent',
                      color: active ? '#4338ca' : '#6b7194',
                      cursor: 'pointer',
                      boxShadow: active ? '0 1px 2px rgba(27,24,64,0.08)' : 'none',
                    }}
                  >
                    {sz}px
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Tabs Bar (Icons8 / Wokwi styled) */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              overflowX: 'auto',
              paddingBottom: 4,
              borderBottom: '1px solid #e0e3ff',
              scrollbarWidth: 'thin',
            }}
          >
            {OLED_CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSearchQuery('');
                  }}
                  style={{
                    border: 'none',
                    background: 'none',
                    padding: '5px 8px',
                    fontSize: 11,
                    fontWeight: active ? 800 : 600,
                    color: active ? '#2563eb' : '#6b7194',
                    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          {activeCategory !== 'custom' && (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 Cari animasi (folder, baterai, wifi, dll)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  fontSize: 11,
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid #c6caff',
                  background: '#fcfdff',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Icons Grid */}
          {activeCategory !== 'custom' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 6,
                alignContent: 'start',
                gridAutoRows: 'max-content',
                flex: 1,
                minHeight: 280,
                maxHeight: 340,
                overflowY: 'auto',
                padding: 2,
                scrollbarWidth: 'thin',
              }}
            >
              {displayedAnims.map((anim) => {
                const isSelected = selectedAnimId === anim.id;
                return (
                  <button
                    key={anim.id}
                    onClick={() => handleSelectAnim(anim.id)}
                    aria-label={`Pilih animasi ${anim.name}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      padding: '6px 4px',
                      borderRadius: 8,
                      border: isSelected ? '2px solid #2563eb' : '1px solid #e0e3ff',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 2px 6px rgba(37,99,235,0.15)' : 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <img
                      src={animThumbnails[anim.id] || BLANK_PIXEL}
                      width={44}
                      height={22}
                      alt={anim.name}
                      style={{
                        imageRendering: 'pixelated',
                        background: '#05070C',
                        borderRadius: 3,
                        display: 'block',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: isSelected ? 800 : 600,
                        color: isSelected ? '#1d4ed8' : '#334155',
                        textAlign: 'center',
                        lineHeight: 1.15,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        width: '100%',
                      }}
                    >
                      {anim.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Custom / Drawing Mode */
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1e1b4b' }}>Template Klasik:</span>
                <select
                  aria-label="Pilih template klasik"
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 6px',
                    borderRadius: 6,
                    border: '1px solid #c6caff',
                    background: '#ffffff',
                    color: '#1b1840',
                    cursor: 'pointer',
                  }}
                >
                  {Object.keys(TEMPLATES).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <p style={{ margin: 0, fontSize: 10.5, color: '#6b7194', lineHeight: 1.4 }}>
                💡 <em>Sentuh atau klik layar OLED di sebelah kanan untuk menggambar piksel bebas!</em>
              </p>
            </div>
          )}

          {/* Helper caption */}
          <div style={{ marginTop: 'auto', paddingTop: 6, fontSize: 10, color: '#8e94b8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{displayedAnims.length} animasi tersedia</span>
            <span style={{ fontWeight: 700, color: '#4f46e5' }}>{selectedSize}x{selectedSize === 128 ? 64 : selectedSize === 64 ? 32 : selectedSize} px</span>
          </div>
        </div>

        {/* ── Right Column: Live OLED Module & Action Buttons ── */}
        <div style={{ display: 'grid', gap: 10 }}>
          {/* Top Label & Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>Preview</span>
              {currentAnim && activeCategory !== 'custom' && (
                <span style={{ fontSize: 10.5, fontWeight: 600, color: '#4338ca' }}>
                  ({currentAnim.name})
                </span>
              )}
            </span>

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => setPlaying(!playing)}
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: 5,
                  border: '1px solid #c6caff',
                  background: '#ffffff',
                  color: '#4338ca',
                  cursor: 'pointer',
                }}
              >
                {playing ? '⏸ Jeda' : '▶ Putar'}
              </button>
              <button
                onClick={handleClear}
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: 5,
                  border: '1px solid #e0e3ff',
                  background: '#ffffff',
                  color: '#6b7194',
                  cursor: 'pointer',
                }}
              >
                🧹 Bersihkan
              </button>
            </div>
          </div>

          {/* ── Realistic Mint OLED Frame with Interactive Screen Canvas ── */}
          <div style={{ position: 'relative', width: '100%', maxWidth: 360, margin: '0 auto' }}>
            <svg
              viewBox="0 0 160 134"
              role="img"
              aria-label="Modul layar OLED 0.96 inci"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            >
              <defs>
                <linearGradient id="oledCaseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.casingLight} />
                  <stop offset="30%" stopColor={C.casing} />
                  <stop offset="100%" stopColor={C.casingDark} />
                </linearGradient>
                <radialGradient id="oledScrewGrad" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="50%" stopColor={C.screwHead} />
                  <stop offset="100%" stopColor="#64748B" />
                </radialGradient>
              </defs>

              {/* Top Rainbow Ribbon Cable */}
              {C.wires.map((wire, i) => {
                const x = 65 + i * 10;
                const d = `M ${x} 18 C ${x} 8, ${x + 6} 2, ${x + 10} 0`;
                return (
                  <g key={`cable-in-${i}`}>
                    <path d={d} fill="none" stroke={wire.dark} strokeWidth={4.4} strokeLinecap="round" />
                    <path d={d} fill="none" stroke={wire.core} strokeWidth={3.6} strokeLinecap="round" />
                    <path d={d} fill="none" stroke={wire.light} strokeWidth={1.2} strokeLinecap="round" opacity={0.85} />
                    <path
                      d={d}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeDasharray="3 8"
                      className={styles.wireFlow}
                      opacity={0.8}
                    />
                  </g>
                );
              })}

              {/* Mint/Toska 3D Outer Frame */}
              <rect x={6} y={12} width={148} height={118} rx={14} fill="url(#oledCaseGrad)" />
              <rect x={40} y={10} width={80} height={4} rx={2} fill="#0F172A" opacity={0.2} />
              <rect x={40} y={126} width={80} height={4} rx={2} fill="#0F172A" opacity={0.2} />

              {/* Navy PCB Base */}
              <rect x={14} y={18} width={132} height={106} rx={6} fill={C.pcb} stroke={C.pcbEdge} strokeWidth={1.5} />

              {/* 4 Corner Screws */}
              <circle cx={24} cy={28} r={5.5} fill={C.washer} stroke="#64748B" strokeWidth={0.8} />
              <circle cx={24} cy={28} r={3.5} fill="#475569" />
              <circle cx={136} cy={28} r={6.5} fill={C.washer} stroke="#64748B" strokeWidth={0.8} />
              <circle cx={136} cy={28} r={4.5} fill="url(#oledScrewGrad)" />
              <line x1={133} y1={28} x2={139} y2={28} stroke={C.screwSlot} strokeWidth={1} strokeLinecap="round" />
              <line x1={136} y1={25} x2={136} y2={31} stroke={C.screwSlot} strokeWidth={1} strokeLinecap="round" />
              <circle cx={24} cy={114} r={6.5} fill={C.washer} stroke="#64748B" strokeWidth={0.8} />
              <circle cx={24} cy={114} r={4.5} fill="url(#oledScrewGrad)" />
              <line x1={21} y1={114} x2={27} y2={114} stroke={C.screwSlot} strokeWidth={1} strokeLinecap="round" />
              <line x1={24} y1={111} x2={24} y2={117} stroke={C.screwSlot} strokeWidth={1} strokeLinecap="round" />
              <circle cx={136} cy={114} r={5.5} fill={C.washer} stroke="#64748B" strokeWidth={0.8} />
              <circle cx={136} cy={114} r={3.5} fill="#475569" />

              {/* Top Solder Pads & Exact Silkscreen: "1 GND VDD SCK SDA 4" */}
              {[65, 75, 85, 95].map((px) => (
                <g key={`solder-${px}`}>
                  <circle cx={px} cy={18} r={3} fill="#E2E8F0" stroke="#94A3B8" strokeWidth={0.8} />
                  <circle cx={px} cy={18} r={1.4} fill="#64748B" />
                </g>
              ))}
              <text x={48} y={29} fontSize={5.5} fontWeight={900} fill="#FFFFFF">1</text>
              <text x={65} y={29} textAnchor="middle" fontSize={4.8} fontWeight={800} fill="#FFFFFF">GND</text>
              <text x={75} y={29} textAnchor="middle" fontSize={4.8} fontWeight={800} fill="#FFFFFF">VDD</text>
              <text x={85} y={29} textAnchor="middle" fontSize={4.8} fontWeight={800} fill="#FFFFFF">SCK</text>
              <text x={95} y={29} textAnchor="middle" fontSize={4.8} fontWeight={800} fill="#FFFFFF">SDA</text>
              <text x={112} y={29} fontSize={5.5} fontWeight={900} fill="#FFFFFF">4</text>

              {/* Deep Obsidian OLED Screen Glass */}
              <rect x={20} y={35} width={120} height={66} rx={3} fill={C.screen} stroke="#090F1A" strokeWidth={1.5} />
              {text && (
                <text x={28} y={72} fontSize={14} fontFamily="monospace" fontWeight={700} fill={C.on} opacity={0.01}>
                  {text}
                </text>
              )}

              {/* Bottom Amber Flex Tab & Support Clamp */}
              <rect x={55} y={98} width={50} height={16} fill={C.flexGold} opacity={0.85} />
              <line x1={65} y1={98} x2={65} y2={114} stroke="#B45309" strokeWidth={1} />
              <line x1={75} y1={98} x2={75} y2={114} stroke="#B45309" strokeWidth={1} />
              <line x1={85} y1={98} x2={85} y2={114} stroke="#B45309" strokeWidth={1} />
              <line x1={95} y1={98} x2={95} y2={114} stroke="#B45309" strokeWidth={1} />
              <rect x={50} y={102} width={60} height={12} rx={2} fill={C.flexBlack} stroke="#27272A" strokeWidth={0.8} />
            </svg>

            {/* ── Interactive 128x64 OLED Pixel Canvas Overlay ── */}
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              aria-label="Layar OLED interaktif 128x64"
              onPointerDown={(e) => {
                e.preventDefault();
                setPlaying(false);
                const i = getCell(e);
                if (i == null) return;
                painting.current = true;
                paintVal.current = grid.current[i] ? 0 : 1;
                paintPixel(e);
              }}
              onPointerMove={(e) => painting.current && paintPixel(e)}
              onPointerUp={() => {
                if (painting.current) {
                  const b = snapshot();
                  onBitmapChange?.(b);
                  sendCommand('DISPLAY_BITMAP', { ...b });
                }
                painting.current = false;
              }}
              onPointerLeave={() => {
                if (painting.current) {
                  const b = snapshot();
                  onBitmapChange?.(b);
                  sendCommand('DISPLAY_BITMAP', { ...b });
                }
                painting.current = false;
              }}
              style={{
                position: 'absolute',
                left: '13%',
                top: '26.8%',
                width: '74%',
                height: '47.8%',
                imageRendering: 'pixelated',
                borderRadius: 3,
                touchAction: 'none',
                cursor: 'crosshair',
                display: 'block',
              }}
            />
          </div>

          {/* ── Primary Action Button ── */}
          <button
            onClick={handleInsertToBlockly}
            style={{
              width: '100%',
              fontSize: 12.5,
              fontWeight: 800,
              padding: '9px 12px',
              borderRadius: 8,
              border: '1px solid #16a34a',
              background: '#22c55e',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              boxShadow: '0 2px 4px rgba(22,163,74,0.2)',
              transition: 'transform 0.1s ease',
            }}
          >
            <span>🧩</span>
            <span>Pasang ke Blok Kode</span>
          </button>
        </div>
      </div>
    </div>
  );
}



