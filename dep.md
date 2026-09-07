Berikut adalah seluruh isi file yang telah dimodifikasi, dibuat, dan dipindahkan, disajikan secara lengkap:

---

### 1. [`src/transport/BaseTransport.ts`](file:///Users/firaniaputri/Downloads/robotku-main/src/transport/BaseTransport.ts)
```typescript
// src/transport/BaseTransport.ts
//
// Shared behaviour for every concrete transport (BLE, Serial):
//   - HELLO handshake with 4s timeout
//   - 500ms HEARTBEAT + 1.5s watchdog -> 'error' + auto e-stop
//   - outgoing framing: every command leaves as `...;\n`, chunked to <=180 bytes
//     and never split across writes when it fits
//   - inbound framing: buffer until `;`/newline, JSON.parse, forward as telemetry
//
// Subclasses only implement the wire-level open/close/write; all protocol logic
// lives here so BLE and Serial stay identical.

import type { ConnState, RobotTransport } from './RobotTransport';
import {
  type RobotCommand,
  type RobotInfo,
  heartbeatLine,
  helloLine,
  estopLines,
  parseTelemetry,
} from '../domain/protocol';

const MAX_CHUNK = 180; // bytes per BLE write (safe for default ATT MTU)
const HELLO_TIMEOUT_MS = 4000;
const HEARTBEAT_INTERVAL_MS = 500;
const HEARTBEAT_TIMEOUT_MS = 1500;

export abstract class BaseTransport implements RobotTransport {
  abstract readonly kind: 'ble' | 'serial';

  private telemetryCbs: Array<(msg: RobotCommand) => void> = [];
  private stateCbs: Array<(s: ConnState) => void> = [];
  private state: ConnState = 'disconnected';

  private rxBuffer = '';
  private encoder = new TextEncoder();

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatSeq = 0;
  private lastRxTime = 0;

  private helloResolve: ((info: RobotInfo) => void) | null = null;

  // ---- subclass contract -------------------------------------------------

  /** Open the picker + device, wire notifications to `this.handleIncoming`. */
  protected abstract openTransport(): Promise<void>;

  /** Tear down the underlying device/port. */
  protected abstract closeTransport(): Promise<void>;

  /** Write raw bytes to the board (already chunked to <=180 bytes). */
  protected abstract writeChunk(bytes: Uint8Array): Promise<void>;

  // ---- lifecycle ---------------------------------------------------------

  async connect(): Promise<RobotInfo> {
    this.setState('connecting');
    try {
      await this.openTransport();
    } catch (err) {
      this.setState('disconnected'); // user cancelled picker / no device
      throw err;
    }

    try {
      const info = await this.handshake();
      this.lastRxTime = Date.now();
      this.startHeartbeat();
      this.setState('connected');
      return info;
    } catch (err) {
      await this.closeTransport().catch(() => {});
      this.setState('error');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    await this.closeTransport().catch(() => {});
    this.setState('disconnected');
  }

  // ---- sending -----------------------------------------------------------

  async sendLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;
    // writeFramed re-splits on ';' and terminates every command with ';\n',
    // so we only need the ';' here — never append the newline ourselves or the
    // split would emit a bare "\n;" frame.
    const normalized = trimmed.endsWith(';') ? trimmed : `${trimmed};`;
    await this.writeFramed(normalized);
  }

  async sendProgram(lines: string[]): Promise<void> {
    for (const line of lines) {
      await this.sendLine(line);
    }
  }

  async estop(): Promise<void> {
    // Bypass every queue: write straight to the wire, immediately.
    try {
      await this.writeFramed(estopLines());
    } catch (err) {
      console.warn('[transport] estop write failed', err);
    }
  }

  // ---- subscriptions -----------------------------------------------------

  onTelemetry(cb: (msg: RobotCommand) => void): void {
    this.telemetryCbs.push(cb);
  }

  onState(cb: (s: ConnState) => void): void {
    this.stateCbs.push(cb);
  }

  // ---- inbound (called by subclasses) ------------------------------------

  /** Feed raw inbound text/bytes; frames are extracted on `;` / newline. */
  protected handleIncoming(text: string): void {
    this.lastRxTime = Date.now();
    this.rxBuffer += text;

    // Only process up to the last complete frame boundary.
    const lastBoundary = Math.max(this.rxBuffer.lastIndexOf(';'), this.rxBuffer.lastIndexOf('\n'));
    if (lastBoundary === -1) return;

    const complete = this.rxBuffer.slice(0, lastBoundary + 1);
    this.rxBuffer = this.rxBuffer.slice(lastBoundary + 1);

    for (const msg of parseTelemetry(complete)) {
      this.dispatch(msg);
    }
  }

  /** Called by subclasses when the underlying link drops unexpectedly. */
  protected handleUnexpectedDisconnect(): void {
    this.stopHeartbeat();
    this.setState('disconnected');
  }

  // ---- internals ---------------------------------------------------------

  private dispatch(msg: RobotCommand): void {
    const type = (msg.command as string) || (msg as any).event;

    if (type === 'HELLO_ACK' && this.helloResolve) {
      const info: RobotInfo = {
        fwVersion: String((msg as any).fw ?? (msg as any).fwVersion ?? '?'),
        board: String((msg as any).board ?? 'Robotku'),
        protocol: String((msg as any).protocol ?? 'robotku-v1'),
        capabilities: Array.isArray((msg as any).capabilities) ? (msg as any).capabilities : [],
      };
      this.helloResolve(info);
      this.helloResolve = null;
    }

    for (const cb of this.telemetryCbs) {
      try {
        cb(msg);
      } catch (err) {
        console.warn('[transport] telemetry callback threw', err);
      }
    }
  }

  private handshake(): Promise<RobotInfo> {
    return new Promise<RobotInfo>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.helloResolve = null;
        reject(new Error('HELLO handshake timed out (no HELLO_ACK within 4s)'));
      }, HELLO_TIMEOUT_MS);

      this.helloResolve = (info) => {
        clearTimeout(timer);
        resolve(info);
      };

      this.writeFramed(helloLine()).catch((err) => {
        clearTimeout(timer);
        this.helloResolve = null;
        reject(err);
      });
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatSeq = 0;
    this.heartbeatTimer = setInterval(() => {
      // Watchdog: no inbound frame within the timeout window -> failsafe.
      if (Date.now() - this.lastRxTime > HEARTBEAT_TIMEOUT_MS) {
        console.warn('[transport] heartbeat watchdog tripped');
        this.setState('error');
        void this.estop();
        return;
      }
      void this.writeFramed(heartbeatLine(this.heartbeatSeq++)).catch(() => {
        this.setState('error');
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private setState(s: ConnState): void {
    if (this.state === s) return;
    this.state = s;
    for (const cb of this.stateCbs) {
      try {
        cb(s);
      } catch (err) {
        console.warn('[transport] state callback threw', err);
      }
    }
  }

  /**
   * UTF-8 encode a `;`-terminated blob and write it in <=180-byte chunks,
   * splitting on `;` boundaries so a single command isn't torn across writes
   * when it fits in a chunk. Each command goes out `;\n`-terminated — see the
   * comment inside for why the newline is not optional.
   */
  private async writeFramed(blob: string): Promise<void> {
    // Group commands so each chunk stays <=MAX_CHUNK and prefers `;` boundaries.
    // Every command leaves as `...;\n`. The trailing newline matters: firmware
    // that reads with Serial.readStringUntil('\n') (the ControllerV1 sketch)
    // otherwise hangs until its ~1s timeout and then parses several concatenated
    // commands as one string. Robotku's own feed() splits on ';' AND '\n', so the
    // extra byte is read as an empty line and ignored.
    const commands = blob
      .split(';')
      .map((c) => c.trim())
      .filter((c) => c.length > 0)
      .map((c) => `${c};\n`);

    let batch = '';
    for (const cmd of commands) {
      const cmdBytes = this.encoder.encode(cmd);
      if (cmdBytes.length > MAX_CHUNK) {
        // Oversized single command: flush batch, then hard-split the command.
        if (batch) {
          await this.writeChunk(this.encoder.encode(batch));
          batch = '';
        }
        await this.writeRawChunks(cmdBytes);
        continue;
      }
      if (this.encoder.encode(batch + cmd).length > MAX_CHUNK) {
        await this.writeChunk(this.encoder.encode(batch));
        batch = cmd;
      } else {
        batch += cmd;
      }
    }
    if (batch) {
      await this.writeChunk(this.encoder.encode(batch));
    }
  }

  private async writeRawChunks(bytes: Uint8Array): Promise<void> {
    for (let i = 0; i < bytes.length; i += MAX_CHUNK) {
      await this.writeChunk(bytes.slice(i, i + MAX_CHUNK));
    }
  }
}
```

---

