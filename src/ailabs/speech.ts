// src/ailabs/speech.ts
//
// TTS Fira (docs/AI-LABS.md §6) — window.speechSynthesis, pilih voice id-ID kalau
// ada; kalau tidak, laporkan voice mana yang dipakai (jangan pura-pura). STT
// (SpeechRecognition) menyusul di step berikut. Semua gratis, tanpa API key.

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (!ttsSupported()) return null;
  const vs = window.speechSynthesis.getVoices();
  if (!vs.length) return null;
  return (
    vs.find((v) => /id[-_]?id/i.test(v.lang)) ||
    vs.find((v) => v.lang.toLowerCase().startsWith('id')) ||
    vs[0]
  );
}

/** Nama voice yang akan dipakai (untuk ditampilkan jujur ke user). */
export function voiceLabel(): string {
  cachedVoice = cachedVoice || pickVoice();
  return cachedVoice ? `${cachedVoice.name} (${cachedVoice.lang})` : 'tidak ada voice';
}

export function speak(text: string): void {
  if (!ttsSupported() || !text.trim()) return;
  cachedVoice = cachedVoice || pickVoice();
  const u = new SpeechSynthesisUtterance(text);
  if (cachedVoice) u.voice = cachedVoice;
  u.lang = cachedVoice?.lang || 'id-ID';
  u.rate = 1;
  u.pitch = 1.15; // sedikit lebih ceria untuk anak
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

// Voice list dimuat asinkron di sebagian browser — perbarui cache saat siap.
if (ttsSupported() && typeof window.speechSynthesis.addEventListener === 'function') {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoice = pickVoice();
  });
}

// --- STT (speech-to-text) — praktis hanya Chrome/Edge, butuh internet + izin mic + HTTPS.
// Deteksi dulu, jangan gagal diam-diam (AI-LABS.md §5/§6). Tipe SpeechRecognition tak
// ada di lib DOM standar, jadi didefinisikan minimal di sini (tanpa `any`).
interface SRAlternative {
  transcript: string;
}
interface SRResultLike {
  0: SRAlternative;
}
interface SRResultListLike {
  0: SRResultLike;
}
interface SREvent {
  results: SRResultListLike;
}
interface SRErrorEvent {
  error: string;
}
interface SRInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SRCtor = new () => SRInstance;
type WindowWithSR = Window & { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };

export function sttSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as WindowWithSR;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export interface ListenResult {
  ok: boolean;
  text: string;
  reason?: 'unsupported' | 'no-speech' | 'timeout' | 'error' | 'start-failed';
}

/** Dengarkan sekali (id-ID) dan kembalikan transkrip. Tak pernah throw. */
export function listenOnce(timeoutMs = 8000): Promise<ListenResult> {
  return new Promise((resolve) => {
    if (!sttSupported()) {
      resolve({ ok: false, text: '', reason: 'unsupported' });
      return;
    }
    const w = window as WindowWithSR;
    const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition)!;
    const rec = new Ctor();
    rec.lang = 'id-ID';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    let done = false;
    const finish = (r: ListenResult) => {
      if (done) return;
      done = true;
      clearTimeout(to);
      try {
        rec.stop();
      } catch {
        // sudah berhenti
      }
      resolve(r);
    };
    const to = setTimeout(() => finish({ ok: false, text: '', reason: 'timeout' }), timeoutMs);
    rec.onresult = (e) => finish({ ok: true, text: String(e.results?.[0]?.[0]?.transcript ?? '').trim() });
    rec.onerror = (e) => finish({ ok: false, text: '', reason: e?.error ? 'error' : 'error' });
    rec.onend = () => finish({ ok: false, text: '', reason: 'no-speech' });
    try {
      rec.start();
    } catch {
      finish({ ok: false, text: '', reason: 'start-failed' });
    }
  });
}
