// src/worker.js — Robotku AI backend (Cloudflare Worker)
//
// Holds the Netra/DeepSeek API key SERVER-SIDE (Worker secret NETRA_API_KEY) so the
// static site (hub.robotku.id) never ships it. Browser POSTs { messages }; we add the
// persona + key and stream the OpenAI-compatible SSE straight back (Workers pass the
// upstream ReadableStream through untouched → true streaming).
//
// Deploy:
//   npx wrangler login
//   npx wrangler secret put NETRA_API_KEY     (paste a SPEND-LIMITED, revocable key)
//   npx wrangler deploy
// Then the chat endpoint is:  https://robotku-ai.<your-subdomain>.workers.dev/chat

const NETRA = 'https://api.netraruntime.com/v1/chat/completions';
const MODEL = 'deepseek/deepseek-v4-flash-0731';

// Server owns the persona — the browser can only supply user/assistant turns.
// Indonesian persona: on the stable 2.2.3 firmware the robot doesn't speak over
// BLE — the laptop's browser TTS (which HAS a native id-ID voice) reads the reply.
// So Indonesian reads far better than the English-for-MeloTTS variant. (English is
// only worth it once the robot itself speaks via Workers AI TTS.)
const PERSONA =
  'Kamu "Robotku AI", asisten robot yang ramah untuk anak-anak yang sedang belajar ' +
  'coding dan AI. Jawab SINGKAT (1-3 kalimat), hangat, jujur (akui bila tidak tahu), ' +
  'dalam Bahasa Indonesia. Boleh emoji sesekali. Jelaskan hal teknis sesederhana mungkin.';

// Added when the reply will be SPOKEN by the robot (client sends voice:true): emoji,
// markdown and symbols get read aloud or garbled by TTS, and long answers are slow.
const VOICE_RULES =
  ' Jawabanmu akan diucapkan robot lewat speaker: JANGAN pakai emoji, markdown, daftar ' +
  'bernomor, atau simbol; tulis angka dan singkatan seperti diucapkan; maksimal 2 kalimat pendek.';

function cors(env) {
  return {
    'Access-Control-Allow-Origin': (env && env.FIRA_ALLOW_ORIGIN) || '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Text -> speech for the robot. Workers AI MeloTTS returns base64 MP3; the browser
// decodes it, downsamples to 8 kHz 8-bit and streams it to the ESP32 speaker over
// BLE. MeloTTS has no Indonesian voice — 'es' (Spanish) approximates Indonesian
// vowels best, so that's the default; the caller may override `lang`.
const TTS_MODEL = '@cf/myshell-ai/melotts';
const TTS_LANGS = new Set(['en', 'es', 'fr', 'zh', 'jp', 'kr']);

// Native Indonesian voice: Workers AI has none (MeloTTS en/es/fr/zh/jp/kr, Aura-2 en/es),
// so when the secret GOOGLE_TTS_API_KEY is set we use Google Cloud Text-to-Speech id-ID
// (`npx wrangler secret put GOOGLE_TTS_API_KEY`, key restricted to the TTS API). It
// returns LINEAR16 WAV at exactly the robot's rate (8/16 kHz), so the browser only
// re-encodes it. Voice override: var GOOGLE_TTS_VOICE (id-ID-Wavenet-A/D = female,
// B/C = male; Standard-* are cheaper). No key -> MeloTTS as before.
async function googleTts(env, text, sr) {
  const r = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_TTS_API_KEY },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: 'id-ID', name: env.GOOGLE_TTS_VOICE || 'id-ID-Wavenet-A' },
      audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: sr, speakingRate: 1.05 },
    }),
  });
  if (!r.ok) throw new Error('google tts ' + r.status);
  const j = await r.json();
  if (!j.audioContent) throw new Error('google tts: no audio');
  return j.audioContent;
}