### 2. [`src/test/transport.test.ts`](file:///Users/firaniaputri/Downloads/robotku-main/src/test/transport.test.ts)
```typescript
// src/test/transport.test.ts
// Wire framing regression: every command the transport writes must end with ";\n".
//
// Firmware that reads with Serial.readStringUntil('\n') (the ControllerV1 sketch)
// hangs on a missing newline until its ~1s timeout and then tries to parse several
// concatenated commands as one string. Robotku's own feed() splits on ';' AND '\n',
// so the extra byte is harmless there — but it must be exactly one byte, and the
// ';' must not be doubled.

import { describe, it, expect } from 'vitest';
import { BaseTransport } from '../transport/BaseTransport';
import { driveDirectLine, setPortLine, estopLines } from '../domain/protocol';

/** Records every byte the transport hands to the wire. */
class FakeTransport extends BaseTransport {
  readonly kind = 'serial' as const;
  readonly chunks: string[] = [];
  private decoder = new TextDecoder();

  protected async openTransport(): Promise<void> {}
  protected async closeTransport(): Promise<void> {}
  protected async writeChunk(bytes: Uint8Array): Promise<void> {
    this.chunks.push(this.decoder.decode(bytes));
  }

  /** Everything written so far, as one string. */
  wire(): string {
    return this.chunks.join('');
  }

  /** The wire split back into lines, newline included. */
  lines(): string[] {
    return this.wire()
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => `${l}\n`);
  }
}

function assertWellFramed(t: FakeTransport): void {
  const wire = t.wire();
  expect(wire.length).toBeGreaterThan(0);
  expect(wire.endsWith(';\n')).toBe(true);
  expect(wire).not.toContain(';;'); // no doubled terminator
  expect(wire).not.toContain('\n\n'); // no blank lines
  expect(wire).not.toContain('\n;'); // no orphaned ';' after a newline
  for (const line of t.lines()) {
    expect(line.endsWith(';\n')).toBe(true);
    expect(line.slice(0, -2)).not.toContain('\n');
  }
}

describe('BaseTransport wire framing', () => {
  it('terminates a single command with ";\\n"', async () => {
    const t = new FakeTransport();
    await t.sendLine('{"command":"SET_PORT","port":1,"value":80}');
    expect(t.wire()).toBe('{"command":"SET_PORT","port":1,"value":80};\n');
    assertWellFramed(t);
  });

  it('does not double the ";" when the caller already terminated the line', async () => {
    const t = new FakeTransport();
    await t.sendLine(setPortLine(1, 80)); // protocol helper already appends ';'
    expect(t.wire()).toBe('{"command":"SET_PORT","port":1,"value":80};\n');
    assertWellFramed(t);
  });

  it('newline-terminates every command of a multi-command blob', async () => {
    const t = new FakeTransport();
    await t.sendLine(`${driveDirectLine(50, -50)}${setPortLine(2, 0)}`);
    expect(t.lines()).toEqual([
      '{"command":"DRIVE_DIRECT","left":50,"right":-50};\n',
      '{"command":"SET_PORT","port":2,"value":0};\n',
    ]);
    assertWellFramed(t);
  });

  it('newline-terminates every line of a program', async () => {
    const t = new FakeTransport();
    await t.sendProgram([
      '{"command":"MOVE_TIMED","params":{"direction":"forward","speed":60,"duration_ms":1000}}',
      '{"command":"STOP_ALL"};',
    ]);
    expect(t.lines()).toHaveLength(2);
    assertWellFramed(t);
  });

  it('newline-terminates the e-stop path (both commands)', async () => {
    const t = new FakeTransport();
    await t.estop();
    expect(t.lines()).toEqual([
      '{"command":"DRIVE_DIRECT","left":0,"right":0};\n',
      '{"command":"ESTOP"};\n',
    ]);
    // estopLines() itself must NOT already carry newlines, or we'd double them.
    expect(estopLines()).not.toContain('\n');
    assertWellFramed(t);
  });

  it('keeps chunks within the BLE-safe 180-byte budget once newlines are added', async () => {
    const t = new FakeTransport();
    const many = Array.from({ length: 20 }, (_, i) => setPortLine(1, i)).join('');
    await t.sendLine(many);
    for (const chunk of t.chunks) {
      expect(new TextEncoder().encode(chunk).length).toBeLessThanOrEqual(180);
    }
    expect(t.lines()).toHaveLength(20);
    assertWellFramed(t);
  });

  it('writes nothing for an empty or whitespace-only line', async () => {
    const t = new FakeTransport();
    await t.sendLine('   ');
    await t.sendLine('');
    expect(t.chunks).toEqual([]);
  });
});
```

---

### 3. [`firmware/robotku-esp32/robotku-esp32.ino`](file:///Users/firaniaputri/Downloads/robotku-main/firmware/robotku-esp32/robotku-esp32.ino)
```cpp
/* ============================================================================
 * robotku-esp32.ino — Arduino IDE entry point ONLY. Deliberately empty.
 * ----------------------------------------------------------------------------
 * The firmware itself lives in src/main.cpp + src/config.h. That layout is what
 * PlatformIO expects by default (src_dir = src), and it matches the ESP32
 * RoboSchool-Controller project, so the two are drop-in compatible.
 *
 * The Arduino IDE additionally requires a sketch file named after its folder,
 * and it compiles every source file under the sketch's src/ subdirectory
 * recursively — so this stub is all that is needed to keep BOTH toolchains
 * working from the same tree:
 *
 *   PlatformIO   : pio run -t upload        (from this folder)
 *   Arduino IDE  : open this .ino, then Upload
 *
 * Do NOT put code here: the IDE concatenates .ino files into its own
 * translation unit, so setup()/loop() defined here would clash with the real
 * ones in src/main.cpp. See README.md ("Build").
 * ==========================================================================*/
```

---

### 4. [`firmware/robotku-esp32/platformio.ini`](file:///Users/firaniaputri/Downloads/robotku-main/firmware/robotku-esp32/platformio.ini)
```ini
; ============================================================================
; PlatformIO project for the Robotku ESP32 firmware.
; Versions below are the exact ones this firmware was compiled against
; (Arduino ESP32 core 2.0.17). See README before bumping any of them.
; ============================================================================
[env:esp32dev]
platform = espressif32@6.9.0     ; -> Arduino ESP32 core 2.0.17
board = esp32dev
framework = arduino

monitor_speed = 115200
; 115200 matches the RoboSchool-Controller setup and any USB-UART bridge/cable.
; Raise to 921600 only once a faster upload is proven on your board — a cable or
; board that cannot hold 921600 fails with a confusing "packet content transfer
; stopped" error rather than an obvious speed complaint.
upload_speed = 115200

lib_deps =
    ; Pin NimBLE to 1.4.x. 2.x renames the onMTUChange callback signature and
    ; will break this build without an obvious error.
    h2zero/NimBLE-Arduino @ 1.4.3
    ; ArduinoJson 7 — StaticJsonDocument is deprecated; this code uses JsonDocument.
    bblanchon/ArduinoJson @ ^7.4.3
    madhephaestus/ESP32Servo @ ^3.2.1
    adafruit/Adafruit SSD1306 @ ^2.5.17
    adafruit/Adafruit GFX Library @ ^1.12.6
    adafruit/Adafruit BusIO @ ^1.17.4

; --- Arduino IDE users (no PlatformIO) ---
; Install the same libraries from Library Manager at the versions above, select
; an "ESP32 Dev Module" board on ESP32 core 2.0.x, and open robotku-esp32.ino (the code is compiled from src/).
```

---

