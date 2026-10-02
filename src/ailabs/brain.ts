// src/ailabs/brain.ts
//
// Otak Robotku AI — memanggil LLM (Netra / DeepSeek, OpenAI-compatible) LANGSUNG
// dari browser, tanpa proxy. Kunci API diambil dari localStorage (diisi sekali
// lewat tombol ⚙ di panel chat) atau dari NEXT_PUBLIC_NETRA_API_KEY saat build.
// Tanpa kunci → mode DEMO (jawaban siap pakai, UX tetap jalan).
//
// CATATAN KEAMANAN: kunci ada di browser (localStorage). Siapa pun yang pakai
// perangkat itu bisa membacanya. Pakai kunci khusus yang DIBATASI biaya & bisa
// dicabut — jangan kunci utama. (Ini trade-off "yang penting jalan dulu".)

const NETRA_URL = 'https://api.netraruntime.com/v1/chat/completions';
const MODEL = 'deepseek/deepseek-v4-flash-0731';
const KEY_STORAGE = 'robotku.ai.key';

const PERSONA =
  'Kamu "Robotku AI", asisten robot yang ramah untuk anak-anak yang sedang belajar ' +
  'coding dan AI. Jawab singkat, hangat, dan mudah dimengerti dalam Bahasa Indonesia. ' +
  'Boleh pakai emoji sesekali. Kalau ditanya hal teknis, jelaskan sesederhana mungkin.';

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

/** Kunci API: localStorage dulu, lalu env build-time. Kosong = mode demo. */
export function getAiKey(): string {
  try {
    const k = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY_STORAGE) : null;
    if (k && k.trim()) return k.trim();
  } catch {
    /* localStorage tak tersedia (SSR) */
  }
  const env =
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_NETRA_API_KEY : undefined;
  return (env || '').trim();
}

export function setAiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export function hasAiKey(): boolean {
  return getAiKey().length > 0;
}

const DEMO_REPLIES = [
  'Halo! Aku Robotku AI mode demo — kunci AI belum diisi, jadi ini jawaban siap pakai.',
  'Seru! Tapi otak AI-ku belum aktif. Isi kunci AI di tombol ⚙ ya biar aku jawab sungguhan.',
  'Aku dengar kamu! Untuk jawaban AI asli, masukkan kunci AI dulu lewat ⚙.',
  'Wah, pertanyaan bagus. Kunci AI-ku belum dipasang — isi dulu di ⚙, nanti aku jawab beneran.',
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

/** Kirim riwayat ke Netra langsung; stream jawaban. Tanpa kunci / error → demo. */
export async function firaChat(
  history: ChatMsg[],
  cb: StreamCallbacks = {},
  signal?: AbortSignal,
): Promise<ChatResult> {
  const key = getAiKey();
  if (!key) return demoStream(history, cb, signal);

  const convo = history.filter((m) => m.role === 'user' || m.role === 'assistant');
  const messages: ChatMsg[] = [{ role: 'system', content: PERSONA }, ...convo];

  try {
    const res = await fetch(NETRA_URL, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        stream: true,
        // DeepSeek V4 Flash adalah model reasoning: butuh ruang token yang cukup,
        // kalau terlalu kecil `content` bisa kosong. reasoning effort 'low' = cepat.
        max_tokens: 500,
        reasoning: { effort: 'low' },
      }),
    });
    if (!res.ok || !res.body) throw new Error('netra ' + res.status);

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
    // Kunci salah / CORS / jaringan → jangan mati total, pakai demo.
    return demoStream(history, cb, signal);
  }
}
