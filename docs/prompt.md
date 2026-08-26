# Robotku Block Coding — Prompt Detail (UI + Toolbox lengkap, Design System Robotku)

Membangun **editor Block Coding** yang meniru layout & set blok Stick'em (dibaca dari 18 screenshot), tapi **di-skin ke Design System Robotku** (indigo #4F46E5 + pink #EC2D8F, font Plus Jakarta Sans, tema terang, tombol pill, maskot). Basis kode: `astroid-webview` (Blockly 12 — sudah punya `categories/*`, `toolbox.ts`, `simulator.ts`, `simulator_sequencer.ts`, `robotProfiles.ts`); **perluas** agar set blok lengkap seperti daftar di bawah.

> Inti: **tiru struktur & isi toolbox**, ganti **look** ke Robotku. Kategori tetap punya warna berbeda (anak butuh pembeda), tapi diselaraskan ke palet DS. Canvas terang berpola titik. Blok emit perintah `{"command":...};` (streaming, tanpa compile/flash), reporter sensor pakai request/response via `GET_*` + `TELEMETRY` (pola `simulator_sequencer.ts`).

---

## Peta kategori & warna (Robotku)

| Kategori (sidebar) | Warna blok (hex)       | Sumber di astroid-webview  | Reuse / Tambah                               |
| ------------------ | ---------------------- | -------------------------- | -------------------------------------------- |
| Movement           | `#16A34A` hijau        | `categories/motors.ts`     | reuse + tambah Steering, Claw, Stop variants |
| Timing             | `#E08600` amber        | `categories/events.ts`     | Wait sec + Wait-until-boolean                |
| Display            | `#3B82F6` biru         | `categories/looks.ts`      | LED Matrix + LCD Screen (tambah)             |
| Audio              | `#F97316` oranye       | `categories/audio.ts`      | Microphone + Tune + Volume + Tempo (tambah)  |
| Sensors & Data     | `#8B5CF6` ungu         | `categories/sensors.ts`    | perluas suite sensor + pin I/O               |
| Program Flow       | `#06B6D4` cyan         | Blockly built-in `control` | reskin                                       |
| Logic              | `#0D9488` teal         | Blockly built-in `logic`   | reskin                                       |
| Math               | `#4F46E5` indigo       | Blockly built-in `math`    | reskin                                       |
| Variables          | `#A16207` coklat-amber | Blockly typed vars         | num/bool/string                              |
| Functions          | `#565386` ink-slate    | Blockly `procedures`       | Define / Exit                                |
| Templates          | `#CA8A04` emas         | (baru)                     | snippet tersimpan + comment                  |
| AI                 | `#EC2D8F` pink         | (baru, stub)               | kategori eksperimen                          |

Header bar: indigo `--indigo-800 #352DA0`, judul putih “Block Coding” + panah back. Sidebar: surface putih, baris kategori (ikon + label warna kategori); kategori terpilih = pill terisi warna kategori + teks putih. Canvas `#F3F4FB` dotted grid. Blok pembungkus **“Start Program … End”** (hat block, lilac lembut). Font semua UI & blok: **Plus Jakarta Sans**.

Toolbar kanan (vertikal, tombol bulat): **Run** (hijau ▶), **Share**, **Download**, **Serial Monitor** (tampilkan telemetry), **AI** (kamera, stub). **Trash** kanan-bawah. **Connect** (power, hijau saat tersambung) di bawahnya. **Fullscreen** kiri-bawah. **Dock bawah**: Projects · Community · Settings.

---

## PROMPT (salin ke Claude Code)

> Lampirkan `astroid-webview/`, `Robotku_Design_System.html`, folder `Mascot Logo Robotku School/`.

