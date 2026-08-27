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
static const int PORT_CHANNEL[9] = {
  -1,   // [0] unused — ports are 1-based
   0,   // port 1 -> LEFT  (PIN_SERVO_L)
   1,   // port 2 -> RIGHT (PIN_SERVO_R)
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

// Timed moves set a firmware deadline = browser-requested duration + this margin.
// The browser is the real timekeeper; this deadline is only a SAFETY NET for a
// lost STOP. The margin keeps the two from racing (see FIX 3 in the .ino).
#define MOTION_SAFETY_MARGIN_MS  300
