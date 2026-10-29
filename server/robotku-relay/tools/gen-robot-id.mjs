#!/usr/bin/env node
// Generate a robot ID (6 chars) and a random secret (32 hex chars).
// Usage: node tools/gen-robot-id.mjs

import crypto from 'crypto';

const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0,1,I,O

let id = '';
for (let i = 0; i < 6; i++) {
  id += CHARS[crypto.randomInt(CHARS.length)];
}

const secret = crypto.randomBytes(16).toString('hex');

console.log(`Robot ID:     ${id}`);
console.log(`Robot Secret: ${secret}`);
console.log();
console.log(`Firmware serial command:`);
console.log(`  SET_RELAY ${id} ${secret}`);
