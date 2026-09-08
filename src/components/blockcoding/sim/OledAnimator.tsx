// src/components/blockcoding/sim/OledAnimator.tsx
//
// Wokwi-Animator-style rack: click a card -> the animation plays on the sim OLED
// (onFrame) and streams to the real robot via DISPLAY_BITMAP (throttled to ~4.5 fps
// so 2 KB frames fit 115200 baud). Click again to stop. prefers-reduced-motion
// shows a single static frame.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useDrive } from '../../../hooks/useDrive';
import { OLED_ANIMS, AW, AH } from './oledAnimations';
import type { Bitmap } from './PixelEditor';

function toUrl(pixels: string): string {
  if (typeof document === 'undefined') return '';
  const cv = document.createElement('canvas');
  cv.width = AW;
  cv.height = AH;
  const cx = cv.getContext('2d');
  if (!cx) return '';
  const img = cx.createImageData(AW, AH);
  for (let i = 0; i < AW * AH; i++) {
    const o = i * 4;
    img.data[o] = 59; // #3BE8F5
    img.data[o + 1] = 232;
    img.data[o + 2] = 245;
    img.data[o + 3] = pixels[i] === '1' ? 255 : 0;
  }
  cx.putImageData(img, 0, 0);
  return cv.toDataURL();
}

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function OledAnimator({ onFrame }: { onFrame: (b: Bitmap | null) => void }) {
  const { sendCommand } = useDrive();
  const [playing, setPlaying] = useState<string | null>(null);
  const lastSend = useRef(0);

  // Static frame-0 previews (never change) — render once.
  const previews = useMemo(() => Object.fromEntries(OLED_ANIMS.map((a) => [a.id, toUrl(a.frame(0))])), []);

  useEffect(() => {
    if (!playing) return;
    const anim = OLED_ANIMS.find((a) => a.id === playing);
    if (!anim) return;
    let i = 0;
    const tick = () => {
      const pixels = anim.frame(i);
      onFrame({ w: AW, h: AH, pixels });
      const now = Date.now();
      if (now - lastSend.current >= 220) {
        lastSend.current = now;
        sendCommand('DISPLAY_BITMAP', { w: AW, h: AH, pixels }); // no-op if not connected
      }
      i++;
    };
    tick();
    if (reduced()) return; // one static frame, no animation
    const h = setInterval(tick, Math.round(1000 / anim.fps));
    return () => clearInterval(h);
  }, [playing, onFrame, sendCommand]);

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#cdd6e6' }}>
        Animasi OLED <em style={{ color: '#9DB0C9', fontWeight: 400 }}>— klik untuk mainkan di layar & robot</em>
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {OLED_ANIMS.map((a) => {
          const active = playing === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setPlaying(active ? null : a.id)}
              aria-pressed={active}
              aria-label={`${active ? 'Hentikan' : 'Mainkan'} animasi ${a.name}`}
              style={{
                display: 'grid',
                gap: 4,
                justifyItems: 'center',
                padding: 6,
                borderRadius: 8,
                border: `1px solid ${active ? '#8085F4' : '#ffffff22'}`,
                background: active ? 'rgba(129,133,244,0.22)' : 'rgba(255,255,255,0.04)',
                color: '#eaf6ff',
                cursor: 'pointer',
              }}
            >
              <img
                src={previews[a.id]}
                width={64}
                height={32}
                alt=""
                style={{ imageRendering: 'pixelated', background: '#050608', borderRadius: 4 }}
              />
              <span style={{ fontSize: 11, fontWeight: 700 }}>
                {active ? '■' : '▶'} {a.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
