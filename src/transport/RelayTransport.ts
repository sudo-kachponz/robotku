// src/transport/RelayTransport.ts
//
// Relay transport — connects to the robotku relay server (Cloudflare Worker +
// Durable Object) over wss://. The relay pairs a browser controller with a
// robot by ID. Same JSON wire protocol as direct WiFi, but openTransport waits
// for the RELAY "linked" frame before resolving, and relay control frames are
// filtered from telemetry.

import { BaseTransport } from './BaseTransport';
import { isRelayFrame, RELAY_CLOSE } from '../domain/protocol';

const OPEN_TIMEOUT_MS = 6000;

export class RelayTransport extends BaseTransport {
  readonly kind = 'relay' as const;

  private ws: WebSocket | null = null;
  private opened = false;
  private readonly decoder = new TextDecoder();

  /** Last close code/reason from the relay, for UI display. */
  lastCloseCode: number | undefined;
  lastCloseReason: string | undefined;

  constructor(
    private readonly url: string,
    private readonly robotId: string,
  ) {
    super();
  }

  // Relay has higher latency — widen the heartbeat/chunk windows per Fajri's notes
  protected override get maxChunk(): number { return 4000; }
  protected override get heartbeatIntervalMs(): number { return 1000; }
  protected override get heartbeatTimeoutMs(): number { return 5000; }
  protected override get helloTimeoutMs(): number { return 6000; }

  protected openTransport(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.url}/ws?role=web&id=${this.robotId}`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      this.ws = ws;
      ws.binaryType = 'arraybuffer';

      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch { /* ignore */ }
        reject(new Error('Relay: timeout menyambung ke server'));
      }, OPEN_TIMEOUT_MS);

      const fail = (code: number | undefined, reason: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.lastCloseCode = code;
        this.lastCloseReason = reason;
        const info = code ? RELAY_CLOSE[code] : undefined;
        reject(new Error(info?.message ?? reason ?? 'Relay: koneksi ditolak'));
      };

      ws.onerror = () => {
        if (!settled && !this.opened) {
          fail(undefined, 'Server relay tidak terjangkau. Periksa koneksi internet.');
        }
      };

      ws.onclose = (e: CloseEvent) => {
        if (!settled) {
          // Relay rejection: open then immediate close with 44xx code
          fail(e.code, e.reason);
          return;
        }
        // Post-linked close (robot disconnected mid-session, etc.)
        if (this.opened) {
          this.lastCloseCode = e.code;
          this.lastCloseReason = e.reason;
          this.opened = false;
          const info = RELAY_CLOSE[e.code];
          this.handleUnexpectedDisconnect(
            info?.message ?? e.reason ?? `Relay closed (${e.code})`,
          );
        }
      };

      ws.onmessage = (e: MessageEvent) => {
        const raw = typeof e.data === 'string' ? e.data : this.decoder.decode(e.data as ArrayBuffer);

        // Before linked: look for the RELAY linked frame
        if (!settled) {
          // Parse relay frame out of the raw text
          try {
            const clean = raw.replace(/;\s*$/, '').trim();
            const msg = JSON.parse(clean);
            if (msg.command === 'RELAY' && msg.event === 'linked') {
              settled = true;
              this.opened = true;
              clearTimeout(timer);
              resolve();
              return;
            }
          } catch { /* not JSON yet, keep waiting */ }
          return;
        }

        // After linked: filter RELAY control frames, forward the rest
        this.handleIncomingRelay(raw);
      };

      ws.onopen = () => {
        // Don't resolve yet — wait for RELAY linked frame
      };
    });
  }

  /** Filter RELAY frames from reaching telemetry subscribers. */
  private handleIncomingRelay(raw: string): void {
    // Quick check: if the raw text contains "RELAY", parse and filter
    if (raw.includes('"RELAY"')) {
      // Split on frame boundaries and filter
      const frames = raw.split(/(?<=;)\s*/);
      const filtered: string[] = [];
      for (const frame of frames) {
        const trimmed = frame.trim();
        if (!trimmed) continue;
        try {
          const clean = trimmed.replace(/;\s*$/, '');
          const msg = JSON.parse(clean);
          if (isRelayFrame(msg)) continue; // drop RELAY frames
        } catch { /* not parseable alone, pass through */ }
        filtered.push(trimmed);
      }
      if (filtered.length > 0) {
        this.handleIncoming(filtered.join(''));
      }
      return;
    }
    // No RELAY command — pass through directly
    this.handleIncoming(raw);
  }

  protected async closeTransport(): Promise<void> {
    this.opened = false;
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
    try { ws.close(); } catch { /* ignore */ }
  }

  protected async writeChunk(bytes: Uint8Array): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Relay not connected');
    }
    this.ws.send(this.decoder.decode(bytes));
  }
}
