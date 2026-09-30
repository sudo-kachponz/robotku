// src/ailabs/mic.ts
//
// Mikrofon browser untuk tahap DENGAR (docs/AI-LABS.md §3/§5): level suara (VU) +
// deteksi tepuk (ambang + cooldown, meniru CLAP_THRESHOLD/COOLDOWN firmware).
// Dipakai saat robot TIDAK terhubung; kalau robot ada, MIC_CLAP dari board yang
// dipakai. Bukan STT — cuma level mentah (§6: mic ESP32 hanya untuk tepuk).

export type MicState = 'idle' | 'unsupported' | 'denied' | 'active';

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

export class MicListener {
  state: MicState = 'idle';
  onClap?: () => void;
  // Ambang 0..1 pada amplitudo puncak; cooldown supaya satu tepuk tak dihitung ganda.
  clapThreshold = 0.16;
  cooldownMs = 600;

  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  // Inferred Uint8Array<ArrayBuffer> (narrow) so getByteTimeDomainData accepts it on TS 5.7+.
  private buf = new Uint8Array(0);
  private lastClap = 0;

  async start(): Promise<MicState> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.state = 'unsupported';
      return this.state;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!Ctor) {
        this.state = 'unsupported';
        return this.state;
      }
      this.ctx = new Ctor();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      src.connect(this.analyser);
      this.buf = new Uint8Array(this.analyser.fftSize);
      this.state = 'active';
    } catch {
      this.state = 'denied';
    }
    return this.state;
  }

  /** Amplitudo puncak 0..1 untuk VU; sekaligus memicu onClap saat lewat ambang. */
  level(): number {
    if (this.state !== 'active' || !this.analyser || this.buf.length === 0) return 0;
    this.analyser.getByteTimeDomainData(this.buf);
    let peak = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const v = Math.abs(this.buf[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (peak >= this.clapThreshold && now - this.lastClap > this.cooldownMs) {
      this.lastClap = now;
      this.onClap?.();
    }
    return peak;
  }

  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.buf = new Uint8Array(0);
    this.state = 'idle';
  }
}

/** Isyarat menetas (placeholder WebAudio). Robot: SPEAKER_PLAY_PCM welcome_audio;
 *  browser: welcome_audio.h belum diekspor ke JS, jadi untuk sekarang jingle naik. */
export function playHatchCue(): void {
  try {
    const Ctor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      const t0 = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.14);
    });
    setTimeout(() => void ctx.close(), 900);
  } catch {
    // audio tak tersedia — abaikan
  }
}