### 5. [`firmware/robotku-esp32/src/config.h`](file:///Users/firaniaputri/Downloads/robotku-main/firmware/robotku-esp32/src/config.h)
```cpp
/* ============================================================================
 * config.h — Robotku ESP32 pin map, port table, servo calibration, timing.
 * ONE place to change hardware wiring. The .ino never hardcodes a GPIO.
 * ----------------------------------------------------------------------------
 * ESP32 GPIO rules (read before moving a pin):
 *   - 6..11   : wired to on-board SPI flash — DO NOT USE.
 *   - 34..39  : INPUT-ONLY, no output/PWM — never put an actuator here (a servo
 *               on GPIO34 just sits silent and you waste an afternoon).
 *   - 0,2,12,15 : strapping pins — avoid for outputs (boot glitches).
 * Pins below are chosen to respect all of the above.
 * ==========================================================================*/
#pragma once

// ------------------------------------------------------------------- OLED
// SSD1306 128x64 over I2C (proven on bench test1). Splash + status live here.
#define PIN_OLED_SDA   21
#define PIN_OLED_SCL   22
#define OLED_ADDR      0x3C
#define OLED_WIDTH     128
#define OLED_HEIGHT    64

// ----------------------------------------------------------------- Buzzer
// Passive buzzer driven with tone()/noTone(). tone() is async on ESP32.
#define PIN_BUZZER     26

// ------------------------------------------------------------------ Servos
// SG90 CONTINUOUS rotation servos (ESP32Servo):
//   setPeriodHertz(50), attach(pin, SERVO_MIN_US, SERVO_MAX_US)
//   write(90) = stop, write(180) = full one way, write(0) = full the other.
#define PIN_SERVO_L    33      // LEFT drive  — proven working on bench test1
#define PIN_SERVO_R    25      // RIGHT drive — TODO: confirm GPIO25 is free on
                               //               your board BEFORE you solder it.

// Is the RIGHT servo physically soldered and tested? THE ONE switch for it.
// 0 = one-servo board (the current ControllerV1 bench build: GPIO33 only).
//     The board then reports ports:[1] in HELLO_ACK and answers UNSUPPORTED to
//     SET_PORT on port 2, so the web app can say WHY the right stick is dead
//     instead of just going quiet — which reads to a tester as "the web is broken".
// 1 = second servo really attached & verified. Flip this, reflash, done: the
//     port table and HELLO_ACK both follow from here, nothing else to edit.
#define HAS_SERVO_R    0

#define SERVO_MIN_US   500
#define SERVO_MAX_US   2400
#define SERVO_STOP_DEG 90      // continuous-servo neutral

// The right servo faces the opposite way on the chassis, so a "+" command must
// spin it the other direction for the robot to go straight. Flip if your build
// mirrors this.
#define SERVO_R_INVERT 1       // 1 = invert right side, 0 = don't

// A continuous SG90 almost never truly stops at exactly 90°. Trim (in degrees,
// may be negative) shifts each side's neutral so value 0 = actually still.
// Calibrate on the bench: send SET_PORT value 0 and nudge until it stops.
#define SERVO_L_TRIM   0
#define SERVO_R_TRIM   0

// --------------------------------------------------- Port (1..8) -> drive side
// Joystick / SET_PORT addresses output ports 1..8. Keep the mapping a TABLE so
// wiring a new port later is a one-line change, not another if-branch.
//   value 0  = LEFT servo channel
//   value 1  = RIGHT servo channel
//   value -1 = not wired  -> firmware replies UNSUPPORTED (never silent).
// Port 2 is derived from HAS_SERVO_R — do NOT hardcode it here and in HELLO_ACK.
static const int PORT_CHANNEL[9] = {
  -1,                        // [0] unused — ports are 1-based
   0,                        // port 1 -> LEFT  (PIN_SERVO_L)
  (HAS_SERVO_R ? 1 : -1),    // port 2 -> RIGHT (PIN_SERVO_R), only if wired
  -1,   // port 3 — not wired
  -1,   // port 4
  -1,   // port 5
  -1,   // port 6
  -1,   // port 7
  -1    // port 8
};

// ---------------------------------------------------------------- Timing
// Watchdog: once a link has said HELLO, the browser must keep talking (it sends
// HEARTBEAT every 500ms). If it goes quiet this long, cut the motors.
#define HEARTBEAT_TIMEOUT_MS     2000

// OLED: an SSD1306 refresh is ~30 ms over I2C. Never push more often than this,
// or a Joystick stream (which changes the display every command) starves the
// command path. Frames are marked dirty and flushed from loop().
#define OLED_MIN_PUSH_INTERVAL_MS   50

// Timed moves set a firmware deadline = browser-requested duration + this margin.
// The browser is the real timekeeper; this deadline is only a SAFETY NET for a
// lost STOP. The margin keeps the two from racing (see FIX 3 in the .ino).
#define MOTION_SAFETY_MARGIN_MS  300
```

---

