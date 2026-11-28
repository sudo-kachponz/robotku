// src/ailabs/robotVoice.ts
//
// Robot "speaks" the AI reply. Pipeline: reply text -> split into sentences as the
// LLM streams -> /tts per sentence (Piper id-ID server or Google id-ID; returns a
// base64 WAV) -> decode + resample with Web Audio -> 8-bit unsigned PCM -> stream to
// the ESP32 as TTS_BEGIN / TTS_CHUNK* / TTS_END over the active link.
//
// Firmware 2.6+ (cap TTS_STREAM) plays WHILE chunks arrive and lets each next sentence
// be appended (TTS_BEGIN append:true), so the robot starts talking after the first
// sentence instead of after the whole reply, then answers TTS_DONE {seq} when it has
// finished. Older firmware gets the old one-shot clip (8 kHz, <= 12 s).
// Falls back to the browser speaker (caller's job) whenever the robot can't play it.

import { getState } from '../app/store';
import { onTelemetry } from '../app/connection';
import type { RobotTransport } from '../transport/RobotTransport';

const DEFAULT_TTS_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FIRA_TTS_URL) ||
  'https://robotku-ai.hubrobotku.workers.dev/tts';

/**
 * TTS endpoint. `localStorage['robotku.ttsUrl']` overrides it without a rebuild, e.g.
 * the Piper server running on the tester's own PC (server/robotku-tts):
 *   localStorage.setItem('robotku.ttsUrl', 'http://localhost:5002/tts')
 */
function ttsUrl(): string {
  try {
    return window.localStorage.getItem('robotku.ttsUrl') || DEFAULT_TTS_URL;
  } catch {
    return DEFAULT_TTS_URL;
  }
}

const LEGACY_MAX_BYTES = 95000; // pre-2.6 firmware buffer is 96000 (12 s @ 8 kHz)
const CHUNK = 3000; // bytes per TTS_CHUNK — base64 (~4 KB) stays under the 9 KB line cap
const CHUNK_GAP_MS = 25; // pace chunks so the relay/WS link doesn't flood + drop the tail

/** Why the robot did / did not speak — shown to the user instead of silently using the laptop. */
export type RobotSpeakResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not_connected' | 'no_speaker' | 'empty' | 'tts_failed' | 'send_failed' | 'cancelled';
      detail?: string;
    };

export const SPEAK_REASON_TEXT: Record<Exclude<RobotSpeakResult, { ok: true }>['reason'], string> =
  {
    not_connected: 'robot belum tersambung',
    no_speaker: 'firmware robot tidak punya speaker (TTS_BEGIN)',
    empty: 'teks kosong',
    tts_failed: 'server suara (TTS) gagal',
    send_failed: 'pengiriman suara ke robot terputus',
    cancelled: 'dihentikan',
  };

/** True when a robot is connected AND its firmware advertises the TTS opcodes. */
export function robotCanSpeak(): boolean {
  const { transport, robotInfo } = getState();
  return !!transport && !!robotInfo?.capabilities?.includes('TTS_BEGIN');
}

function caps(): string[] {
  return getState().robotInfo?.capabilities ?? [];
}

/** BLE (~8 KB/s) and USB serial (115200 baud) can only just keep up with 8 kHz audio. */
export function isSlowLink(t: RobotTransport | null | undefined): boolean {
  return !t || t.kind === 'ble' || t.kind === 'serial';
}

