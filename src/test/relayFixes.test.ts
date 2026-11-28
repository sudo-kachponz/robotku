// src/test/relayFixes.test.ts
//
// Regression guards for "connected, but nothing reaches the hardware":
//  - AI blocks must never be streamed raw to the firmware (it answers UNSUPPORTED);
//    the voice goes to the robot's speaker via TTS_BEGIN/CHUNK/END.
//  - speakViaRobot must say WHY it fell back to the laptop.
//  - the relay link is remembered across reloads/new tabs.
//  - HELLO_ACK (incl. diag) parses the same for the handshake and a re-HELLO.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { setActiveTransport, setRobotInfo } from '../app/store';
import type { RobotTransport } from '../transport';
import { TransportSink } from '../runtime/TransportSink';
import { speakViaRobot } from '../ailabs/robotVoice';
import { robotInfoFromHelloAck, RELAY_CLOSE } from '../domain/protocol';
import { getSavedLink, dispatchTelemetry } from '../app/connection';

function mockTransport(kind: 'relay' | 'ble' = 'relay') {
  const sent: string[] = [];
  const t = {
    kind,
    sendLine: (line: string) => {
      sent.push(line);
      return Promise.resolve();
    },
  } as unknown as RobotTransport;
  return { t, sent };
}

// Fake TTS backend + WebAudio decode/resample (jsdom has none of them).
function fakeAudio(seconds = 0.5) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify({ audio: btoa('RIFF') }), { status: 200 }),
  );
  class FakeCtx {
    async decodeAudioData() {
      return { sampleRate: 8000, duration: seconds, getChannelData: () => new Float32Array(8000 * seconds) };
    }
    close() {}
  }
  class FakeOffline {
    constructor(_ch: number, private len: number) {}
    createBufferSource() {
      return { buffer: null, connect() {}, start() {} };
    }
    async startRendering() {
      const n = this.len;
      return { getChannelData: () => new Float32Array(n) };
    }
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
  (globalThis as unknown as { OfflineAudioContext: unknown }).OfflineAudioContext = FakeOffline;
}

afterEach(() => {
  setActiveTransport(null);
  setRobotInfo(null);
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('AI voice goes to the robot, never raw to firmware', () => {
  it('TransportSink does not send AI_SPEAK as a firmware command', async () => {
    const { t, sent } = mockTransport();
    setActiveTransport(t);
    // Board without TTS -> falls back, but still must not stream AI_SPEAK raw.
    setRobotInfo({ fwVersion: 'x', board: 'b', protocol: 'p', capabilities: [], ports: [] });
    const sink = new TransportSink(t);
    await sink.exec({ command: 'AI_SPEAK', params: { text: 'halo' } } as never);
    expect(sent.some((l) => l.includes('AI_SPEAK'))).toBe(false);
  });

  it('streams TTS_BEGIN/TTS_CHUNK/TTS_END when the robot has a speaker', async () => {
    const { t, sent } = mockTransport();
    setActiveTransport(t);
    setRobotInfo({ fwVersion: 'x', board: 'b', protocol: 'p', capabilities: ['TTS_BEGIN'], ports: [] });
    fakeAudio(0.1);
    const res = await speakViaRobot('halo robot');
    expect(res.ok).toBe(true);
    expect(sent[0]).toContain('TTS_BEGIN');
    expect(sent.some((l) => l.includes('TTS_CHUNK'))).toBe(true);
    expect(sent[sent.length - 1]).toContain('TTS_END');
  });

  it('2.6 firmware: sentences are appended to one take and end on TTS_DONE', async () => {
    const { t, sent } = mockTransport('relay');
    setActiveTransport(t);
    setRobotInfo({ fwVersion: '2.6.0-mk', board: 'b', protocol: 'p', capabilities: ['TTS_BEGIN', 'TTS_STREAM', 'TTS_SR16'], ports: [] });
    fakeAudio(0.5);
    const done = speakViaRobot('Halo, aku robot kamu. Ayo kita belajar coding bareng!');
    // Answer TTS_DONE for the LAST end as soon as it has been sent.
    const ends = () => sent.filter((l) => l.includes('TTS_END'));
    await vi.waitFor(() => expect(ends()).toHaveLength(2));
    const begins = sent.filter((l) => l.includes('TTS_BEGIN')).map((l) => JSON.parse(l.slice(0, -1)).params);
    expect(begins[0]).toMatchObject({ sr: 16000, append: false, pre_ms: 300 });
    expect(begins[1]).toMatchObject({ sr: 16000, append: true });
    const lastSeq = JSON.parse(ends()[1].slice(0, -1)).params.seq;
    dispatchTelemetry({ command: 'TTS_DONE', params: { seq: lastSeq - 1 } }); // stale: ignored
    let settled = false;
    void done.then(() => (settled = true));
    await new Promise((r) => setTimeout(r, 250));
    expect(settled).toBe(false);
    dispatchTelemetry({ command: 'TTS_DONE', params: { seq: lastSeq } });
    expect(await done).toEqual({ ok: true });
  });

  it('BLE link: 8 kHz and the robot buffers the whole first sentence', async () => {
    const { t, sent } = mockTransport('ble');
    setActiveTransport(t);
    setRobotInfo({ fwVersion: '2.6.0-mk', board: 'b', protocol: 'p', capabilities: ['TTS_BEGIN', 'TTS_STREAM', 'TTS_SR16'], ports: [] });
    fakeAudio(0.1);
    const done = speakViaRobot('Halo semuanya, apa kabar?');
    await vi.waitFor(() => expect(sent.some((l) => l.includes('TTS_END'))).toBe(true));
    expect(JSON.parse(sent[0].slice(0, -1)).params).toMatchObject({ sr: 8000, pre_ms: 120000 });
    const seq = JSON.parse(sent[sent.length - 1].slice(0, -1)).params.seq;
    dispatchTelemetry({ command: 'TTS_DONE', params: { seq } });
    expect(await done).toEqual({ ok: true });
  });

  it('reports a reason instead of silently using the laptop', async () => {
    expect(await speakViaRobot('halo')).toEqual({ ok: false, reason: 'not_connected' });
    const { t } = mockTransport();
    setActiveTransport(t);
    setRobotInfo({ fwVersion: '0.0.0-fake', board: 'FAKE ROBOT (test)', protocol: 'p', capabilities: [], ports: [] });
    const r = await speakViaRobot('halo');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no_speaker');
  });
});

describe('relay link + HELLO_ACK', () => {
  it('remembers only a valid relay link', () => {
    expect(getSavedLink()).toBeNull();
    window.localStorage.setItem('robotku.lastLink', JSON.stringify({ kind: 'relay', id: 'ABC234' }));
    expect(getSavedLink()).toEqual({ kind: 'relay', id: 'ABC234' });
    window.localStorage.setItem('robotku.lastLink', JSON.stringify({ kind: 'relay', id: 'bad' }));
    expect(getSavedLink()).toBeNull();
  });

  it('parses HELLO_ACK including firmware diag', () => {
    const info = robotInfoFromHelloAck({
      command: 'HELLO_ACK',
      fw: '2.5.0-mk',
      board: 'Robotku Makerkit S3 v1.3',
      capabilities: ['TTS_BEGIN'],
      ports: [1, 2, 5],
      diag: { reset: 'BROWNOUT', psram: 8388608 },
    } as never);
    expect(info.fwVersion).toBe('2.5.0-mk');
    expect(info.diag?.reset).toBe('BROWNOUT');
  });

  it('takeover close code (4412) is not auto-retried', () => {
    expect(RELAY_CLOSE[4412]?.retry).toBe('no');
  });
});