### 6. [`firmware/robotku-esp32/src/main.cpp`](file:///Users/firaniaputri/Downloads/robotku-main/firmware/robotku-esp32/src/main.cpp)
```cpp
/* ============================================================================
 * Robotku ESP32 Firmware — resident command interpreter (Joystick + 6 blocks)
 * ----------------------------------------------------------------------------
 * Speaks the SAME line-delimited JSON protocol as the Robotku web app, over BOTH:
 *   - BLE Nordic UART Service (NUS)   -> Web Bluetooth
 *   - USB Serial @ 115200             -> Web Serial
 * The web app STREAMS commands; we interpret them live. No compile/flash on Run.
 *
 * SCOPE (deliberately narrow — prove the pipe end-to-end first):
 *   Joystick  : SET_PORT
 *   Block set : MOVE_TIMED, TURN_TIMED, WAIT, PLAY_TONE, STOP_ALL
 *   Everything else -> {"command":"UNSUPPORTED","op":"..."};
 *
 * A bench operator can ALSO type ControllerV1-style text commands into the Serial
 * Monitor (cw / ccw / stop / help / a bare 0-180 angle) — see handleTextCommand().
 * That path is purely additive; the JSON path is untouched.
 *
 * Layout: this file is src/main.cpp with src/config.h beside it, so both
 * PlatformIO (default src_dir) and the Arduino IDE (which compiles the sketch's
 * src/ tree) build it. robotku-esp32.ino in the parent folder is an empty stub
 * that exists only to give the Arduino IDE a sketch name. See README.
 *
 * Two wire shapes both accepted (see FIX 2):
 *   flat   {"command":"SET_PORT","port":1,"value":80};                 (Joystick)
 *   nested {"command":"MOVE_TIMED","params":{"direction":"backward",   (Blocks)
 *           "speed":40,"duration_ms":2000}};
 *
 * Hardware is proven on bench test1 — see config.h. Drive is TWO continuous SG90
 * servos (tank style), NOT an H-bridge; buzzer on GPIO26; SSD1306 OLED on I2C.
 *
 * Pinned libraries (see platformio.ini / README):
 *   NimBLE-Arduino, ArduinoJson 7, ESP32Servo, Adafruit_SSD1306, Adafruit_GFX.
 * ==========================================================================*/

#include <NimBLEDevice.h>
#include <ArduinoJson.h>          // v7 — JsonDocument (StaticJsonDocument is deprecated)
#include <ESP32Servo.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#include "config.h"

// ------------------------------------------------------------------ Identity
#define FW_VERSION   "2.0.0-joy6"
#define BOARD_NAME   "Robotku ESP32"
#define PROTOCOL_ID  "robotku-v1"
#define BLE_NAME     "Robotku"

// -------------------------------------------------------------- NUS UUIDs
// MUST match src/transport/BleTransport.ts exactly — do NOT change these.
#define NUS_SERVICE_UUID  "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define NUS_RX_CHAR_UUID  "6e400002-b5a3-f393-e0a9-e50e24dcca9e"  // web writes here
#define NUS_TX_CHAR_UUID  "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // we notify here

// =============================================================== HARDWARE
Servo servoL;
Servo servoR;
Adafruit_SSD1306 oled(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
bool oledOk = false;

// ----------------------------------------------------- Non-blocking motion
// FIX 3: the firmware NEVER blocks. A timed command sets the actuators and
// records a deadline; loop() stops them when the deadline passes. delay() must
// not appear on the command path or (a) BLE bytes pile up and (b) HEARTBEAT is
// missed and the watchdog kills a move longer than the timeout. The browser is
// the real timekeeper; this deadline is only a safety net if a STOP is lost.
// Do NOT "simplify" this back into delay() — that reintroduces both bugs.
unsigned long motionEndsAtMs = 0;   // 0 = no timed motion in flight

// ----------------------------------------------------- Heartbeat watchdog
// FIX 6: arm ONLY after the first HELLO (a bare board on the bench must idle,
// not failsafe every second). Disarm on BLE disconnect. Trip if the link goes
// quiet for HEARTBEAT_TIMEOUT_MS.
unsigned long lastRxMs = 0;
bool watchdogArmed = false;
bool failsafeEngaged = false;

// --------------------------------------------------------------- BLE state
NimBLECharacteristic* txChar = nullptr;
bool bleConnected = false;
uint16_t bleMtu = 23;               // updated on negotiation (FIX 5); 23 = BLE default

// Inbound line buffers (one per interface; both feed the same parser).
String bleBuffer = "";
String serialBuffer = "";

String lastStatus = "Siap";         // shown on OLED

// ------------------------------------------------------- Interface presence
// USB Serial gives us no connect/disconnect event, so "USB" means "we have seen
// at least one line arrive over it". BLE we know exactly. Drives the OLED's
// connection line: "BLE" > "USB" > "Terputus".
bool usbSeen = false;

// ------------------------------------------------------------- Servo mirror
// Last angle actually written per channel, so the OLED can show the true servo
// position (ControllerV1 does this and it is far more useful on the bench than a
// generic status string). Index 0 = left, 1 = right.
int servoAngle[2] = { SERVO_STOP_DEG, SERVO_STOP_DEG };

// ---------------------------------------------------------- OLED throttling
// An SSD1306 refresh is ~30 ms over I2C. Rendering on every command would
// throttle the command stream itself (Joystick sends continuously), so frames
// are marked dirty and pushed at most every OLED_MIN_PUSH_INTERVAL_MS from loop().
String oledLine1 = "Siap";
String oledLine2 = "USB / Bluetooth";
bool oledDirty = false;
unsigned long lastOledPushMs = 0;

// ============================================================ ACTUATOR API
// Where "stopped" actually is for a channel, once trim is applied.
int servoNeutralDeg(int ch) {
  return SERVO_STOP_DEG + (ch == 0 ? SERVO_L_TRIM : SERVO_R_TRIM);
}

// The ONE place a servo angle is written. Both the JSON path (driveChannel) and
// the bench text path (a bare 0-180) go through here, so the OLED mirror and the
// unwired-channel guard can't drift apart.
void servoWriteAngle(int ch, int deg) {
  if (ch < 0 || ch > 1) return;
  if (ch == 1 && !HAS_SERVO_R) return;   // right servo not soldered — nothing to drive
  deg = constrain(deg, 0, 180);
  Servo* s = (ch == 0) ? &servoL : &servoR;
  s->write(deg);
  servoAngle[ch] = deg;
  oledDirty = true;                      // pushed by loop(), throttled
}

// STOP / CW / CCW for a channel, derived from the angle actually written
// relative to that channel's trimmed neutral — no extra state to keep in sync.
const char* servoDirLabel(int ch) {
  int d = servoAngle[ch] - servoNeutralDeg(ch);
  if (d > 2)  return "CW";
  if (d < -2) return "CCW";
  return "STOP";
}

// One continuous-servo channel. value in [-100,100]: + = forward for that side
// AFTER invert is applied, 0 = stop (with trim), - = reverse.
void driveChannel(int ch, int value) {
  value = constrain(value, -100, 100);
  int trim   = (ch == 0) ? SERVO_L_TRIM : SERVO_R_TRIM;
  bool invert = (ch == 0) ? false : (SERVO_R_INVERT != 0);

  int eff = invert ? -value : value;
  // Continuous SG90: 90 = stop, ±90 span. Trim nudges the neutral point.
  servoWriteAngle(ch, SERVO_STOP_DEG + trim + (eff * 90) / 100);
}

// Tank drive: left/right in [-100,100], + = forward.
void driveTank(int left, int right) {
  driveChannel(0, left);
  driveChannel(1, right);
}

// STOP_ALL / failsafe / deadline: every channel to neutral, cancel any deadline.
void stopAllActuators() {
  driveChannel(0, 0);
  driveChannel(1, 0);
  motionEndsAtMs = 0;
}

// =============================================================== OLED
// "BLE" | "USB" | "Terputus" — what the board is actually talking to.
const char* connLabel() {
  if (bleConnected) return "BLE";
  if (usbSeen)      return "USB";
  return "Terputus";
}

// Build the frame and push it. Callers go through oledPushIfDue(), never here.
void oledRender() {
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);

  // Row 1: brand + which link we are on.
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.print(F("Robotku"));
  const char* conn = connLabel();
  oled.setCursor(128 - 6 * (int)strlen(conn), 0);   // right-aligned, 6px/char
  oled.print(conn);

  // Row 2: the headline status, big enough to read from across the table.
  oled.setTextSize(2);
  oled.setCursor(0, 12);
  oled.print(oledLine1);

  // Row 3: real servo position + direction, per channel (ControllerV1 style).
  oled.setTextSize(1);
  oled.setCursor(0, 32);
  char buf[24];
  if (HAS_SERVO_R) {
    snprintf(buf, sizeof(buf), "L%3d %-4s R%3d %s",
             servoAngle[0], servoDirLabel(0), servoAngle[1], servoDirLabel(1));
  } else {
    // Honest about the hardware: no second servo, so no second reading.
    snprintf(buf, sizeof(buf), "L%3d %-4s R  --", servoAngle[0], servoDirLabel(0));
  }
  oled.print(buf);

  // Row 4: detail line.
  oled.setCursor(0, 46);
  oled.print(oledLine2);

  oled.display();
}

// Push a pending frame if the display has had its ~30 ms to breathe. Called from
// loop() and opportunistically right after a status change so single events
// (HELLO, STOP) appear immediately instead of waiting for the next tick.
void oledPushIfDue() {
  if (!oledOk || !oledDirty) return;
  unsigned long now = millis();
  if (now - lastOledPushMs < OLED_MIN_PUSH_INTERVAL_MS) return;
  lastOledPushMs = now;
  oledDirty = false;
  oledRender();
}

void oledStatus(const String& line1, const String& line2) {
  oledLine1 = line1;
  oledLine2 = line2;
  oledDirty = true;
  oledPushIfDue();
}

void oledSplash() {
  if (!oledOk) return;
  oled.clearDisplay();
  // Simple friendly robot face — the "robot is alive" cue for kids.
  oled.drawRoundRect(34, 8, 60, 40, 8, SSD1306_WHITE);   // head
  oled.fillCircle(52, 26, 5, SSD1306_WHITE);             // left eye
  oled.fillCircle(76, 26, 5, SSD1306_WHITE);             // right eye
  oled.drawLine(54, 40, 74, 40, SSD1306_WHITE);          // smile
  oled.drawLine(64, 2, 64, 8, SSD1306_WHITE);            // antenna
  oled.fillCircle(64, 2, 2, SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  oled.setCursor(40, 54);
  oled.println(F("ROBOTKU"));
  oled.display();
}

// Startup chirp — happens in setup(), so delay() here is fine (not the cmd path).
void startupTone() {
  tone(PIN_BUZZER, 880, 120);  delay(140);
  tone(PIN_BUZZER, 1175, 120); delay(140);
  tone(PIN_BUZZER, 1568, 160); delay(180);
  noTone(PIN_BUZZER);
}

// =============================================================== TELEMETRY
// FIX 5: chunk notifications by the NEGOTIATED MTU (minus the 3-byte ATT header),
// not a fixed 180. The web reassembles across notifications by buffering until a
// ';', so a mid-line split is safe; we just must not exceed the MTU or the stack
// silently drops the tail and the JSON arrives corrupt.
void sendTelemetry(const String& line) {
  if (bleConnected && txChar) {
    size_t maxChunk = (bleMtu > 3) ? (size_t)(bleMtu - 3) : 20;
    for (size_t i = 0; i < line.length(); i += maxChunk) {
      String chunk = line.substring(i, i + maxChunk);
      txChar->setValue((uint8_t*)chunk.c_str(), chunk.length());
      txChar->notify();
    }
  }
  Serial.print(line);   // mirror to USB serial
}

void sendJson(JsonDocument& doc) {
  String out;
  serializeJson(doc, out);
  out += ";";           // the web parser splits on ';' — always terminate
  sendTelemetry(out);
}

void sendUnsupported(const char* op) {
  JsonDocument d;
  d["command"] = "UNSUPPORTED";
  d["op"] = op;
  sendJson(d);
}

// ---------------------------------------------------- param helpers (FIX 2)
// Duration may arrive as duration_ms | ms | duration (isNull() == key absent).
long readDurationMs(JsonObjectConst p) {
  if (!p["duration_ms"].isNull()) return p["duration_ms"].as<long>();
  if (!p["ms"].isNull())          return p["ms"].as<long>();
  if (!p["duration"].isNull())    return p["duration"].as<long>();
  return 0;
}

// A tiny note-name -> frequency map so PLAY_TONE accepts {"note":"C4"} too.
int noteToFreq(const char* note) {
  struct N { const char* n; int f; };
  static const N tbl[] = {
    {"C4",262},{"D4",294},{"E4",330},{"F4",349},{"G4",392},{"A4",440},{"B4",494},
    {"C5",523},{"D5",587},{"E5",659},{"F5",698},{"G5",784},{"A5",880}
  };
  for (auto& e : tbl) if (strcasecmp(e.n, note) == 0) return e.f;
  return 440;
}

// =========================================================== COMMAND PARSER
void handleCommand(const String& jsonLine) {
  JsonDocument doc;
  if (deserializeJson(doc, jsonLine)) return;   // ignore malformed fragment

  const char* cmd = doc["command"] | "";
  if (cmd[0] == '\0') return;

  // FIX 2 — nested-or-flat shim. Read EVERY parameter through `p`. Block Coding
  // sends {command, params:{...}}; Joystick/bench send flat {command, port,...}.
  // Supporting both means a later web change never forces re-flashing every board.
  JsonObjectConst p = doc["params"].is<JsonObject>() ? doc["params"].as<JsonObjectConst>()
                                                     : doc.as<JsonObjectConst>();

  // Any inbound, well-formed command counts as "link alive".
  lastRxMs = millis();
  failsafeEngaged = false;

  // --- STOP_ALL — safety first, handled before anything else ---------------
  if (strcmp(cmd, "STOP_ALL") == 0) {
    stopAllActuators();
    lastStatus = "STOP";
    return;
  }

  // --- System / handshake --------------------------------------------------
  if (strcmp(cmd, "HELLO") == 0) {
    // FIX 7 — advertise ONLY what actually compiles here.
    JsonDocument ack;
    ack["command"]  = "HELLO_ACK";
    ack["fw"]       = FW_VERSION;
    ack["board"]    = BOARD_NAME;
    ack["protocol"] = PROTOCOL_ID;
    JsonArray caps = ack["capabilities"].to<JsonArray>();
    caps.add("SET_PORT");
    caps.add("STOP_ALL");
    caps.add("MOVE_TIMED");
    // Turning needs two independently driven sides. With HAS_SERVO_R = 0 there
    // is only one, so don't advertise it — see the ports scan below.
    if (HAS_SERVO_R) caps.add("TURN_TIMED");
    caps.add("WAIT");
    caps.add("PLAY_TONE");
    // Report the ports that are REALLY wired by scanning the config.h table —
    // never a hardcoded list. A board claiming port 2 it doesn't have makes the
    // right joystick axis die silently, which reads as "the web app is broken".
    JsonArray ports = ack["ports"].to<JsonArray>();
    for (int i = 1; i <= 8; i++) {
      if (PORT_CHANNEL[i] >= 0) ports.add(i);
    }
    ack["driveMode"] = "servo";
    ack["hasBuzzer"] = true;
    ack["hasOled"]   = true;
    sendJson(ack);
    watchdogArmed = true;         // the link is live from here on
    lastStatus = "Terhubung";
    oledStatus("Terhubung", bleConnected ? "via Bluetooth" : "via USB");
    return;
  }

  if (strcmp(cmd, "HEARTBEAT") == 0) {
    JsonDocument ack;
    ack["command"] = "ACK";
    ack["seq"] = doc["seq"] | 0;
    sendJson(ack);
    return;
  }

// --- Joystick ------------------------------------------------------------
  // SET_PORT is LIVE control: no deadline (the joystick keeps sending; the
  // watchdog is the safety net). Map the port through the config.h table.
  if (strcmp(cmd, "SET_PORT") == 0) {
    int port  = p["port"]  | 0;
    int value = p["value"] | 0;
    if (port < 1 || port > 8 || PORT_CHANNEL[port] < 0) {
      sendUnsupported("SET_PORT");   // unwired port — never silent (FIX 4)
      return;
    }
    driveChannel(PORT_CHANNEL[port], value);
    return;
  }

  // --- Block: Forward / Reverse -------------------------------------------
  if (strcmp(cmd, "MOVE_TIMED") == 0) {
    const char* dir = p["direction"] | "forward";
    int speed = constrain((int)(p["speed"] | 60), 0, 100);
    long ms   = readDurationMs(p);
    int sign  = (strcmp(dir, "backward") == 0) ? -1 : 1;   // must read direction (FIX 2)
    driveTank(sign * speed, sign * speed);
    if (ms > 0) motionEndsAtMs = millis() + ms + MOTION_SAFETY_MARGIN_MS;
    lastStatus = (sign > 0) ? "Maju" : "Mundur";
    return;
  }

  // --- Block: Left / Right -------------------------------------------------
  if (strcmp(cmd, "TURN_TIMED") == 0) {
    if (!HAS_SERVO_R) {
      // One driven side can't turn — it would just drive straight. Say so
      // instead of moving wrongly and silently (FIX 4).
      sendUnsupported("TURN_TIMED");
      return;
    }
    const char* dir = p["direction"] | "left";
    int speed = constrain((int)(p["speed"] | 60), 0, 100);
    long ms   = readDurationMs(p);
    // left = left side back + right side forward; right = the mirror.
    bool left = (strcmp(dir, "left") == 0);
    driveTank(left ? -speed : speed, left ? speed : -speed);
    if (ms > 0) motionEndsAtMs = millis() + ms + MOTION_SAFETY_MARGIN_MS;
    lastStatus = left ? "Kiri" : "Kanan";
    return;
  }

  // --- Block: Wait ---------------------------------------------------------
  // Non-blocking no-op: the browser owns sequencing. We ACK so it's clear the
  // command arrived (and so the link stays "alive" — handled above).
  if (strcmp(cmd, "WAIT") == 0) {
    JsonDocument ack;
    ack["command"] = "ACK";
    ack["op"] = "WAIT";
    sendJson(ack);
    return;
  }

  // --- Block: Play Tone ----------------------------------------------------
  if (strcmp(cmd, "PLAY_TONE") == 0) {
    int freq;
    if (!p["frequency"].isNull())  freq = p["frequency"].as<int>();
    else if (!p["note"].isNull())  freq = noteToFreq(p["note"].as<const char*>());
    else                           freq = 440;
    long ms = readDurationMs(p);
    if (ms <= 0) ms = 300;
    tone(PIN_BUZZER, freq, ms);   // async on ESP32 — non-blocking (FIX 3)
    lastStatus = "Nada";
    return;
  }

  // --- Anything else -------------------------------------------------------
  // FIX 4: never silent. The old "ignore unknown command" line is exactly why
  // Joystick failed without a trace.
  sendUnsupported(cmd);
}

// ==================================================== TEXT COMMAND FALLBACK
// The web app only ever speaks JSON. Typing JSON by hand into a Serial Monitor is
// miserable, so a bench operator also gets the ControllerV1 vocabulary:
//
//   cw [ms]   ccw [ms]   stop   help   <angka 0-180>
//
// PURELY ADDITIVE — the JSON path above is untouched. This reuses driveChannel() /
// servoWriteAngle() and the SAME non-blocking motionEndsAtMs deadline that loop()
// already enforces; there is no second timer to keep in sync. Replies use
// ControllerV1's [OK]/[ERROR] prefixes and go to USB Serial only: they are not
// JSON, and the web's telemetry parser silently drops non-JSON frames anyway.

void textReply(const char* msg) {
  Serial.print(msg);
  Serial.print('\n');
}

void textHelp() {
  textReply("[OK] perintah teks (selain JSON):");
  textReply("  cw [ms]   - putar arah + (kosongkan ms = sampai stop)");
  textReply("  ccw [ms]  - putar arah -");
  textReply("  stop      - hentikan semua, batalkan tenggat");
  textReply("  0-180     - tulis sudut servo langsung");
  textReply("  help      - tampilkan daftar ini");
  textReply("[OK] JSON tetap jalan, mis: {\"command\":\"STOP_ALL\"};");
}

bool isAllDigits(const String& t) {
  if (t.length() == 0) return false;
  for (unsigned int i = 0; i < t.length(); i++) {
    if (!isDigit(t[i])) return false;
  }
  return true;
}

void handleTextCommand(const String& raw) {
  String line = raw;
  line.replace('\t', ' ');           // some Serial Monitors send tabs
  line.trim();
  if (line.length() == 0) return;

  int sp = line.indexOf(' ');
  String verb = (sp < 0) ? line : line.substring(0, sp);
  String arg  = (sp < 0) ? String("") : line.substring(sp + 1);
  verb.toLowerCase();
  arg.trim();

  if (verb == "help" || verb == "?") {
    textHelp();
    return;
  }

  if (verb == "stop") {
    stopAllActuators();               // also clears motionEndsAtMs
    lastStatus = "STOP";
    oledStatus("STOP", "perintah teks");
    textReply("[OK] stop");
    return;
  }

  if (verb == "cw" || verb == "ccw") {
    if (arg.length() > 0 && !isAllDigits(arg)) {
      textReply("[ERROR] ms harus angka, mis: cw 2000");
      return;
    }
    long ms = (arg.length() > 0) ? arg.toInt() : 0;
    bool cw = (verb == "cw");
    // "cw" = the same direction a POSITIVE SET_PORT drives the left channel, so
    // bench and web agree. The right channel keeps its SERVO_R_INVERT mirroring.
    int value = cw ? 100 : -100;
    driveChannel(0, value);
    if (HAS_SERVO_R) driveChannel(1, value);
    // Same deadline field the JSON path uses. No MOTION_SAFETY_MARGIN_MS here:
    // on the bench there is no browser acting as timekeeper, so the ms typed IS
    // the duration. ms omitted / 0 -> run until an explicit `stop`.
    motionEndsAtMs = (ms > 0) ? (millis() + (unsigned long)ms) : 0;
    lastStatus = cw ? "CW" : "CCW";

    char detail[24];
    if (ms > 0) snprintf(detail, sizeof(detail), "%ld ms", ms);
    else        snprintf(detail, sizeof(detail), "sampai stop");
    oledStatus(lastStatus, detail);

    char ok[48];
    snprintf(ok, sizeof(ok), "[OK] %s %s", cw ? "cw" : "ccw", detail);
    textReply(ok);
    return;
  }

  // A bare number: write the angle straight through, ControllerV1 style. Useful
  // for finding a continuous servo's true neutral before setting SERVO_*_TRIM.
  if (isAllDigits(line)) {
    int deg = line.toInt();
    if (deg > 180) {
      textReply("[ERROR] sudut harus 0-180");
      return;
    }
    motionEndsAtMs = 0;               // a held angle has no deadline
    servoWriteAngle(0, deg);
    if (HAS_SERVO_R) servoWriteAngle(1, deg);
    lastStatus = "Sudut";

    char detail[24];
    snprintf(detail, sizeof(detail), "%d deg", deg);
    oledStatus("Sudut", detail);

    char ok[40];
    snprintf(ok, sizeof(ok), "[OK] sudut %d", deg);
    textReply(ok);
    return;
  }

  textReply("[ERROR] perintah tidak dikenal - ketik help");
}

// Feed raw bytes into a per-interface buffer, dispatch on ';' or newline.
// A completed line starting with '{' is JSON (the web app); anything else is a
// human at a Serial Monitor, so it goes to the text fallback.
void feed(String& buffer, char c, bool fromSerial) {
  if (c == ';' || c == '\n') {
    String line = buffer;
    line.trim();
    buffer = "";
    if (line.length() == 0) return;   // e.g. the '\n' after a ';' — ignore
    if (fromSerial) usbSeen = true;
    if (line[0] == '{') handleCommand(line);
    else                handleTextCommand(line);
  } else {
    buffer += c;
    if (buffer.length() > 600) buffer = "";   // overflow guard
  }
}

// =================================================================== BLE
class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* server) override {
    (void)server;
    bleConnected = true;
    lastRxMs = millis();
  }
  void onDisconnect(NimBLEServer* server) override {
    bleConnected = false;
    bleMtu = 23;
    stopAllActuators();          // failsafe on link loss
    watchdogArmed = false;       // disarm until the next HELLO (FIX 6)
    lastStatus = "Terputus";
    oledStatus("Terputus", "menunggu...");
    server->startAdvertising();  // allow reconnection
  }
  // FIX 5: capture the negotiated MTU so telemetry chunks correctly.
  void onMTUChange(uint16_t mtu, ble_gap_conn_desc* desc) override {
    (void)desc;
    bleMtu = mtu;
  }
};

class RxCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* chr) override {
    std::string data = chr->getValue();
    for (char c : data) feed(bleBuffer, c, false);
  }
};

void setupBle() {
  NimBLEDevice::init(BLE_NAME);
  NimBLEDevice::setMTU(247);      // FIX 5: ask for a big MTU; peer negotiates down

  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  NimBLEService* service = server->createService(NUS_SERVICE_UUID);

  NimBLECharacteristic* rxChar = service->createCharacteristic(
    NUS_RX_CHAR_UUID,
    NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  rxChar->setCallbacks(new RxCallbacks());

  txChar = service->createCharacteristic(NUS_TX_CHAR_UUID, NIMBLE_PROPERTY::NOTIFY);

  service->start();

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(NUS_SERVICE_UUID);
  adv->setName(BLE_NAME);
  adv->start();
}

// =================================================================== SETUP
void setup() {
  Serial.begin(115200);

  // Servos (ESP32Servo): 50 Hz, calibrated pulse range for SG90.
  servoL.setPeriodHertz(50);
  servoL.attach(PIN_SERVO_L, SERVO_MIN_US, SERVO_MAX_US);
  if (HAS_SERVO_R) {             // don't claim a timer for a servo that isn't there
    servoR.setPeriodHertz(50);
    servoR.attach(PIN_SERVO_R, SERVO_MIN_US, SERVO_MAX_US);
  }
  stopAllActuators();

  pinMode(PIN_BUZZER, OUTPUT);

  // OLED
  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  oledOk = oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  if (oledOk) oledSplash();

  startupTone();                  // "robot hidup" cue (delay() ok in setup)

  setupBle();

  oledStatus("Siap", "USB / Bluetooth");
}

// ==================================================================== LOOP
void loop() {
  // 1) Drain USB serial.
  while (Serial.available() > 0) feed(serialBuffer, (char)Serial.read(), true);

  // 2) Non-blocking motion deadline (FIX 3): stop when a timed move expires.
  if (motionEndsAtMs != 0 && (long)(millis() - motionEndsAtMs) >= 0) {
    stopAllActuators();           // also clears motionEndsAtMs
    lastStatus = "Selesai";
    oledStatus("Selesai", "menunggu perintah");
  }

  // 3) Heartbeat watchdog (FIX 6): only after HELLO; trip once when link quiet.
  if (watchdogArmed && !failsafeEngaged &&
      (millis() - lastRxMs > HEARTBEAT_TIMEOUT_MS)) {
    stopAllActuators();
    failsafeEngaged = true;
    oledStatus("LINK PUTUS", "motor dimatikan");
    JsonDocument fs;
    fs["command"] = "FAILSAFE";
    fs["reason"] = "heartbeat_timeout";
    sendJson(fs);
  }

  // 4) Push a pending OLED frame, at most every OLED_MIN_PUSH_INTERVAL_MS (FIX:
  //    an SSD1306 refresh is ~30 ms of I2C; rendering per command would throttle
  //    the command stream itself).
  oledPushIfDue();
}
```

