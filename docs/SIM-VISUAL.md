# Simulator Board Visuals (4.md)

Pure-SVG board + module visuals for the Block Coding simulator. **No** data/protocol/
firmware/block changes — reads existing `SimSink` state only.

## Files

| File | What |
|---|---|
| `src/components/blockcoding/sim/BoardSvg.tsx` | The Controller V3 board: toska casing, blue PCB, ESP32 shield + antenna, RGB LED (glow), buzzer (waves), USB, silkscreen, **5 I2C headers (black/red/green/yellow)** + **5 PWM headers (yellow/red/black)**, clickable ports. Spec colors live in one `C` const. |
| `src/components/blockcoding/sim/OledModule.tsx` | External 0.96" OLED — toska frame, blue PCB, `GND VDD SCK SDA` pins, black screen rendering **real** text / 5×5 matrix / shapes; long text marquees. |
| `src/components/blockcoding/sim/ServoModule.tsx` | SG90 — blue body, toska mount, white 2-arm horn that spins with `speed`. |
| `src/components/blockcoding/sim/BoardPanel.tsx` | The "Papan" section: wires the board to live state, "Pasang modul" attach panel (saved via localforage), "Coba langsung" manual panel (LED/text/buzz, sim-only). |
| `src/components/blockcoding/sim/SimBoard.module.css` | CSS-only animations (buzzer rings, BLE blink, marquee, horn spin) — all off under `prefers-reduced-motion`. |

Mounted in `SimStage` **above** the old numeric port strip (kept as a debug fallback).

## Acceptance

| # | Criterion | Status |
|---|---|---|
| 1 | Board (blue PCB + toska casing) is visible | ✅ render test `simBoard.test.ts` asserts casing `#2FC49A` + all 10 ports; page serves 200 |
| 2 | "Set LED red" → LED dome glows red | ✅ render test asserts `rgb(255,0,0)`; wired to `state.ledColor` |
| 3 | Type text in "Coba langsung" → OLED shows it; long text scrolls | ✅ OLED renders `text`; `oledMarquee` for >10 chars |
| 4 | Play Tone → buzzer emits waves | ✅ `buzzerActive` from `state.buzzerHz`, CSS wave rings |
| 5 | Servo on P1 + move block → horn spins; P1 header lights | ✅ `ServoModule speed`, PWM port `active` glow |
| 6 | OLED on I3 → module appears (I2C block, top) | ✅ attach panel; servo→PWM / OLED→I2C validated |
| 7 | Header color order matches photo (top black-red-green-yellow, bottom yellow-red-black) | ✅ from `hardware.ts` colors; render test checks red + green rows |
| 8 | Refresh → attached modules persist | ✅ `loadSimModules`/`persistSimModules` (localforage) |

**To view:** `npm run dev` → open `http://localhost:3000/control/modes/code/` and show the simulator panel.

## Known follow-ups (not blocking)
- The rainbow bezier cable from a plugged module to its exact port column is drawn as a labelled panel (`→ I3`) rather than a pixel-traced curve — exact coordinates want a straight-on board photo / EasyEDA PNG.
- Robot-arena wheel count vs. attached servos is unchanged (existing RobotSprite).
