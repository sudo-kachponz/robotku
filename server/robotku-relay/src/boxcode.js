// src/boxcode.js — hardware passwords (the card inside every robot box) + tokens.
//
// Password    = 16 random symbols (80 bits), printed as XXXX-XXXX-XXXX-XXXX. Only its
//               SHA-256 is stored (table robot_devices, migrations/001_devices.sql);
//               80 random bits make a fast hash safe and keep login a single
//               indexed lookup.
// Relay ID    = random 6 symbols per device, stored in the same row ("kode relay").
// Robot token = first 32 hex of HMAC-SHA256(RELAY_SIGNING_KEY, id) — the existing
//               robot auth, unchanged, so robots still log in without a DB query.
// Web token   = "<expiry>.<hmac>" handed out by /login; the controller presents it
//               when it opens the relay socket (enforced with REQUIRE_WEB_LOGIN=1).
//
// Uses only WebCrypto, so it runs both in the Worker and in Node >= 20.

export const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 symbols, no 0/1/I/O
const PASSWORD_LEN = 16;

const enc = (s) => new TextEncoder().encode(s);
const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey('raw', enc(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc(msg)));
}

function randomSymbols(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return [...b].map((x) => ALPHABET[x & 31]).join(''); // 256 % 32 == 0 -> unbiased
}

/** Robot token = first 32 hex of HMAC-SHA256(key, id). Same as gen-robot-id.mjs. */
export async function robotSecret(key, id) {
  return (await hmacHex(key, id)).slice(0, 32);
}

/** Uppercase, drop dashes/spaces/"RK" prefix; null when it can't be a password. */
export function normalizePassword(raw) {
  const s = String(raw || '').toUpperCase().replace(/^\s*RK[-\s]*/, '').replace(/[\s-]/g, '');
  if (s.length !== PASSWORD_LEN) return null;
  for (const c of s) if (!ALPHABET.includes(c)) return null;
  return s;
}

/** XXXXXXXXXXXXXXXX -> XXXX-XXXX-XXXX-XXXX (what gets printed). */
export const formatPassword = (norm) => norm.match(/.{4}/g).join('-');

export const randomPassword = () => formatPassword(randomSymbols(PASSWORD_LEN));
export const randomRelayId = () => randomSymbols(6);

/** SHA-256 hex of the normalized password (what the database stores). */
export async function passwordHash(raw) {
  const norm = normalizePassword(raw);
  if (!norm) return null;
  return hex(await crypto.subtle.digest('SHA-256', enc(norm)));
}

/** Signed controller token for relay `id`, valid `days` days. */
export async function webToken(key, id, days = 30, now = Date.now()) {
  const exp = Math.floor(now / 1000) + days * 86400;
  return `${exp}.${(await hmacHex(key, `web:${id}:${exp}`)).slice(0, 32)}`;
}

/** True when `token` was issued by webToken() for this `id` and hasn't expired. */
export async function verifyWebToken(key, id, token, now = Date.now()) {
  const m = /^(\d{9,11})\.([0-9a-f]{32})$/.exec(String(token || ''));
  if (!key || !m || Number(m[1]) * 1000 < now) return false;
  const want = (await hmacHex(key, `web:${id}:${m[1]}`)).slice(0, 32);
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= want.charCodeAt(i) ^ m[2].charCodeAt(i);
  return diff === 0;
}