---

### 7. [`firmware/robotku-esp32/README.md`](file:///Users/firaniaputri/Downloads/robotku-main/firmware/robotku-esp32/README.md)
```markdown
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
```

---

### 8. [`README.md`](file:///Users/firaniaputri/Downloads/robotku-main/README.md)
```markdown
<div align="center">
  <img src="public/brand/Robotku-Mascot-Logo-Horizontal.png" alt="Robotku Logo" width="550" />

# Robotku - Web Control & Block Coding Suite

**An intuitive, full-screen robotics control & scratch-style block coding platform built for Next.js, Blockly, and ESP32 robots.**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Blockly](https://img.shields.io/badge/Blockly-Zelos_Renderer-FFAB19?style=for-the-badge&logo=google)](https://developers.google.com/blockly)
[![ESP32](https://img.shields.io/badge/Hardware-ESP32-E7352C?style=for-the-badge&logo=espressif)](https://www.espressif.com/)

</div>

---

## 🌟 Overview

**Robotku** is a state-of-the-art Web Application designed to control and program educational robots in real time. Built according to the **Robotku Design System**, it combines high-performance full-screen control interfaces with a high-fidelity Scratch-style (Zelos) Block Coding environment, complete with an embedded 3D Three.js simulator and real-time ESP32 hardware communication.

---

## ✨ Key Features

### 🎮 1. Interactive Full-Screen Control Modes

- **Base Robot**: Direct D-pad directional drive with claw grabber/release triggers.
- **Port Control**: Precision testing for 8 motor/servo ports with individual sliders (`-100` to `+100`).
- **Tank Mode**: Dual left/right tread throttle controls with turret rotation support.
- **Joystick Mode**: Smooth 360° analog stick mixing with hardware action buttons.

### 🧩 2. Zelos Block Coding System

- **12 Comprehensive Categories**:
  - 🟢 **Movement**: Timed drive, steering, claw controls, emergency stop.
  - 🟠 **Timing**: Program execution wait & conditional wait blocks.
  - 🔵 **Display**: 5x5 LED Matrix patterns, LCD shapes, custom text strings.
  - 🟧 **Audio**: Tone generators, sound effects, slot recording & BPM controls.
  - 🟣 **Sensors & Data**: Touch buttons, ultrasonic, temperature, humidity, light, heading, & pin I/O.
  - 🩵 **Program Flow**: Loop repeat, infinite loops, while guards, if/else conditions.
  - 🧪 **Logic, Math, Variables, Functions, Templates, & AI**: Complete programming abstractions.
- **Glassmorphic Category Flyout**: Dynamic low-saturation glass pane transparency matching each active category color (`backdrop-filter: blur(16px)`).
- **Isolated Category Filtering**: Selecting a category opens only its corresponding blocks, preventing scroll bleeding across sections.
- **Robotku Design System Typography**: Styled with **Plus Jakarta Sans** Display 30px / 800 Bold sidebar headers and H1 23px / 700 Bold flyout headers.

### 🤖 3. Embedded 3D Simulator & Real-Time Hardware Bridge

- **Three.js 3D Robot Canvas**: Live 3D robot model animating program execution in real time right under the glass pane layout.
- **ESP32 Serial & Telemetry Bridge**: Seamless WebSerial/WebSocket connectivity to stream generated JSON opcodes directly to ESP32 hardware.

---

## 🛠️ Technology Stack

| Component                 | Technology                                                                                                  |
| :------------------------ | :---------------------------------------------------------------------------------------------------------- |
| **Framework**             | [Next.js 15](https://nextjs.org/) (Pages Router)                                                            |
| **Language**              | [TypeScript](https://www.typescriptlang.org/)                                                               |
| **Block Coding Engine**   | [Google Blockly](https://developers.google.com/blockly) (Zelos Renderer)                                    |
| **3D Rendering**          | [Three.js](https://threejs.org/)                                                                            |
| **Design Tokens & Icons** | Vanilla CSS Modules, [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans), Lucide Icons |
| **Hardware Firmware**     | C++ / Arduino ESP32 (`firmware/robotku-esp32/`)                                                             |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Installation

1. **Clone the repository**:

   ```bash
   git clone git@github.com:sudo-kachponz/robotku.git
   cd robotku
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Run the development server**:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

