// src/ailabs/robotVoice.ts
//
// Robot "speaks" the AI reply. Pipeline: reply text -> backend /tts (Workers AI
// MeloTTS, returns a base64 WAV) -> decode with Web Audio -> downsample to 8 kHz
// 8-bit unsigned PCM -> stream to the ESP32 over BLE as TTS_BEGIN / TTS_CHUNK* /
// TTS_END. The firmware buffers the whole clip then plays it through the MAX98357A
// (buffer-then-play — BLE is too slow for reliable real-time). Falls back to the
// browser speaker (caller's job) whenever the robot can't play it.

import { getState } from '../app/store';

const TTS_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FIRA_TTS_URL) ||
  'https://robotku-ai.hubrobotku.workers.dev/tts';

const TARGET_SR = 8000; // must match the firmware playback rate
const MAX_BYTES = 31000; // firmware buffer is 32000 (4 s); keep a little headroom
const CHUNK = 3000; // bytes per TTS_CHUNK — base64 (~4 KB) stays under the 9 KB line cap

/** True when a robot is connected AND its firmware advertises the TTS opcodes. */
export function robotCanSpeak(): boolean {
  const { transport, robotInfo } = getState();
  return !!transport && !!robotInfo?.capabilities?.includes('TTS_BEGIN');
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

/**
 * Speak `text` through the robot. Returns true if the robot played it, false if
 * the caller should fall back to the browser speaker.
 */
export async function speakViaRobot(text: string, lang = 'en'): Promise<boolean> {
  if (!robotCanSpeak() || !text.trim()) return false;

  let pcm: Uint8Array;
  try {
    const res = await fetch(TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { audio?: string };
    if (!data.audio) return false;

    // Decode the WAV/MP3 to float PCM, then downsample to 8 kHz 8-bit unsigned.
    const bytes = base64ToU8(data.audio);
    const AC: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const buf = await ctx.decodeAudioData(bytes.buffer.slice(0) as ArrayBuffer);
    const ch = buf.getChannelData(0);
    const ratio = buf.sampleRate / TARGET_SR;
    const outLen = Math.min(MAX_BYTES, Math.floor(ch.length / ratio));
    pcm = new Uint8Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const f = ch[Math.floor(i * ratio)] || 0; // nearest-neighbour downsample
      pcm[i] = Math.max(0, Math.min(255, Math.round(f * 127 + 128))); // float -> u8 (centre 128)
    }
    void ctx.close();
  } catch {
    return false;
  }

  // Stream to the robot. sendLine awaits the GATT write, giving natural backpressure.
  const { transport } = getState();
  if (!transport) return false;
  try {
    await transport.sendLine(JSON.stringify({ command: 'TTS_BEGIN', params: {} }) + ';');
    for (let off = 0; off < pcm.length; off += CHUNK) {
      const slice = pcm.subarray(off, Math.min(off + CHUNK, pcm.length));
      await transport.sendLine(
        JSON.stringify({ command: 'TTS_CHUNK', params: { data: u8ToBase64(slice) } }) + ';',
      );
    }
    await transport.sendLine(JSON.stringify({ command: 'TTS_END', params: {} }) + ';');
    return true;
  } catch {
    return false;
  }
}
