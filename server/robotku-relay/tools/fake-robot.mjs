#!/usr/bin/env node
// Simulate a robot connecting to the relay for testing.
// It identifies itself as board "FAKE ROBOT (test)" so the web badge can never be
// mistaken for real hardware. NEVER run it with the ID of a physical robot: the relay
// keeps only the newest robot socket, so the fake and the real board kick each other.
// Usage: node tools/fake-robot.mjs <host:port> <ID> <SECRET>
// Example: node tools/fake-robot.mjs 127.0.0.1:8787 A3B7K2 abc123...

import WebSocket from 'ws';

const [host, id, secret] = process.argv.slice(2);
if (!host || !id || !secret) {
  console.error('Usage: node tools/fake-robot.mjs <host:port> <ID> <SECRET>');
  process.exit(1);
}

const url = `ws://${host}/ws?role=robot&id=${id}`;
console.log(`Connecting to ${url}...`);

const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${secret}` } });

ws.on('open', () => {
  console.log('Connected as robot');
  // Same liveness beacon as the firmware (relay marks silent robots offline).
  setInterval(() => ws.send('{"command":"RELAY","event":"robot_alive"};'), 10000);
});

ws.on('message', (data) => {
  const raw = data.toString();
  console.log('RX:', raw);

  // Auto-reply to HELLO with HELLO_ACK
  if (raw.includes('"HELLO"')) {
    const ack = JSON.stringify({
      command: 'HELLO_ACK',
      fw: '0.0.0-fake',
      board: 'FAKE ROBOT (test)',
      protocol: 'robotku-v1',
      capabilities: ['SET_PORT', 'STOP_ALL', 'STOP', 'MOVE_TIMED', 'WAIT',
        'PLAY_TONE', 'SET_WIFI', 'SET_LED_COLOR', 'DISPLAY_TEXT',
        'DISPLAY_BITMAP', 'SET_LED_BRIGHTNESS', 'SET_HEAD_POSITION',
        'ATTACH', 'DETACH', 'TURN_TIMED', 'STEER_TIMED'],
      ports: [1, 2, 5],
      driveMode: 'servo',
      hasBuzzer: true, hasOled: true, hasRgbLed: true,
      hasNeoPixel: false, hasSpeaker: false, hasMic: false,
      boardId: 'fake',
    }) + ';';
    ws.send(ack);
    console.log('TX: HELLO_ACK');
  }

  // Auto-reply to HEARTBEAT with ACK
  if (raw.includes('"HEARTBEAT"')) {
    try {
      const clean = raw.replace(/;\s*$/, '');
      const msg = JSON.parse(clean);
      ws.send(JSON.stringify({ command: 'ACK', seq: msg.seq }) + ';');
    } catch {}
  }

  // Handle RELAY events
  if (raw.includes('"RELAY"')) {
    if (raw.includes('controller_joined')) console.log('>> Controller joined');
    if (raw.includes('controller_left')) console.log('>> Controller left');
  }
});

ws.on('close', (code, reason) => {
  console.log(`Disconnected: ${code} ${reason}`);
  process.exit(0);
});

ws.on('error', (err) => {
  console.error('Error:', err.message);
});
