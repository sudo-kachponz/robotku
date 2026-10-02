// src/components/ailabs/FiraPanel.tsx
//
// Robotku AI di editor blok — drawer kanan dibelah dua:
//   ATAS  : monitor Tamagotchi 1:1 dari mametchi-monitor.html — cangkang telur
//           (gradien + rim + kilau), brand "Tamag[o]tchi", layar piksel penuh
//           (RAM/RUN/baterai, pet Mametchi, caption, bar RAM/CPU, tanggal+jam),
//           dan 3 tombol pink. Ekspresi pet mengikuti keadaan AI. Ini juga basis
//           animasi OLED robot nanti.
//   BAWAH : kolom chat ala ChatGPT.
// Otak lewat BACKEND (Cloudflare Worker via brain.ts) — kunci di server.

import { useEffect, useRef, useState } from 'react';
import { Lcd, PETW } from './lcd/engine';
import { PET_COLORS, type Mood } from './lcd/sprites';
import { firaChat, type ChatMsg } from '../../ailabs/brain';
import { speak, stopSpeaking, ttsSupported, voiceLabel, listenOnce, sttSupported } from '../../ailabs/speech';
import { speakViaRobot } from '../../ailabs/robotVoice';
import styles from './FiraPanel.module.css';

type Face = 'idle' | 'thinking' | 'speaking';

// Random-walk sim so the RAM/CPU bars feel alive (identik dgn mametchi-monitor).
function drift(v: number, amt: number, lo: number, hi: number): number {
  v += (Math.random() - 0.5) * amt;
  v += (55 - v) * 0.008;
  return Math.max(lo, Math.min(hi, v));
}

export default function FiraPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lcdRef = useRef<HTMLCanvasElement>(null);
  const faceRef = useRef<Face>('idle');
  const listeningRef = useRef(false);
  const tickRef = useRef(0);
  const statsRef = useRef({ ram: 56, cpu: 22 });
  const pokeRef = useRef(0); // happy flash until this timestamp (tombol dipencet)
  const logRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: 'Halo! Aku Robotku AI. Tanya aku apa saja ya 🙂' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [listening, setListening] = useState(false);

  // drift the sim once a second
  useEffect(() => {
    const id = setInterval(() => {
      const s = statsRef.current;
      s.ram = drift(s.ram, 2.4, 18, 94);
      s.cpu = drift(s.cpu, 9, 2, 99);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // monitor loop — full pet view; pet mood/caption track the AI state.
  useEffect(() => {
    const canvas = lcdRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const lcd = new Lcd(ctx, canvas.width, canvas.height);
    const { W, H } = lcd;
    let raf = 0;
    const loop = () => {
      const t = ++tickRef.current;
      lcd.clear();
      lcd.ctx.fillStyle = 'rgba(190,227,246,.22)';
      lcd.ctx.fillRect(0, 0, W, H);
      lcd.drawBackdrop();
      lcd.drawChrome(false, 'RAM');

      const s = statsRef.current;
      const now = Date.now();
      const face = faceRef.current;
      const lis = listeningRef.current;
      let mood: Mood;
      let say: string;
      if (lis) {
        mood = 'tired';
        say = 'DENGAR';
      } else if (face === 'thinking') {
        mood = 'tired';
        say = 'BERPIKIR';
      } else if (face === 'speaking') {
        mood = 'happy';
        say = 'BICARA';
      } else if (now < pokeRef.current) {
        mood = 'happy';
        say = 'LEGA!';
      } else {
        mood = s.cpu > 78 ? 'tired' : s.ram < 55 ? 'happy' : 'ok';
        say = mood === 'happy' ? 'LEGA!' : mood === 'tired' ? 'BERAT' : 'SIAP';
      }
      const f = ((t / 26) | 0) % 2;
      lcd.drawPet(((W - PETW * 2) / 2) | 0, 14, 2, mood, f);
      lcd.miniCenter(80, say, PET_COLORS.C_B, 2);
      lcd.bar(5, 96, W - 10, 5, s.ram, 'RAM');
      lcd.bar(5, 105, W - 10, 5, s.cpu, 'CPU');
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  function poke() {
    pokeRef.current = Date.now() + 2200; // pet senang sebentar
  }

  async function handleMic() {
    if (listening || busy || !sttSupported()) return;
    setListening(true);
    listeningRef.current = true;
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
      listeningRef.current = false;
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
      // Prefer the ROBOT's speaker (so it physically talks); fall back to the
      // laptop/phone speaker only when no robot with TTS is connected.
      const reply = res.content || acc;
      const spokeOnRobot = await speakViaRobot(reply);
      if (!spokeOnRobot && ttsSupported()) speak(reply);
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
      {/* slim header */}
      <div className={styles.head}>
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

      {/* TOP: Tamagotchi monitor (1:1 dari mametchi-monitor.html) */}
      <div className={styles.monitor}>
        <div className={styles.stage}>
          <div className={styles.egg} />
          <div className={styles.rim} />
          <div className={styles.brand} aria-label="Tamagotchi">
            Tamag
            <span className={styles.oglyph} aria-hidden="true">
              <i />
            </span>
            tchi
          </div>
          <div className={styles.screenWrap}>
            <div className={styles.screen}>
              <canvas ref={lcdRef} width={128} height={128} className={styles.lcd} />
              <div className={styles.glass} />
            </div>
          </div>
          <div className={styles.btns}>
            <button className={`${styles.btn} ${styles.sm}`} onClick={poke} aria-label="Tombol kiri" />
            <button className={`${styles.btn} ${styles.lg}`} onClick={poke} aria-label="Tombol tengah" />
            <button className={`${styles.btn} ${styles.sm}`} onClick={poke} aria-label="Tombol kanan" />
          </div>
        </div>
      </div>

      {/* BOTTOM: chat */}
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
