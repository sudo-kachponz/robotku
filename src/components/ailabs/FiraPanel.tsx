// src/components/ailabs/FiraPanel.tsx
//
// Robotku AI di editor blok — panel/drawer kanan: avatar Tamagotchi (piksel
// canvas) + UI chat ala ChatGPT. Otak memanggil BACKEND (Cloudflare Worker via
// brain.ts) yang pegang kunci di server — user TAK perlu input apa pun. Tanpa
// backend → mode demo. Client-only (canvas + fetch streaming).

import { useEffect, useRef, useState } from 'react';
import { Lcd, PETW } from './lcd/engine';
import { PET_COLORS, type Mood } from './lcd/sprites';
import { firaChat, type ChatMsg } from '../../ailabs/brain';
import { speak, stopSpeaking, ttsSupported, voiceLabel, listenOnce, sttSupported } from '../../ailabs/speech';
import styles from './FiraPanel.module.css';

type Face = 'idle' | 'thinking' | 'speaking';

export default function FiraPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const avatarRef = useRef<HTMLCanvasElement>(null);
  const faceRef = useRef<Face>('idle');
  const tickRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: 'Halo! Aku Robotku AI. Tanya aku apa saja ya 🙂' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [listening, setListening] = useState(false);

  // avatar loop
  useEffect(() => {
    const canvas = avatarRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const lcd = new Lcd(ctx, canvas.width, canvas.height);
    const { W, H } = lcd;
    let raf = 0;
    const loop = () => {
      tickRef.current++;
      lcd.clear();
      lcd.ctx.fillStyle = 'rgba(190,227,246,.25)';
      lcd.ctx.fillRect(0, 0, W, H);
      lcd.drawBackdrop();
      const face = faceRef.current;
      const m: Mood = face === 'speaking' ? 'happy' : face === 'thinking' ? 'tired' : 'ok';
      const f = ((tickRef.current / 22) | 0) % 2;
      lcd.drawPet(((W - PETW * 2) / 2) | 0, 6, 2, m, f);
      const cap = face === 'thinking' ? 'BERPIKIR' : face === 'speaking' ? '...' : 'SIAP';
      lcd.miniCenter(H - 12, cap, PET_COLORS.C_B, 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  async function handleMic() {
    if (listening || busy || !sttSupported()) return;
    setListening(true);
    faceRef.current = 'thinking';
    try {
      const r = await listenOnce();
      if (r.ok && r.text) await send(r.text);
      else
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: r.reason === 'unsupported' ? '(STT hanya di Chrome/Edge — ketik saja ya)' : '(tidak mendengar apa-apa, coba lagi)' },
        ]);
    } finally {
      setListening(false);
      if (!busy) faceRef.current = 'idle';
    }
  }

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    const history = [...messages, { role: 'user', content: text } as ChatMsg];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    faceRef.current = 'thinking';
    let acc = '';
    try {
      const res = await firaChat(history, {
        onContent: (d) => {
          acc += d;
          faceRef.current = 'speaking';
          setMessages((m) => {
            const c = [...m];
            c[c.length - 1] = { role: 'assistant', content: acc };
            return c;
          });
        },
      });
      setDemo(res.demo);
      if (ttsSupported()) speak(res.content || acc);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'error tak dikenal';
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { role: 'assistant', content: '⚠ Maaf, ada kendala: ' + msg };
        return c;
      });
    } finally {
      setBusy(false);
      faceRef.current = 'idle';
    }
  }

  return (
    <aside className={`${styles.panel} ${open ? styles.open : ''}`} aria-hidden={!open}>
      <div className={styles.head}>
        <canvas ref={avatarRef} width={96} height={96} className={styles.avatar} />
        <div className={styles.title}>
          <b>Robotku AI</b>
          <span className={styles.sub}>{demo ? 'mode demo (server AI mati)' : 'AI aktif'}</span>
        </div>
        <button className={styles.icon} onClick={() => setShowInfo((v) => !v)} title="Info">
          ⚙
        </button>
        <button className={styles.icon} onClick={onClose} title="Tutup" aria-label="Tutup">
          ✕
        </button>
      </div>

      {showInfo && (
        <div className={styles.keyBox}>
          <p className={styles.warn}>
            🤖 Robotku AI jalan lewat server — kamu tak perlu memasukkan apa pun, dan kunci tidak pernah
            ada di browser. Suara: {ttsSupported() ? voiceLabel() : 'tak didukung browser ini'}.
          </p>
        </div>
      )}

      <div className={styles.log} ref={logRef}>
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? styles.bubbleUser : styles.bubbleFira}>
            {m.content || (busy && i === messages.length - 1 ? '…' : '')}
          </div>
        ))}
      </div>

      <div className={styles.inputRow}>
        <button
          className={`${styles.mic} ${listening ? styles.micOn : ''}`}
          onClick={handleMic}
          disabled={busy || listening || !sttSupported()}
          title={sttSupported() ? 'Bicara ke Robotku AI (Bahasa Indonesia)' : 'STT hanya Chrome/Edge — ketik saja'}
          aria-label="Bicara"
        >
          {listening ? '●' : '🎤'}
        </button>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder={listening ? 'Mendengarkan…' : 'Tulis atau tekan 🎤 lalu bicara…'}
          disabled={busy || listening}
        />
        <button className={styles.send} onClick={() => send()} disabled={busy || !input.trim()}>
          {busy ? '…' : 'Kirim'}
        </button>
        {busy && (
          <button className={styles.stop} onClick={stopSpeaking} title="Hentikan suara">
            ◼
          </button>
        )}
      </div>
    </aside>
  );
}
