// src/ailabs/brain.ts
//
// Otak Robotku AI — memanggil BACKEND (Cloudflare Worker, lihat ../../robotku-ai-backend)
// yang menyimpan kunci Netra di server. Browser HANYA mengirim giliran percakapan;
// kunci TAK pernah ada di bundle browser dan user TAK perlu input. Streaming SSE ala
// OpenAI (delta.content = jawaban, delta.reasoning = "berpikir"). Kalau backend tak
// tersedia → mode DEMO (kelas WiFi jelek tak boleh mati total).

const PROXY_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FIRA_PROXY_URL) ||
  'https://robotku-ai.hubrobotku.workers.dev/chat';

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onReasoning?: (delta: string) => void; // Robotku AI "berpikir"
  onContent?: (delta: string) => void; // jawaban tampil huruf demi huruf
}

export interface ChatResult {
  content: string;
  demo: boolean;
}

const DEMO_REPLIES = [
  'Halo! Aku Robotku AI mode demo — server AI belum tersambung, jadi ini jawaban siap pakai.',
  'Seru! Tapi otak AI-ku belum online. Coba lagi sebentar ya.',
  'Aku dengar kamu! Untuk jawaban AI asli, server Robotku AI harus aktif dulu.',
  'Wah, pertanyaan bagus. Server AI-ku sedang tidak aktif — nanti aku jawab sungguhan.',
];

function demoReply(history: ChatMsg[]): string {
  const n = history.filter((m) => m.role === 'user').length;
  return DEMO_REPLIES[(n - 1 + DEMO_REPLIES.length) % DEMO_REPLIES.length];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function demoStream(
  history: ChatMsg[],
  cb: StreamCallbacks,
  signal?: AbortSignal,
): Promise<ChatResult> {
  const reply = demoReply(history);
  for (const ch of reply) {
    if (signal?.aborted) break;
    cb.onContent?.(ch);
    await sleep(14);
  }
  return { content: reply, demo: true };
}

/** Kirim riwayat ke backend; stream jawaban. Fallback demo bila backend mati. */
export async function firaChat(
  history: ChatMsg[],
  cb: StreamCallbacks = {},
  signal?: AbortSignal,
): Promise<ChatResult> {
  // Browser hanya kirim giliran user/assistant — persona & kunci ada di server.
  const messages = history.filter((m) => m.role === 'user' || m.role === 'assistant');
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok || !res.body) throw new Error('backend ' + res.status);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let content = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const j = JSON.parse(data) as {
            choices?: { delta?: { content?: string; reasoning?: string } }[];
          };
          const d = j.choices?.[0]?.delta;
          if (d?.reasoning) cb.onReasoning?.(d.reasoning);
          if (d?.content) {
            content += d.content;
            cb.onContent?.(d.content);
          }
        } catch {
          // fragmen JSON belum lengkap — abaikan
        }
      }
    }
    if (!content) throw new Error('empty');
    return { content, demo: false };
  } catch {
    // Backend tak tersedia → mode demo (streaming palsu supaya UX tetap sama).
    return demoStream(history, cb, signal);
  }
}
