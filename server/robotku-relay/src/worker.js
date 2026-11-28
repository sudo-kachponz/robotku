// src/worker.js — Robotku Relay Server (Cloudflare Worker + Durable Object)
//
// Pairs a browser controller with a robot by 6-char ID over WebSocket.
// Browser: wss://<host>/ws?role=web&id=<ID>
// Robot:   wss://<host>/ws?role=robot&id=<ID>  (Authorization: Bearer <secret>)
//
// Deploy:
//   npx wrangler deploy
//   # Set robot secrets via gen-robot-id.mjs, stored in robot NVS
//   # Hardware passwords: migrations/001_devices.sql + tools/seed-devices.mjs (Postgres)
//   npx wrangler secret put DATABASE_URL   (Supabase transaction pooler URL, port 6543)

import postgres from 'postgres';
import { robotSecret, passwordHash, webToken, verifyWebToken } from './boxcode.js';

const ID_RE = /^[2-9A-HJ-NP-Z]{6}$/;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/ws') return handleWs(request, env);
    if (url.pathname === '/health') return json({ ok: true });
    // /provision = the same login, kept for the setup wizard's older name.
    if (url.pathname === '/login' || url.pathname === '/provision') {
      if (request.method === 'OPTIONS') return preflight(request, env);
      if (request.method === 'POST') return handleLogin(request, env, ctx);
    }
    return new Response('not found', { status: 404 });
  },
};

async function handleWs(request, env) {
  const upgrade = request.headers.get('Upgrade');
  if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
    return new Response('expected websocket', { status: 426 });
  }

  const url = new URL(request.url);
  const role = url.searchParams.get('role');
  const rawId = (url.searchParams.get('id') || '').toUpperCase().trim();

  if (!role || !['web', 'robot'].includes(role) || !ID_RE.test(rawId)) {
    return closeUpgrade(4400, 'ID atau peran tidak valid');
  }

  // Origin check for web controllers
  if (role === 'web') {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    if (!allowed.some(a => a === origin)) {
      return closeUpgrade(4403, 'Situs ini belum diizinkan mengendalikan robot');
    }
    // Controller login: the token from /login (hardware password). A token that is
    // sent must be valid; with REQUIRE_WEB_LOGIN=1 a bare relay code is refused too.
    const token = url.searchParams.get('token');
    if (token || env.REQUIRE_WEB_LOGIN === '1') {
      if (!(await verifyWebToken(env.RELAY_SIGNING_KEY, rawId, token))) {
        return closeUpgrade(4401, 'Login dulu dengan password robot (kartu di dalam box)');
      }
    }
  }

  // Robot auth — validate the secret, not just the format. The secret is
  // HMAC-SHA256(RELAY_SIGNING_KEY, id) (first 32 hex), same as gen-robot-id.mjs,
  // so the worker verifies statelessly (no per-robot store). Reject if the signing
  // key is unset so auth can never silently become open.
  if (role === 'robot') {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const expected = env.RELAY_SIGNING_KEY ? await robotSecret(env.RELAY_SIGNING_KEY, rawId) : '';
    if (!expected || token !== expected) {
      return closeUpgrade(4401, 'Token robot tidak valid');
    }
  }

  // Rate limit per IP
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Route to Durable Object by robot ID
  const roomId = env.ROOM.idFromName(rawId);
  const room = env.ROOM.get(roomId);

  // Forward to DO
  const doUrl = new URL(request.url);
  doUrl.searchParams.set('role', role);
  doUrl.searchParams.set('id', rawId);
  doUrl.searchParams.set('ip', ip);
  if (role === 'robot') {
    doUrl.searchParams.set('token', (request.headers.get('Authorization') || '').slice(7));
  }

  return room.fetch(new Request(doUrl.toString(), {
    headers: request.headers,
  }));
}

function closeUpgrade(code, reason) {
  // WebSocket upgrade that immediately closes with a code.
  // Browser can't read HTTP status on failed upgrade, so we accept then close.
  const pair = new WebSocketPair();
  pair[1].accept();
  pair[1].close(code, reason);
  return new Response(null, { status: 101, webSocket: pair[0] });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());
  return allowed.includes(origin) ? origin : null;
}

// The wizard runs on another origin (hub.robotku.id), so the browser needs CORS
// headers to READ the answer — without them the old /provision always looked failed.
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}

function preflight(request, env) {
  const origin = allowedOrigin(request, env);
  return new Response(null, { status: origin ? 204 : 403, headers: origin ? corsHeaders(origin) : {} });
}

