/* ============================================================================
 * pins_makerkit_s3.h — GPIO map for Makerkit ESP32-S3 v1.3 (ESP32-S3-WROOM-2-N16R8V).
 * From SCH Schematic3_1 (Update 2026-10-20). Selected by `-D BOARD_MAKERKIT_S3`.
 * SAME firmware/features as pins_makerkit.h — only chip + pins differ.
 *
 * Serial = CH340C on the board (UART0), NOT native USB — so GPIO19/20 are free and
 * the env must NOT enable USB-CDC. PWM1..6 and the servos are on the LEFT bus
 * (high confidence). I2S speaker/mic + I2C are on the RIGHT bus — non-servo, so a
 * wrong one only kills that feature (OLED/mic/speaker), never burns hardware; verify
 * on the board and swap if needed.
 * ==========================================================================*/
#pragma once

#define BOARD_NAME   "Robotku Makerkit S3 v1.3"
#define BOARD_ID     "esp32s3-makerkit-v1.3"

// -------- Buzzer (BUZZ) --------
#define PIN_BUZZER     12      // IO12

// -------- WS2812B NeoPixel (RGB_Led, U6-U9 = 4 LEDs) --------
#define HAS_RGB        0
#define HAS_NEOPIXEL   1
#define PIN_NEOPIXEL   11      // IO11
#define NEOPIXEL_COUNT 4

// -------- I2S Microphone (INMP441/U5) : I2S_NUM_0 RX --------
#define HAS_MIC        1
#define PIN_MIC_SCK    21      // IO21  (verify vs WS)
#define PIN_MIC_WS     47      // IO47
#define PIN_MIC_SD     13      // IO13

// -------- I2S Speaker (MAX98357A/U4) : I2S_NUM_1 TX --------
#define HAS_SPEAKER    1
#define PIN_SPK_BCLK   41      // IO41 (SPK_CLK)
#define PIN_SPK_LRC    42      // IO42 (SPK_LRC)
#define PIN_SPK_DIN    40      // IO40 (SPK_DIN)

// -------- OLED / I2C (SSD1306) --------
#define HAS_OLED       1
#define PIN_OLED_SDA   38      // IO38 (SDA)
#define PIN_OLED_SCL   39      // IO39 (SCL)
#define OLED_ADDR      0x3C

// -------- Drive servos (PWM headers; web port N = PWM-N) --------
#define PIN_SERVO_L    10      // PWM1 = IO10  web port 1 (drive left)
#define PIN_SERVO_R    9       // PWM2 = IO9   web port 2 (drive right)
#define HAS_SERVO_R    1

// -------- Accessory positional servo (web port 5 = PWM5) --------
#define PIN_SERVO_AUX  19      // PWM5 = IO19
#define HAS_SERVO_AUX  1
