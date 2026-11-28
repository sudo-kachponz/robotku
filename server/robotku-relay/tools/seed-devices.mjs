#!/usr/bin/env node
// Create hardware passwords (one per robot box) in Postgres and print the box cards.
//
//   export DATABASE_URL='postgresql://...'        # Supabase: Settings -> Database
//   export RELAY_SIGNING_KEY=<worker secret>       # optional: adds the SET_RELAY line
//   node tools/seed-devices.mjs 10 batch-2026-12 > cards-batch-2026-12.csv
//
// CSV: label,password,relay_code,set_relay
//   password   -> print on the card inside the box. Shown ONLY here: the database
//                 keeps just its SHA-256, so save this CSV somewhere private.
//   relay_code -> may go on the card too (it is the robot's ID, not a secret login)
//   set_relay  -> paste into the robot's serial monitor to pre-flash it at the factory
// Run migrations/001_devices.sql first.

import postgres from 'postgres';
import { randomPassword, randomRelayId, passwordHash, robotSecret } from '../src/boxcode.js';

const url = process.env.DATABASE_URL;
const key = process.env.RELAY_SIGNING_KEY || '';
const n = Number(process.argv[2] || 10);
const prefix = process.argv[3] || 'box';
if (!url || !Number.isInteger(n) || n < 1 || n > 1000) {
  console.error('Usage: DATABASE_URL=... node tools/seed-devices.mjs <count 1..1000> [label-prefix]');
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
try {
  console.log('label,password,relay_code,set_relay');
  for (let made = 0; made < n; ) {
    const password = randomPassword();
    const relayId = randomRelayId();
    const label = `${prefix}-${String(made + 1).padStart(3, '0')}`;
    // `on conflict do nothing` -> a (vanishingly rare) duplicate relay ID or password
    // simply retries with fresh random values instead of failing the batch.
    const rows = await sql`
      insert into robot_devices (password_hash, relay_id, label)
      values (${await passwordHash(password)}, ${relayId}, ${label})
      on conflict do nothing
      returning relay_id`;
    if (!rows.length) continue;
    const setRelay = key ? `SET_RELAY ${relayId} ${await robotSecret(key, relayId)}` : '';
    console.log([label, password, relayId, setRelay].join(','));
    made++;
  }
} finally {
  await sql.end();
}
