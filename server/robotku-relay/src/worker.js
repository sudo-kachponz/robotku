// src/worker.js — Robotku Relay Server (Cloudflare Worker + Durable Object)
//
// Pairs a browser controller with a robot by 6-char ID over WebSocket.
// Browser: wss://<host>/ws?role=web&id=<ID>
// Robot:   wss://<host>/ws?role=robot&id=<ID>  (Authorization: Bearer <secret>)
//
// Deploy:
//   npx wrangler deploy
//   # Set robot secrets via gen-robot-id.mjs, stored in robot NVS

const ID_RE = /^[2-9A-HJ-NP-Z]{6}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/ws') return handleWs(request, env);
    if (url.pathname === '/health') return json({ ok: true });
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
  }

  // Robot auth
  if (role === 'robot') {
    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ') || auth.length < 10) {
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Durable Object: one per robot ID ──

export class RelayRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.robot = null;       // WebSocket
    this.controller = null;  // WebSocket
    this.controllerIp = null;
    this.lastControllerActivity = 0;
    this.idleTimer = null;
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

  handleRobot(ws, id) {
    // Replace existing robot connection
    if (this.robot) {
      try { this.robot.close(4411, 'Robot baru tersambung'); } catch {}
    }
    this.robot = ws;

    // Notify existing controller that robot is back
    if (this.controller) {
      this.sendRelay(this.controller, 'robot_reconnected');
    }

    ws.addEventListener('message', (event) => {
      // Forward robot data to controller
      if (this.controller) {
        try { this.controller.send(event.data); } catch {}
      }
    });

    ws.addEventListener('close', () => {
      if (this.robot === ws) {
        this.robot = null;
        // Notify controller
        if (this.controller) {
          try { this.controller.close(4410, 'Robot terputus'); } catch {}
          this.controller = null;
        }
        this.stopIdleTimer();
      }
    });
  }

  handleController(ws, id, ip) {
    // One controller at a time
    if (this.controller) {
      ws.close(4409, 'Robot sedang dikendalikan pengguna lain');
      return;
    }

    // Robot must be online
    if (!this.robot) {
      this.recordFail(ip);
      ws.close(4404, 'Robot tidak ditemukan atau sedang offline');
      return;
    }

    this.controller = ws;
    this.controllerIp = ip;
    this.lastControllerActivity = Date.now();

    // Send linked event
    this.sendRelay(ws, 'linked');
    // Notify robot
    this.sendRelay(this.robot, 'controller_joined');

    this.startIdleTimer();

    ws.addEventListener('message', (event) => {
      this.lastControllerActivity = Date.now();
      // Forward controller commands to robot
      if (this.robot) {
        try { this.robot.send(event.data); } catch {}
      }
    });

    ws.addEventListener('close', () => {
      if (this.controller === ws) {
        this.controller = null;
        this.controllerIp = null;
        this.stopIdleTimer();
        // Notify robot
        if (this.robot) {
          this.sendRelay(this.robot, 'controller_left');
        }
      }
    });
  }

  sendRelay(ws, event) {
    try {
      ws.send(JSON.stringify({ command: 'RELAY', event }) + ';');
    } catch {}
  }

  // ── Idle timeout: release controller lock after 10s inactivity ──

  startIdleTimer() {
    this.stopIdleTimer();
    this.idleTimer = setInterval(() => {
      if (this.controller && Date.now() - this.lastControllerActivity > 10000) {
        try { this.controller.close(4408, 'Sesi berakhir karena tidak aktif'); } catch {}
        this.controller = null;
        this.controllerIp = null;
        this.stopIdleTimer();
        if (this.robot) this.sendRelay(this.robot, 'controller_left');
      }
    }, 2000);
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

function closeUpgrade(code, reason) {
  const pair = new WebSocketPair();
  pair[1].accept();
  pair[1].close(code, reason);
  return new Response(null, { status: 101, webSocket: pair[0] });
}
