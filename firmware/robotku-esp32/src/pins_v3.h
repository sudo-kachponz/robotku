/* ============================================================================
 * pins_v3.h — GPIO map + HAS_* flags for the ORIGINAL ESP32_Controller_V3 board.
 * Selected by `-D BOARD_V3` (see config.h). Only PINS and per-board capability
 * flags live here; every NON-pin constant (timing, servo calibration, deadband,
 * trim, port table) is shared in config.h.
 *
 * ESP32 GPIO rules (read before moving a pin):
 *   6..11  : on-board SPI flash — DO NOT USE.
 *   34..39 : INPUT-ONLY — never an actuator/output here.
 *   0,2,12,15 : strapping pins — avoid for outputs. GPIO5 is also strapping.
 * These pins are proven on bench test1.
 * ==========================================================================*/
#pragma once

// -------------------------------------------------------------- Board identity
#define BOARD_NAME   "Robotku ESP32"
#define BOARD_ID     "esp32-controller-v3"

// ------------------------------------------------------------------- OLED (I2C)
#define HAS_OLED       1
#define PIN_OLED_SDA   21
#define PIN_OLED_SCL   22
#define OLED_ADDR      0x3C

// ----------------------------------------------------------------- Buzzer
// Passive buzzer, tone()/noTone() replaced by ESP32PWM (own LEDC timer).
#define PIN_BUZZER     13

// ----------------------------------------------------------------- RGB LED (discrete)
// Common-cathode RGB via 100Ω, schematic nets LED1/LED2/LED3. Driven ON/OFF
// (8 colors), NOT PWM. PROVEN: any PWM/LEDC RGB approach stutters servo 2 and/or
// leaves the LED dark — two servos + PWM RGB can't share this chip's LEDC timers.
// Digital keeps both servos smooth; the web color wheel snaps to nearest-8 here.
// (This LEDC-contention caveat is V3-specific: the Makerkit variant replaces this
//  with a WS2812B on RMT — see pins_makerkit.h — where the caveat no longer applies.)
#define HAS_RGB        1       // 0 = no RGB LED -> firmware answers UNSUPPORTED
#define PIN_LED_R      16
#define PIN_LED_G      17
#define PIN_LED_B      5

// V3 has no addressable strip and no I2S audio.
#define HAS_NEOPIXEL   0
#define HAS_MIC        0
#define HAS_SPEAKER    0

// ------------------------------------------------------------------ Servos
// SG90 CONTINUOUS drive servos (write 90=stop). Calibration lives in config.h.
#define PIN_SERVO_L    33      // LEFT drive  — proven on bench test1
#define PIN_SERVO_R    25      // RIGHT drive
#define HAS_SERVO_R    1       // 1 = right servo soldered & tested; 0 = one-servo board

// Accessory POSITIONAL servo on web port 5 (see SERVO_AUX_PORT in config.h).
#define PIN_SERVO_AUX  26      // free "PWM3 aux header"
#define HAS_SERVO_AUX  1       // 0 = no accessory servo -> P5 answers UNSUPPORTED