4. **Build for production**:
   ```bash
   npm run build
   npm run start
   ```

---

## 🔌 Firmware Setup (ESP32)

The firmware source code is located in `firmware/robotku-esp32/src/main.cpp`
(pins and wiring in `src/config.h`). See
[`firmware/robotku-esp32/README.md`](firmware/robotku-esp32/README.md) for wiring,
pinned library versions, and the verification order.

**PlatformIO** (the `src/` layout is its default, nothing to configure):

1. `cd firmware/robotku-esp32`
2. `pio run -t upload`
3. `pio device monitor` (115200)

**Arduino IDE:** open `firmware/robotku-esp32/robotku-esp32.ino` — an empty stub
that exists only because the IDE needs a sketch named after its folder; the IDE
compiles `src/main.cpp` from the sketch's `src/` subdirectory. Install the
libraries at the versions pinned in `platformio.ini`, select board **ESP32 Dev
Module** on ESP32 core 2.0.x, and upload.

---

## 📁 Repository Structure

```
robotku/
├── public/
│   └── brand/               # Brand assets & mascot logos
├── src/
│   ├── assets/              # SVGs, icons, and UI graphics
│   ├── categories/          # 12 Blockly category definitions & generators
│   ├── components/
│   │   ├── blockcoding/     # Block coding editor & glass pane canvas
│   │   ├── control/         # Control layout & connection status bar
│   │   └── modes/           # Interactive mode components (Joystick, Tank, etc.)
│   ├── pages/               # Next.js pages & control routing
│   ├── styles/              # Design System tokens & module styles
│   ├── simulator.ts         # Three.js 3D robot simulator engine
│   ├── toolbox.ts           # Blockly category toolbox structure
│   └── visual/              # Robotku theme, palette, and category icons
└── firmware/
    └── robotku-esp32/       # ESP32 Arduino C++ firmware
```

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
```

---

### 9. [`docs/DEPLOY-CHECKLIST.md`](file:///Users/firaniaputri/Downloads/robotku-main/docs/DEPLOY-CHECKLIST.md)
```markdown
# Deploy checklist — hub.robotku.id (R6)

