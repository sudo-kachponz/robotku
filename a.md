# Robotku Web Control — Prompt Lengkap untuk Claude Code

Membangun **seluruh aplikasi kontrol** (kloning fungsional control.stickem.sg, versi web Robotku): Home → Web Control → Connect → **Control Modes (5 mode, Block Coding salah satunya)** → Settings + Guide. Konektivitas hardware **langsung dari browser** (Web Bluetooth + Web Serial, pola Stick'em), UI/UX **di-reskin ke Design System Robotku**.

> Ringkas keputusan teknis (sudah divalidasi dari codebase & screenshot):
> - **Stack:** React + TypeScript + Vite (+ Tailwind/shadcn) untuk shell & semua layar; **Block Coding** memakai ulang editor Blockly dari `astroid-webview` (Blockly 12, kategori, simulator, `robotProfiles.ts`).
> - **Kenapa web lama gak nyambung:** semua eksekusi keluar lewat `window.astroidAppChannel(json)` → dulu diteruskan ke Flutter Bluetooth **Classic (SPP)**, yang **tidak ada di browser**. Kita ganti dengan `RobotTransport` (Web Bluetooth **NUS** + Web Serial) + firmware **interpreter resident** di ESP32 → Run tanpa compile/flash, persis Stick'em.
> - **Reskin:** pertahankan LAYOUT & UX Stick'em, ganti warna ke Robotku (indigo #4F46E5 + pink #EC2D8F, font Plus Jakarta Sans, tema terang) + maskot Robotku.

---

## Peta aplikasi (acuan)

```
/                         Home — 2 kartu: "Kontrol Robot" (Web Control) + "Robotku Academy" (link keluar, stub)
/control                  Let's Get Started — logo + maskot + tombol Connect besar
/control/modes            Control Modes — carousel 5 mode (panah kiri/kanan, 5 dot)
/control/modes/base       Base Robot   — D-pad + Grab/Release
/control/modes/port       Port Control — 8 slider port (S/V/G 1–8)
/control/modes/tank       Tank Mode    — 2 slider roda L/R + belok + turret
/control/modes/joystick   Joystick     — 1 joystick analog + 2 tombol
/control/modes/code       Block Coding — editor Blockly (dari astroid-webview)
/control/settings         Settings — tab [Settings | Guide]
/control/projects         Projects — simpan/muat program & preset (minimal)
```

Chrome global (muncul di seluruh layar `/control/*`): badge **NO DEVICE CONNECTED / CONNECTED** (tengah-atas), tombol **Connect** power (kanan-bawah, ikon jadi hijau saat tersambung), **Fullscreen** (kiri-bawah), tombol **Home**, dan **dock bawah** (Projects · Community · Settings).

---

## PROMPT (salin ke Claude Code / Cursor)

> Lampirkan ke context: folder `astroid-webview/`, file `Robotku_Design_System.html`, dan folder `Mascot Logo Robotku School/`. Biarkan prompt berbahasa Inggris.

```
ROLE
You are a senior TypeScript/web + embedded engineer. Build the complete "Robotku Web Control" app: a fully web-based clone of control.stickem.sg's feature set, reskinned to the Robotku Design System, that connects to real hardware directly from the browser (no Flutter/native shell). Follow Clean Architecture + DDD-lite. Ship it in the phases defined under BUILD ORDER; each phase must run before the next starts.

STACK
- React 18 + TypeScript + Vite + React Router. Tailwind + shadcn/ui for components.
- Block Coding module reuses the attached `astroid-webview` (Blockly 12): PORT its `src/categories/*`, `src/toolbox.ts`, `src/simulator.ts`, `src/robotProfiles.ts`, `src/visual/theme.ts`, and the code generator into `src/modules/block-coding/blockly/`, and mount Blockly inside a React `<BlockCoding/>` component. Do NOT rewrite Blockly from scratch.
- No backend required for this iteration; persist projects/settings in IndexedDB (localforage). NEVER use localStorage in a way that breaks if unavailable — wrap it.

NON-NEGOTIABLE ARCHITECTURE
- A single framework-agnostic `RobotTransport` service is the ONLY thing that talks to hardware. Every mode (Base, Port, Tank, Joystick, Block Coding) sends through it. Removing/replacing the old `window.astroidAppChannel` bridge is mandatory.
- Domain layer (protocol, command model, port-mapping rules) has zero React/transport imports. UI depends on interfaces only.

=========================================================
INFORMATION ARCHITECTURE / ROUTES
=========================================================
/                         Home: two big cards — "Kontrol Robot" → /control, "Robotku Academy" → external/stub.
/control                  "Let's Get Started": Robotku mascot + robot illustration + big primary Connect button + subtitle "Klik Connect untuk langsung mengendalikan robotmu. Jelajahi mode dan coba coding!".
/control/modes            Control Modes carousel: 5 cards with left/right arrows + 5 dots. Order: Base Robot, Port Control, Tank Mode, Joystick, Block Coding. Each card: illustration + title + one-line desc + green "Enter".
/control/modes/base|port|tank|joystick|code   the mode screens (specs below).
/control/settings         Settings with tabs [Settings | Guide].
/control/projects         Projects list (save/load).

GLOBAL CHROME (persistent on all /control/* screens)
- Top-center connection badge: red "NO DEVICE CONNECTED" or green "CONNECTED · <board> · fw <ver>".
- Bottom-right Connect power button: opens Connect panel; icon/ring turns green when connected (mirror Stick'em "icon green when paired").
- Bottom-left Fullscreen toggle. A Home button (top-left back arrow or home icon).
- Bottom dock: Projects (folder) · Community (link to Robotku community, configurable) · Settings (gear).

=========================================================
DESIGN SYSTEM (reskin — read Robotku_Design_System.html and mirror EXACTLY)
=========================================================
Create `src/theme/tokens.css` from the DS variables and use app-wide. Keep Stick'em's LAYOUT/UX but Robotku's LOOK (light, not dark purple):
- Font: 'Plus Jakarta Sans'.
- Brand primary indigo --indigo-600 #4F46E5 (hover #4338CA, deep #352DA0); accent pink --pink-500 #EC2D8F.
- Ink text --ink-900 #1B1840 … --ink-300 #C2C6DB; bg #F3F4FB; surface #FFFFFF; line #E7E9F2.
- Semantic: green #16A34A (success/connected/Enter), red #E5484D (disconnected/reset), amber #E08600, blue #3B82F6, purple #8B5CF6.
- Radii --r-xs..xl (6/8/12/16/20) + --r-full 999 (pill buttons). Shadows xs..lg. Focus ring 0 0 0 4px rgba(79,70,229,.14).
- Primary CTA buttons are pill-shaped. "Enter"/"Connect" success buttons use green. "Reset to default" uses red.
Branding: header/logo uses `Mascot Logo Robotku School/Robotku-Mascot-Logo-Horizontal.png`; Home/Connect hero uses a mascot pose (`Poses/Pose1.png`). Replace ALL "Stick'em"/"Astroid" user-facing text with "Robotku". Rebuild the Blockly theme (`theme.ts`) as a LIGHT theme on these tokens (workspace #F3F4FB, white flyout, indigo insertion marker, Plus Jakarta Sans), mapping the 8 categories to on-brand colors from the DS.

=========================================================
TRANSPORT LAYER (the core fix) — src/services/transport/
=========================================================
RobotTransport.ts (interface):
  type ConnState='disconnected'|'connecting'|'connected'|'error';
  interface RobotInfo{fwVersion:string;board:string;protocol:string;capabilities:string[]}
  interface RobotTransport{
    readonly kind:'ble'|'serial';
    connect():Promise<RobotInfo>;    // device picker + HELLO handshake
    disconnect():Promise<void>;
    sendLine(line:string):Promise<void>;       // one `{...};`
    sendProgram(lines:string[]):Promise<void>;  // whole program w/ flow control
    onTelemetry(cb:(m:any)=>void):void;
    onState(cb:(s:ConnState)=>void):void;
    estop():Promise<void>;
  }
BleTransport.ts — Web Bluetooth, Nordic UART Service:
  SERVICE 6e400001-b5a3-f393-e0a9-e50e24dcca9e; RX_WRITE …0002 (writeWithoutResponse); TX_NOTIFY …0003 (notify).
  requestDevice({filters:[{services:[SERVICE]}],optionalServices:[SERVICE]}); on connect send {"command":"HELLO","protocol":"robotku-v1"}; await HELLO_ACK (≤4s) → RobotInfo. Chunk ≤180 bytes; buffer/flush on ';'. Decode notifications, split on ';'/newline, JSON.parse, forward. Handle GATT disconnect → estop + state.
SerialTransport.ts — Web Serial, baud 115200, identical protocol (TextEncoder/Decoder streams, reader buffers until ';').
index.ts — isBleSupported(), isSerialSupported(), createTransport(kind), plus a `transportStore` (singleton, subscribable) holding transport+ConnState+RobotInfo consumed by all modes.
Shared: HEARTBEAT every 500ms {"command":"HEARTBEAT","seq":n}; if no ACK ≤1.5s → 'error' + estop + toast. estop(): send DRIVE_DIRECT 0,0 + ESTOP immediately, bypassing queue.

=========================================================
PROTOCOL / COMMAND MODEL — src/domain/protocol/
=========================================================
Line-delimited JSON: `{"command":"...",...};`. Reuse opcode strings from robotProfiles.ts (astroidV2). Do NOT invent new opcodes except SET_PORT (below).
Primitives used by control modes:
  SET_PORT   {port:1..8, value:-100..100}     // signed drive/servo per port — the primitive for all drive/port UIs
  DRIVE_DIRECT {left:-100..100, right:-100..100} // convenience for tank/joystick (firmware maps to wheel ports)
  SET_GRIPPER {state:'open'|'closed'}
  ESTOP, HELLO/HELLO_ACK, HEARTBEAT/ACK, GET_SENSOR_DATA, TELEMETRY (notify), plus the rest already in robotProfiles.
Port mapping (from Settings) is applied on the WEB side: modes translate UI intent → SET_PORT on the configured ports (see each mode). Keep DRIVE_DIRECT available for Block Coding blocks that emit it.

=========================================================
MODES (each shares the transport + connection badge; if disconnected, controls render but send nothing + hint "Connect dulu")
=========================================================
MODE — Base Robot (/control/modes/base)
  UI: robot illustration; a D-pad (Up/Down/Left/Right) + "Grab" and "Release" buttons (like Stick'em).
  Mapping (defaults from Settings): Left Wheel ports [1,3], Right Wheel ports [2,4], Arms ports [5,6].
  Forward→SET_PORT(left+,right+); Backward→both −; Left→left−,right+; Right→left+,right−; release→0.
  Grab→SET_GRIPPER closed (or SET_PORT arms +); Release→open.
  Keybinds: Forward W/ArrowUp, Backward S/ArrowDown, Left A/ArrowLeft, Right D/ArrowRight, Grab Q, Release E.

MODE — Port Control (/control/modes/port)
  UI: PCB illustration + 8 sliders labeled 1..8 (range -100..100 or 0..100 with invert). Live: on change → SET_PORT(port,value) throttled ~20Hz.
  Keybinds: Port1..8 = Digit1..Digit8; hold SHIFT to invert direction. "Test individual ports."

MODE — Tank Mode (/control/modes/tank)
  UI: two vertical sliders (L,R) + left/right turn buttons + turret controls.
  Mapping: Left Wheel [1,3], Right Wheel [2,4], Arm/Turret [5]. Left slider→SET_PORT left ports; right slider→right ports. Turret CW/CCW→SET_PORT(5,±).
  Keybinds: Left Throttle + W / − S; Right Throttle + E / − D; Turret CCW Q / CW R.

MODE — Joystick (/control/modes/joystick)
  UI: one analog joystick (x,y) + two action buttons. Throttle ~20Hz → arcade mixing to left/right → SET_PORT on Left [1,3]/Right [2,4]; Custom Y port [5], Custom X port [6] driven by stick axes if configured. Release → 0,0. Buttons → SET_LED_COLOR / SET_GRIPPER demo.

MODE — Block Coding (/control/modes/code)  ← reuse astroid-webview
  Port the Blockly editor. Keep continuous toolbox, categories, simulator, and the existing `{"command":...};` generator. Rewire `runCommandsOnRobot()`/`command_runner.ts`: if transport connected → sendProgram(lines); else → run SIMULATOR (so Run always works). Remove all `window.astroidAppChannel(...)` and Flutter references. Right toolbar buttons: Run (green), Stop→estop, Share, Download, Serial Monitor (shows telemetry), + keep an AI button as no-op stub. Wrapper block "Start Program … End".

=========================================================
SETTINGS (/control/settings) — tabs [Settings | Guide]
=========================================================
Domain model `RobotSettings` persisted in IndexedDB, editable here, consumed by all modes:
- Per-mode PORT MAPPING (multi-select port chips, ports 1..8):
    Base Robot:  Arms [5,6], Left Wheel [1,3], Right Wheel [2,4]
    Tank Mode:   Arm/Turret [5], Left Wheel [1,3], Right Wheel [2,4]
    Joystick:    Left [1,3], Right [2,4], Custom Y [5], Custom X [6]
- SPEED AND DIRECTION: Port 1..8 → speed enum (default "Fast"; also Medium/Slow) + a "DEFAULT" toggle that inverts that port's direction. Applied when a mode computes SET_PORT for that port.
- KEYBIND TABLES (display + editable, two bindings each):
    Base/Clawbot: Forward W/↑, Left A/←, Right D/→, Backward S/↓, Grab Q, Release E
    Port Control (SHIFT to invert): Port1..8 = Digit1..8
    Tank: Left Throttle+ W, Left Throttle− S, Right Throttle+ E, Right Throttle− D, Turret CCW Q, Turret CW R
- Footer: "App Version: v1.0.0" (Robotku), "Report a bug" (→ community link), and a red "Reset to default" button.
GUIDE tab (illustrated steps, reskinned):
    1. "Nyalakan PCB" — colok kabel USB-C ke power bank/laptop.
    2. "Pasang Servo" — orientasi kabel: Kuning→pin S, Merah→pin V, Coklat→pin G (tunjukkan benar ✓ / salah ✗).
    3. "Pair via Bluetooth" — saat tersambung, ikon Connect jadi hijau.

=========================================================
PROJECTS (/control/projects) — minimal
=========================================================
Save/load Block Coding programs (.rbk JSON = Blockly workspace) and named Settings presets in IndexedDB. List, rename, delete, duplicate.

=========================================================
FIRMWARE COMPANION — firmware/robotku-esp32/robotku-esp32.ino
=========================================================
Arduino ESP32 sketch (NimBLE-Arduino + ArduinoJson):
- BLE NUS server advertising SERVICE/RX/TX above; ALSO read Serial@115200 with the SAME line protocol.
- Buffer bytes until ';', JSON-parse, switch over opcodes: HELLO→HELLO_ACK{fw,board,protocol,capabilities}, HEARTBEAT→ACK{seq}, ESTOP, DRIVE_DIRECT(left,right) (map to configured wheel ports), SET_PORT(port,value) (drive one of 8 outputs), SET_GRIPPER, SET_LED_COLOR, DISPLAY_ICON, PLAY_INTERNAL_SOUND, GET_SENSOR_DATA→TELEMETRY.
- 8 output ports as named GPIO constants at top (TODO map to your driver). drive(port,value) + wheelGroups helper. Heartbeat watchdog: no HEARTBEAT for 1s → stop all outputs (failsafe). Compile-ready, heavily commented.

=========================================================
BUILD ORDER (do NOT skip; each phase runnable)
=========================================================
Phase 0 — Scaffold React+Vite+Router+Tailwind+shadcn; tokens.css from DS; global chrome (badge, Connect panel w/ capability detection, fullscreen, home, dock); transport layer (BLE+Serial) with a mock echo so Connect flow works before firmware.
Phase 1 — BLOCK CODING end-to-end (priority): port astroid-webview Blockly into React, light Robotku theme, rewire runner→transport, simulator fallback. Verify: with ESP32 flashed, Connect→Run streams a program and the robot moves; Stop=failsafe; disconnected=simulator.
Phase 2 — The four control modes (Base, Port, Tank, Joystick) sharing the transport + keybinds + SET_PORT mapping.
Phase 3 — Settings (port mapping, Speed&Direction, keybind tables, reset) + Guide + Projects + Home + Control Modes carousel polish.
Deliver diffs per file; after each phase, list what to test.

ACCEPTANCE CRITERIA
- Full navigation works: Home → Kontrol Robot → Connect → Control Modes → each mode; Settings tabs; Projects.
- One shared connection drives ALL modes; badge + green Connect reflect state everywhere.
- With ESP32 flashed: Block Coding Run moves the robot (no compile/flash); Base/Tank/Joystick/Port drive live; Stop/failsafe works; heartbeat timeout stops actuators.
- No device: every mode renders, Block Coding runs in simulator, clear "NO DEVICE CONNECTED".
- Safari/Firefox/iOS: friendly capability notice + "buka di Chrome/Edge"; Block Coding still usable in simulator.
- Entire UI follows Robotku DS (indigo/pink, Plus Jakarta Sans, pill buttons, light theme) with the Robotku mascot; zero "Stick'em"/"Astroid"/Flutter/`browser-serialport`/`astroidAppChannel` remnants.

GUARDRAILS
- Don't invent opcodes beyond robotProfiles.ts + SET_PORT.
- Keep line-delimited JSON (note binary+CRC framing as future hardening).
- Reuse existing Blockly assets; don't rebuild the editor.
- Web Bluetooth/Web Serial require HTTPS/localhost + Chromium — detect and degrade gracefully, never crash.

Start by printing the folder/module plan + the RobotTransport interface + the RobotSettings domain model, then implement Phase 0 → 3 with diffs.
```

---

## Quick start

```bash
cd robotku-web-control
npm i
npm run dev            # https/localhost di Chrome/Edge

# firmware (sekali flash → jadi interpreter resident):
# Arduino IDE / arduino-cli, board ESP32 Dev Module, lib NimBLE-Arduino + ArduinoJson
# flash firmware/robotku-esp32/robotku-esp32.ino
```

Alur uji: Home → **Kontrol Robot** → **Connect (Bluetooth)** → pilih board (ikon hijau) → **Control Modes** → **Block Coding → Run** (robot gerak tanpa flash) → coba **Joystick/Tank/Port/Base** lewat koneksi yang sama → **Settings** untuk ubah pemetaan port & Speed/Direction.

## Catatan penting
- Konfirmasikan **chip board Robotku**. Kalau ESP32 → jalur BLE NUS di atas langsung jalan. Kalau kit lama pakai **Bluetooth Classic/HC-05**, itu **tidak bisa** dari web sama sekali; firmware ESP32 interpreter ini jadi wajib.
- Reskin = tiru **layout/UX** Stick'em, tapi **warna/aset** 100% Robotku (design system + maskot). Jangan pakai ungu gelap Stick'em.
- Prompt sengaja bertahap (Phase 0–3) supaya Block Coding + konektivitas (bagian tersulit) tembus dulu, baru mode lain & Settings/Guide.