/** Strip what TTS would read aloud or choke on: URLs, markdown, emoji. */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_`#>~|[\]]/g, '')
    .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cuts streamed LLM text into speakable sentences as it arrives. Fragments shorter
 * than MIN_LEN ("Wah!") stay glued to the next sentence so the robot doesn't fire a
 * TTS request per word.
 */
export class SentenceSplitter {
  private buf = '';
  private static readonly MIN_LEN = 12;

  feed(delta: string): string[] {
    this.buf += delta;
    const out: string[] = [];
    const re = /[.!?…]+["')\]]*\s+|\n+/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.buf))) {
      const end = m.index + m[0].length;
      const s = this.buf.slice(last, end).trim();
      if (s.length >= SentenceSplitter.MIN_LEN) {
        out.push(s);
        last = end;
      }
    }
    this.buf = this.buf.slice(last);
    return out;
  }

  flush(): string {
    const s = this.buf.trim();
    this.buf = '';
    return s;
  }
}

function u8ToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Float samples -> 8-bit unsigned (centre 128), peak-normalised: 8-bit needs every bit. */
export function floatToU8(samples: Float32Array): Uint8Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const g = peak > 0.01 ? Math.min(4, 0.95 / peak) : 1;
  const pcm = new Uint8Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    pcm[i] = Math.max(0, Math.min(255, Math.round(samples[i] * g * 127 + 128)));
  }
  return pcm;
}

/** Float sample -> G.711 mu-law byte (what firmware 2.6.1+ decodes, cap TTS_ULAW). */
function muLaw(x: number): number {
  const s = Math.max(-32768, Math.min(32767, Math.round(x * 32767)));
  const sign = s < 0 ? 0x80 : 0;
  const v = Math.min(Math.abs(s), 32635) + 0x84;
  const e = Math.max(0, 31 - Math.clz32(v) - 7); // bit length - 8
  return ~(sign | (e << 4) | ((v >> (e + 3)) & 0x0f)) & 0xff;
}

/** Peak-normalised mu-law: 1 byte/sample like 8-bit, but ~13-bit quality on quiet syllables. */
export function floatToUlaw(samples: Float32Array): Uint8Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const g = peak > 0.01 ? Math.min(4, 0.95 / peak) : 1;
  const out = new Uint8Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = muLaw(samples[i] * g);
  return out;
}

/**
 * Voice pitch: 1 = Piper's natural voice; >1 = higher, more child-like. Raised by
 * playing faster while Piper speaks `pitch` x slower, so the tempo stays the same.
 *   localStorage.setItem('robotku.voicePitch', '1.25')
 */
export function voicePitch(): number {
  try {
    const v = Number(window.localStorage.getItem('robotku.voicePitch'));
    return v >= 1 && v <= 1.6 ? v : 1;
  } catch {
    return 1;
  }
}

/** Text -> robot-ready bytes at `sr` Hz (mu-law or 8-bit linear). Throws on failure. */
async function fetchPcm(text: string, sr: number, ulaw: boolean): Promise<Uint8Array> {
  const pitch = voicePitch();
  const res = await fetch(ttsUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 1.05 = tempo of the board's reference clip (see server/robotku-tts).
    body: JSON.stringify({ text, lang: 'id', sr, length_scale: 1.05 * pitch }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { audio?: string };
  if (!data.audio) throw new Error('no audio');

  const AC: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(base64ToU8(data.audio).buffer.slice(0) as ArrayBuffer);
  } finally {
    void ctx.close();
  }
  // OfflineAudioContext resamples with a proper low-pass filter (the old
  // nearest-neighbour pick aliased "s"/"c" sounds into hiss on the robot speaker).
  // Voicing calibrated against the board's own clear clip (welcome_audio.h, 16-bit):
  // Piper put 18% of its energy below 300 Hz (the tiny speaker only buzzes there) and
  // ~0.2% in 3-5 kHz where consonants live (reference 3.8% / 2.1%). This EQ was fitted
  // to the reference spectrum (bands now 4/59/34/1.4/1.4% vs 4/65/29/2.1/0.8%), then a
  // compressor keeps soft syllables audible.
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil((buf.duration / pitch) * sr)), sr);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pitch;
  const biquad = (type: BiquadFilterType, freq: number, gain = 0, q = 0.7071) => {
    const f = off.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.gain.value = gain;
    f.Q.value = q;
    return f;
  };
  const hp = biquad('highpass', 350);
  const body = biquad('peaking', 650, 3, 0.8);
  const presence = biquad('highshelf', 3000, 12);
  const comp = off.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  src.connect(hp).connect(body).connect(presence).connect(comp).connect(off.destination);
  src.start();
  const out = (await off.startRendering()).getChannelData(0);
  return ulaw ? floatToUlaw(out) : floatToU8(out);
}

const send = (t: RobotTransport, command: string, params: Record<string, unknown>) =>
  t.sendLine(JSON.stringify({ command, params }) + ';');

async function sendPcm(
  t: RobotTransport,
  pcm: Uint8Array,
  begin: Record<string, unknown>,
  seq: number,
  cancelled: () => boolean,
): Promise<void> {
  await send(t, 'TTS_BEGIN', begin);
  for (let off = 0; off < pcm.length && !cancelled(); off += CHUNK) {
    // sendLine awaits the GATT write on BLE (natural backpressure); WS/relay have
    // none, so pace the chunks or the link drops the tail.
    await send(t, 'TTS_CHUNK', {
      data: u8ToBase64(pcm.subarray(off, Math.min(off + CHUNK, pcm.length))),
    });
    await new Promise((r) => setTimeout(r, CHUNK_GAP_MS));
  }
  await send(t, 'TTS_END', { seq });
}

export interface RobotSpeech {
  /** Queue one sentence; its TTS request starts now, overlapping the one playing. */
  say(text: string): void;
  /** No more text: resolves once the robot has finished playing (or failed). */
  end(): Promise<RobotSpeakResult>;
  /** Stop sending and silence the robot now. */
  cancel(): void;
}

let seqCounter = 0;

/** Open a speech session on the connected robot. */
export function startRobotSpeech(): RobotSpeech {
  const st = getState();
  let failed: Exclude<RobotSpeakResult, { ok: true }> | null = !st.transport
    ? { ok: false, reason: 'not_connected' }
    : !robotCanSpeak()
      ? { ok: false, reason: 'no_speaker', detail: st.robotInfo?.board }
      : null;
  const streaming = caps().includes('TTS_STREAM');
  const slow = isSlowLink(st.transport);
  const sr = streaming && !slow && caps().includes('TTS_SR16') ? 16000 : 8000;
  const ulaw = caps().includes('TTS_ULAW');
  const fmt = ulaw ? { fmt: 'ulaw' } : {};

  let cancelled = false;
  let chain: Promise<void> = Promise.resolve();
  let lastSeq = 0;
  let totalBytes = 0;
  let legacyText = '';
  let queued = 0;
  const doneSeqs = new Set<number>();
  // Listen from the start: TTS_DONE for the last sentence can beat end() to the punch.
  const off = onTelemetry((msg: { command?: string; params?: { seq?: number } }) => {
    if (msg?.command === 'TTS_DONE') doneSeqs.add(Number(msg.params?.seq) || 0);
  });

  const queue = (text: string, begin: Record<string, unknown>, maxBytes = Infinity) => {
    const pcmP = fetchPcm(text, sr, ulaw);
    pcmP.catch(() => {}); // surfaced in the chain below; avoid an unhandled rejection
    chain = chain.then(async () => {
      if (failed || cancelled) return;
      let pcm: Uint8Array;
      try {
        pcm = (await pcmP).subarray(0, maxBytes);
      } catch (e) {
        failed = { ok: false, reason: 'tts_failed', detail: String(e) };
        return;
      }
      const t = getState().transport;
      if (!t) {
        failed = { ok: false, reason: 'not_connected' };
        return;
      }
      const seq = ++seqCounter;
      try {
        await sendPcm(t, pcm, begin, seq, () => cancelled);
        lastSeq = seq;
        totalBytes += pcm.length;
      } catch (e) {
        failed = { ok: false, reason: 'send_failed', detail: String(e) };
      }
    });
  };

  return {
    say(text) {
      const t = cleanForSpeech(text);
      if (!t || failed || cancelled) return;
      if (!streaming) {
        legacyText += (legacyText ? ' ' : '') + t; // old firmware: one clip at the end
        return;
      }
      // First sentence starts a fresh take; on BLE/serial the robot buffers the whole
      // sentence first (link ~= play rate, so streaming would stutter).
      const first = queued++ === 0; // counted synchronously: lastSeq is set only after sending
      queue(t, first ? { sr, ...fmt, append: false, pre_ms: slow ? 120000 : 300 } : { sr, append: true });
    },
    async end() {
      if (!streaming && legacyText && !failed) queue(legacyText, {}, LEGACY_MAX_BYTES);
      await chain;
      try {
        if (cancelled) return { ok: false, reason: 'cancelled' };
        if (failed) return failed;
        if (!lastSeq) return { ok: false, reason: 'empty' };
        // Wait until the robot is done talking (TTS_DONE on 2.6+, estimate on older).
        const playMs = (totalBytes / sr) * 1000;
        const deadline = Date.now() + playMs + (streaming ? 4000 : 500);
        while (Date.now() < deadline && !cancelled) {
          if (streaming && doneSeqs.has(lastSeq)) break;
          await new Promise((r) => setTimeout(r, 100));
        }
        return cancelled ? { ok: false, reason: 'cancelled' } : { ok: true };
      } finally {
        off();
      }
    },
    cancel() {
      cancelled = true;
      const t = getState().transport;
      if (t) void send(t, 'STOP_SOUNDS', {}).catch(() => {});
    },
  };
}

/** Speak a whole `text` through the robot; resolves when it has finished talking. */
export async function speakViaRobot(text: string): Promise<RobotSpeakResult> {
  if (!text.trim()) return { ok: false, reason: 'empty' };
  const speech = startRobotSpeech();
  const splitter = new SentenceSplitter();
  for (const s of splitter.feed(text)) speech.say(s);
  const rest = splitter.flush();
  if (rest) speech.say(rest);
  return speech.end();
}
