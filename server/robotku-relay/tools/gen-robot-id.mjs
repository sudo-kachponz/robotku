#!/usr/bin/env node
// Generate a robot ID (6 chars) and a random secret (32 hex chars).
// Usage: node tools/gen-robot-id.mjs

import crypto from 'crypto';

// Signing key must match the worker's RELAY_SIGNING_KEY secret, else the robot's
// token won't validate. Set it in the env before running this tool.
const KEY = process.env.RELAY_SIGNING_KEY;
if (!KEY) {
  console.error('Set RELAY_SIGNING_KEY env first (same value as the worker secret).');
  console.error('  export RELAY_SIGNING_KEY=<key>  &&  node tools/gen-robot-id.mjs');
  process.exit(1);
}

const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0,1,I,O

let id = '';
for (let i = 0; i < 6; i++) {
  id += CHARS[crypto.randomInt(CHARS.length)];
}

// Secret = HMAC-SHA256(KEY, id) first 32 hex — worker recomputes + verifies statelessly.
const secret = crypto.createHmac('sha256', KEY).update(id).digest('hex').slice(0, 32);

console.log(`Robot ID:     ${id}`);
console.log(`Robot Secret: ${secret}`);
console.log();
console.log(`Firmware serial command:`);
console.log(`  SET_RELAY ${id} ${secret}`);
