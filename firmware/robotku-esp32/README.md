# Robotku ESP32 firmware — Joystick + 6 blocks

Resident command interpreter. The Robotku web app **streams** line-delimited JSON
commands over **USB Serial (115200)** or **Web Bluetooth (BLE NUS)**; this firmware
executes them live. There is no compile/flash on Run.

Scope is deliberately narrow — prove the pipe end-to-end first:

| Feature | Opcodes |
| --- | --- |
| Joystick | `SET_PORT` |
| Block Coding (6) | `MOVE_TIMED`, `TURN_TIMED`, `WAIT`, `PLAY_TONE`, `STOP_ALL` |
| Everything else | replies `{"command":"UNSUPPORTED","op":"..."};` — never silent |

Both wire shapes are accepted: flat `{"command":"SET_PORT","port":1,"value":80};`
(Joystick) and nested `{"command":"MOVE_TIMED","params":{...}};` (Blocks).

## Files

- `robotku-esp32.ino` — the interpreter (parser, drive model, BLE, watchdog, OLED).
- `config.h` — **all** pins, the port→GPIO table, servo calibration, and timing.
  Change wiring here, nowhere else.
- `platformio.ini` — board + pinned library versions.

## Hardware / wiring (proven on bench test1)

| Part | GPIO | Notes |
| --- | --- | --- |
| OLED SSD1306 128×64 | SDA **21**, SCL **22**, I²C `0x3C` | splash + status |
| Passive buzzer | **26** | `tone()` / `noTone()` |
| Left drive servo (SG90 continuous) | **33** | proven |
| Right drive servo (SG90 continuous) | **25** | **confirm free before soldering** |

**Second servo is a prerequisite, not optional.** With one servo the robot can only
spin in place — turning left/right (block test D3) and two-axis Joystick can't be
proven. Confirm GPIO25 is free on your board; if the PCB already uses it, pick
another safe output pin and update `PIN_SERVO_R` in `config.h`.

**ESP32 GPIO rules** (documented in `config.h`): avoid 6–11 (flash), 34–39
(input-only, no PWM/output), and 0/2/12/15 (strapping) for outputs.

Continuous servos drift: send `SET_PORT value 0` and adjust `SERVO_L_TRIM` /
`SERVO_R_TRIM` until each side truly stops. `SERVO_R_INVERT` makes "+" mean forward
on both sides.

## Build

**PlatformIO:** `pio run -t upload` from this folder.

**Arduino IDE / arduino-cli:** install the libraries at the versions in
`platformio.ini`, select an ESP32 Dev Module on **ESP32 core 2.0.x**, and upload.
Verified with:

```
arduino-cli compile --fqbn esp32:esp32:esp32 .
```

### Pinned versions (why they matter)

- **ESP32 Arduino core 2.0.17.** Core **3.x** renamed the LEDC API
  (`ledcSetup`/`ledcAttachPin` → `ledcAttach`) and ships **NimBLE 2.x**, both of
  which break this build. If you must move to 3.x, expect to touch BLE callbacks.
- **NimBLE-Arduino 1.4.3.** 2.x changes `onMTUChange` to take `NimBLEConnInfo&`
  instead of `ble_gap_conn_desc*` — this firmware uses the 1.4 signature.
- **ArduinoJson 7.** `StaticJsonDocument` is deprecated; the code uses `JsonDocument`.
- **ESP32Servo 3.2.1**, **Adafruit SSD1306 2.5.17 + GFX 1.12.6 + BusIO 1.17.4**.

> Note: `tone()` and ESP32Servo both use hardware timers. This pairing is proven on
> the bench; if you add more PWM peripherals and hit a timer conflict, allocate
> timers explicitly with `ESP32PWM::allocateTimer(...)`.

## The 7 fixes (why the old firmware failed)

1. **Pin map** — the old map put motor lines on GPIO26/33, the buzzer and servo
   pins. `config.h` is now the single source of truth.
2. **Nested params** — Block Coding sends `{command, params:{…}}`; the old code
   read `doc["speed"]` at the top level → always defaulted, `direction` never read
   (no reverse, no left). A shim reads every field through `p` (nested **or** flat).
3. **Never block** — `delay()` on the command path starved BLE and missed the
   heartbeat, so any move >1 s died to the watchdog. Timed moves now set a deadline
   (`motionEndsAtMs`) that `loop()` enforces; the browser stays the timekeeper.
4. **6 opcodes + `UNSUPPORTED`** — the old "ignore unknown command" line is exactly
   why Joystick failed with no trace. Unknown opcodes now reply `UNSUPPORTED`.
5. **BLE MTU** — telemetry is chunked by the **negotiated** MTU−3, not a fixed 180
   (default MTU is 23). `setMTU(247)` requests a larger one.
6. **Watchdog** — arms only after the first `HELLO` (a bare bench board idles),
   disarms on disconnect, 2000 ms timeout, emits `FAILSAFE` + an OLED cue.
7. **Honest `HELLO_ACK`** — advertises only the 6 opcodes that compile, plus
   `ports:[1,2]`, `driveMode:"servo"`, `hasBuzzer`, `hasOled`.

## Verification (do IN ORDER — don't skip to Bluetooth)

**A — Serial Monitor @115200, paste manually (no web yet).**
The single most decisive test is A3:

```
{"command":"HELLO","protocol":"robotku-v1"};                                  -> HELLO_ACK, 6 caps, ports:[1,2]
{"command":"SET_PORT","port":1,"value":80};                                   -> left servo spins
{"command":"SET_PORT","port":1,"value":0};                                    -> left servo STOPS (tune trim)
{"command":"MOVE_TIMED","params":{"direction":"backward","speed":40,"duration_ms":2000}};
                                                                              -> REVERSE 40% for 2 s, then auto-stop
{"command":"PLAY_TONE","params":{"frequency":440,"duration_ms":500}};         -> buzzer beeps
{"command":"STOP_ALL"};                    (mid-move)                          -> stops at once
{"command":"DISPLAY_MATRIX"};                                                 -> UNSUPPORTED
```

If A fails, stop — don't blame Bluetooth.

**B — Joystick over USB (Web Serial):** stick moves servos smoothly; release →
neutral, no creep; close the tab mid-move → stops within 2 s (failsafe).

**C — Joystick over Bluetooth:** identical to B. If B works and C doesn't, it's BLE
— check FIX 5 (MTU).

**D — Block Coding over USB, 6 blocks:** Forward 1 s takes ~1 s (not 2); Reverse
slow really reverses slowly; Left then Right go opposite ways; `Repeat 3×[Forward
0.5 s, Play Tone]` runs three times in order; a 5 s program finishes without the
watchdog firing; Stop mid-program halts in <200 ms; the same program in the 2D
simulator matches direction/order within 10% on duration.

**E — Block Coding over Bluetooth:** repeat D1–D7, identical.
