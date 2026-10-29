// src/app/connection.ts
//
// Connection use-cases. UI calls these; they orchestrate the transport, the app
// store, the command_runner and telemetry. UI never touches a concrete transport
// directly — only this controller and the RobotTransport interface.

import {
  createTransport,
  setWsUrl,
  setRelayTarget,
  RelayTransport,
  type ConnState,
  type RobotInfo,
  type TransportKind,
} from '../transport';
import { setWifiLine, otaUpdateLine, RELAY_ID_RE, RELAY_CLOSE } from '../domain/protocol';
import {
  setActiveTransport as storeSetTransport,
  setConnState,
  setRobotInfo,
  getState,
} from './store';
import { setActiveTransport as runnerSetTransport } from '../command_runner';
import { showToast } from '../ui/toast';

type TelemetryCb = (msg: any) => void;
const telemetryCbs = new Set<TelemetryCb>();

/**
 * Subscribe to telemetry frames. Returns an unsubscribe. Multiple subscribers
 * coexist (the Serial Monitor and telemetryCache both listen) — previously a
 * second subscriber silently replaced the first.
 */
export function onTelemetry(cb: TelemetryCb): () => void {
  telemetryCbs.add(cb);
  return () => {
    telemetryCbs.delete(cb);
  };
}

/** Fan a telemetry frame out to every subscriber (used by the active transport). */
export function dispatchTelemetry(msg: any): void {
  for (const cb of telemetryCbs) cb(msg);
}

// ── Persistent-connection state ──────────────────────────────────────────────
// Once connected, the link must survive page navigation and transient drops — only
// an explicit user disconnect ends it. Serial reuses getPorts(); BLE reuses
// getDevices() (see BleTransport), so both reconnect with NO user gesture.
let lastKind: TransportKind | null = null;
let userDisconnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
// Show the "menyambung ulang…" toast once per drop episode, not once per retry —
// a BLE reconnect can take several GATT-error attempts and the spam is alarming.
let reconnectToastShown = false;
const MAX_RECONNECT = 30;

function clearReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

// Last relay close code, used to decide reconnect policy
let lastRelayCloseCode: number | undefined;

/** Schedule a silent reconnect after an UNEXPECTED drop (never after a user disconnect). */
function scheduleReconnect(): void {
  if (userDisconnected || lastKind == null) return;
  const st = getState();
  if (st.connState === 'connected' || st.connState === 'connecting') return;
  if (reconnectAttempts >= MAX_RECONNECT) return;

  // Relay: only retry on codes that make sense (4404 offline, 4410 robot dropped, network error)
  if (lastKind === 'relay' && lastRelayCloseCode) {
    const info = RELAY_CLOSE[lastRelayCloseCode];
    if (info && info.retry === 'no') return; // 4400, 4403, 4408, 4409, 4429 — don't retry
  }

  clearReconnect();
  // First retry waits ~1.5s: after a BLE drop the ESP32 needs ~1s to free the old
  // link before it re-advertises, so reconnecting sooner just hits "GATT Error Unknown".
  // Relay uses longer backoff (3, 6, 12s) to avoid IP rate limiting.
  const baseDelay = lastKind === 'relay' ? 3000 : 1500;
  const step = lastKind === 'relay' ? 3000 : 600;
  const maxDelay = lastKind === 'relay' ? 12000 : 6000;
  const delay = Math.min(baseDelay + reconnectAttempts * step, maxDelay);
  reconnectTimer = setTimeout(() => {
    reconnectAttempts += 1;
    connect(lastKind!, true).catch(() => scheduleReconnect());
  }, delay);
}

/** Tear down the active transport WITHOUT marking it a user disconnect. */
async function teardown(): Promise<void> {
  const { transport } = getState();
  if (!transport) return;
  await transport.disconnect().catch(() => {});
  runnerSetTransport(null);
  storeSetTransport(null);
}

/** Connect via the chosen transport, run the handshake, publish to the store. */
export async function connect(kind: TransportKind, isReconnect = false): Promise<RobotInfo> {
  clearReconnect();
  if (!isReconnect) {
    userDisconnected = false;
    reconnectAttempts = 0;
    reconnectToastShown = false;
  }
  lastKind = kind;
  await teardown();

  const transport = createTransport(kind);

  transport.onState((s: ConnState) => {
    setConnState(s);
    if (s === 'connected') {
      reconnectAttempts = 0;
      reconnectToastShown = false;
      lastRelayCloseCode = undefined;
    } else if (s === 'error') {
      runnerSetTransport(null);
      if (!userDisconnected) {
        if (!reconnectToastShown) {
          showToast('Koneksi terputus — menyambung ulang…', 'warn');
          reconnectToastShown = true;
        }
        scheduleReconnect();
      }
    } else if (s === 'disconnected') {
      // Capture relay close code for reconnect policy
      if (transport instanceof RelayTransport) {
        lastRelayCloseCode = transport.lastCloseCode;
      }
      runnerSetTransport(null);
      storeSetTransport(null);
      if (!userDisconnected) {
        // Relay: show the specific close reason
        if (lastKind === 'relay' && lastRelayCloseCode && RELAY_CLOSE[lastRelayCloseCode]) {
          if (!reconnectToastShown) {
            showToast(RELAY_CLOSE[lastRelayCloseCode].message, 'warn');
            reconnectToastShown = true;
          }
        }
        scheduleReconnect();
      }
    }
  });

  transport.onTelemetry(dispatchTelemetry);

  storeSetTransport(transport);

  try {
    const info = await transport.connect();
    runnerSetTransport(transport);
    setRobotInfo(info);
    setConnState('connected');
    reconnectAttempts = 0;
    lastRelayCloseCode = undefined;
    if (!isReconnect) showToast(`Connected · ${info.board} · fw ${info.fwVersion}`, 'success');
    return info;
  } catch (err) {
    // Capture relay close code for reconnect policy
    if (transport instanceof RelayTransport) {
      lastRelayCloseCode = transport.lastCloseCode;
    }
    runnerSetTransport(null);
    storeSetTransport(null);
    setConnState('disconnected');
    const message = err instanceof Error ? err.message : String(err);
    // A user cancelling the picker throws a NotFoundError — keep that quiet-ish and
    // don't retry (they chose not to pick a device).
    if (/cancel|NotFound|no device selected/i.test(message)) {
      if (!isReconnect) showToast('No device selected.', 'info');
    } else {
      // GATT errors are transient (board mid-cleanup / busy) — don't scare the user with
      // "GATT Error Unknown"; just say we're retrying, and only once per episode.
      const friendly = /GATT/i.test(message)
        ? 'Bluetooth sibuk — mencoba menyambung lagi…'
        : `Gagal menyambung: ${message}`;
      if (!isReconnect && !reconnectToastShown) {
        showToast(friendly, 'warn');
        reconnectToastShown = true;
      }
      scheduleReconnect(); // transient failure (board booting/out of range) → keep trying
    }
    throw err;
  }
}

