#!/usr/bin/env python3
"""Robotku TTS server — native Indonesian robot voice with Piper (id_ID-news_tts).

Same contract as the old Workers AI /tts, so the web (src/ailabs/robotVoice.ts) and the
firmware don't change:

    POST /tts   {"text": "...", "sr": 16000|8000}  ->  {"audio": "<base64 WAV>", "format": "wav"}
    GET  /health                                    ->  {"ok": true, "voice": "..."}

The WAV comes back already at the robot's rate (8/16 kHz, mono 16-bit) so the browser
only re-encodes it to 8-bit. Runs on CPU (~0.1-0.3 s per sentence).

Setup (once):
    python3 -m venv venv && venv/bin/pip install -r requirements.txt
    mkdir voices && cd voices
    curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx
    curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx.json
Run:
    PIPER_VOICE=voices/id_ID-news_tts-medium.onnx venv/bin/python server.py
Env: PORT (5002), PIPER_VOICE, ALLOWED_ORIGINS (comma list, default hub + localhost),
     LENGTH_SCALE (1.0; >1 = slower speech).
"""

import base64
import io
import json
import os
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
from piper import PiperVoice, SynthesisConfig

PORT = int(os.environ.get("PORT", "5002"))
VOICE_PATH = os.environ.get("PIPER_VOICE", "voices/id_ID-news_tts-medium.onnx")
ALLOWED = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS",
    "https://hub.robotku.id,http://localhost:3000,http://localhost:3123",
).split(",") if o.strip()]
LENGTH_SCALE = float(os.environ.get("LENGTH_SCALE", "1.0"))
MAX_CHARS = 600

voice = PiperVoice.load(VOICE_PATH)
synth_lock = threading.Lock()  # one synthesis at a time keeps CPU use predictable


def synthesize(text: str, sr: int) -> bytes:
    """Text -> mono 16-bit WAV at `sr` Hz."""
    buf = io.BytesIO()
    with synth_lock, wave.open(buf, "wb") as w:
        voice.synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=LENGTH_SCALE))
    buf.seek(0)
    with wave.open(buf) as r:
        src_sr = r.getframerate()
        x = np.frombuffer(r.readframes(r.getnframes()), dtype=np.int16).astype(np.float32)
    if src_sr != sr and len(x):
        # Linear resample; Piper output is already band-limited well below 4 kHz-ish
        # energy for speech, and the browser low-pass-resamples again for the robot.
        n_out = int(len(x) * sr / src_sr)
        x = np.interp(np.arange(n_out) * (src_sr / sr), np.arange(len(x)), x)
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(np.clip(x, -32768, 32767).astype(np.int16).tobytes())
    return out.getvalue()


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "content-type")
            # Chrome Private Network Access: lets https://hub.robotku.id reach this
            # server on localhost / the LAN.
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, status: int, data: dict):
        body = json.dumps(data).encode()
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):  # noqa: N802 (http.server naming)
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):  # noqa: N802
        if self.path.rstrip("/") == "/health":
            return self._json(200, {"ok": True, "voice": os.path.basename(VOICE_PATH)})
        self._json(404, {"error": "not found"})

    def do_POST(self):  # noqa: N802
        if self.path.rstrip("/") != "/tts":
            return self._json(404, {"error": "not found"})
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 64 * 1024)
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self._json(400, {"error": "json tidak valid"})
        text = str(body.get("text", "")).strip()[:MAX_CHARS]
        if not text:
            return self._json(400, {"error": "text kosong"})
        sr = 8000 if body.get("sr") == 8000 else 16000
        try:
            wav = synthesize(text, sr)
        except Exception as e:  # report instead of dropping the connection
            return self._json(500, {"error": f"tts gagal: {e}"})
        self._json(200, {"audio": base64.b64encode(wav).decode(), "format": "wav", "provider": "piper-id"})

    def log_message(self, fmt, *args):
        pass  # quiet; errors are returned to the client


if __name__ == "__main__":
    print(f"Robotku TTS (Piper {os.path.basename(VOICE_PATH)}) on :{PORT}, origins: {', '.join(ALLOWED)}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
