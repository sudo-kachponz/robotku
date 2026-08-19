// src/transport/SerialTransport.ts
//
// Web Serial (USB) transport — identical wire protocol to BLE. Fallback path for
// Chromium browsers without Web Bluetooth, and for wired benches.

import { BaseTransport } from './BaseTransport';

const BAUD_RATE = 115200;

export class SerialTransport extends BaseTransport {
  readonly kind = 'serial' as const;

  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private decoder = new TextDecoder();
  private readLoopActive = false;

  protected async openTransport(): Promise<void> {
    if (!navigator.serial) {
      throw new Error('Web Serial is not available in this browser.');
    }

    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: BAUD_RATE });

    if (!this.port.writable || !this.port.readable) {
      throw new Error('Serial port has no readable/writable stream.');
    }
    this.writer = this.port.writable.getWriter();
    this.reader = this.port.readable.getReader();

    this.readLoopActive = true;
    void this.readLoop();
  }

  protected async closeTransport(): Promise<void> {
    this.readLoopActive = false;
    try {
      await this.reader?.cancel();
    } catch {
      /* ignore */
    }
    try {
      this.reader?.releaseLock();
    } catch {
      /* ignore */
    }
    try {
      await this.writer?.close();
    } catch {
      /* ignore */
    }
    try {
      this.writer?.releaseLock();
    } catch {
      /* ignore */
    }
    try {
      await this.port?.close();
    } catch {
      /* ignore */
    }
    this.reader = null;
    this.writer = null;
    this.port = null;
  }

  protected async writeChunk(bytes: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error('Serial not connected');
    await this.writer.write(bytes);
  }

  private async readLoop(): Promise<void> {
    if (!this.reader) return;
    try {
      while (this.readLoopActive) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) this.handleIncoming(this.decoder.decode(value));
      }
    } catch (err) {
      console.warn('[serial] read loop ended', err);
    } finally {
      if (this.readLoopActive) {
        // Loop ended unexpectedly (cable pulled) -> failsafe.
        this.handleUnexpectedDisconnect();
      }
    }
  }
}
