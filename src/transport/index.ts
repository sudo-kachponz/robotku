// src/transport/index.ts
//
// Capability detection + factory. This is the only module UI code imports to
// obtain a transport; everything downstream is the RobotTransport interface.

import type { RobotTransport } from './RobotTransport';
import { BleTransport } from './BleTransport';
import { SerialTransport } from './SerialTransport';
import { WsTransport } from './WsTransport';
import { RelayTransport } from './RelayTransport';

export type { RobotTransport, ConnState, RobotInfo } from './RobotTransport';
export { RelayTransport } from './RelayTransport';

export type TransportKind = 'ble' | 'serial' | 'ws' | 'relay';

// WiFi target for the WS transport, set by connection.connectWifi() before connect('ws')
// so the whole connect/reconnect machinery works unchanged.
let wsUrl = 'ws://robotku.local:81';
export function setWsUrl(url: string): void {
  wsUrl = url;
}
export function getWsUrl(): string {
  return wsUrl;
}

// Relay target, set by connection.connectRelay() before connect('relay').
const DEFAULT_RELAY_URL =
  typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_RELAY_URL
    ? process.env.NEXT_PUBLIC_RELAY_URL
    : 'ws://localhost:8787';

let relayUrl = DEFAULT_RELAY_URL;
let relayRobotId = '';

export function setRelayTarget(target: { url?: string; id: string }): void {
  if (target.url) relayUrl = target.url;
  relayRobotId = target.id.toUpperCase().trim();
}
export function getRelayTarget(): { url: string; id: string } {
  return { url: relayUrl, id: relayRobotId };
}

/** WebSocket exists in every modern browser; mixed-content (https -> ws://) is the real gate. */
export function isWsSupported(): boolean {
  return typeof WebSocket !== 'undefined';
}

/** Web Bluetooth support (Chromium on HTTPS/localhost). */
export function isBleSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

/** Web Serial support (Chromium on HTTPS/localhost). */
export function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serial;
}

/** True if the browser can talk to hardware at all. */
export function isAnyTransportSupported(): boolean {
  return isBleSupported() || isSerialSupported();
}

/** Create a concrete transport for the requested kind. */
export function createTransport(kind: TransportKind): RobotTransport {
  switch (kind) {
    case 'ble':
      return new BleTransport();
    case 'serial':
      return new SerialTransport();
    case 'ws':
      return new WsTransport(wsUrl);
    case 'relay':
      return new RelayTransport(relayUrl, relayRobotId);
    default:
      throw new Error(`Unknown transport kind: ${kind}`);
  }
}

/** Pick the best available transport kind (BLE preferred, Serial fallback). */
export function pickTransport(): TransportKind | null {
  if (isBleSupported()) return 'ble';
  if (isSerialSupported()) return 'serial';
  return null;
}
