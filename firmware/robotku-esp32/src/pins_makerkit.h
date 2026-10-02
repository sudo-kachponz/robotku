/* ============================================================================
 * pins_makerkit.h — GPIO map + HAS_* flags for the Makerkit V1.2 PCB (successor
 * of ESP32_Controller_V3). Selected by `-D BOARD_MAKERKIT` (see config.h).
 *
 * SAME peripherals as V3 (2 continuous drive servos, 1 positional aux servo,
 * SSD1306 OLED, buzzer, PWM/I2C ports) — only the PIN MAP changed, plus two NEW
 * peripherals: I2S mic (INMP441) and I2S speaker (MAX98357A). The discrete RGB
 * LED is replaced by a WS2812B strip (its old pins 16/17/5 are now the mic).
 *
 * PROVEN vs UNCONFIRMED — see docs/pin.md. Only pins with running test code in
 * `ESP32 Robotku_Makerkit-V1.2/` are filled. Everything else is a HARD STOP:
 * the #error below fails `pio run -e makerkit` on purpose until the schematic is
 * confirmed. DO NOT guess servo/OLED/port pins — a wrong servo pin burns hardware.
 * ==========================================================================*/
#pragma once

// -------------------------------------------------------------- Board identity
#define BOARD_NAME   "Robotku Makerkit V1.2"
#define BOARD_ID     "esp32-makerkit-v1.2"

// =============================== PROVEN (test code exists) ===================

// ----------------------------------------------------------------- Buzzer
#define PIN_BUZZER     13      // ESP32 Robotku_Makerkit-V1.2/src/main.cpp

// ----------------------------------------------------- WS2812B NeoPixel (replaces RGB)
// Addressable strip on the RMT peripheral (NOT LEDC) — so the V3 "PWM RGB stutters
// the servos because they fight over LEDC timers" caveat DOES NOT apply here.
// Full 24-bit color, per-pixel; SET_LED_COLOR gains an optional `index` (0..3|all).
#define HAS_RGB        0       // discrete RGB retired on this PCB
#define HAS_NEOPIXEL   1
#define PIN_NEOPIXEL   32      // test/testRGB.cpp (WS2812B, NEO_GRB + NEO_KHZ800)
#define NEOPIXEL_COUNT 4       // test/testRGB.cpp

// ------------------------------------------------------- I2S Microphone (INMP441)
// I2S_NUM_0, RX. test/testMic.cpp & test/testClap-Response.cpp.
#define HAS_MIC        1
#define PIN_MIC_SCK    17      // SCK / BCLK
#define PIN_MIC_WS     5       // WS / LRCL  (NOTE: GPIO5 is a strapping pin — verify boot, see docs/pin.md)
#define PIN_MIC_SD     16      // SD / DOUT

// ------------------------------------------------------- I2S Speaker (MAX98357A)
// I2S_NUM_1, TX. test/testSpeaker.cpp / testClap-Response.cpp.
#define HAS_SPEAKER    1
#define PIN_SPK_BCLK   19      // CLK
#define PIN_SPK_LRC    23      // LRC
#define PIN_SPK_DIN    18      // DIN

// =============================== CONFIRMED from schematic ====================
// Source: SCH_Schematic3_2026-09-30.pdf (ESP32-WROOM-32D netlist). The PCB routes
// PWM1..PWM5 headers to the GPIOs below; by the unchanged port convention (§4)
// web port N = header PWM-N, so port1=drive-left, port2=drive-right, port5=aux.
// Plug the LEFT drive servo into PWM1, RIGHT into PWM2, accessory into PWM5.
#define MAKERKIT_PINS_CONFIRMED 1

// ------------------------------------------------------------------- OLED (I2C)
// Same bus as V3 (SDA=21, SCL=22) — confirmed on the schematic.
#define HAS_OLED       1
#define PIN_OLED_SDA   21
#define PIN_OLED_SCL   22
#define OLED_ADDR      0x3C

// ------------------------------------------------------------------ Servos
// SG90 CONTINUOUS drive servos (write 90=stop). Calibration is shared (config.h).
// Per SCH_Schematic3 the PWM headers map: PWM1=IO33, PWM2=IO27, PWM3=IO26,
// PWM4=IO25, PWM5=IO32. GPIO32 is the WS2812B strip here, so the accessory servo
// moves off PWM5 onto PWM3 (GPIO26). FIX: PIN_SERVO_L was wrongly 14 (not a PWM
// header) with aux on 33 (which IS PWM1) — so web port 1 never reached the left
// drive servo and only port 2 moved. Left now = PWM1/GPIO33, aux = PWM3/GPIO26.
#define PIN_SERVO_L    33      // PWM1 header -> web port 1 (drive left)
#define PIN_SERVO_R    27      // PWM2 header -> web port 2 (drive right)
#define HAS_SERVO_R    1       // Makerkit V1.2 = 2 drive servos (user-confirmed)

// Accessory POSITIONAL servo on web port 5 (SERVO_AUX_PORT in config.h).
#define PIN_SERVO_AUX  26      // PWM3 header -> web port 5 (accessory; PWM5/GPIO32 is NeoPixel)
#define HAS_SERVO_AUX  1

// PWM4 (GPIO25) is broken out on the PCB but unwired in firmware (PORT_CHANNEL
// leaves it -1). PWM5 (GPIO32) is used by the WS2812B strip. See docs/pin.md.
