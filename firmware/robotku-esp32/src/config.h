/* ============================================================================
 * config.h — ONE firmware, TWO board variants (V3 and Makerkit V1.2).
 * ----------------------------------------------------------------------------
 * This file selects a PIN MAP by build flag, then holds every NON-pin constant
 * that BOTH variants share (OLED geometry, servo calibration, deadband, trim,
 * port table, timing, clap thresholds). Peripherals are identical across the two
 * boards — only the wiring differs — so main.cpp must branch on HAS_* flags and
 * pin names ONLY, never on `#ifdef BOARD_*`.
 *
 * Build:
 *   pio run -e v3          (-D BOARD_V3)        -> pins_v3.h
 *   pio run -e makerkit    (-D BOARD_MAKERKIT)  -> pins_makerkit.h
 * Arduino IDE / bare `pio run` (no flag) defaults to V3 (the shipping board).
 * ==========================================================================*/
#pragma once

// ------------------------------------------------------ Pin map selection
#if defined(BOARD_MAKERKIT)
  #include "pins_makerkit.h"
#elif defined(BOARD_V3)
  #include "pins_v3.h"
#else
  #warning "No BOARD_* build flag set; defaulting to BOARD_V3 (Arduino IDE / bare pio run). Pass -D BOARD_MAKERKIT for the Makerkit V1.2 PCB."
  #include "pins_v3.h"
#endif

// ------------------------------------------------------------------- OLED geometry
// (address + I2C pins are per-board and live in pins_*.h; geometry is shared.)
#define OLED_WIDTH     128
#define OLED_HEIGHT    64

// ------------------------------------------------------------------ Servo calibration
// SG90 CONTINUOUS drive servos (ESP32Servo):
//   setPeriodHertz(50), attach(pin, SERVO_MIN_US, SERVO_MAX_US)
//   write(90) = stop, write(180) = full one way, write(0) = full the other.
#define SERVO_MIN_US   500
#define SERVO_MAX_US   2400
#define SERVO_STOP_DEG 90      // continuous-servo neutral

// The right servo faces the opposite way on the chassis, so a "+" command must
// spin it the other direction for the robot to go straight. Flip if your build
// mirrors this.
#define SERVO_R_INVERT 1       // 1 = invert right side, 0 = don't

// A continuous SG90 almost never truly stops at exactly 90°. Trim (in degrees,
// may be negative) shifts each side's neutral so value 0 = actually still.
#define SERVO_L_TRIM   0
#define SERVO_R_TRIM   0

// Released joystick / idle: treat |value| below this as "stop" so the pulses are
// CUT (servo.detach), not held at ~90 where a continuous SG90 keeps creeping.
#define SERVO_DEADBAND 3

// -------------------------------------------------- Accessory (positional) servo
// The detachable "Servo SG90" module lives on web port P5. Unlike the two
// CONTINUOUS drive servos, this one is POSITIONAL: value -100..100 -> 0..180 deg,
// value 0 = centre (held). Its GPIO is per-board (PIN_SERVO_AUX in pins_*.h).
#define SERVO_AUX_CH   2       // third channel index (0=left,1=right,2=aux)
#define SERVO_AUX_PORT 5       // which web port drives it (matches P5 in the UI)

// --------------------------------------------------- Port (1..8) -> drive side
// Joystick / SET_PORT addresses output ports 1..8. Keep the mapping a TABLE so
// wiring a new port later is a one-line change, not another if-branch.
//   value 0  = LEFT servo channel
//   value 1  = RIGHT servo channel
//   value -1 = not wired  -> firmware replies UNSUPPORTED (never silent).
// Derived from the per-board HAS_SERVO_R / HAS_SERVO_AUX flags — do NOT hardcode.
static const int PORT_CHANNEL[9] = {
  -1,                        // [0] unused — ports are 1-based
   0,                        // port 1 -> LEFT  (PIN_SERVO_L)
  (HAS_SERVO_R ? 1 : -1),    // port 2 -> RIGHT (PIN_SERVO_R), only if wired
  -1,   // port 3 — not wired
  -1,   // port 4
  (HAS_SERVO_AUX ? SERVO_AUX_CH : -1),   // port 5 -> AUX positional servo (P5)
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
// lost STOP. The margin keeps the two from racing (see FIX 3 in main.cpp).
#define MOTION_SAFETY_MARGIN_MS  300

// ---------------------------------------------------------------- Audio / clap (Makerkit)
// Proven starting points from ESP32 Robotku_Makerkit-V1.2/test/testClap-Response.cpp.
// Kept here so they can be calibrated in ONE place. Only used when HAS_MIC.
#define CLAP_THRESHOLD    9000   // peak |sample| that counts as a clap
#define CLAP_COOLDOWN_MS  2000   // ignore further claps for this long after one
