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

- `src/main.cpp` — the interpreter (parser, drive model, BLE, watchdog, OLED).
- `src/config.h` — **all** pins, the port→GPIO table, servo calibration, and timing.
  Change wiring here, nowhere else.
- `platformio.ini` — board + pinned library versions.
- `robotku-esp32.ino` — **empty stub**, Arduino IDE entry point only (see Build).

The code lives in `src/` because that is PlatformIO's default `src_dir` and it
matches the ESP32 RoboSchool-Controller project layout, so the two are drop-in
compatible. The Arduino IDE also compiles a sketch's `src/` tree recursively, so
both toolchains build the same files — see **Build** below.

## Hardware / wiring (proven on bench test1)

| Part | GPIO | Notes |
| --- | --- | --- |
| OLED SSD1306 128×64 | SDA **21**, SCL **22**, I²C `0x3C` | splash + status |
| Passive buzzer | **26** | `tone()` / `noTone()` |
| Left drive servo (SG90 continuous) | **33** | proven |
| Right drive servo (SG90 continuous) | **25** | **not wired yet** — see `HAS_SERVO_R` |

**Second servo is a prerequisite, not optional.** With one servo the robot can only
spin in place — turning left/right (block test D3) and two-axis Joystick can't be
proven. Confirm GPIO25 is free on your board; if the PCB already uses it, pick
another safe output pin and update `PIN_SERVO_R` in `src/config.h`.

### `HAS_SERVO_R` — the one switch for the second servo

`src/config.h` ships with `#define HAS_SERVO_R 0` (the current bench build: one
servo on GPIO33). Everything else follows from that flag — do not hardcode port 2
anywhere:

| `HAS_SERVO_R` | `PORT_CHANNEL[2]` | `HELLO_ACK` | `SET_PORT` port 2 | `TURN_TIMED` |
| --- | --- | --- | --- | --- |
| `0` | `-1` | `ports:[1]`, no `TURN_TIMED` cap | `UNSUPPORTED` | `UNSUPPORTED` |
| `1` | `1` | `ports:[1,2]` + `TURN_TIMED` cap | drives right servo | turns |

Why it matters: a board that claims `ports:[1,2]` it doesn't have makes the right
joystick axis go dead **silently**, and a tester reads that as "the web app is
broken". Reporting `ports:[1]` lets the web app show the real reason. Flip the flag
to `1` only once the second servo is soldered *and* tested, then reflash.

**ESP32 GPIO rules** (documented in `config.h`): avoid 6–11 (flash), 34–39
(input-only, no PWM/output), and 0/2/12/15 (strapping) for outputs.

Continuous servos drift: send `SET_PORT value 0` and adjust `SERVO_L_TRIM` /
`SERVO_R_TRIM` until each side truly stops. `SERVO_R_INVERT` makes "+" mean forward
on both sides.

## Build

Both toolchains build the same `src/` tree — neither is second-class.

**PlatformIO** (default `src_dir = src`, nothing to configure):

```
pio run              # compile
pio run -t upload    # compile + flash
pio device monitor    # 115200
```

**Arduino IDE / arduino-cli:** the IDE requires a sketch file named after its
folder, so `robotku-esp32.ino` exists as an intentionally **empty stub**; the IDE
compiles `src/main.cpp` and `src/config.h` from the sketch's `src/` subdirectory.
Install the libraries at the versions in `platformio.ini`, select an ESP32 Dev
Module on **ESP32 core 2.0.x**, open `robotku-esp32.ino`, and upload. Verified with:

```
arduino-cli compile --fqbn esp32:esp32:esp32 .
```

Do **not** move code into the `.ino`: the IDE concatenates `.ino` files into its
own translation unit, so a `setup()`/`loop()` there would clash with the real ones
in `src/main.cpp`.

`upload_speed` is **115200** — the same rate as the RoboSchool-Controller project
and safe on any cable. Raise it only once a faster upload is proven on your board;
a link that can't hold 921600 fails with a confusing transfer error rather than an
obvious speed complaint.

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
7. **Honest `HELLO_ACK`** — advertises only the opcodes that compile, and the ports
   that are **really wired**: the `ports` array is built by scanning
   `PORT_CHANNEL`, so it follows `HAS_SERVO_R` instead of being hardcoded. Plus
   `driveMode:"servo"`, `hasBuzzer`, `hasOled`.

## Text commands (bench debugging, USB Serial)

The web app only ever speaks JSON, but typing JSON by hand is miserable. A line
that does **not** start with `{` is treated as a text command — the same
vocabulary as the RoboSchool-Controller sketch:

| Type | Does |
| --- | --- |
| `cw 2000` | spin 2 s in the `+` direction, then stop by itself |
| `ccw` | spin the other way until `stop` (no duration = no deadline) |
| `stop` | stop everything, cancel any deadline |
| `137` | write that raw angle (0–180) — how you find a continuous servo's neutral |
| `help` | print the list |

Replies use `[OK]` / `[ERROR]` prefixes. This path reuses `driveChannel()` and the
**same** non-blocking `motionEndsAtMs` deadline as the JSON path — there is no
second timer. The JSON path is untouched, and the web's telemetry parser silently
drops these non-JSON lines.

## OLED status

The display shows the link (`BLE` / `USB` / `Terputus`), a headline status, and the
**real servo position + direction** per channel (`L135 CW   R  --` when the right
servo isn't wired). `display()` is pushed at most every
`OLED_MIN_PUSH_INTERVAL_MS` (50 ms): an SSD1306 refresh costs ~30 ms of I2C, so
rendering per command would throttle the command stream itself.

## Verification (do IN ORDER — don't skip to Bluetooth)

**A — Serial Monitor @115200, paste manually (no web yet).**
The single most decisive test is A3:

```
{"command":"HELLO","protocol":"robotku-v1"};                                  -> HELLO_ACK, ports:[1] (HAS_SERVO_R=0)
{"command":"SET_PORT","port":1,"value":80};                                   -> left servo spins
{"command":"SET_PORT","port":1,"value":0};                                    -> left servo STOPS (tune trim)
{"command":"MOVE_TIMED","params":{"direction":"backward","speed":40,"duration_ms":2000}};
                                                                              -> REVERSE 40% for 2 s, then auto-stop
{"command":"PLAY_TONE","params":{"frequency":440,"duration_ms":500}};         -> buzzer beeps
{"command":"STOP_ALL"};                    (mid-move)                          -> stops at once
{"command":"DISPLAY_MATRIX"};                                                 -> UNSUPPORTED
{"command":"SET_PORT","port":2,"value":80};   (with HAS_SERVO_R=0)             -> UNSUPPORTED
```

Then the text path, same Serial Monitor:

```
help        -> the command list
cw 2000     -> servo spins 2 s, stops by itself, OLED shows CW then Selesai
stop        -> [OK] stop
90          -> [OK] sudut 90
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
