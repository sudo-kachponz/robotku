/* ============================================================================
 * pins_makerkit_s3.h — GPIO map + HAS_* flags for the ESP32-S3 Makerkit board.
 * Selected by `-D BOARD_MAKERKIT_S3` (see config.h). SAME firmware/features as the
 * ESP32 makerkit (pins_makerkit.h) — only the pin numbers + chip change.
 *
 * ⚠️ DO NOT COPY the ESP32 pin numbers. The S3 has different GPIO numbering AND
 * reserves pins the ESP32 doesn't:
 *   - GPIO19 / GPIO20 = native USB D-/D+ (can't use — serial is USB-CDC).
 *   - GPIO26..32 = SPI flash; GPIO33..37 = octal PSRAM on S3-WROOM-1 (reserved).
 *   - GPIO0, 3, 45, 46 = strapping pins (avoid or verify boot).
 * A wrong servo pin burns hardware. Fill every value below from the ACTUAL S3 PCB
 * wiring, then delete the #error. Until then this board will NOT compile on purpose.
 * ==========================================================================*/
#pragma once

#define BOARD_NAME   "Robotku Makerkit S3"
#define BOARD_ID     "esp32s3-makerkit"

// ---- FILL THESE FROM THE S3 BOARD, then remove the #error below ----
#error "pins_makerkit_s3.h: fill the S3 GPIO map from the real board before building (-e makerkit_s3)."

// -------- Buzzer --------
#define PIN_BUZZER     0   // TODO S3 GPIO

// -------- WS2812B NeoPixel --------
#define HAS_RGB        0
#define HAS_NEOPIXEL   1
#define PIN_NEOPIXEL   0   // TODO S3 GPIO (RMT-capable)
#define NEOPIXEL_COUNT 4

// -------- I2S Microphone (INMP441) : I2S_NUM_0 RX --------
#define HAS_MIC        1
#define PIN_MIC_SCK    0   // TODO  (SCK / BCLK)
#define PIN_MIC_WS     0   // TODO  (WS / LRCL)
#define PIN_MIC_SD     0   // TODO  (SD / DOUT)

// -------- I2S Speaker (MAX98357A) : I2S_NUM_1 TX --------
#define HAS_SPEAKER    1
#define PIN_SPK_BCLK   0   // TODO  (CLK)   — NOT 19/20 (USB)
#define PIN_SPK_LRC    0   // TODO  (LRC)
#define PIN_SPK_DIN    0   // TODO  (DIN)

// -------- OLED (I2C, SSD1306) --------
#define HAS_OLED       1
#define PIN_OLED_SDA   0   // TODO
#define PIN_OLED_SCL   0   // TODO
#define OLED_ADDR      0x3C

// -------- Drive servos (continuous SG90; write 90 = stop) --------
#define PIN_SERVO_L    0   // TODO  web port 1 (drive left)
#define PIN_SERVO_R    0   // TODO  web port 2 (drive right)
#define HAS_SERVO_R    1

// -------- Accessory positional servo (web port 5) --------
#define PIN_SERVO_AUX  0   // TODO
#define HAS_SERVO_AUX  1
