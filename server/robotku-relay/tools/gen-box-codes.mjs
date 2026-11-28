#!/usr/bin/env node
// Generate box cards: one product password per robot + its relay code.
//
//   export RELAY_SIGNING_KEY=<same value as the worker secret>
//   node tools/gen-box-codes.mjs 50 > boxes-2026-12.csv
//
// CSV columns: serial,password,relay_code,robot_secret,set_relay
//   password   -> print on the card inside the box (customer types it in the web
//                 setup wizard: "Setup Relay" -> password -> code goes to the robot)
//   relay_code -> print on the card too (customer enters it under "Connect over
//                 Internet" — works straight away if the robot was pre-flashed)
//   set_relay  -> paste into the robot's serial monitor at the factory to pre-flash
// The CSV holds robot secrets: keep it private, don't commit it.

import { randomSerial, passwordForSerial, relayForSerial } from '../src/boxcode.js';

const KEY = process.env.RELAY_SIGNING_KEY;
if (!KEY) {
  console.error('Set RELAY_SIGNING_KEY env first (same value as the worker secret).');
  process.exit(1);
}
const n = Number(process.argv[2] || 1);
if (!Number.isInteger(n) || n < 1 || n > 10000) {
  console.error('Usage: node tools/gen-box-codes.mjs <count 1..10000>');
  process.exit(1);
}

console.log('serial,password,relay_code,robot_secret,set_relay');
const seenSerial = new Set();
const seenId = new Set();
while (seenSerial.size < n) {
  const serial = randomSerial();
  if (seenSerial.has(serial)) continue;
  const { id, secret } = await relayForSerial(KEY, serial);
  if (seenId.has(id)) continue; // two boxes must never share a relay room
  seenSerial.add(serial);
  seenId.add(id);
  console.log([serial, await passwordForSerial(KEY, serial), id, secret, `SET_RELAY ${id} ${secret}`].join(','));
}
