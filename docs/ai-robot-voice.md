# Robotku AI — robot voice feature (status + WiFi-migration reference)

Reference for the AI chat + "robot speaks the reply" feature. Captures what's built
today (BLE-based) and the facts needed to plan a WiFi version. Not a to-do list.

## What it does today
- User chats (type or browser mic STT) with "Robotku AI" in the Block-Coding AI drawer.
- Reply comes from an LLM via a Cloudflare Worker (key held server-side).
- If a robot with the right firmware is connected, the **robot speaks** the reply
  through its I2S speaker; otherwise the **laptop/phone browser** speaks it.

## Components & files
**Backend — Cloudflare Worker** (`server/robotku-ai-backend/`, deployed separately with wrangler, NOT part of the Next build)
- `src/worker.js`
  - `POST /chat` → streams the LLM (Netra/DeepSeek) SSE back to the browser. Key = wrangler secret `NETRA_API_KEY`. Persona is server-side (currently **Indonesian**).
  - `POST /tts` → Workers AI MeloTTS (`@cf/myshell-ai/melotts`) → returns base64 **WAV**. No Indonesian voice on Workers AI (see Limitations).
  - `[ai]` binding in `wrangler.toml` powers `/tts`.
- Live at `https://robotku-ai.hubrobotku.workers.dev`. CORS locked to `https://hub.robotku.id`.

**Web** (static Next export, `src/`)
- `src/ailabs/brain.ts` — `firaChat()`: POSTs `{messages}` to `/chat`, parses SSE (`delta.reasoning` + `delta.content`), demo fallback if backend down.
- `src/ailabs/robotVoice.ts` — `speakViaRobot()`: fetch `/tts` → decode WAV with Web Audio → downsample to 8 kHz 8-bit → stream to the robot as `TTS_BEGIN`/`TTS_CHUNK`*/`TTS_END` over BLE. Gated by `robotCanSpeak()` = `capabilities.includes('TTS_BEGIN')`.
- `src/ailabs/speech.ts` — browser TTS (`speechSynthesis`, native `id-ID` voice) + STT. Fallback when no robot.
- `src/components/ailabs/FiraPanel.tsx` — chat UI; prefers `speakViaRobot`, falls back to `speak()`.

**Firmware** (`firmware/robotku-esp32/src/main.cpp`, makerkit variant, HAS_SPEAKER)
- `TTS_BEGIN` / `TTS_CHUNK` / `TTS_END` handlers: receive base64 8 kHz 8-bit PCM, buffer-then-play via MAX98357A (lazy-malloc'd buffer, `PCM_STREAM_CAP` = 4 s). Advertised in HELLO caps.
- Opcodes also mirrored in `src/domain/protocol.ts`, `src/robotProfiles.ts`, `src/domain/boardProfile.ts`.

## Data flow (today)
```
mic/text → browser → Worker /chat → LLM → reply text → browser
reply text → Worker /tts → WAV → browser (decode+downsample 8 kHz) → BLE chunks → ESP32 → speaker
```

## Known limitations (the reason to consider WiFi)
- **BLE bandwidth ~8 KB/s** → robot audio capped at 8 kHz "telephone" quality, buffer-then-play (a few-second delay), max ~4 s clip. Real-time / hi-fi not possible over BLE NUS.
- **No Indonesian TTS on Workers AI** (MeloTTS langs: en/es/fr/zh/jp/kr). Clean robot audio ⇒ English; native Indonesian only via the laptop browser voice.
- **Robot-mic input not built** — robot's INMP441 only does clap/level, not voice capture. STT is browser-side only.

## Shipping status (as of this commit)
- Published firmware on the web flasher is **2.2.0-mk** (stable: servo both-sides + stable BLE) which **does NOT** advertise `TTS_BEGIN` → robot-speak auto-falls-back to the laptop. The TTS firmware source (2.2.x-mk, `TTS_*` handlers) is on `main` but its builds had a BLE connect-drop still under investigation (suspect: the 3 TTS opcodes added to the HELLO caps — the only connect-time delta vs the stable 2.2.0; or brownout from the connect speaker-blip, already removed).

## Phase 1 (WiFi transport) — status + a hard flash constraint
Implemented on branch **`wifi-phase1`** (NOT main; experimental, compile-verified only):
- Firmware `2.3.0-mk`: WiFi STA + `SET_WIFI` provisioning (creds in NVS, bootstrapped over
  the existing BLE/Serial link) + `WebSocketsServer` on :81 reusing `feed()`/`handleCommand`
  (same JSON protocol) + mDNS `robotku.local`. `sendTelemetry` now also broadcasts to WS
  clients; HELLO_ACK reports `wifiIp`/`wsPort`. Builds for `-e v3` and `-e makerkit`.
- **⚠️ Flash wall:** with the WiFi+WS+mDNS stack, **makerkit = 97.9% of the 1.25 MB app
  partition** (v3 = 86.8%). Consequences on this 4 MB board:
  - **Serving the web app from the ESP** (the chosen mixed-content fix) has **no room** —
    even a slim embedded page likely needs the `huge_app` partition (3 MB app, **no OTA**).
  - **OTA (b.md)** needs dual app slots; at 97.9% of one slot there's no growth headroom.
  - On 4 MB you can realistically have **WiFi + serve-page** OR **WiFi + OTA**, not both.
  - This is the concrete point where a **bigger-flash ESP32 (S3, 8/16 MB + PSRAM)** pays off
    (ties back to the earlier "do we need a better ESP32?" question).
- **Not yet done / blocked:** HTTP file server to actually serve the UI (mixed-content fix),
  the web `WiFiTransport.ts` (a.md), OTA (b.md), and WiFi+NimBLE+I2S coexistence testing on
  real hardware (heap/radio contention is unproven).

## Tunable knobs (code pointers, for whatever comes next)
- Audio rate/size/loudness: `TARGET_SR`, `MAX_BYTES`, `CHUNK` in `robotVoice.ts`; `PCM_STREAM_CAP` + the `<<7` playback scale + `SPK_AMPLITUDE` in `main.cpp`.
- Language: `PERSONA` + `/tts` `lang` in `server/robotku-ai-backend/src/worker.js`.
- TTS model: `TTS_MODEL` in the worker.
