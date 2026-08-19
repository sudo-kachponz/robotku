// src/transport/BleTransport.ts
//
// Web Bluetooth transport over the Nordic UART Service (NUS). Protocol-agnostic:
// all HELLO/HEARTBEAT/framing logic lives in BaseTransport; this file only knows
// how to open a GATT device and push/pull bytes.

import { BaseTransport } from './BaseTransport';

const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX_WRITE = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // write (to board)
const NUS_TX_NOTIFY = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // notify (from board)

export class BleTransport extends BaseTransport {
  readonly kind = 'ble' as const;

  private device: BluetoothDevice | null = null;
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null;
  private txChar: BluetoothRemoteGATTCharacteristic | null = null;
  private decoder = new TextDecoder();
  private canWriteWithoutResponse = true;

  private onGattDisconnected = () => {
    this.rxChar = null;
    this.txChar = null;
    this.handleUnexpectedDisconnect();
  };

  protected async openTransport(): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth is not available in this browser.');
    }

    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [NUS_SERVICE] }],
      optionalServices: [NUS_SERVICE],
    });

    this.device.addEventListener('gattserverdisconnected', this.onGattDisconnected);

    const server = await this.device.gatt!.connect();
    const service = await server.getPrimaryService(NUS_SERVICE);

    this.rxChar = await service.getCharacteristic(NUS_RX_WRITE);
    this.txChar = await service.getCharacteristic(NUS_TX_NOTIFY);

    // Prefer writeWithoutResponse when the characteristic supports it.
    this.canWriteWithoutResponse = this.rxChar.properties.writeWithoutResponse;

    this.txChar.addEventListener('characteristicvaluechanged', this.onNotify);
    await this.txChar.startNotifications();
  }

  protected async closeTransport(): Promise<void> {
    if (this.txChar) {
      this.txChar.removeEventListener('characteristicvaluechanged', this.onNotify);
      try {
        await this.txChar.stopNotifications();
      } catch {
        /* ignore */
      }
    }
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.onGattDisconnected);
      if (this.device.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    }
    this.device = null;
    this.rxChar = null;
    this.txChar = null;
  }

  protected async writeChunk(bytes: Uint8Array): Promise<void> {
    if (!this.rxChar) throw new Error('BLE not connected');
    // Copy into a fresh ArrayBuffer-backed view to satisfy BufferSource typing.
    const buf = new Uint8Array(bytes);
    if (this.canWriteWithoutResponse) {
      await this.rxChar.writeValueWithoutResponse(buf);
    } else {
      await this.rxChar.writeValueWithResponse(buf);
    }
  }

  private onNotify = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;
    this.handleIncoming(this.decoder.decode(value));
  };
}