Static export (`output: 'export'`) mirrored to Apache shared hosting over FTPS.

## One-time setup

- [ ] **Rotate the FTP credentials** in hPanel (they leaked in chat). Store the new
      ones as GitHub Actions **Secrets**: `FTP_HOST`, `FTP_USER`, `FTP_PASS`.
      Never commit them, never put them in `.env` that is tracked, never log them.
- [ ] Confirm the host allows FTPS (`ftp:ssl-force true` in `scripts/deploy.sh`).

## Pipeline (runs from a clean clone, no manual step)

```bash
npm ci
npm run typecheck && npm test && npm run build   # build emits out/.htaccess + out/version.json
FTP_HOST=… FTP_USER=… FTP_PASS=… SKIP_SIM3D=1 npm run deploy
```

CI equivalent: `.github/workflows/deploy.yml` on push to `main`.

## Config that makes static hosting work

- `next.config.mjs`: `output:'export'`, `images.unoptimized`, `trailingSlash:true`
  (→ `control/modes/code/index.html`, not `.html`), `productionBrowserSourceMaps:false`,
  and a build-time guard that fails if `src/pages/api/*` exists.
- `out/.htaccess` (generated): `Options -Indexes`, force HTTPS, `ErrorDocument 404`,
  immutable caching for hashed assets + `no-cache` for HTML/`version.json`,
  deflate/brotli, wasm/glb/hdr/webp MIME, `Permissions-Policy: camera=(self),
  bluetooth=(self), serial=(self)`. **HSTS is opt-in**: emitted only when
  `ENABLE_HSTS=1` at build time — turn it on only after HTTPS is confirmed in prod
  (a wrong HSTS header is unrecoverable until `max-age` expires).
- Fonts are self-hosted via `next/font` (no runtime `fonts.googleapis.com` request).
- `public/brand/*` is WebP (176 KB total); `public/og-image.png` (1200×630) backs
  the social share preview.

## Upload strategy (scripts/deploy.sh)

Two passes, both with `--delete` to prune stale files within their tree:

1. `/_next` hashed chunks — `--only-newer` is safe (content-hashed names) and
   avoids re-uploading megabytes of unchanged JS.
2. Everything else (HTML, `.htaccess`, `version.json`) — **no** `--only-newer`, so
   these tiny files are always re-uploaded fresh (shared-host clock drift makes
   timestamp comparison unreliable and can silently skip a real change).

`SKIP_SIM3D=1` excludes the 26 MB of 3D assets from the launch payload (and from
`--delete` pruning, so a previously-uploaded `sim3d/` is left intact).

## Post-deploy verification (tick with evidence)

- [ ] `https://hub.robotku.id` loads; `http://` → `https://` 301.
- [ ] Deep link `https://hub.robotku.id/control/modes/code/` loads directly (not just via client nav).
- [ ] Hard refresh on every route: no 404, no blank page.
- [ ] DevTools → Application: secure context; `navigator.bluetooth` / `navigator.serial` on Chrome desktop.
- [ ] AI panel can request the camera (Permissions-Policy not blocking).
- [ ] Lighthouse (throttled 4G): Performance ≥ 80, Accessibility ≥ 95 on landing + editor. Record numbers.
- [ ] `/control/modes/code` First Load JS matches PERF-BASELINE.md.
- [ ] Redeploy once

→ new `version.json` appears without a manual cache clear.

CI does the last check automatically: after the mirror it polls
`https://hub.robotku.id/version.json` and fails the job unless `.sha` matches the
deployed commit (a half-finished FTPS mirror otherwise exits 0 while the site is
stale).

## Pre-deploy gate run — 2026-08-27 (evidence)

Recorded from an actual run on the release candidate. Re-run these before any
subsequent deploy; the TLS answer in particular can change.

### D1 — is TLS actually live? (decides the redirect flag)

```
$ curl -sSI https://hub.robotku.id | head -1
HTTP/2 200

$ curl -sSI http://hub.robotku.id | grep -iE '^(HTTP|location)'
HTTP/1.1 301 Moved Permanently
Location: https://hub.robotku.id/
```

**TLS is live** → deploy with `ENABLE_HTTPS_REDIRECT=1`. (The host already 301s
http→https at the server level; the generated `.htaccess` redirect is belt-and-braces
and, more importantly, is what makes the redirect survive a host-config change.)

If this ever comes back `SSL certificate problem` instead, deploy **without** the
flag and ask the hPanel holder to issue the certificate first. Never turn the
redirect on ahead of TLS: the operator has FTP only and cannot undo it from a panel.

### D2 — verification pipeline

```
$ npm ci                                   # clean install, exit 0
$ npm run lint                             # eslint --max-warnings 0, exit 0, no output
$ npm test                                 # 20 files, 118 tests passed (111 baseline + 7 new)
$ npm run typecheck                        # tsc --noEmit, exit 0, no output
$ SKIP_SIM3D=1 npm run build               # exit 0, 17 pages, 18 exported routes
```

First Load JS, against the ≤125 kB budget for the editor route:

| Route | First Load JS | Budget |
| --- | --- | --- |
| `/control/modes/code` | **122 kB** | ≤ 125 kB ✓ |
| `/control/modes` | 126 kB | — (largest route) |
| `/` | 116 kB | — |

Note a pre-existing **+2 kB drift** against `docs/PERF-BASELINE.md` (recorded
2026-08-26): it lists `/control/modes/code` at 120 kB and shared JS at 112 kB;
this build gives 122 kB and 114 kB. The whole delta is in the **shared** chunk, not
in any route, and the baseline table has no `/cek` row — so it predates
`src/pages/cek.tsx`. Still inside the ≤125 kB budget; refresh PERF-BASELINE.md
from a git clone when convenient.

