// src/ailabs/stages.ts
//
// Fira lifecycle (docs/AI-LABS.md §2): 6 tahap, evolusi permanen di localStorage
// 'robotku.fira'. Step 3 mengaktifkan tahap 0 (TELUR) + 1 (DENGAR). Tahap 2-5
// didefinisikan di sini untuk UI (terkunci) tapi belum berfungsi.

export type StageId = 0 | 1 | 2 | 3 | 4 | 5;

export interface Progress {
  stage: StageId;
  claps: number; // tepuk beruntun (tahap 1)
  phrases: number; // TTS (tahap 2)
  transcripts: number; // STT (tahap 3)
  convos: number; // LLM (tahap 4)
  name: string;
  createdAt: number;
}

export interface StageMeta {
  id: StageId;
  name: string;
  sense: string;
}

export const STAGES: readonly StageMeta[] = [
  { id: 0, name: 'TELUR', sense: '—' },
  { id: 1, name: 'DENGAR', sense: 'Mikrofon' },
  { id: 2, name: 'BICARA', sense: 'Suara (TTS)' },
  { id: 3, name: 'PAHAM', sense: 'Transkrip (STT)' },
  { id: 4, name: 'BERPIKIR', sense: 'LLM' },
  { id: 5, name: 'BERTINDAK', sense: 'Tools' },
];

/** Tepuk beruntun yang dibutuhkan untuk naik dari DENGAR (tahap 1) ke tahap 2. */
export const CLAPS_TO_ADVANCE = 5;

const KEY = 'robotku.fira';

function fresh(): Progress {
  return { stage: 0, claps: 0, phrases: 0, transcripts: 0, convos: 0, name: 'Fira', createdAt: Date.now() };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...fresh(), ...(JSON.parse(raw) as Partial<Progress>) };
  } catch {
    // localStorage bisa diblokir (mode privat) — jalan dengan default, jangan crash.
  }
  return fresh();
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // abaikan: penyimpanan tak tersedia
  }
}

/** Telur baru — reset permanen (dipanggil setelah konfirmasi user, §2). */
export function resetProgress(): Progress {
  const p = fresh();
  saveProgress(p);
  return p;
}
