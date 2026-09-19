// src/transport/BleTransport.ts
//
// Web Bluetooth transport over the Nordic UART Service (NUS). Protocol-agnostic:
// all HELLO/HEARTBEAT/framing logic lives in BaseTransport; this file only knows
// how to open a GATT device and push/pull bytes.

import { BaseTransport } from './BaseTransport';

const BLE_NAME = 'Robotku'; // firmware's advertised name — match it when reusing a granted device
const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_RX_WRITE = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // write (to board)
const NUS_TX_NOTIFY = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // notify (from board)

export class BleTransport extends BaseTransport {
  readonly kind = 'ble' as const;

  private device: BluetoothDevice | null = null;
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null;
  private txChar: BluetoothRemoteGATTCharacteristic | null = null;
  private decoder = new TextDecoder();

  private onGattDisconnected = () => {
    this.rxChar = null;
    this.txChar = null;
    this.handleUnexpectedDisconnect();
  };

  protected async openTransport(): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth is not available in this browser.');
    }

    // Reuse a previously-granted device so RECONNECTS (and revisits) need NO picker
    // gesture — getDevices() returns already-permitted devices. Only the first-time
    // grant falls back to the native picker (which requires a user gesture).
    let device: BluetoothDevice | null = null;
    try {
      const granted = (await navigator.bluetooth.getDevices?.()) ?? [];
      device = granted.find((d) => d.name === BLE_NAME) ?? null;
    } catch {
      /* getDevices unsupported (no flag) → fall through to the picker */
    }
    if (!device) {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [NUS_SERVICE] }],
        optionalServices: [NUS_SERVICE],
      });
    }
    this.device = device;

    this.device.addEventListener('gattserverdisconnected', this.onGattDisconnected);

    const server = await this.device.gatt!.connect();
    const service = await server.getPrimaryService(NUS_SERVICE);

    this.rxChar = await service.getCharacteristic(NUS_RX_WRITE);
    this.txChar = await service.getCharacteristic(NUS_TX_NOTIFY);

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
    // Use WITH-response writes: each waits for the board's ACK, giving flow control.
    // writeWithoutResponse let a big DISPLAY_BITMAP (~46 chunks) flood the ESP32's BLE
    // buffer and drop the link — response writes pace themselves and stay stable.
    if (this.rxChar.properties.write) {
      await this.rxChar.writeValueWithResponse(buf);
    } else {
      await this.rxChar.writeValueWithoutResponse(buf);
    }
  }

  private onNotify = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    const value = target.value;
    if (!value) return;
    this.handleIncoming(this.decoder.decode(value));
  };
}