/**
 * Provision WiFi on the robot over the CURRENT link (BLE/Serial). The robot joins the
 * STA and emits WIFI_STATUS{connected,ip,wsPort} once up — the UI listens for that to
 * learn the IP, then calls connectWifi().
 */
export async function provisionWifi(ssid: string, pass: string): Promise<void> {
  const { transport } = getState();
  if (!transport) throw new Error('Sambungkan dulu lewat Bluetooth/USB sebelum kirim WiFi.');
  if (transport.kind === 'relay') throw new Error('SET_WIFI tidak bisa lewat relay. Gunakan USB Serial.');
  await transport.sendLine(setWifiLine(ssid, pass));
}

/** Connect to the robot over WiFi (WebSocket). `host` is an IP or mDNS name (robotku.local). */
export async function connectWifi(host: string): Promise<RobotInfo> {
  const clean = host.trim().replace(/^wss?:\/\//, '').replace(/:\d+$/, '');
  setWsUrl(`ws://${clean}:81`);
  return connect('ws');
}

/** Connect to the robot through the relay server using a 6-char robot ID. */
export async function connectRelay(rawId: string, relayUrl?: string): Promise<RobotInfo> {
  const id = rawId.toUpperCase().replace(/\s/g, '');
  if (!RELAY_ID_RE.test(id)) {
    throw new Error('Kode robot tidak valid. Harus 6 karakter (angka 2-9, huruf tanpa I dan O).');
  }
  setRelayTarget({ id, ...(relayUrl ? { url: relayUrl } : {}) });
  lastRelayCloseCode = undefined;
  return connect('relay');
}

export interface OtaManifest {
  version: string;
  url: string;
  notes?: string;
}

/** Latest firmware manifest hosted on the same origin (public/firmware/ota.json). */
export async function fetchOtaManifest(): Promise<OtaManifest | null> {
  try {
    const res = await fetch('/firmware/ota.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as OtaManifest;
  } catch {
    return null;
  }
}

/**
 * Kick off an OTA firmware update: the robot downloads the .bin from `url` itself over
 * WiFi (no browser mixed-content). Needs an active link (BLE/Serial/WS) + robot on WiFi.
 * The caller watches OTA_PROGRESS / OTA_OK / OTA_FAIL via onTelemetry.
 */
export async function startOtaUpdate(url: string, version: string): Promise<void> {
  const { transport } = getState();
  if (!transport) throw new Error('Sambungkan robot dulu (BLE/USB) sebelum update.');
  await transport.sendLine(otaUpdateLine(url, version));
}

let autoConnecting = false;

/**
 * Auto-reconnect on page load with NO click: if the user already granted a serial
 * port before (navigator.serial.getPorts()), reopen it and run the handshake.
 * getPorts() needs no user gesture, so the robot connects by itself every visit.
 * No-op when nothing is remembered (Web Serial can't prompt without a click) or
 * already connected — the Connect button still covers the first-time grant.
 */
export async function autoConnect(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serial) return false;
  // NEVER disturb an existing connection. This runs on mount of BOTH the Control and
  // Block Coding pages, so if the user connected over BLE on one page, opening the
  // other must not fire a serial connect — connect('serial') calls disconnect() first,
  // which tears down the live BLE link and then times out its own handshake (no
  // HELLO_ACK) on a board that's on battery/BLE only. connect() sets the store
  // transport before its handshake, so a truthy transport also catches an in-flight
  // BLE connect. Also guards StrictMode's double-invoke.
  const st = getState();
  if (autoConnecting || st.transport || st.connState === 'connected' || st.connState === 'connecting') {
    return false;
  }
  autoConnecting = true;
  try {
    const ports = await navigator.serial.getPorts();
    if (ports.length === 0) return false;
    await connect('serial');
    return true;
  } catch {
    return false; // stay quiet; the Connect button still works
  } finally {
    autoConnecting = false;
  }
}

/** Disconnect the active transport (if any) — USER-initiated, so no auto-reconnect. */
export async function disconnect(): Promise<void> {
  userDisconnected = true;
  clearReconnect();
  await teardown();
}

/** Emergency stop through the active transport, if connected. */
export async function estop(): Promise<void> {
  const { transport } = getState();
  if (transport) {
    await transport.estop().catch((err) => console.warn('estop failed', err));
  }
}
