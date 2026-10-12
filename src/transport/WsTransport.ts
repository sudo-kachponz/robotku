// src/transport/WsTransport.ts
//
// WiFi transport — a WebSocket to the ESP32's WS server (ws://<robot>:81, firmware
// 2.3.x "wifi-phase1"). Same JSON wire protocol as BLE/Serial, so BaseTransport does
// all the work; this only opens/closes the socket and writes TEXT frames.
//
// NOTE (mixed content): browsers block ws:// from an https:// page. This works when
// the app is served over http/localhost or hosted by the robot itself — the connect
// UI warns about this.

import { BaseTransport } from './BaseTransport';

const OPEN_TIMEOUT_MS = 6000;

export class WsTransport extends BaseTransport {
  readonly kind = 'ws' as const;

  private ws: WebSocket | null = null;
  private opened = false;
  private readonly decoder = new TextDecoder();

  constructor(private readonly url: string) {
    super();
  }

  protected openTransport(): Promise<void> {
    return new Promise((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(this.url);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      this.ws = ws;
      ws.binaryType = 'arraybuffer';

      const timer = setTimeout(() => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        reject(new Error(`WiFi: tak bisa menyambung ke ${this.url} (timeout)`));
      }, OPEN_TIMEOUT_MS);

      ws.onopen = () => {
        clearTimeout(timer);
        this.opened = true;
        resolve();
      };
      ws.onerror = () => {
        if (!this.opened) {
          clearTimeout(timer);
          reject(
            new Error(
              `WiFi: gagal ke ${this.url}. Cek IP/jaringan — dan ws:// hanya jalan dari halaman http/localhost (bukan https).`,
            ),
          );
        }
      };
      ws.onmessage = (e: MessageEvent) => {
        const d = e.data;
        this.handleIncoming(typeof d === 'string' ? d : this.decoder.decode(d as ArrayBuffer));
      };
      ws.onclose = () => {
        if (this.opened) {
          this.opened = false;
          this.handleUnexpectedDisconnect();
        }
      };
    });
  }

  protected async closeTransport(): Promise<void> {
    this.opened = false;
    const ws = this.ws;
    this.ws = null;
    if (!ws) return;
    ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  }

  protected async writeChunk(bytes: Uint8Array): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WiFi not connected');
    }
    // The firmware WS server handles WStype_TEXT (the JSON protocol is ASCII, so
    // byte-level chunking from BaseTransport never splits a multibyte char).
    this.ws.send(this.decoder.decode(bytes));
  }
}