// Log in with the hardware password from the robot box (Postgres table robot_devices,
// see migrations/001_devices.sql). Returns the robot's relay code + robot token (the
// setup wizard sends them to the board as SET_RELAY) and a controller token for the
// relay socket. Same password -> same relay code, so a lost code is recoverable.
async function handleLogin(request, env, ctx) {
  const origin = allowedOrigin(request, env);
  if (!origin) return json({ error: 'origin not allowed' }, 403);
  const headers = corsHeaders(origin);
  if (!env.RELAY_SIGNING_KEY || !env.DATABASE_URL) {
    return json({ error: 'not_configured', message: 'Server relay belum diatur (RELAY_SIGNING_KEY / DATABASE_URL).' }, 500, headers);
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    // no/invalid body -> reported as a bad format below
  }
  const hash = await passwordHash(body && body.password);
  if (!hash) {
    return json({ error: 'password_format', message: 'Password robot berbentuk XXXX-XXXX-XXXX-XXXX (ada di kartu dalam box).' }, 400, headers);
  }
  // prepare:false = works through Supabase's transaction pooler (pgbouncer).
  const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1, fetch_types: false, connect_timeout: 10 });
  let rows;
  try {
    rows = await sql`
      update robot_devices
         set claimed_at = coalesce(claimed_at, now()), last_login_at = now(), login_count = login_count + 1
       where password_hash = ${hash} and not revoked
   returning relay_id`;
  } catch (e) {
    console.error('login db error:', e && e.message);
    return json({ error: 'db_error', message: 'Database sedang bermasalah, coba lagi sebentar.' }, 503, headers);
  } finally {
    const closing = sql.end({ timeout: 2 });
    if (ctx && ctx.waitUntil) ctx.waitUntil(closing);
    else await closing;
  }
  if (!rows.length) {
    return json({ error: 'bad_password', message: 'Password salah atau sudah dinonaktifkan.' }, 403, headers);
  }
  const id = rows[0].relay_id;
  return json(
    { id, secret: await robotSecret(env.RELAY_SIGNING_KEY, id), token: await webToken(env.RELAY_SIGNING_KEY, id) },
    200,
    headers,
  );
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

// ── Durable Object: one per robot ID ──
//
// Session rules (v2):
//  - Robot liveness = last message seen. The robot sends {"command":"RELAY",
//    "event":"robot_alive"} every 10 s (Cloudflare answers WS pings itself, so the
//    DO never sees them). No traffic for ROBOT_STALE_MS = treat as offline, even if
//    the socket still says OPEN (half-open TCP after a brownout reboot).
//  - Newest controller WINS (takeover). The old one gets 4412. Reloading a tab or
//    opening AI Labs in a new tab no longer locks the owner out with 4409.
//  - A robot reboot does NOT kill the controller. The controller gets
//    "robot_offline", then "robot_reconnected" (it re-sends HELLO). Only if the
//    robot stays away ROBOT_GRACE_MS is the controller closed with 4410.

const ROBOT_STALE_MS = 35000;
const ROBOT_GRACE_MS = 30000;
const CONTROLLER_IDLE_MS = 30000;

