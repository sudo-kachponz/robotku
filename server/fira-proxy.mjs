// server/fira-proxy.mjs
//
// Fira LLM proxy — menyimpan API key Netra di SERVER (env), meneruskan permintaan
// chat ke Netra, dan stream balik ke browser. Tujuannya: kunci TAK pernah ada di
// bundle browser dan user TAK perlu input (jawaban atas AI-LABS.md §5 / arahan user).
//
// Zero-dependency (Node >= 18, pakai global fetch + node:http). Jalankan:
//   NETRA_API_KEY=sk_... FIRA_ALLOW_ORIGIN=https://appmu PORT=8787 node server/fira-proxy.mjs
// Produksi: taruh di VPS di belakang nginx, rutekan /api/fira/ -> proxy (same-origin,
// tanpa CORS). Lihat deploy/nginx-fira-proxy.conf. JANGAN commit key; pakai env/secret.

import http from 'node:http';

const KEY = process.env.NETRA_API_KEY || '';
const NETRA = process.env.NETRA_URL || 'https://api.netraruntime.com/v1/chat/completions';
const ORIGIN = process.env.FIRA_ALLOW_ORIGIN || '*';
const PORT = Number(process.env.PORT) || 8787;
const DEFAULT_MODEL = process.env.FIRA_MODEL || 'deepseek/deepseek-v4-flash-0731';

// Persona milik SERVER — browser tak bisa mengganti (hanya kirim giliran user/assistant).
const PERSONA =
  'Kamu Fira, asisten AI untuk anak yang ramah, sabar, dan berbahasa Indonesia. ' +
  'Jawab SINGKAT (1-3 kalimat), sederhana, dan JUJUR — akui bila tidak tahu. ' +
  'Jangan menampilkan penalaran panjang.';

// Naive per-IP rate limit supaya kunci publik tak langsung dikuras (ganti dengan
// yang lebih kuat di produksi). Batas: N permintaan / jendela waktu per IP.
const RL_MAX = Number(process.env.FIRA_RL_MAX) || 20;
const RL_WINDOW_MS = Number(process.env.FIRA_RL_WINDOW_MS) || 60_000;
const hits = new Map(); // ip -> {n, until}
function rateLimited(ip) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.until) {
    hits.set(ip, { n: 1, until: now + RL_WINDOW_MS });
    return false;
  }
  e.n++;
  return e.n > RL_MAX;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const path = (req.url || '').split('?')[0];
  if (req.method === 'GET' && path === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, keyConfigured: !!KEY }));
    return;
  }
  if (req.method !== 'POST' || !(path === '/chat' || path === '/api/fira/chat')) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  if (!KEY) {
    res.writeHead(500);
    res.end('NETRA_API_KEY belum di-set di server');
    return;
  }
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  if (rateLimited(ip)) {
    res.writeHead(429);
    res.end('terlalu banyak permintaan, coba lagi sebentar');
    return;
  }

  let body = '';
  let aborted = false;
  req.on('data', (c) => {
    body += c;
    if (body.length > 100_000) {
      aborted = true;
      res.writeHead(413);
      res.end('body terlalu besar');
      req.destroy();
    }
  });
  req.on('end', async () => {
    if (aborted) return;
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end('json tidak valid');
      return;
    }
    // Server yang memutuskan model/limit/persona — browser hanya boleh mengisi giliran.
    const turns = Array.isArray(payload.messages) ? payload.messages : [];
    const clean = turns
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    const upstream = {
      model: DEFAULT_MODEL,
      messages: [{ role: 'system', content: PERSONA }, ...clean],
      stream: true,
      max_tokens: 400,
      reasoning: { effort: 'low' },
    };
    try {
      const r = await fetch(NETRA, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(upstream),
      });
      res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'text/event-stream' });
      if (!r.body) {
        res.end();
        return;
      }
      const reader = r.body.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch {
      if (!res.headersSent) res.writeHead(502);
      res.end('gagal menghubungi penyedia LLM');
    }
  });
});

server.listen(PORT, () => {
  // Jangan pernah log nilai key.
  console.log(`[fira-proxy] listening on :${PORT}  key=${KEY ? 'set' : 'MISSING'}  origin=${ORIGIN}`);
});
