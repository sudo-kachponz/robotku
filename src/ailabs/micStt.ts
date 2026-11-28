// src/ailabs/micStt.ts
//
// Voice input FROM the robot's mic. Pipeline: MIC_STT {secs, sr, bits, vad} -> firmware
// records the INMP441, ends the take itself ~1 s after you stop talking (VAD) or on
// MIC_STOP, streams base64 MIC_DATA chunks + MIC_END {sr, bits} back over the active
// link (BLE / WiFi-WS / relay) -> we wrap a WAV -> backend /stt (Whisper, Indonesian)
// -> text. Returns null on any failure so the caller can fall back to the browser mic.
//
// WiFi/relay take 16 kHz 16-bit (what Whisper wants); BLE/serial take 8 kHz 8-bit
// (4x less data). Pre-2.6 firmware (no MIC_STOP cap) gets the old {secs} request and
// always answers 8 kHz 8-bit.

import { getState } from '../app/store';
import { onTelemetry } from '../app/connection';
import { isSlowLink } from './robotVoice';

const STT_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FIRA_STT_URL) ||
  'https://robotku-ai.hubrobotku.workers.dev/stt';

/** True when a robot with mic-STT firmware is connected. */
export function robotCanListen(): boolean {
  const { transport, robotInfo } = getState();
  return !!transport && !!robotInfo?.capabilities?.includes('MIC_STT');
}

/** End the robot's current take now (push-to-talk release). No-op on old firmware. */
export function stopRobotListening(): void {
  const { transport, robotInfo } = getState();
  if (transport && robotInfo?.capabilities?.includes('MIC_STOP')) {
    void transport
      .sendLine(JSON.stringify({ command: 'MIC_STOP', params: {} }) + ';')
      .catch(() => {});
  }
}

function base64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Wrap raw mono PCM (8-bit unsigned or 16-bit LE signed) into a base64 WAV. */
export function pcmToWavB64(pcm: Uint8Array, sr = 8000, bits: 8 | 16 = 8): string {
  const n = pcm.length;
  const block = bits / 8;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  w(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * block, true);
  v.setUint16(32, block, true);
  v.setUint16(34, bits, true);
  w(36, 'data');
  v.setUint32(40, n, true);
  new Uint8Array(buf, 44).set(pcm);
  const b = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin);
}

// Whisper's classic hallucinations on silence / noise (YouTube outro captions).
const HALLUCINATION =
  /terima kasih (telah|sudah|udah|karena) (menonton|nonton)|jangan lupa (like|subscribe)|subtitle|amara\.org|sampai jumpa di video/i;

/** Trim a transcript; null when it is empty or a known silence hallucination. */
export function cleanTranscript(text: string | undefined | null): string | null {
  const t = (text || '').trim();
  if (!t || HALLUCINATION.test(t) || !/[\p{L}\p{N}]/u.test(t)) return null;
  return t;
}

/**
 * Record via the robot mic and transcribe. The robot stops by itself when you stop
 * talking (or after `maxSecs`); call stopRobotListening() to end it early.
 */
export function listenViaRobot(maxSecs = 8): Promise<string | null> {
  const { transport, robotInfo } = getState();
  if (!transport || !robotCanListen()) return Promise.resolve(null);
  const modern = !!robotInfo?.capabilities?.includes('MIC_STOP');
  const slow = isSlowLink(transport);
  const params = modern
    ? { secs: maxSecs, sr: slow ? 8000 : 16000, bits: slow ? 8 : 16, vad: true }
    : { secs: Math.min(4, maxSecs) };

  return new Promise((resolve) => {
    const chunks: Record<number, Uint8Array> = {};
    let done = false;
    const finish = (val: string | null) => {
      if (done) return;
      done = true;
      off();
      clearTimeout(timer);
      resolve(val);
    };

    // Safety timeout: record window + transfer (8 KB/s on BLE) + Whisper.
    const timer = setTimeout(() => finish(null), (maxSecs + (slow ? 25 : 15)) * 1000);

    const off = onTelemetry(
      (msg: { command?: string; params?: Record<string, unknown> } & Record<string, unknown>) => {
        const c = msg?.command;
        const p = (msg?.params ?? msg) as Record<string, unknown>;
        if (c === 'MIC_DATA') {
          chunks[Number(p.seq) || 0] = base64ToU8(String(p.data || ''));
        } else if (c === 'MIC_END') {
          const ordered = Object.keys(chunks)
            .map(Number)
            .sort((a, b) => a - b)
            .map((k) => chunks[k]);
          const total = ordered.reduce((s, a) => s + a.length, 0);
          if (!total) {
            finish(null);
            return;
          }
          const pcm = new Uint8Array(total);
          let o = 0;
          for (const a of ordered) {
            pcm.set(a, o);
            o += a.length;
          }
          const sr = Number(p.sr) === 16000 ? 16000 : 8000;
          const bits = Number(p.bits) === 16 ? 16 : 8;
          (async () => {
            try {
              const r = await fetch(STT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio: pcmToWavB64(pcm, sr, bits), lang: 'id' }),
              });
              const d = (await r.json()) as { text?: string };
              finish(cleanTranscript(d.text));
            } catch {
              finish(null);
            }
          })();
        }
      },
    );

    transport
      .sendLine(JSON.stringify({ command: 'MIC_STT', params }) + ';')
      .catch(() => finish(null));
  });
}
