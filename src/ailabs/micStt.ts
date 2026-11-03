// src/ailabs/micStt.ts
//
// Voice input FROM the robot's mic. Pipeline: MIC_STT {secs} -> firmware records the
// INMP441, streams back base64 MIC_DATA chunks + MIC_END over the active transport
// (BLE / WiFi-WS / relay) -> we reassemble 8 kHz 8-bit PCM -> wrap a WAV -> backend
// /stt (Workers AI Whisper) -> text. Returns null on any failure so the caller can
// fall back to the browser mic.

import { getState } from '../app/store';
import { onTelemetry } from '../app/connection';

const STT_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_FIRA_STT_URL) ||
  'https://robotku-ai.hubrobotku.workers.dev/stt';

/** True when a robot with mic-STT firmware is connected. */
export function robotCanListen(): boolean {
  const { transport, robotInfo } = getState();
  return !!transport && !!robotInfo?.capabilities?.includes('MIC_STT');
}

function base64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Wrap 8 kHz 8-bit unsigned mono PCM into a base64 WAV (what Whisper accepts). */
function pcmU8ToWavB64(pcm: Uint8Array, sr = 8000): string {
  const n = pcm.length;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, pcm[i]);
  const b = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin);
}

/**
 * Record via the robot mic and transcribe. Returns the recognised text, or null.
 */
export function listenViaRobot(secs = 3): Promise<string | null> {
  const { transport } = getState();
  if (!transport || !robotCanListen()) return Promise.resolve(null);

  return new Promise((resolve) => {
    const chunks: Record<number, Uint8Array> = {};
    let done = false;

    const finish = (val: string | null) => {
      if (done) return;
      done = true;
      off();
      resolve(val);
    };

    const off = onTelemetry((msg: { command?: string; params?: Record<string, unknown> } & Record<string, unknown>) => {
      const c = msg?.command;
      const p = (msg?.params ?? msg) as Record<string, unknown>;
      if (c === 'MIC_DATA') {
        chunks[Number(p.seq) || 0] = base64ToU8(String(p.data || ''));
      } else if (c === 'MIC_END') {
        const ordered = Object.keys(chunks).map(Number).sort((a, b) => a - b).map((k) => chunks[k]);
        const total = ordered.reduce((s, a) => s + a.length, 0);
        if (!total) { finish(null); return; }
        const pcm = new Uint8Array(total);
        let o = 0;
        for (const a of ordered) { pcm.set(a, o); o += a.length; }
        (async () => {
          try {
            const r = await fetch(STT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: pcmU8ToWavB64(pcm) }),
            });
            const d = (await r.json()) as { text?: string };
            finish((d.text || '').trim() || null);
          } catch {
            finish(null);
          }
        })();
      }
    });

    transport
      .sendLine(JSON.stringify({ command: 'MIC_STT', params: { secs } }) + ';')
      .catch(() => finish(null));

    // Safety timeout: record window + transfer + Whisper.
    setTimeout(() => finish(null), (secs + 10) * 1000);
  });
}