### D3 — preflight really does block a lock-out

`scripts/preflight.mjs` runs at the top of `deploy.sh`. Verified all three branches
by pointing `PREFLIGHT_URL` at hosts with known TLS states:

| Case | `.htaccess` redirect | TLS state | Expected | Actual |
| --- | --- | --- | --- | --- |
| Real host | OFF | ok (HTTP 200) | pass + warn "Web BLE/Serial won't work on http" | exit 0, warning printed ✓ |
| Real host | ON | ok (HTTP 200) | pass | exit 0, "Preflight lolos" ✓ |
| `https://tls-tidak-ada.hub.robotku.id` | ON | unreachable (`ENOTFOUND`) | **FAIL** | exit 1, "PREFLIGHT GAGAL" ✓ |
| `https://expired.badssl.com` | ON | cert-invalid (`CERT_HAS_EXPIRED`) | **FAIL** | exit 1, "PREFLIGHT GAGAL" ✓ |

Commands used:

```bash
SKIP_SIM3D=1 node scripts/preflight.mjs                       # real host
SKIP_SIM3D=1 PREFLIGHT_URL=https://tls-tidak-ada.hub.robotku.id node scripts/preflight.mjs
SKIP_SIM3D=1 PREFLIGHT_URL=https://expired.badssl.com node scripts/preflight.mjs
```

Upload size reported: **~22.5 MB** with `SKIP_SIM3D=1` (sim3d excluded).

### ⚠ D2 caveat — `version.json` sha

`postbuild.mjs` derives `sha` from `git rev-parse --short HEAD`, falling back to
`"unknown"`. The build above ran from an unzipped archive with **no `.git`**, so it
produced:

```json
{ "sha": "unknown", "builtAt": "2026-08-27T11:57:30.542Z" }
```

The D5 check "`/version.json` sha matches the local build" is meaningless with
`unknown`, and CI's post-mirror sha poll would compare against `GITHUB_SHA` and
fail. **Deploy from a real git clone**, or set `GITHUB_SHA` explicitly:

```bash
GITHUB_SHA=$(git rev-parse HEAD) SKIP_SIM3D=1 npm run build
```

### Firmware gate — `pio run` compiles (acceptance 2)

The firmware moved to `src/main.cpp` + `src/config.h` so PlatformIO finds it with
no `src_dir` override. Verified with a real toolchain (PlatformIO Core 6.1.19):

```
$ cd firmware/robotku-esp32 && pio run
PLATFORM: Espressif 32 (6.9.0) > Espressif ESP32 Dev Module
PACKAGES: framework-arduinoespressif32 @ 3.20017.241212, toolchain-xtensa-esp32 @ 8.4.0
Dependency Graph
|-- NimBLE-Arduino @ 1.4.3      |-- ArduinoJson @ 7.4.3
|-- ESP32Servo @ 3.2.1          |-- Adafruit SSD1306 @ 2.5.17
|-- Adafruit GFX Library @ 1.12.6  |-- Adafruit BusIO @ 1.17.4  |-- Wire @ 2.0.0
RAM:   11.2% (36676 / 327680 bytes)
Flash: 50.4% (660601 / 1310720 bytes)
========================= [SUCCESS] =========================
```

Every pinned library resolved to the exact version in `platformio.ini`, and the
build is clean — no errors, no warnings. `firmware.bin` produced.

Port table logic checked separately against a host compiler, both flag states:

| `HAS_SERVO_R` | `PORT_CHANNEL` | `HELLO_ACK ports` | `TURN_TIMED` cap | `SET_PORT` 2 |
| --- | --- | --- | --- | --- |
| `0` (shipped) | `[-1,0,-1,…]` | `[1]` | absent | `UNSUPPORTED` |
| `1` | `[-1,0,1,…]` | `[1,2]` | present | drives right servo |

Still needs a board on a desk (nothing here can substitute):

- [ ] `cw 2000` → servo spins 2 s and stops **by itself**
- [ ] `help` → the command list appears
- [ ] a JSON `MOVE_TIMED` still behaves exactly as before
- [ ] OLED shows the real servo angle, `STOP`/`CW`/`CCW`, and `USB`/`BLE`/`Terputus`
- [ ] `HELLO` over Serial replies `ports:[1]`, and `SET_PORT` port 2 → `UNSUPPORTED`

### D4 — deploy (manual, not CI)

Not yet run — needs the rotated FTP credentials (see One-time setup). First deploy
must be a **full** mirror:

```bash
FTP_HOST=… FTP_USER=… FTP_PASS=… \
  ENABLE_HTTPS_REDIRECT=1 SKIP_SIM3D=1 FORCE_FULL=1 npm run deploy
```

`ENABLE_HTTPS_REDIRECT=1` is correct **because D1 came back HTTP/2 200**. Re-run D1
first if any time has passed.

### D5 — post-deploy verification (fill in after D4)

- [ ] `https://hub.robotku.id/` opens
- [ ] `https://hub.robotku.id/control/modes/code/` opens on a **hard refresh**, not
      just client-side navigation
- [ ] `https://hub.robotku.id/version.json` sha matches the local build
      (see the caveat above — must not be `unknown`)
- [ ] `https://hub.robotku.id/cek/` opens on a phone, and **"Salin Hasil"** yields
      text that pastes into WhatsApp

### D6 — release archive exists before the mirror

- [ ] `releases/out-<sha>-<timestamp>.tar.gz` written by `deploy.sh` **before** it
      uploads anything
- [ ] `bash scripts/rollback.sh` (no args) lists it
- [ ] one restore rehearsal done, and `/version.json` shows the rolled-back sha

## Rollback

`scripts/deploy.sh` saves a snapshot of `out/` as
`releases/out-<sha>-<timestamp>.tar.gz` **before** every mirror. To roll back:

1. **Pick the good archive:**

   ```bash
   bash scripts/rollback.sh           # lists available releases
   ```

2. **Restore and re-mirror:**

   ```bash
   FTP_HOST=… FTP_USER=… FTP_PASS=… bash scripts/rollback.sh releases/out-abc1234-20260827-143000.tar.gz
   ```

   This extracts the archive into `out/` and runs a full mirror (no `--only-newer`).

3. **Confirm** `https://hub.robotku.id/version.json` shows the rolled-back sha.

Alternative: rebuild from a known-good commit:
```bash
git checkout <good-sha>
npm ci && npm run build
FTP_HOST=… FTP_USER=… FTP_PASS=… FORCE_FULL=1 SKIP_SIM3D=1 bash scripts/deploy.sh
```

## Emergency: .htaccess locks the site

If a bad `.htaccess` makes the site completely inaccessible (infinite redirect loop,
500 errors, etc.) and you only have FTP access — **no hPanel** — the fix is to upload
a minimal `.htaccess` via any FTP client (FileZilla, command-line `lftp`, etc.).

**Copy-paste this entire file** as `.htaccess` in the `public_html` root:

```apache
# EMERGENCY .htaccess — replaces the broken one.
# Upload this via FTP to restore basic site access.
# Then rebuild and redeploy properly.

Options -Indexes

ErrorDocument 404 /404/index.html

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json
</IfModule>

<IfModule mod_mime.c>
  AddType application/wasm .wasm
  AddType image/webp .webp
</IfModule>
```

This deliberately has **no** HTTPS redirect, **no** HSTS, **no** aggressive caching —
just enough to serve the static files and stop the bleeding. Once the site is
accessible again, do a proper rebuild with the correct flags and redeploy.

Quick FTP upload from command line:
```bash
echo 'Options -Indexes
ErrorDocument 404 /404/index.html' > /tmp/htaccess-emergency
lftp -c "set ftp:ssl-force true; open -u \"$FTP_USER\",\"$FTP_PASS\" \"$FTP_HOST\"; \
         put /tmp/htaccess-emergency -o /public_html/.htaccess"
```

> NOTE: the CSP is intentionally NOT enforced yet. The Blockly/tfjs stack needs
> `'wasm-unsafe-eval'` and ProgramRunner's condition sandbox needs `'unsafe-eval'`
> (`new Function`). Start in Report-Only, tune, then enforce — do not remove
> `unsafe-eval` or every sensor block stops evaluating.
```

---

### 10. [`.gitignore`](file:///Users/firaniaputri/Downloads/robotku-main/.gitignore)
```gitignore
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Next.js
.next/
out/
next-env.d.ts

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
*.tsbuildinfo
tsconfig.tsbuildinfo

# Coverage & env
coverage/
.env*
!.env.example
!.env.deploy.example

# Deploy release archives (local snapshots, can be large)
releases/

# PlatformIO firmware build output (firmware/robotku-esp32/.pio)
.pio/
```
