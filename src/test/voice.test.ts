// Robot voice pipeline helpers: sentence streaming, speech cleanup, WAV framing,
// Whisper hallucination filter.
import { describe, it, expect } from 'vitest';
import { SentenceSplitter, cleanForSpeech, floatToU8, floatToUlaw } from '../ailabs/robotVoice';
import { pcmToWavB64, cleanTranscript } from '../ailabs/micStt';

describe('SentenceSplitter', () => {
  it('emits sentences as the stream crosses their end, keeps the tail', () => {
    const sp = new SentenceSplitter();
    expect(sp.feed('Halo! Aku Robotku AI, teman ')).toEqual([]); // "Halo!" too short alone
    expect(sp.feed('belajarmu. Kita coba')).toEqual(['Halo! Aku Robotku AI, teman belajarmu.']);
    expect(sp.feed(' robot ya? Ayo')).toEqual(['Kita coba robot ya?']);
    expect(sp.flush()).toBe('Ayo');
    expect(sp.flush()).toBe('');
  });

  it('does not split decimals and splits on newlines', () => {
    const sp = new SentenceSplitter();
    expect(sp.feed('Kecepatannya 3.5 meter per detik.\nLalu ')).toEqual([
      'Kecepatannya 3.5 meter per detik.',
    ]);
  });
});

describe('cleanForSpeech', () => {
  it('drops emoji, markdown and URLs', () => {
    expect(cleanForSpeech('**Halo** 🤖👋 lihat https://robotku.id ya!')).toBe('Halo lihat ya!');
  });
});

describe('floatToU8', () => {
  it('centres silence at 128 and normalises a quiet signal to near full scale', () => {
    const pcm = floatToU8(new Float32Array([0, 0.3, -0.3, 0]));
    expect(pcm[0]).toBe(128);
    expect(pcm[1]).toBeGreaterThan(240);
    expect(pcm[2]).toBeLessThan(16);
  });
});

describe('floatToUlaw', () => {
  // Same decode as the firmware's ulawTable (main.cpp ulawInit).
  const dec = (b: number) => {
    const u = ~b & 0xff;
    const t = (((u & 0x0f) << 3) + 0x84) << ((u & 0x70) >> 4);
    return u & 0x80 ? 0x84 - t : t - 0x84;
  };
  it('round-trips through the firmware decoder (silence = 0xFF, peak = 0.95 FS)', () => {
    const x = new Float32Array([0, 1, -1, 0.5, -0.25]);
    const u = floatToUlaw(x);
    expect(u[0]).toBe(0xff);
    [0, 0.95, -0.95, 0.475, -0.2375].forEach((want, i) => {
      expect(Math.abs(dec(u[i]) / 32767 - want)).toBeLessThan(0.02); // within one mu-law step
    });
  });
  it('keeps quiet samples distinct where 8-bit linear flattens them', () => {
    const quiet = new Float32Array([1, 0.004, 0.008, 0.012]); // loud first sample fixes the gain
    expect(new Set(floatToUlaw(quiet).slice(1)).size).toBe(3);
    expect(new Set(floatToU8(quiet).slice(1)).size).toBeLessThan(3);
  });
});

describe('pcmToWavB64', () => {
  const header = (b64: string) => {
    const bin = atob(b64);
    const v = new DataView(Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer);
    return {
      sr: v.getUint32(24, true),
      byteRate: v.getUint32(28, true),
      align: v.getUint16(32, true),
      bits: v.getUint16(34, true),
      data: v.getUint32(40, true),
      len: bin.length,
    };
  };
  it('writes a 16 kHz 16-bit header', () => {
    expect(header(pcmToWavB64(new Uint8Array(320), 16000, 16))).toEqual({
      sr: 16000,
      byteRate: 32000,
      align: 2,
      bits: 16,
      data: 320,
      len: 364,
    });
  });
  it('keeps the legacy 8 kHz 8-bit default', () => {
    expect(header(pcmToWavB64(new Uint8Array(80)))).toMatchObject({
      sr: 8000,
      byteRate: 8000,
      align: 1,
      bits: 8,
    });
  });
});

describe('cleanTranscript', () => {
  it('rejects empty, punctuation-only and silence hallucinations', () => {
    expect(cleanTranscript('')).toBeNull();
    expect(cleanTranscript(' ... ')).toBeNull();
    expect(cleanTranscript('Terima kasih telah menonton!')).toBeNull();
    expect(cleanTranscript('  robot maju dong ')).toBe('robot maju dong');
  });
});
