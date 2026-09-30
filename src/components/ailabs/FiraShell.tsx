// src/components/ailabs/FiraShell.tsx
//
// AI Labs "Fira" — cangkang Tamagotchi (CSS 3D) + layar canvas 128x128, di-port dari
// mametchi-monitor.html (docs/AI-LABS.md §1/§4). Step 3: tahap 0 (TELUR + menetas)
// dan tahap 1 (DENGAR: VU mic + tepuk), plus mode WAJAH/JAM. Semua isi layar =
// piksel canvas. Client-only: canvas + requestAnimationFrame + getUserMedia.

import { useEffect, useRef } from 'react';
import { Lcd, INK, INK2, PETW } from './lcd/engine';
import { PET_COLORS, type Mood } from './lcd/sprites';
import {
  loadProgress,
  saveProgress,
  resetProgress,
  CLAPS_TO_ADVANCE,
  type Progress,
} from '../../ailabs/stages';
import { MicListener, playHatchCue } from '../../ailabs/mic';
import styles from './FiraShell.module.css';

type FiraMode = 'wajah' | 'dengar' | 'jam';
const MODES: FiraMode[] = ['wajah', 'dengar', 'jam'];

export default function FiraShell() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  // Loop-read state in refs so button clicks never re-render — canvas is the output.
  const progressRef = useRef<Progress>({ stage: 0, claps: 0, phrases: 0, transcripts: 0, convos: 0, name: 'Fira', createdAt: 0 });
  const modeRef = useRef<FiraMode>('wajah');
  const powerSaveRef = useRef(false);
  const flashRef = useRef(0);
  const tickRef = useRef(0);
  const micRef = useRef<MicListener | null>(null);
  const vuRef = useRef(0);
  const justClappedRef = useRef(0);

  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const lcd = new Lcd(ctx, canvas.width, canvas.height);
    const { W, H } = lcd;
    const C_B = PET_COLORS.C_B;

    progressRef.current = loadProgress();

    const mic = new MicListener();
    micRef.current = mic;
    mic.onClap = () => {
      const p = progressRef.current;
      if (p.stage !== 1) return; // hanya dihitung di tahap DENGAR
      p.claps = Math.min(CLAPS_TO_ADVANCE, p.claps + 1);
      justClappedRef.current = now();
      if (p.claps >= CLAPS_TO_ADVANCE) {
        p.stage = 2; // naik ke BICARA (view-nya masih terkunci sampai step berikut)
        flashRef.current = 10;
      }
      saveProgress(p);
    };

    // --- egg (tahap 0), speckled + wobble ---
    function drawEgg() {
      const cx = ((W / 2) | 0) + Math.round(2 * Math.sin(tickRef.current / 12));
      const cy = 56, rx = 15, ry = 20;
      for (let dy = -ry; dy <= ry; dy++) {
        const k = 1 - (dy * dy) / (ry * ry);
        if (k < 0) continue;
        const w = Math.round(rx * Math.sqrt(k) * (dy < -6 ? 0.9 : 1)); // sedikit runcing di atas
        for (let dx = -w; dx <= w; dx++) {
          const edge = dx <= -w + 1 || dx >= w - 1;
          lcd.px(cx + dx, cy + dy, 1, 1, edge ? C_B : '#FAF0C9');
        }
      }
      lcd.px(cx - 6, cy - 4, 3, 3, PET_COLORS.C_P);
      lcd.px(cx + 4, cy + 2, 3, 3, PET_COLORS.C_L);
      lcd.px(cx - 2, cy + 8, 2, 2, PET_COLORS.C_P);
      lcd.px(cx - 8, cy - 12, 4, 3, '#FFFFFF');
    }

    function viewTelur() {
      lcd.miniCenter(8, 'TAHAP 0 TELUR', INK2, 1);
      drawEgg();
      lcd.miniCenter(H - 26, 'ATAU TEPUK', INK2, 1);
      if (((tickRef.current / 30) | 0) % 2 === 0) lcd.miniCenter(H - 16, 'TEKAN TENGAH', INK, 1);
    }

    function viewWajah() {
      const m: Mood = powerSaveRef.current ? 'sleep' : 'ok';
      const f = ((tickRef.current / 26) | 0) % 2;
      lcd.drawPet(((W - PETW * 2) / 2) | 0, 12, 2, m, f);
      lcd.miniCenter(78, m === 'sleep' ? 'ZZZ...' : 'SIAP', C_B, 2);
      if (m === 'sleep') {
        lcd.mini(W - 18, 28, 'Z', C_B, 1);
        lcd.mini(W - 13, 20, 'Z', C_B, 2);
      }
    }

    function viewDengar() {
      lcd.miniCenter(16, 'DENGAR', INK, 2);
      const st = mic.state;
      if (st === 'active') {
        const lvl = mic.level();
        vuRef.current = vuRef.current * 0.6 + lvl * 0.4;
        lcd.bar(10, 40, W - 20, 8, Math.min(100, vuRef.current * 160), 'VU');
        const claps = Math.min(progressRef.current.claps, CLAPS_TO_ADVANCE);
        for (let i = 0; i < CLAPS_TO_ADVANCE; i++) {
          const dx = 26 + i * 16;
          if (i < claps) lcd.px(dx, 58, 5, 5, C_B);
          else {
            lcd.px(dx, 58, 5, 5, 'rgba(40,52,64,.16)');
            lcd.px(dx, 58, 1, 5, INK2);
            lcd.px(dx + 4, 58, 1, 5, INK2);
          }
        }
        lcd.miniCenter(70, 'TEPUK ' + claps + '/' + CLAPS_TO_ADVANCE, INK, 1);
        const reacting = now() - justClappedRef.current < 400;
        lcd.miniCenter(88, reacting ? 'TEPUK!' : 'DENGARKAN', reacting ? C_B : INK2, 2);
      } else {
        const msg =
          st === 'unsupported' ? 'MIC TAK ADA' : st === 'denied' ? 'IZIN DITOLAK' : 'IZINKAN MIC';
        lcd.miniCenter(48, msg, INK, 1);
        if (st === 'idle' || st === 'denied') lcd.miniCenter(64, 'TEKAN KANAN', INK2, 1);
      }
    }

    function viewJam() {
      const d = new Date();
      const h12 = ((d.getHours() + 11) % 12) + 1;
      const t = String(h12).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      const w = lcd.seg7text(0, 0, t, 3, 4, 'rgba(0,0,0,0)'); // measure (invisible)
      lcd.mini(5, 5, powerSaveRef.current ? 'ECO' : 'RUN', INK2, 1);
      lcd.seg7text(((W - w) / 2) | 0, 14, t, 3, 4);
      const tgl =
        d.getFullYear() +
        '/' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '/' +
        String(d.getDate()).padStart(2, '0') +
        (d.getHours() < 12 ? ' AM' : ' PM');
      lcd.miniCenter(46, tgl, INK2, 1);
      lcd.miniCenter(56, 'FIRA', C_B, 2);
      lcd.drawPet(((W - PETW * 2) / 2) | 0, 62, 2, powerSaveRef.current ? 'sleep' : 'ok', ((tickRef.current / 30) | 0) % 2);
    }

    function render() {
      lcd.clear();
      lcd.drawBackdrop();
      if (progressRef.current.stage === 0) {
        viewTelur();
      } else if (modeRef.current === 'jam') {
        viewJam();
      } else {
        lcd.drawChrome(powerSaveRef.current, 'FIRA');
        if (modeRef.current === 'dengar') viewDengar();
        else viewWajah();
      }
      if (flashRef.current > 0) {
        lcd.ctx.fillStyle = 'rgba(255,255,255,' + flashRef.current / 8 + ')';
        lcd.ctx.fillRect(0, 0, W, H);
        flashRef.current--;
      }
    }

    let raf = 0;
    const loop = () => {
      tickRef.current++;
      render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent) => {
      if (progressRef.current.stage === 0) {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          hatch();
        }
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') cycleMode();
      else if (e.key === ' ') {
        e.preventDefault();
        action();
      } else if (e.key.toLowerCase() === 'r') flashRef.current = 4;
      else if (e.key.toLowerCase() === 'n') resetEgg();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      mic.stop();
    };
  }, []);

  // --- button actions (mutate refs; loop picks them up) ---
  function hatch() {
    playHatchCue();
    const p = progressRef.current;
    p.stage = 1;
    p.claps = 0;
    if (!p.createdAt) p.createdAt = Date.now();
    saveProgress(p);
    modeRef.current = 'wajah';
    flashRef.current = 8;
  }
  function startMic() {
    const mic = micRef.current;
    if (mic && mic.state !== 'active') void mic.start();
  }
  function cycleMode() {
    const i = MODES.indexOf(modeRef.current);
    modeRef.current = MODES[(i + 1) % MODES.length];
    if (modeRef.current === 'dengar') startMic(); // dalam gesture klik → boleh minta izin mic
    flashRef.current = 3;
  }
  function togglePower() {
    powerSaveRef.current = !powerSaveRef.current;
    screenRef.current?.classList.toggle(styles.dim, powerSaveRef.current);
    flashRef.current = 4;
  }
  function action() {
    if (modeRef.current === 'dengar') startMic();
    else if (modeRef.current === 'jam') togglePower();
    else flashRef.current = 4;
  }
  function resetEgg() {
    if (typeof window !== 'undefined' && window.confirm('Mulai telur baru? Progres Fira akan hilang.')) {
      progressRef.current = resetProgress();
      modeRef.current = 'wajah';
      flashRef.current = 8;
    }
  }

  // Tombol tengah: menetas saat TELUR, ganti tampilan setelahnya.
  const onCenter = () => {
    if (progressRef.current.stage === 0) hatch();
    else cycleMode();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.stage}>
        <div className={styles.egg} />
        <div className={styles.rim} />

        <div className={styles.brand} aria-label="Fira">
          Fir
          <span className={styles.oglyph} aria-hidden="true">
            <i />
          </span>
        </div>

        <div className={styles.screenWrap}>
          <div className={styles.screen} ref={screenRef}>
            <canvas id="lcd" ref={canvasRef} width={128} height={128} className={styles.lcd} />
            <div className={styles.glass} />
          </div>
        </div>

        <div className={styles.btns}>
          <button className={`${styles.btn} ${styles.sm}`} onClick={() => (flashRef.current = 4)} title="Ulangi" aria-label="Ulangi" />
          <button className={`${styles.btn} ${styles.lg}`} onClick={onCenter} title="Menetas / ganti tampilan" aria-label="Menetas atau ganti tampilan" />
          <button className={`${styles.btn} ${styles.sm}`} onClick={action} title="Aksi" aria-label="Aksi" />
        </div>
      </div>
    </div>
  );
}