```
ROLE
Build the Robotku "Block Coding" editor as a web module (React + TypeScript + Vite; mount Blockly 12). REUSE the attached astroid-webview (categories, toolbox, simulator, simulator_sequencer, robotProfiles, code generator) and EXTEND it to the full toolbox below. The visual language must follow the Robotku Design System (indigo/pink, Plus Jakarta Sans, light theme, pill buttons, mascot) — replicate Stick'em's editor LAYOUT and BLOCK SET, but Robotku's LOOK. No Flutter, no native bridge.

OUTPUT CONTRACT
Every executable block generates line-delimited JSON: `{"command":"...",...};`. Program runs by streaming these to RobotTransport (Web Bluetooth NUS / Web Serial) — no compile/flash. If no device: run the SIMULATOR. Reporter/boolean sensor blocks resolve values via request/response: emit `{"command":"GET_SENSOR_DATA","sensor":...,"port":...}` and await matching `TELEMETRY` (reuse simulator_sequencer.ts). Keep the "Start Program … End" wrapper (hat) block.

EDITOR CHROME (reskin to Robotku DS — read Robotku_Design_System.html for tokens)
- Header: deep indigo (#352DA0) bar, white bold "Block Coding", back arrow (left).
- Left sidebar (white surface): rows Movement, Timing, Display, Audio, Sensors, Program Flow, Logic, Math, then "Advanced" group: Variables, Functions, Templates, AI. Each row = category icon + label in the category color; selected row = filled pill in category color with white text.
- Canvas: #F3F4FB with dotted grid; continuous-toolbox flyout on white.
- Right vertical toolbar (round buttons): Run (green ▶ → sendProgram / simulator), Stop (→ transport.estop), Share, Download (.rbk), Serial Monitor (telemetry drawer), AI (camera, no-op stub).
- Trash (bottom-right), Connect power button (turns green when connected + connection badge top-center), Fullscreen (bottom-left), bottom dock (Projects · Community · Settings).
- Font 'Plus Jakarta Sans' everywhere; rebuild Blockly theme as LIGHT with the category colors in the table; block text white, editable fields cream/white, insertion marker indigo.

TOOLBOX — implement EXACTLY these categories & blocks (fields in [], emitted command in →):

MOVEMENT (#16A34A)
- Forward for [N] sec, Speed [Slow|Medium|Fast], Ports L [p][p] R [p][p]  → {"command":"MOVE_TIMED","dir":"forward","secs":N,"speed":s,"left":[..],"right":[..]}
- Reverse … (same fields)                                                → dir:"backward"
- Left for [N] sec, Speed, Ports L/R                                      → {"command":"TURN_TIMED","dir":"left",...}
- Right …                                                                → dir:"right"
- Steering for [N] sec, Steering [-100..100], Speed, Ports L/R            → {"command":"STEER_TIMED","secs":N,"steering":v,"speed":s,"left":[..],"right":[..]}
- Claw for [N] sec, Direction [clockwise|anticlockwise], Speed, Ports [p][p] → {"command":"CLAW_TIMED","secs":N,"dir":d,"speed":s,"ports":[..]}
- Stop [2 WHEEL|4 WHEEL] Ports L [p] R [p]   (red)                        → {"command":"STOP","ports":[..]}
- Stop All Motors                            (red)                        → {"command":"STOP_ALL"}
  Speed enum maps Slow/Medium/Fast → 40/70/100.

TIMING (#E08600)
- Wait for [N] sec           → {"command":"WAIT","secs":N}
- Wait for <boolean>         → sequencer polls the boolean (e.g., touch button / sensor compare) until true.

DISPLAY (#3B82F6)
  LED Matrix:
  - Display LED [5x5 matrix editor] for [N] sec → {"command":"DISPLAY_MATRIX","pattern":[..25 bits],"secs":N}
  - Display Text ["…"]                           → {"command":"DISPLAY_TEXT","text":"…"}
  - Set LED Brightness [0..100]                  → {"command":"SET_LED_BRIGHTNESS","value":v}
  - Clear LED Matrix                             → {"command":"CLEAR_MATRIX"}
  LCD Screen:
  - Display Shape [Left Arrow|Right Arrow|Heart|Smile|…] for [N] sec → {"command":"LCD_SHAPE","shape":s,"secs":N}
  - Display Text [text] for [N] sec              → {"command":"LCD_TEXT","text":t,"secs":N}
  - Clear Screen                                 → {"command":"LCD_CLEAR"}

AUDIO (#F97316)
  Microphone:
  - Record Audio in Slot [1..n] for [N] sec [and continue when done|until done] → {"command":"RECORD_AUDIO","slot":k,"secs":N,"wait":bool}
  - Play Recording in Slot [1..n] [until done|and continue]                     → {"command":"PLAY_RECORDING","slot":k,"wait":bool}
  Tune:
  - Play Sound Effect [Short Beep|…] [until done|and continue] → {"command":"PLAY_SOUND_EFFECT","effect":e,"wait":bool}
  - Play tone [C4] for [N] sec [until done]                    → {"command":"PLAY_TONE","note":"C4","secs":N,"wait":bool}
  - Play tone [C4] for [N] beat [until done]                   → {"command":"PLAY_TONE","note":"C4","beats":N,"wait":bool}
  Volume:
  - Set Volume to [0..100] %   → {"command":"SET_VOLUME","value":v}
  - Stop All Sounds            → {"command":"STOP_SOUNDS"}
  Tempo:
  - Set BPM to [N]             → {"command":"SET_BPM","bpm":N}

SENSORS & DATA (#8B5CF6)  (boolean + reporter blocks unless noted)
  - <Touch Button 1 is pressed>, <Touch Button 2 is pressed>  → GET_SENSOR_DATA sensor:"button1"/"button2"
  - <Is Recording?>                                           → sensor:"recording"
  - Set Analog Pin on Port [G1..] to [0..255]                 → {"command":"SET_ANALOG","port":p,"value":v}   (statement)
  - Get Analog Pin on Port [G1..]                             → sensor:"analog",port
  - Set Digital Pin on Port [G1..] to [HIGH|LOW]              → {"command":"SET_DIGITAL","port":p,"value":hl} (statement)
  - Get Digital Pin on Port [G1..]                            → sensor:"digital",port
  - Ultrasonic Sensor Value in [cm|inch]                      → sensor:"ultrasonic",unit
  - Ultrasonic Sensor Value in [cm|inch] on Port [G1..]       → sensor:"ultrasonic",unit,port
  - Temperature Sensor Value (°C) [on Port [G1..]]            → sensor:"temperature"[,port]
  - Humidity Sensor Value (%) [on Port [G1..]]                → sensor:"humidity"[,port]
  - Light Sensor Value (lux) [on Port [G1..]]                 → sensor:"light"[,port]
  - Distance Travelled (cm) on Port [G1..]                    → sensor:"distance",port
  - Reset Distance Travelled on Port [G1..]                   → {"command":"RESET_DISTANCE","port":p} (statement)
  - Heading Value (deg) [on Port [G1..]]                      → sensor:"heading"[,port]
  - Reset Heading Value [on Port [G1..]]                      → {"command":"RESET_HEADING"[,"port":p]} (statement)

PROGRAM FLOW (#06B6D4) — reskin Blockly control
  - Repeat Forever { } · Repeat [N] times { } · while <bool> { } · Break · Continue · IF <bool> THEN { } ELSE { } (with +/- mutator)

LOGIC (#0D9488) — reskin Blockly logic
  - [ ] [=|≠|<|≤|>|≥] [ ] · <bool> OR <bool> · <bool> AND <bool> · NOT <bool> · True/False (dropdown) · pick random True or False

MATH (#4F46E5) — reskin Blockly math
  - [ ] [+|−|×|÷] [ ] · remainder of [ ] / [ ] · number · π/constants · min/max of [ ] and [ ] · round/roundup/rounddown of [ ] · square root/…/of [ ] · absolute of [ ] · pick random integer from [a] to [b]

VARIABLES (#A16207) — typed
  - Set [numVar] to [0] · Set [boolVar] to <True> · Set [strVar] to ["…"] · typed reporters under "Your Number/String/Boolean Variables"

FUNCTIONS (#565386)
  - Define [name] { } · Exit Function (return) · list under "Your Functions" (empty hint: "Untuk membuat fungsi, seret blok Define ke workspace")

TEMPLATES (#CA8A04)
  - Comment block ["a comment"] (collapsible) · user-saved snippets (e.g., test / Stop Go / Balloon / led) loaded from the Projects/Templates store; allow "save selection as template".

AI (#EC2D8F) — stub category (mark "Eksperimen")
  - e.g. <AI: object [ ] detected?> / [AI: capture frame] as no-op placeholders wired to the AI camera button; clearly future-work, don't block the build.

CODE GENERATION & PROTOCOL
- Extend robotProfiles.ts into a documented "Robotku v1.1" opcode map covering the commands above (keep existing DRIVE_DIRECT/MOVE_TIMED/TURN_TIMED/WAIT/SET_GRIPPER/SET_LED_COLOR/DISPLAY_ICON/PLAY_INTERNAL_SOUND/GET_SENSOR_DATA; add DISPLAY_MATRIX/DISPLAY_TEXT/SET_LED_BRIGHTNESS/CLEAR_MATRIX/LCD_*/RECORD_AUDIO/PLAY_RECORDING/PLAY_SOUND_EFFECT/PLAY_TONE/SET_VOLUME/STOP_SOUNDS/SET_BPM/SET_ANALOG/GET_ANALOG/SET_DIGITAL/GET_DIGITAL/RESET_DISTANCE/RESET_HEADING/STEER_TIMED/CLAW_TIMED/STOP/STOP_ALL).
- Statement blocks stream immediately; timed blocks include secs and the sequencer waits; reporter blocks do GET_SENSOR_DATA→await TELEMETRY. Keep the simulator working for every block when disconnected.
- Provide firmware stubs for new opcodes in firmware/robotku-esp32 (comment TODOs) so the protocol is complete even if some peripherals aren't wired yet.

ACCEPTANCE CRITERIA
- Sidebar shows all 12 categories with Robotku colors; selecting a category opens its flyout with EXACTLY the blocks listed; blocks are Robotku-themed (Plus Jakarta Sans, category color, light canvas).
- Dragging blocks under "Start Program", pressing Run streams commands (robot moves when connected) or simulates (when not); Stop = failsafe; Serial Monitor shows telemetry; reporter blocks return live sensor values.
- Save/Load .rbk, Templates snippets persist (IndexedDB). No "Stick'em"/"Astroid"/Flutter/browser-serialport/astroidAppChannel remnants.
- Runs on https/localhost in Chrome/Edge; graceful notice on unsupported browsers (Block Coding still usable in simulator).

GUARDRAILS
- Reuse astroid-webview blocks/generators; only ADD missing blocks. Don't rebuild Blockly from scratch.
- Keep line-delimited JSON (binary+CRC framing later).
- Category colors from the table; don't fall back to Blockly defaults.

Start by printing: (1) the category→block plan mapped to existing astroid-webview files vs new files, (2) the extended robotProfiles v1.1 opcode map, (3) the Robotku Blockly theme. Then implement, showing diffs per file.
```

---

## Catatan

- Ini **melengkapi** prompt sebelumnya (`PROMPT_Robotku_WebControl_FullApp.md`): pakai file ini saat menggarap **modul Block Coding** secara detail; modul lain (Joystick, Tank, Port, Base, Settings, Guide) ikut prompt full-app.
- Reporter sensor (Ultrasonic/Temperature/Heading/dll) itu blok **nilai** — di model streaming, nilainya diambil via `GET_SENSOR_DATA` → `TELEMETRY`. Pola ini sudah ada di `simulator_sequencer.ts`, tinggal disambungkan ke transport nyata.
- Opcode display/audio/sensor baru = **perluasan sah** untuk bahasa block; beda dari guardrail “jangan ngarang opcode” pada modul kendali. Semua didokumentasikan di `robotProfiles.ts` v1.1 + stub firmware.
- Kalau kamu mau, saya bisa langsung tuliskan **`toolbox.ts` + definisi blok Robotku** (JSON Blockly) untuk beberapa kategori inti (Movement, Timing, Display, Sensors) sebagai starter, biar agen tinggal lanjut.
