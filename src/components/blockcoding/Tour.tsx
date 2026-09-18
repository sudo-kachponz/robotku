// src/components/blockcoding/Tour.tsx
//
// Interactive onboarding tour: each step spotlights a real UI element (a toolbar
// button or a zone) and shows a callout explaining it, with Next/Back/Skip.
// Bilingual (ID/EN). No dependency — the "spotlight" is a box with a huge
// box-shadow spread that dims everything except the highlighted element.

import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import styles from './Tour.module.css';

type Step = { sel?: string; icon: string; title: string; body: string };

const STEPS: Record<'id' | 'en', Step[]> = {
  id: [
    { icon: '👋', title: 'Yuk kenalan!', body: 'Tur singkat ± 30 detik biar kamu tau tiap bagian buat apa. Tekan "Lanjut".' },
    { sel: '[data-tour="sim-panel"]', icon: '🤖', title: 'Simulator (kiri)', body: 'Robot virtual. Program yang kamu buat langsung dicoba di sini tanpa alat fisik.' },
    { sel: '.blocklyToolboxDiv', icon: '🧩', title: 'Blok Perintah (tengah)', body: 'Daftar blok. Klik kategori (Movement, Logic, dll), lalu seret blok ke area program di kanan.' },
    { sel: '[data-tour="run"]', icon: '▶️', title: 'Run', body: 'Jalankan programmu — robot di simulator langsung bergerak mengikuti blok.' },
    { sel: '[data-tour="stop"]', icon: '⏹️', title: 'Stop', body: 'Hentikan program kapan saja. Tombol darurat (failsafe).' },
    { sel: '[data-tour="simulator"]', icon: '🖥️', title: 'Tombol Simulator', body: 'Tampilkan atau sembunyikan panel simulator di kiri.' },
    { sel: '[data-tour="ai"]', icon: '🎥', title: 'AI', body: 'Nyalakan kamera untuk deteksi objek & warna, lalu pakai hasilnya di blok.' },
    { sel: '[data-tour="templates"]', icon: '🗂️', title: 'Templates', body: 'Contoh program siap pakai — tinggal coba dan pelajari.' },
    { sel: '[data-tour="save"]', icon: '💾', title: 'Simpan', body: 'Save ke Projects, Share (salin), atau Download sebagai file .rbk.' },
    { icon: '🔌', title: 'Robot Asli', body: 'Hubungkan robot lewat tombol power (kanan bawah) via USB / Bluetooth. Tekan tombol "?" kapan saja untuk membuka tur ini lagi.' },
  ],
  en: [
    { icon: '👋', title: 'Quick tour!', body: 'A ± 30-second tour so you know what each part does. Press "Next".' },
    { sel: '[data-tour="sim-panel"]', icon: '🤖', title: 'Simulator (left)', body: 'A virtual robot. Your program runs here instantly — no hardware needed.' },
    { sel: '.blocklyToolboxDiv', icon: '🧩', title: 'Command Blocks (center)', body: 'The block list. Click a category (Movement, Logic, …), then drag blocks to the program area on the right.' },
    { sel: '[data-tour="run"]', icon: '▶️', title: 'Run', body: 'Run your program — the simulator robot moves along with your blocks.' },
    { sel: '[data-tour="stop"]', icon: '⏹️', title: 'Stop', body: 'Stop the program anytime. An emergency (failsafe) button.' },
    { sel: '[data-tour="simulator"]', icon: '🖥️', title: 'Simulator button', body: 'Show or hide the simulator panel on the left.' },
    { sel: '[data-tour="ai"]', icon: '🎥', title: 'AI', body: 'Turn on the camera for object & color detection, then use it in your blocks.' },
    { sel: '[data-tour="templates"]', icon: '🗂️', title: 'Templates', body: 'Ready-made example programs — just try and learn from them.' },
    { sel: '[data-tour="save"]', icon: '💾', title: 'Save', body: 'Save to Projects, Share (copy), or Download as a .rbk file.' },
    { icon: '🔌', title: 'Real Robot', body: 'Connect a robot via the power button (bottom-right) over USB / Bluetooth. Press the "?" button anytime to reopen this tour.' },
  ],
};

const CARD_W = 320;
const CARD_H = 200;
const GAP = 14;

function calloutStyle(rect: DOMRect | null): CSSProperties {
  if (!rect) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: CARD_W };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rightSpace = vw - rect.right;
  const leftSpace = rect.left;
  let left: number;
  let placedSide = true;
  if (rightSpace > CARD_W + 32) left = rect.right + GAP;
  else if (leftSpace > CARD_W + 32) left = rect.left - GAP - CARD_W;
  else {
    left = rect.left + rect.width / 2 - CARD_W / 2;
    placedSide = false;
  }
  let top = placedSide ? rect.top : rect.bottom + GAP;
  left = Math.max(GAP, Math.min(left, vw - CARD_W - GAP));
  top = Math.max(GAP, Math.min(top, vh - CARD_H - GAP));
  return { left, top, width: CARD_W };
}

export default function Tour({
  lang,
  onLang,
  onClose,
}: {
  lang: 'id' | 'en';
  onLang: (l: 'id' | 'en') => void;
  onClose: () => void;
}) {
  const steps = STEPS[lang];
  const [i, setI] = useState(0);
  const idx = Math.min(i, steps.length - 1);
  const step = steps[idx];
  const last = idx >= steps.length - 1;
  const [rect, setRect] = useState<DOMRect | null>(null);

  const next = useCallback(() => {
    setI((v) => (v >= steps.length - 1 ? v : v + 1));
    if (last) onClose();
  }, [last, onClose, steps.length]);
  const back = useCallback(() => setI((v) => Math.max(0, v - 1)), []);

  const measure = useCallback(() => {
    if (!step.sel) return setRect(null);
    const el = document.querySelector(step.sel) as HTMLElement | null;
    if (!el) return setRect(null);
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // hidden / off-screen (e.g. sim closed, toolbox collapsed) → centered fallback
    if (r.width < 2 || r.height < 2 || r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh) {
      return setRect(null);
    }
    setRect(r);
  }, [step]);

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(measure);
    const t = setTimeout(measure, 280); // wait out sim/toolbox transitions
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, onClose]);

  const spot: CSSProperties | null = rect
    ? { top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 }
    : null;

  return (
    <div className={styles.root} aria-live="polite">
      <div className={styles.blocker} onClick={next} />
      {spot && <div className={styles.spot} style={spot} />}
      <div className={styles.card} style={calloutStyle(rect)} onClick={(e) => e.stopPropagation()}>
        <div className={styles.langRow}>
          <button className={lang === 'id' ? styles.langActive : ''} onClick={() => onLang('id')}>
            ID
          </button>
          <button className={lang === 'en' ? styles.langActive : ''} onClick={() => onLang('en')}>
            EN
          </button>
        </div>
        <div className={styles.head}>
          <span className={styles.icon}>{step.icon}</span>
          <strong>{step.title}</strong>
        </div>
        <p className={styles.body}>{step.body}</p>
        <div className={styles.footer}>
          <span className={styles.count}>
            {idx + 1}/{steps.length}
          </span>
          <div className={styles.actions}>
            <button className={styles.skip} onClick={onClose}>
              {lang === 'id' ? 'Lewati' : 'Skip'}
            </button>
            {idx > 0 && (
              <button className={styles.back} onClick={back}>
                {lang === 'id' ? 'Kembali' : 'Back'}
              </button>
            )}
            <button className={styles.next} onClick={next}>
              {last ? (lang === 'id' ? 'Selesai' : 'Done') : lang === 'id' ? 'Lanjut' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