async function handleTts(request, env, headers) {
  if (!env.AI) {
    return new Response(JSON.stringify({ error: 'AI binding tidak aktif' }), {
      status: 501,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'json tidak valid' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
  const text = String(body.text || '').slice(0, 600).trim();
  if (!text) {
    return new Response(JSON.stringify({ error: 'text kosong' }), {
      status: 400,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
  const sr = body.sr === 8000 ? 8000 : 16000;
  if (env.GOOGLE_TTS_API_KEY && (!body.lang || body.lang === 'id')) {
    try {
      const audio = await googleTts(env, text, sr);
      return new Response(JSON.stringify({ audio, format: 'wav', provider: 'google-id' }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.warn('google tts failed, falling back to MeloTTS:', e && e.message);
    }
  }
  const lang = TTS_LANGS.has(body.lang) ? body.lang : 'es';
  try {
    const out = await env.AI.run(TTS_MODEL, { prompt: text, lang });
    // MeloTTS returns { audio: "<base64 mp3>" }.
    const audio = out && typeof out.audio === 'string' ? out.audio : null;
    if (!audio) throw new Error('no audio');
    // MeloTTS actually returns a base64 WAV (RIFF/PCM) despite the model card;
    // the browser decodes it with Web Audio either way, so format is just a hint.
    return new Response(JSON.stringify({ audio, format: 'wav' }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'tts gagal: ' + (e && e.message) }), {
      status: 502,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}

// Speech-to-text: POST /stt { audio: base64 WAV/MP3/OGG } -> { text }. Powers voice
// input from the robot's mic (mic PCM -> web wraps WAV -> here). Workers AI Whisper.
async function handleStt(request, env, headers) {
  if (!env.AI) {
    return new Response(JSON.stringify({ error: 'AI binding tidak aktif' }), {
      status: 501, headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'json tidak valid' }), {
      status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
  const b64 = String(body.audio || '');
  if (!b64) {
    return new Response(JSON.stringify({ error: 'audio kosong' }), {
      status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
  try {
    let out;
    try {
      // large-v3-turbo with the language pinned to Indonesian: far fewer wrong-language
      // guesses on short robot-mic clips than auto-detect; vad_filter drops the
      // silent tail that makes Whisper hallucinate ("terima kasih telah menonton").
      out = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
        audio: b64,
        language: body.lang === 'en' ? 'en' : 'id',
        vad_filter: true,
      });
    } catch (e) {
      console.warn('whisper-large-v3-turbo failed, falling back to whisper:', e && e.message);
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      // Whisper (v1) takes the audio file bytes as a plain array.
      out = await env.AI.run('@cf/openai/whisper', { audio: [...bytes] });
    }
    const text = (out && typeof out.text === 'string' ? out.text : '').trim();
    return new Response(JSON.stringify({ text }), {
      status: 200, headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'stt gagal: ' + (e && e.message) }), {
      status: 502, headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });

    // Voice input from robot mic (POST /stt { audio }).
    if (new URL(request.url).pathname === '/stt' && request.method === 'POST') {
      return handleStt(request, env, cors(env));
    }

    // Robot speech endpoint (POST /tts { text, lang? }).
    if (new URL(request.url).pathname === '/tts' && request.method === 'POST') {
      return handleTts(request, env, cors(env));
    }

    if (request.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, keyConfigured: !!env.NETRA_API_KEY }), {
        status: 200,
        headers: { ...cors(env), 'Content-Type': 'application/json' },
      });
    }

    if (request.method !== 'POST') {
      return new Response('not found', { status: 404, headers: cors(env) });
    }

    const key = env.NETRA_API_KEY;
    if (!key) {
      return new Response('NETRA_API_KEY belum di-set (wrangler secret put NETRA_API_KEY)', {
        status: 500,
        headers: cors(env),
      });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response('json tidak valid', { status: 400, headers: cors(env) });
    }

    const turns = Array.isArray(payload.messages) ? payload.messages : [];
    const clean = turns
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

    const upstream = {
      model: MODEL,
      messages: [{ role: 'system', content: PERSONA + (payload.voice ? VOICE_RULES : '') }, ...clean],
      stream: true,
      max_tokens: 500,
      reasoning: { effort: 'low' },
    };

    let r;
    try {
      r = await fetch(NETRA, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify(upstream),
      });
    } catch {
      return new Response('gagal menghubungi penyedia LLM', { status: 502, headers: cors(env) });
    }

    // Stream the SSE straight through to the browser.
    return new Response(r.body, {
      status: r.status,
      headers: { ...cors(env), 'Content-Type': r.headers.get('content-type') || 'text/event-stream' },
    });
  },
};