export class RelayRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.robot = null;       // WebSocket
    this.robotLastSeen = 0;
    this.controller = null;  // WebSocket
    this.controllerIp = null;
    this.lastControllerActivity = 0;
    this.idleTimer = null;
    this.graceTimer = null;
    this.rateLimits = new Map(); // ip -> { fails: number, oldestFail: number }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const id = url.searchParams.get('id');
    const ip = url.searchParams.get('ip');

    // Rate limit check
    if (role === 'web') {
      const limit = this.checkRateLimit(ip);
      if (limit) {
        return closeUpgrade(4429, `Terlalu banyak percobaan. Coba lagi ${limit} detik`);
      }
    }

    const pair = new WebSocketPair();
    const [client, server] = pair;
    server.accept();

    if (role === 'robot') {
      this.handleRobot(server, id);
    } else {
      this.handleController(server, id, ip);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  robotOnline() {
    return !!this.robot && this.robot.readyState === 1 && Date.now() - this.robotLastSeen < ROBOT_STALE_MS;
  }

  handleRobot(ws, id) {
    // Replace existing robot connection (newest robot socket wins)
    if (this.robot && this.robot !== ws) {
      const old = this.robot;
      this.robot = null;
      try { old.close(4411, 'Robot baru tersambung'); } catch {}
    }
    this.robot = ws;
    this.robotLastSeen = Date.now();
    this.stopGraceTimer();

    // Controller waited through a robot reboot -> tell it to re-HELLO
    if (this.controller) {
      this.sendRelay(this.controller, 'robot_reconnected');
      this.sendRelay(ws, 'controller_joined');
    }

    ws.addEventListener('message', (event) => {
      this.robotLastSeen = Date.now();
      const data = event.data;
      // Liveness beacons stay inside the relay
      if (typeof data === 'string' && data.length < 80 && data.includes('robot_alive')) return;
      if (this.controller) {
        try { this.controller.send(data); } catch {}
      }
    });

    const gone = () => {
      if (this.robot !== ws) return; // an older socket closing after a replacement
      this.robot = null;
      if (this.controller) {
        this.sendRelay(this.controller, 'robot_offline');
        this.startGraceTimer();
      }
    };
    ws.addEventListener('close', gone);
    ws.addEventListener('error', gone);
  }

  handleController(ws, id, ip) {
    // Robot must be online AND recently heard from
    if (!this.robotOnline()) {
      if (this.robot) { try { this.robot.close(4410, 'Robot tidak merespons'); } catch {} this.robot = null; }
      this.recordFail(ip);
      ws.close(4404, 'Robot tidak ditemukan atau sedang offline');
      return;
    }

    // Takeover: the newest controller wins
    if (this.controller) {
      const old = this.controller;
      this.controller = null;
      try { old.close(4412, 'Robot dibuka di tab/perangkat lain'); } catch {}
    }

    this.controller = ws;
    this.controllerIp = ip;
    this.lastControllerActivity = Date.now();

    this.sendRelay(ws, 'linked');
    this.sendRelay(this.robot, 'controller_joined');

    this.startIdleTimer();

    ws.addEventListener('message', (event) => {
      this.lastControllerActivity = Date.now();
      if (!this.robot) {
        return; // robot rebooting — controller already got robot_offline
      }
      try {
        this.robot.send(event.data);
      } catch (err) {
        console.error('[relay] robot send failed:', err);
        this.robot = null;
        this.sendRelay(ws, 'robot_offline');
        this.startGraceTimer();
      }
    });

    const gone = () => {
      if (this.controller !== ws) return;
      this.controller = null;
      this.controllerIp = null;
      this.stopIdleTimer();
      this.stopGraceTimer();
      if (this.robot) this.sendRelay(this.robot, 'controller_left');
    };
    ws.addEventListener('close', gone);
    ws.addEventListener('error', gone);
  }

  sendRelay(ws, event) {
    if (!ws) return;
    try {
      ws.send(JSON.stringify({ command: 'RELAY', event }) + ';');
    } catch {}
  }

  // ── Grace period while the robot reboots / re-joins WiFi ──

  startGraceTimer() {
    if (this.graceTimer) return;
    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      if (!this.robot && this.controller) {
        try { this.controller.close(4410, 'Robot terputus'); } catch {}
        this.controller = null;
        this.controllerIp = null;
        this.stopIdleTimer();
      }
    }, ROBOT_GRACE_MS);
  }

  stopGraceTimer() {
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }

  // ── Idle timeout: release controller lock after inactivity ──

  startIdleTimer() {
    this.stopIdleTimer();
    this.idleTimer = setInterval(() => {
      if (this.controller && Date.now() - this.lastControllerActivity > CONTROLLER_IDLE_MS) {
        try { this.controller.close(4408, 'Sesi berakhir karena tidak aktif'); } catch {}
        this.controller = null;
        this.controllerIp = null;
        this.stopIdleTimer();
        if (this.robot) this.sendRelay(this.robot, 'controller_left');
      }
    }, 5000);
  }

  stopIdleTimer() {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }

  // ── Rate limiting: 10 failures per IP in 10 minutes ──

  checkRateLimit(ip) {
    const now = Date.now();
    const entry = this.rateLimits.get(ip);
    if (!entry) return null;

    // Clean old failures
    if (now - entry.oldestFail > 600000) {
      this.rateLimits.delete(ip);
      return null;
    }

    if (entry.fails >= 10) {
      const waitSec = Math.ceil((entry.oldestFail + 600000 - now) / 1000);
      return waitSec;
    }
    return null;
  }

  recordFail(ip) {
    const now = Date.now();
    const entry = this.rateLimits.get(ip) || { fails: 0, oldestFail: now };
    // Reset if oldest is expired
    if (now - entry.oldestFail > 600000) {
      entry.fails = 0;
      entry.oldestFail = now;
    }
    entry.fails++;
    this.rateLimits.set(ip, entry);
  }
}
