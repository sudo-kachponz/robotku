// Setup flow in the connect panel: a robot linked over Bluetooth/USB shows the
// numbered steps; its own relay code (HELLO_ACK diag.relayId) skips the hardware
// password; "Pindah ke internet" only unlocks once diag.relay says it is online.
import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ConnectPanel from '../components/control/ConnectPanel';
import { setActiveTransport, setConnState, setRobotInfo } from '../app/store';
import type { RobotTransport } from '../transport';

const ble = { kind: 'ble', sendLine: () => Promise.resolve() } as unknown as RobotTransport;
const render = () => renderToStaticMarkup(createElement(ConnectPanel, { onClose: () => {} }));
const info = (diag: Record<string, unknown>) => ({
  fwVersion: '2.6.2-mk',
  board: 'Robotku Makerkit S3 v1.3',
  protocol: 'robotku-v1',
  capabilities: [],
  ports: [1, 2, 5],
  diag,
});

afterEach(() => {
  setActiveTransport(null);
  setRobotInfo(null);
  setConnState('disconnected');
});

describe('connect panel setup flow', () => {
  it('not connected: relay box + Bluetooth/USB setup buttons (Bluetooth enabled again)', () => {
    const html = render();
    expect(html).toContain('Sambung via Relay');
    expect(html).toContain('Langkah 01');
    expect(html).toContain('Nyalakan robot');
    // Bluetooth button present and enabled (it was force-disabled before 2.6)
    expect(html).toMatch(/<button class="[^"]*bleBtn[^"]*">/);
    expect(html).not.toContain('nonaktif');
  });

  it('linked over Bluetooth with a provisioned robot: shows its relay code, asks for WiFi', () => {
    setActiveTransport(ble);
    setConnState('connected');
    setRobotInfo(info({ relayId: 'KV5KDZ', relay: false }));
    const html = render();
    expect(html).toContain('Tersambung via Bluetooth');
    expect(html).toContain('KV5KDZ');
    expect(html).not.toContain('Ambil kode relay'); // no hardware password needed
    expect(html).toContain('Kirim WiFi ke robot');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Pindah ke internet/);
  });

  it('robot without a relay code asks for the hardware password', () => {
    setActiveTransport(ble);
    setConnState('connected');
    setRobotInfo(info({ relayId: '', relay: false }));
    const html = render();
    expect(html).toContain('Ambil kode relay');
    expect(html).not.toContain('Kirim WiFi ke robot');
  });

  it('robot online on the relay: switch button enabled', () => {
    setActiveTransport(ble);
    setConnState('connected');
    setRobotInfo(info({ relayId: 'KV5KDZ', relay: true }));
    const html = render();
    expect(html).toContain('Robot sudah online di internet');
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Pindah ke internet/);
  });
});
