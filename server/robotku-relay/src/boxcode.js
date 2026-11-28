// src/boxcode.js — product passwords printed on the card inside every robot box.
//
// Password  = 8-char serial + 8-char check, shown as XXXX-XXXX-XXXX-XXXX.
//   check   = first 8 base32 chars of HMAC-SHA256(RELAY_SIGNING_KEY, "box:" + serial)
// Relay ID  = first 6 base32 chars of HMAC(key, "id:" + serial)   (the "kode relay")
// Secret    = robotSecret(key, id)  — the existing robot token scheme, unchanged.
//
// Everything is DERIVED from the key, so the worker verifies a password and hands
// back the same relay code every time with no database, and the factory tool
// (tools/gen-box-codes.mjs) prints matching cards. Guessing a valid password means
// hitting a 40-bit check (~1e12 tries per serial). Rotating RELAY_SIGNING_KEY
// invalidates every printed card — don't.
//
// Uses only WebCrypto, so it runs both in the Worker and in Node >= 20.

export const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 symbols, no 0/1/I/O
const SERIAL_LEN = 8;
const CHECK_LEN = 8;

async function hmacBytes(key, msg) {
  const k = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)));
}

/** First `n` base32 symbols of the bytes (5 bits each, MSB first). */
function base32(bytes, n) {
  let out = '';
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5 && out.length < n) {
      out += ALPHABET[(acc >> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
    if (out.length >= n) break;
  }
  return out;
}

/** Robot token = first 32 hex of HMAC-SHA256(key, id). Same as the worker/gen-robot-id. */
export async function robotSecret(key, id) {
  const sig = await hmacBytes(key, id);
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Uppercase, drop dashes/spaces/"RK" prefix; null when it can't be a password. */
export function normalizePassword(raw) {
  const s = String(raw || '').toUpperCase().replace(/^\s*RK[-\s]*/, '').replace(/[\s-]/g, '');
  if (s.length !== SERIAL_LEN + CHECK_LEN) return null;
  for (const c of s) if (!ALPHABET.includes(c)) return null;
  return s;
}

/** XXXXXXXXXXXXXXXX -> XXXX-XXXX-XXXX-XXXX (what gets printed). */
export function formatPassword(norm) {
  return norm.match(/.{4}/g).join('-');
}

async function checkFor(key, serial) {
  return base32(await hmacBytes(key, 'box:' + serial), CHECK_LEN);
}

/** Relay code + robot token that belong to this serial. */
export async function relayForSerial(key, serial) {
  const id = base32(await hmacBytes(key, 'id:' + serial), 6);
  return { id, secret: await robotSecret(key, id) };
}

/** Make the password for a serial (factory side). */
export async function passwordForSerial(key, serial) {
  return formatPassword(serial + (await checkFor(key, serial)));
}

/**
 * Verify a box password. Returns { serial, id, secret } when genuine, else null.
 * The check is compared in constant time.
 */
export async function claimPassword(key, raw) {
  const norm = normalizePassword(raw);
  if (!key || !norm) return null;
  const serial = norm.slice(0, SERIAL_LEN);
  const want = await checkFor(key, serial);
  const got = norm.slice(SERIAL_LEN);
  let diff = 0;
  for (let i = 0; i < CHECK_LEN; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  if (diff !== 0) return null;
  return { serial, ...(await relayForSerial(key, serial)) };
}

/** Random serial (factory side). */
export function randomSerial() {
  const b = new Uint8Array(SERIAL_LEN);
  crypto.getRandomValues(b);
  return [...b].map((x) => ALPHABET[x & 31]).join('');
}
