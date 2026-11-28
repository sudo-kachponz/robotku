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
 * servos (tank style), NOT an H-bridge; buzzer on GPIO13; SSD1306 OLED on I2C.
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
#include <WiFi.h>                 // Phase 1: WiFi STA transport for AI/audio
#include <ESPmDNS.h>             // robotku.local
#include <Preferences.h>         // persist WiFi creds in NVS
#include <WebSocketsServer.h>    // links2004/WebSockets — WS server on :81
#include <HTTPClient.h>          // OTA: download the new .bin over WiFi
#include <WiFiClientSecure.h>    // OTA: https fetch (ESP-side; setInsecure, not the browser)
#include <Update.h>              // OTA: write the new firmware to the inactive app slot
#include "relay_client.h"        // relay client: control robot from https://hub via wss relay

#include "config.h"

#if HAS_NEOPIXEL
#include <Adafruit_NeoPixel.h>   // WS2812B strip on the Makerkit variant (RMT, not LEDC)
#endif

#if HAS_SPEAKER || HAS_MIC
#include <driver/i2s.h>          // legacy I2S API (ESP32 Arduino core 2.0.x)
#endif
#if HAS_SPEAKER
#include <math.h>
#include "mbedtls/base64.h"      // decode base64 TTS PCM chunks (bundled with ESP-IDF)
#include "welcome_audio.h"       // const int16_t welcomeAudio[] in FLASH (.rodata), 16 kHz mono

#endif
#include <esp_system.h>         // esp_reset_reason() for HELLO_ACK diag
const char* resetReasonName(esp_reset_reason_t r);   // defined after sendHelloAck()

// ------------------------------------------------------------------ Identity
// BOARD_NAME / BOARD_ID come from the selected pin map (pins_*.h) so HELLO_ACK
// tells the web which variant connected — no #ifdef BOARD_* here (see config.h).
#define FW_VERSION   "2.6.3-mk"   // 2.6.3: WiFi radio starts from loop() 3 s after boot at lower TX power, skipped for one boot if the last start reset the board; 2.6.2: S3 servos work (ESP32Servo 3.0.9), touch/AUX/ultrasonic sensors, LCD->OLED, 16K serial RX; 2.6.1: mu-law TTS
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
Servo servoAux;       // accessory positional servo on P5 (config.h)
// Buzzer on a DEDICATED LEDC channel whose timer the servos can NEVER allocate.
// Passive buzzer (pin 13) driven by a GENERAL-PURPOSE hardware timer that toggles
// the pin in its ISR — deliberately NOT LEDC. ESP32Servo owns the LEDC timer pool;
// if the buzzer shares an LEDC timer a servo inherits its frequency and hums instead
// of turning (verified on hardware). A hw timer is a separate peripheral, so the
// servos (LEDC) and the buzzer (hw timer) both work at the same time.
hw_timer_t*   buzzerTimer   = nullptr;
volatile bool buzzerPinHigh = false;
unsigned long buzzerOffMs   = 0;   // 0 = silent/continuous; else stop the tone at this millis()

void IRAM_ATTR buzzerISR() {
  buzzerPinHigh = !buzzerPinHigh;
  // Direct GPIO register write — IRAM-safe inside an ISR (digitalWrite is not).
  if (buzzerPinHigh) GPIO.out_w1ts = (1u << PIN_BUZZER);
  else               GPIO.out_w1tc = (1u << PIN_BUZZER);
}
Adafruit_SSD1306 oled(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
bool oledOk = false;

#if HAS_NEOPIXEL
Adafruit_NeoPixel strip(NEOPIXEL_COUNT, PIN_NEOPIXEL, NEO_GRB + NEO_KHZ800);
uint8_t  neoActiveEffect = 0;      // 0=none, 1=rainbow, 2=chase
unsigned long neoEffectEndsMs = 0; // 0 = run forever; else stop at this millis()
unsigned long neoLastStepMs = 0;
uint16_t neoEffectPhase = 0;
#endif

#if HAS_SPEAKER
// I2S speaker (MAX98357A) on I2S_NUM_1. Audio plays on a dedicated FreeRTOS task
// so the command path / heartbeat NEVER block (FIX 3). The command handlers only
// flip these flags; the task streams samples. Single-writer/single-reader — no mutex.
#define SPK_SR          16000
// Peak amplitude for synthesized tones (int16 full scale = 32767). 3000 was only
// ~9% FS (~-21 dB) -> blip barely audible (Fajrisya: "suara e kecil banget"). A
// sine never clips below 32767, so 18000 (~55% FS) is loud with headroom. If still
// too quiet it's the MAX98357A GAIN pin (floating = 9 dB; tie to GND = 12 dB, or
// via 100k to VDD = 15 dB) — a hardware knob this can't reach.
#define SPK_AMPLITUDE   18000
volatile int           spkToneFreq  = 0;      // >0 = play this tone
volatile bool          spkToneSquare = false; // wave shape
volatile unsigned long spkToneEndMs = 0;      // stop the tone at this millis()
volatile bool          spkPcmPlay   = false;  // true = stream the welcome clip once
volatile bool          spkStop      = false;  // request: silence everything now
bool                   spkReady     = false;  // I2S TX installed OK
volatile int           spkVolume    = 100;    // SET_VOLUME 0..100 — scales tone + TTS samples

// ---- Streamed TTS playback (robot "speaks" the AI reply) --------------------
// The browser sends the AI reply as 8 kHz 8-bit unsigned mono PCM in base64
// chunks (TTS_BEGIN / TTS_CHUNK*/ TTS_END). We buffer the WHOLE clip in RAM then
// play it (buffer-then-play) because BLE is too slow for reliable real-time.
// 8-bit @ 8 kHz = 8 KB/s — matches BLE throughput and halves RAM vs 16-bit.
#define PCM_STREAM_CAP  96000              // 12 s @ 8 kHz, 8-bit — long AI replies were
                                           // cut at ~4 s (32 KB). Lazy-malloc'd from the
                                           // ~200 KB free internal RAM, so no PSRAM needed.
// LAZY-allocated on the first TTS, NOT a 32 KB always-on .bss array: a permanent
// 32 KB static buffer shrank the heap the BLE stack needs and regressed connect
// (2.2.3 stable, 2.2.4/2.2.5 connect-then-drop). Null until the robot first
// speaks, so idle/connect RAM == the stable 2.2.3; kept allocated after (reused,
// no free -> no race with the audio task).
uint8_t*               pcmStreamBuf  = nullptr;
// Big audio buffers go to PSRAM when the board has it (ESP32-S3 WROOM-2 N16R8V:
// 8 MB octal PSRAM, enabled by the makerkit_s3 env). Internal heap is then left for
// WiFi + TLS (relay handshake) + NimBLE, which is what used to starve on TTS.
static uint8_t* allocBig(size_t n) {
  uint8_t* b = nullptr;
  if (psramFound()) b = (uint8_t*)ps_malloc(n);
  if (!b) b = (uint8_t*)malloc(n);
  return b;
}
// With PSRAM the TTS buffer is 1 MB (~65 s @ 16 kHz 8-bit) so a whole multi-sentence
// reply can be appended while it plays; without PSRAM it stays the 96 KB internal one.
#define PCM_STREAM_CAP_PSRAM (1024 * 1024)
size_t                 pcmStreamCap  = 0;   // real size of pcmStreamBuf once allocated
static uint8_t* ensurePcmBuf() {
  if (!pcmStreamBuf) {
    size_t cap = psramFound() ? PCM_STREAM_CAP_PSRAM : PCM_STREAM_CAP;
    pcmStreamBuf = allocBig(cap);
    pcmStreamCap = pcmStreamBuf ? cap : 0;
  }
  return pcmStreamBuf;
}
volatile size_t        pcmStreamLen  = 0;   // bytes buffered so far (writer: command path)
volatile size_t        pcmPlayOff    = 0;   // bytes played so far (reader: audioTask)
volatile bool          pcmStreamRecv = false; // between TTS_BEGIN and TTS_END
volatile bool          pcmStreamPlay = false; // audioTask: play the buffer
volatile int           pcmStreamSr   = 8000;  // 8000 (BLE) or 16000 (WiFi/relay)
// Byte format of the streamed TTS: 0 = 8-bit linear (centre 128, older web builds),
// 1 = G.711 mu-law. Same 1 byte/sample, but mu-law keeps ~13-bit quality for quiet
// syllables where 8-bit linear turned to hiss ("audio kurang jernih").
volatile uint8_t       pcmStreamFmt  = 0;
static int16_t         ulawTable[256];      // filled once in setup via ulawInit()
static void ulawInit() {
  for (int i = 0; i < 256; i++) {
    uint8_t u = ~(uint8_t)i;
    int t = (((u & 0x0F) << 3) + 0x84) << ((u & 0x70) >> 4);
    ulawTable[i] = (int16_t)((u & 0x80) ? (0x84 - t) : (t - 0x84));
  }
}
volatile bool          pcmDoneNotify = false; // audioTask -> loop(): send TTS_DONE
volatile bool          pcmTaskBusy   = false; // audioTask is inside the TTS play loop
volatile int           pcmEndSeq     = 0;     // seq of the last TTS_END (echoed in TTS_DONE)
// Streaming playback: start once `pre_ms` (default 250 ms) is buffered instead of
// waiting for TTS_END, so the robot starts talking while the rest still arrives. BLE
// (~8 KB/s = the 8 kHz play rate) sends a huge pre_ms -> plays on TTS_END, no stutter.
volatile size_t        pcmPrebuf     = 2000;  // bytes (8-bit mono: sr bytes per second)
static inline size_t pcmPrebufferBytes() { return pcmPrebuf; }
// Stop TTS playback and wait (<= ~60 ms, one DMA write) until audioTask has left its
// play loop, so resetting pcmStreamLen/pcmPlayOff can't race its offset write-back.
static void pcmStopAndWait() {
  pcmStreamPlay = false;
  for (int i = 0; i < 30 && pcmTaskBusy; i++) delay(2);
}
#endif

#if HAS_MIC
// I2S microphone (INMP441) on I2S_NUM_0. A task keeps a rolling peak level and a
// latched clap flag; GET_SENSOR_DATA reads them. CLAP_THRESHOLD/COOLDOWN in config.h.
#define MIC_SR  16000
// If the level still reads 0 on a board, flip this to I2S_CHANNEL_FMT_ONLY_RIGHT
// (legacy driver slot naming differs between chips) — one-line test.
#ifndef MIC_CHANNEL_FMT
#define MIC_CHANNEL_FMT I2S_CHANNEL_FMT_ONLY_LEFT
#endif
#define MIC_SHIFT 14   // 32-bit slot -> ~16-bit level (24-bit data, drop noise LSBs)
volatile int  micLevel = 0;      // last block peak, 0..32767
volatile bool micClap  = false;  // latched clap; cleared on read
bool          micReady = false;  // I2S RX installed OK
#endif

#if HAS_SPEAKER && HAS_MIC
// Single-slot voice memo (RECORD_AUDIO/PLAY_RECORDING): micTask captures into the
// shared pcmStreamBuf (8-bit, 8 kHz); PLAY_RECORDING hands recordLen to the TTS
// playback path so the same i2s_write code plays it back. One slot — slot arg ignored.
volatile unsigned long recordMs  = 0;   // 0 = idle; else record until this millis()
volatile size_t        recordLen = 0;   // bytes captured so far
volatile bool          micSttSend = false; // after record: stream buffer to web (MIC_DATA)

// Voice input (MIC_STT) records 16-bit samples into its OWN buffer (PSRAM) so it
// never fights the TTS buffer; 8-bit u8 capture had ~48 dB range and quiet speech
// collapsed to a few LSBs -> Whisper heard mush. Without PSRAM it shares pcmStreamBuf.
#define MIC_STT_CAP_PSRAM  (16000 * 2 * 10)  // 10 s @ 16 kHz s16
int16_t*               sttBuf      = nullptr;
size_t                 sttCap      = 0;     // capacity in SAMPLES
bool                   sttShared   = false; // sttBuf IS pcmStreamBuf (board without PSRAM)
volatile size_t        sttLen      = 0;     // samples captured
volatile bool          sttActive   = false; // micTask fills sttBuf while true
volatile int           sttSr       = 16000; // 16000 or 8000 (decimate by 2)
volatile int           sttBits     = 16;    // 16 = s16le, 8 = u8 (BLE/serial: less data)
volatile bool          sttVad      = true;  // auto-stop after speech + silence
volatile bool          sttSpeech   = false; // VAD saw speech in this take
volatile unsigned long sttEndMs    = 0;     // hard stop at this millis()
// VAD: speech = block mean |x| (after the 150 Hz high-pass) above
// max(VAD_MIN_LEVEL, 2.5x the noise floor measured in the first 200 ms); stop after
// VAD_SILENCE_MS of quiet once speech was heard, or VAD_NO_SPEECH_MS with none.
// Measured on a v1.3 board (2026-11-28): room with people ~900-1500 mean |x|
// (block peaks 3000-6000). Tune here if takes end too early/late.
#define VAD_MIN_LEVEL     600
#define VAD_SILENCE_MS    900
#define VAD_NO_SPEECH_MS  5000
#endif

// ----------------------------------------------------- Non-blocking motion
// FIX 3: the firmware NEVER blocks. A timed command sets the actuators and
// records a deadline; loop() stops them when the deadline passes. delay() must
// not appear on the command path or (a) BLE bytes pile up and (b) HEARTBEAT is
// missed and the watchdog kills a move longer than the timeout. The browser is
// the real timekeeper; this deadline is only a safety net if a STOP is lost.
// Do NOT "simplify" this back into delay() — that reintroduces both bugs.
unsigned long motionEndsAtMs = 0;   // 0 = no timed motion in flight

// SET_BPM: stored for the web's music blocks. Firmware timing is browser-driven, so
// this is advisory only (clamped 40..300) — a knob the web can set and read back.
volatile int musicBpm = 120;

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

// Deferred HELLO_ACK (BUG B fix): the 621-byte ack must NOT be sent from the onWrite
// host-task at MTU 23 (= ~32 synchronous notifies -> NimBLE mbuf pool exhausts ->
// dropped tail -> handshake never completes -> connect-drop loop). We flag it here and
// loop() sends it once MTU is negotiated. See docs/ai-firmware-rca.md (BUG B).
bool helloPending = false;
unsigned long helloRxMs = 0;

// ---- WiFi + WebSocket transport (Phase 1) ----------------------------------
// AI/audio needs far more than BLE's ~8KB/s. A WiFi STA + WebSocket server carries the
// SAME JSON protocol (reuse feed()/handleCommand) so the web can drive + stream TTS over
// WiFi at full quality. Creds provisioned via the SET_WIFI command (stored in NVS) so no
// captive-portal lib is needed for bring-up. Mixed-content plan: ESP serves the UI over
// http (same-origin) so ws:// is allowed — HTTP file server is a follow-up (Phase 1b).
// See docs/ai-robot-voice.md. NOTE: compile-verified only — needs hardware testing for
// WiFi+NimBLE+I2S coexistence (heap/radio) on the board.
WebSocketsServer wsServer(81);
Preferences wifiPrefs;
bool          wifiOn       = false;   // STA started (creds present)
bool          wifiUp       = false;   // associated + got IP (edge-reported once)
unsigned long wifiStartMs  = 0;       // millis() when STA began connecting
// Saved creds waiting to be joined from loop(); see setupWiFi() for why not in setup().
String wifiBootSsid, wifiBootPass;
#define WIFI_BOOT_DELAY_MS 3000
// NVS "wifiTry" is set before the deferred radio start and cleared once the board has
// survived WIFI_SURVIVE_MS. Still set at boot = that start reset the board (weak power).
#define WIFI_SURVIVE_MS 10000
unsigned long wifiTryMs = 0;
const unsigned long WIFI_TIMEOUT_MS = 10000;  // give up after 10s, fall back to BLE/Serial
uint8_t       wsClients    = 0;       // connected WebSocket clients
String        wsBuffer;               // inbound line buffer for the WS parser
// Forward decls (definitions live later in the file).
void feed(String& buffer, char c, bool fromSerial);
bool startWiFiSTA(const String& ssid, const String& pass);

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
// Index 0=left drive, 1=right drive, 2=aux positional. Aux centres at 90.
int servoAngle[3] = { SERVO_STOP_DEG, SERVO_STOP_DEG, 90 };

// Is the ESP32Servo currently emitting pulses on this channel? A DETACHED channel
// sends no signal at all, so a continuous SG90 truly stops instead of creeping at
// "90". We attach lazily (first real drive) and detach at idle / on "cabut", so
// "not driving" == "physically cut" — what the virtual schematic promises.
bool servoHwAttached[3] = { false, false, false };
// Schematic module present? The web's pasang/cabut toggles this. A cut channel
// refuses to drive until it is attached again ("kecuali disambungin lagi").
bool servoModulePresent[3] = { true, true, true };

// ---------------------------------------------------------- OLED throttling
// An SSD1306 refresh is ~30 ms over I2C. Rendering on every command would
// throttle the command stream itself (Joystick sends continuously), so frames
// are marked dirty and pushed at most every OLED_MIN_PUSH_INTERVAL_MS from loop().
String oledLine1 = "Siap";
String oledLine2 = "USB / Bluetooth";
bool oledDirty = false;
unsigned long lastOledPushMs = 0;

// DISPLAY_BITMAP: a coarse pixel-art grid (from the web editor) scaled to fill the
// 128x64 panel. Stored as a '0'/'1' string, row-major, w*h chars. bitmapMode routes
// oledRender() to draw pixels instead of the status layout; any status change clears it.
String oledBmp = "";
int oledBmpW = 0;
int oledBmpH = 0;
bool oledBitmapMode = false;

// ============================================================ ACTUATOR API
// Where "stopped" actually is for a channel, once trim is applied.
int servoNeutralDeg(int ch) {
  if (ch == 2) return 90;   // aux is positional — centre, no continuous-servo trim
  return SERVO_STOP_DEG + (ch == 0 ? SERVO_L_TRIM : SERVO_R_TRIM);
}

// Pin + Servo object for a channel, so the switch lives in ONE place.
int servoPin(int ch) {
  return (ch == 0) ? PIN_SERVO_L : (ch == 1) ? PIN_SERVO_R : PIN_SERVO_AUX;
}
Servo* servoObj(int ch) {
  return (ch == 0) ? &servoL : (ch == 1) ? &servoR : &servoAux;
}
// This channel physically exists on this board?
bool servoChannelWired(int ch) {
  if (ch == 0) return true;
  if (ch == 1) return HAS_SERVO_R;
  if (ch == 2) return HAS_SERVO_AUX;
  return false;
}

// Attach or detach the ESP32Servo for a channel — ONLY on a real transition
// (calling attach() every frame glitches the pulse train). Detach parks the pin
// LOW so it can't float and twitch: the signal is genuinely gone, not just "90".
void servoSetAttached(int ch, bool want) {
  if (ch < 0 || ch > 2 || !servoChannelWired(ch)) return;
  if (want == servoHwAttached[ch]) return;
  Servo* s = servoObj(ch);
  int pin = servoPin(ch);
  if (want) {
    s->setPeriodHertz(50);
    s->attach(pin, SERVO_MIN_US, SERVO_MAX_US);
  } else {
    s->detach();
    pinMode(pin, OUTPUT);
    digitalWrite(pin, LOW);
  }
  servoHwAttached[ch] = want;
}

// The ONE place a servo angle is written. Both the JSON path (driveChannel) and
// the bench text path (a bare 0-180) go through here, so the OLED mirror and the
// unwired-channel guard can't drift apart.
void servoWriteAngle(int ch, int deg) {
  if (ch < 0 || ch > 2 || !servoChannelWired(ch)) return;   // no such servo here
  if (!servoModulePresent[ch]) return;   // cut in the schematic — refuse to drive
  servoSetAttached(ch, true);            // writing an angle means we ARE driving
  deg = constrain(deg, 0, 180);
  servoObj(ch)->write(deg);
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
  if (ch < 0 || ch > 2 || !servoChannelWired(ch)) return;
  value = constrain(value, -100, 100);

  // Cut in the schematic: go silent regardless of channel type.
  if (!servoModulePresent[ch]) {
    servoSetAttached(ch, false);
    servoAngle[ch] = servoNeutralDeg(ch);
    oledDirty = true;
    return;
  }

  // Aux (positional): value -100..100 -> 0..180 deg, HELD (0 = centre, not cut).
  if (ch == 2) {
    servoWriteAngle(2, 90 + (value * 90) / 100);
    return;
  }

  // Continuous drive (0/1): idle within the deadband cuts the pulses entirely.
  // No signal -> a continuous servo actually STOPS; one held at "90" creeps.
  if (abs(value) < SERVO_DEADBAND) {
    servoSetAttached(ch, false);
    servoAngle[ch] = servoNeutralDeg(ch);   // OLED reads STOP
    oledDirty = true;
    return;
  }

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

// RGB LED (FW-06). Digital 8-color (any mix of R/G/B) — PWM stutters servo 2 on this
// board, so on/off keeps both servos smooth. r/g/b are 0..255; >127 = "on".
void setLedColor(int r, int g, int b) {
#if HAS_RGB
  digitalWrite(PIN_LED_R, r > 127 ? HIGH : LOW);
  digitalWrite(PIN_LED_G, g > 127 ? HIGH : LOW);
  digitalWrite(PIN_LED_B, b > 127 ? HIGH : LOW);
#else
  (void)r; (void)g; (void)b;
#endif
}

#if HAS_NEOPIXEL
// WS2812B strip. index -1 = all pixels; else that single pixel. 24-bit, no snap.
void neoSetPixel(int index, uint8_t r, uint8_t g, uint8_t b) {
  if (index < 0) {
    for (int i = 0; i < NEOPIXEL_COUNT; i++) strip.setPixelColor(i, strip.Color(r, g, b));
  } else if (index < NEOPIXEL_COUNT) {
    strip.setPixelColor(index, strip.Color(r, g, b));
  }
  strip.show();
}

// Non-blocking effect stepper, called from loop(). Rainbow/chase advance ~25 fps;
// a deadline (neoEffectEndsMs) clears the strip when the effect's time is up.
void neoTick() {
  if (neoActiveEffect == 0) return;
  if (neoEffectEndsMs != 0 && (long)(millis() - neoEffectEndsMs) >= 0) {
    neoActiveEffect = 0;
    strip.clear();
    strip.show();
    return;
  }
  if (millis() - neoLastStepMs < 40) return;
  neoLastStepMs = millis();
  neoEffectPhase++;
  if (neoActiveEffect == 1) {            // rainbow
    for (int i = 0; i < NEOPIXEL_COUNT; i++) {
      uint16_t hue = (uint16_t)(neoEffectPhase * 512 + i * (65536L / NEOPIXEL_COUNT));
      strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(hue)));
    }
  } else {                                // chase
    strip.clear();
    strip.setPixelColor(neoEffectPhase % NEOPIXEL_COUNT, strip.Color(0, 150, 255));
  }
  strip.show();
}
#endif

#if HAS_SPEAKER
// Bring up I2S_NUM_1 as a 16 kHz mono TX master for the MAX98357A.
void i2sSpeakerInit() {
  i2s_config_t cfg = {};
  cfg.mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX);
  cfg.sample_rate = SPK_SR;
  cfg.bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT;
  cfg.channel_format = I2S_CHANNEL_FMT_ONLY_LEFT;
  cfg.communication_format = I2S_COMM_FORMAT_STAND_I2S;
  cfg.intr_alloc_flags = ESP_INTR_FLAG_LEVEL1;
  cfg.dma_buf_count = 6;
  cfg.dma_buf_len = 256;
  cfg.use_apll = false;
  cfg.tx_desc_auto_clear = true;
  cfg.fixed_mclk = 0;
  esp_err_t e1 = i2s_driver_install(I2S_NUM_1, &cfg, 0, NULL);
  Serial.printf("[i2s spk] install=%d\n", (int)e1);
  if (e1 != ESP_OK) return;               // don't touch pins on a failed driver
  i2s_pin_config_t pins = {};
  pins.mck_io_num  = I2S_PIN_NO_CHANGE;   // MUST be explicit — {} would leave it GPIO0
  pins.bck_io_num  = PIN_SPK_BCLK;
  pins.ws_io_num   = PIN_SPK_LRC;
  pins.data_out_num = PIN_SPK_DIN;
  pins.data_in_num  = I2S_PIN_NO_CHANGE;
  esp_err_t e2 = i2s_set_pin(I2S_NUM_1, &pins);
  Serial.printf("[i2s spk] set_pin=%d\n", (int)e2);
  i2s_zero_dma_buffer(I2S_NUM_1);
  spkReady = (e2 == ESP_OK);
}

// Dedicated audio task: streams either a synthesized tone or the welcome PCM clip.
// It blocks on i2s_write (which only waits for DMA space), never on the command path.
void audioTask(void*) {
  static int16_t buf[256];
  float phase = 0.0f;
  for (;;) {
    if (spkStop) { spkToneFreq = 0; spkPcmPlay = false; spkStop = false; i2s_zero_dma_buffer(I2S_NUM_1); }

    if (spkToneFreq > 0) {
      if ((long)(millis() - spkToneEndMs) >= 0) { spkToneFreq = 0; i2s_zero_dma_buffer(I2S_NUM_1); vTaskDelay(1); continue; }
      const float inc = 2.0f * PI * spkToneFreq / SPK_SR;
      for (int i = 0; i < 256; i++) {
        int16_t s = spkToneSquare ? (phase < PI ? SPK_AMPLITUDE : -SPK_AMPLITUDE)
                                  : (int16_t)(SPK_AMPLITUDE * sinf(phase));
        buf[i] = (int16_t)((int)s * spkVolume / 100);   // SET_VOLUME scale
        phase += inc; if (phase >= 2.0f * PI) phase -= 2.0f * PI;
      }
      size_t wr; i2s_write(I2S_NUM_1, buf, sizeof(buf), &wr, portMAX_DELAY);
    } else if (spkPcmPlay) {
      // Stream welcomeAudio straight from FLASH in 256-sample chunks (never copied to RAM).
      size_t off = 0, wr;
      while (off < (size_t)welcomeAudioLength && spkPcmPlay && !spkStop) {
        size_t n = (size_t)welcomeAudioLength - off; if (n > 256) n = 256;
        i2s_write(I2S_NUM_1, &welcomeAudio[off], n * sizeof(int16_t), &wr, portMAX_DELAY);
        off += n;
      }
      spkPcmPlay = false;
      i2s_zero_dma_buffer(I2S_NUM_1);
    } else if (pcmStreamPlay && pcmStreamBuf) {
      // Streamed TTS: 8-bit unsigned (centre 128) -> 16-bit signed. Plays WHILE chunks
      // still arrive (pcmStreamRecv) and waits on underrun instead of ending, so a
      // reply appended sentence by sentence (TTS_BEGIN append) plays as one take.
      // 8 kHz input is upsampled x2 with linear interpolation (less buzz than
      // sample-doubling); 16 kHz input goes straight to the 16 kHz I2S clock.
      pcmTaskBusy = true;
      const bool up = (pcmStreamSr != SPK_SR);
      int16_t prev = 0;
      size_t wr;
      for (;;) {
        if (!pcmStreamPlay || spkStop) break;
        size_t len = pcmStreamLen, off = pcmPlayOff;
        if (off >= len) {
          if (!pcmStreamRecv) { pcmDoneNotify = true; break; }   // drained, nothing more coming
          vTaskDelay(4);   // underrun: wait for the next chunk (DMA auto-clears to silence)
          continue;
        }
        int n = 0;
        while (n <= 254 && off < len) {
          // u8 (centre 128) -> s16 at HALF scale (<<7, not <<8): still far louder
          // than the old tone, but leaves current headroom so a long reply doesn't
          // brown the board out on USB. Bump toward <<8 if you run on battery.
          // mu-law plays at FULL scale like the welcome clip (calibration: the half-scale
          // TTS sounded 6 dB quieter / less clear than the 16-bit reference clip); the
          // old 8-bit path keeps its half-scale headroom. SET_VOLUME still scales both.
          const int lin = pcmStreamFmt ? ulawTable[pcmStreamBuf[off]] : (((int)pcmStreamBuf[off] - 128) << 7);
          int16_t s = (int16_t)(lin * spkVolume / 100);  // SET_VOLUME scale
          if (up) buf[n++] = (int16_t)(((int)prev + s) / 2);
          buf[n++] = s;
          prev = s;
          off++;
        }
        pcmPlayOff = off;
        i2s_write(I2S_NUM_1, buf, n * sizeof(int16_t), &wr, portMAX_DELAY);
      }
      // Re-check before clearing: TTS_END/append may have queued more audio meanwhile.
      if (spkStop || pcmPlayOff >= pcmStreamLen) pcmStreamPlay = false;
      pcmTaskBusy = false;
      i2s_zero_dma_buffer(I2S_NUM_1);
    } else {
      vTaskDelay(5);
    }
  }
}
#endif

#if HAS_MIC
void i2sMicInit() {
  i2s_config_t cfg = {};
  cfg.mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX);
  cfg.sample_rate = MIC_SR;
  // INMP441 = Philips I2S, 24-bit data in a 32-bit slot, 64 SCK per frame. The old
  // 16-bit + I2S_MSB setup clocked only 32 SCK per frame -> the mic answered zeros
  // ("mic level = 0"). L/R is tied to GND on the Makerkit -> LEFT slot.
  cfg.bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT;
  cfg.channel_format = MIC_CHANNEL_FMT;
  cfg.communication_format = I2S_COMM_FORMAT_STAND_I2S;
  cfg.intr_alloc_flags = ESP_INTR_FLAG_LEVEL1;
  cfg.dma_buf_count = 4;
  cfg.dma_buf_len = 1024;
  cfg.use_apll = false;
  cfg.tx_desc_auto_clear = false;
  cfg.fixed_mclk = 0;
  esp_err_t e1 = i2s_driver_install(I2S_NUM_0, &cfg, 0, NULL);
  Serial.printf("[i2s mic] install=%d\n", (int)e1);
  if (e1 != ESP_OK) return;
  i2s_pin_config_t pins = {};
  pins.mck_io_num  = I2S_PIN_NO_CHANGE;
  pins.bck_io_num  = PIN_MIC_SCK;
  pins.ws_io_num   = PIN_MIC_WS;
  pins.data_out_num = I2S_PIN_NO_CHANGE;
  pins.data_in_num  = PIN_MIC_SD;
  esp_err_t e2 = i2s_set_pin(I2S_NUM_0, &pins);
  Serial.printf("[i2s mic] set_pin=%d\n", (int)e2);
  micReady = (e2 == ESP_OK);
}

// Continuously read the mic, track block peak + detect claps (threshold/cooldown
// from config.h). Runs on its own task so i2s_read blocking never stalls loop().
void micTask(void*) {
  static int32_t raw[512];
  static int16_t samples[512];
  unsigned long lastClapMs = 0;
  for (;;) {
    size_t nbytes = 0;
    if (i2s_read(I2S_NUM_0, raw, sizeof(raw), &nbytes, portMAX_DELAY) != ESP_OK || nbytes == 0) {
      vTaskDelay(2); continue;
    }
    int n = nbytes / sizeof(int32_t);
    // 150 Hz high-pass (2nd-order Butterworth biquad). Measured on the board: the raw
    // stream carries a ~-6000 DC offset plus 50/100 Hz mains hum and rumble — 88% of
    // the "silent room" energy sat below 300 Hz and read as a constant loud level,
    // which broke clap detection and VAD. Speech (300-3400 Hz) passes untouched.
    static bool  hpInit = false;
    static float hb0, hb1, hb2, ha1, ha2, hx1 = 0, hx2 = 0, hy1 = 0, hy2 = 0;
    if (!hpInit) {
      hpInit = true;
      const float w0 = 2.0f * PI * 150.0f / MIC_SR, c = cosf(w0), al = sinf(w0) / (2.0f * 0.7071f);
      const float a0 = 1.0f + al;
      hb0 = (1.0f + c) / 2.0f / a0; hb1 = -(1.0f + c) / a0; hb2 = hb0;
      ha1 = -2.0f * c / a0;         ha2 = (1.0f - al) / a0;
    }
    for (int i = 0; i < n; i++) {
      float x = (float)(raw[i] >> MIC_SHIFT);
      float y = hb0 * x + hb1 * hx1 + hb2 * hx2 - ha1 * hy1 - ha2 * hy2;
      hx2 = hx1; hx1 = x; hy2 = hy1; hy1 = y;
      int32_t out = (int32_t)y;
      samples[i] = (int16_t)constrain(out, -32768, 32767);
    }
    int peak = 0;
    for (int i = 0; i < n; i++) { int a = abs(samples[i]); if (a > peak) peak = a; }
    micLevel = peak;
    if (peak >= CLAP_THRESHOLD && (millis() - lastClapMs) > CLAP_COOLDOWN_MS) {
      lastClapMs = millis();
      micClap = true;   // latched until GET_SENSOR_DATA reads it
    }
#if HAS_SPEAKER
    // RECORD_AUDIO: while armed, downsample 16 kHz -> 8 kHz (every other sample) and
    // store as 8-bit unsigned (centre 128) into the shared buffer PLAY_RECORDING reuses.
    if (recordMs != 0 && pcmStreamBuf) {
      if ((long)(millis() - recordMs) >= 0) {
        recordMs = 0;                            // time up — buffer holds recordLen bytes
      } else {
        for (int i = 0; i < n && recordLen < PCM_STREAM_CAP; i += 2) {
          int v = (samples[i] >> 8) + 128;       // s16 -> u8 unsigned
          pcmStreamBuf[recordLen++] = (uint8_t)constrain(v, 0, 255);
        }
      }
    }

    // MIC_STT: keep full 16-bit samples (x2 decimated by averaging for 8 kHz) and run a
    // simple VAD so the take ends ~1 s after the user stops talking, not on a fixed timer.
    static bool          sttInit = false;
    static int           noiseSum = 0, noiseN = 0, loud = 0;
    static unsigned long sttT0 = 0, lastLoudMs = 0;
    if (sttActive && sttBuf) {
      unsigned long now = millis();
      if (!sttInit) { sttInit = true; noiseSum = 0; noiseN = 0; loud = 0; sttT0 = now; lastLoudMs = now; }
      if (sttSr == 8000) {
        for (int i = 0; i + 1 < n && sttLen < sttCap; i += 2)
          sttBuf[sttLen++] = (int16_t)(((int)samples[i] + samples[i + 1]) / 2);
      } else {
        for (int i = 0; i < n && sttLen < sttCap; i++) sttBuf[sttLen++] = samples[i];
      }
      long sum = 0;
      for (int i = 0; i < n; i++) sum += abs((int)samples[i]);
      const int mav = n ? (int)(sum / n) : 0;                  // block mean |x|: steadier than peak
      unsigned long el = now - sttT0;
      if (el < 200) { noiseSum += mav; noiseN++; }            // first ~200 ms = room noise
      else {
        int noise = noiseN ? noiseSum / noiseN : 0;
        int thr = max(VAD_MIN_LEVEL, noise * 5 / 2);
        if (mav > thr) { if (++loud >= 2) sttSpeech = true; lastLoudMs = now; }
        else loud = 0;
      }
      bool stop = sttLen >= sttCap || (long)(now - sttEndMs) >= 0;
      if (sttVad && !stop) stop = sttSpeech ? (now - lastLoudMs) >= VAD_SILENCE_MS : el >= VAD_NO_SPEECH_MS;
      if (stop) sttActive = false;                             // loop() streams it to the web
    }
    if (!sttActive) sttInit = false;
#endif
  }
}
#endif

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

  // Pixel-art bitmap mode: scale the w x h grid to fill the panel and bail early.
  if (oledBitmapMode && oledBmpW > 0 && oledBmpH > 0) {
    int cw = OLED_WIDTH / oledBmpW;
    int ch = OLED_HEIGHT / oledBmpH;
    for (int r = 0; r < oledBmpH; r++) {
      for (int c = 0; c < oledBmpW; c++) {
        if (oledBmp[r * oledBmpW + c] == '1') oled.fillRect(c * cw, r * ch, cw, ch, SSD1306_WHITE);
      }
    }
    oled.display();
    return;
  }

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
  oledBitmapMode = false; // a status update takes the panel back from bitmap mode
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

// buzzerTone/buzzerOff: passive-buzzer tone via the hardware timer set up in setup().
// ms<=0 = play until the next call; else loop() silences it at the deadline.
void buzzerOff();   // forward decl — buzzerTone() calls buzzerOff() before its definition
void buzzerTone(int freq, long ms) {
#ifdef NO_BUZZER
  freq = 0;   // diagnostic build: a faulty buzzer stage that browns the board out stays silent
#endif
  if (!buzzerTimer || freq <= 0) { buzzerOff(); return; }
  // Timer ticks at 1 MHz (see setup); alarm = half the wave period in µs.
  uint32_t halfUs = 500000UL / (uint32_t)freq;
  if (halfUs < 1) halfUs = 1;
  timerAlarmWrite(buzzerTimer, halfUs, true);
  timerAlarmEnable(buzzerTimer);
  buzzerOffMs = (ms > 0) ? (millis() + ms) : 0;
}
void buzzerOff() {
  if (buzzerTimer) timerAlarmDisable(buzzerTimer);
  buzzerPinHigh = false;
  digitalWrite(PIN_BUZZER, LOW);
  buzzerOffMs = 0;
}

void startupTone() {
  buzzerTone(880, 0);  delay(140);
  buzzerTone(1175, 0); delay(140);
  buzzerTone(1568, 0); delay(180);
  buzzerOff();
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
      // Flow control (BUG B): pace between notifies so the NimBLE host task can drain
      // its mbuf pool. Firing a burst back-to-back (e.g. a 621-byte HELLO_ACK = many
      // notifies at low MTU) exhausts the pool and silently drops the tail (the ';'
      // terminator) -> corrupt frame -> connect-drop loop. notify() returns void in
      // NimBLE 1.4.x so we can't check success — pacing is the lever. Also guards big
      // frames like DISPLAY_BITMAP. See docs/ai-firmware-rca.md.
      delay(2);
    }
  }
  if (wsClients > 0) wsServer.broadcastTXT(line.c_str(), line.length());   // WiFi transport (WS, no MTU chunking)
  if (relayConnected) relaySend(line);                                     // relay transport (internet)
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

// SET_ANALOG/SET_DIGITAL: resolve a web port name ("P1".."P8" or a bare number) to
// its PWM-header GPIO through the SAME config.h table the drive path uses — single
// source of truth. Unwired ports (PORT_CHANNEL == -1) and junk return -1 (skip).
#ifdef AUX_PIN_LIST
static const int AUX_PINS[] = AUX_PIN_LIST;
#endif
// Web port "G1".."G6" -> AUX_I/O GPIO (boards that have the AUX header), else -1.
int auxPin(const char* port) {
#ifdef AUX_PIN_LIST
  if (!port || (port[0] != 'G' && port[0] != 'g')) return -1;
  int n = atoi(port + 1);
  if (n < 1 || n > (int)(sizeof(AUX_PINS) / sizeof(AUX_PINS[0]))) return -1;
  return AUX_PINS[n - 1];
#else
  (void)port;
  return -1;
#endif
}

#ifdef PIN_TOUCH1
// Capacitive pads: the S3 reading RISES when touched. Baseline taken at boot (pads
// untouched); "pressed" = 25% above it.
static uint32_t touchBase[2] = {0, 0};
static void touchInit() {
  const int pins[2] = {PIN_TOUCH1, PIN_TOUCH2};
  for (int i = 0; i < 2; i++) {
    uint32_t sum = 0;
    for (int k = 0; k < 8; k++) sum += touchRead(pins[i]);
    touchBase[i] = sum / 8;
  }
}
static bool touchPressed(int i) {
  uint32_t v = touchRead(i == 0 ? PIN_TOUCH1 : PIN_TOUCH2);
  return touchBase[i] && v > touchBase[i] + touchBase[i] / 4;
}
#endif

#ifdef PIN_US_TRIG
// HC-SR04: 10 us trigger, echo pulse width = round trip. -1 = no sensor / no echo
// within ~4 m (25 ms timeout keeps loop() responsive).
static float ultrasonicRead(bool inch) {
  digitalWrite(PIN_US_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_US_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_US_TRIG, LOW);
  unsigned long us = pulseIn(PIN_US_ECHO, HIGH, 25000UL);
  if (us == 0) return -1;
  return roundf((inch ? us / 148.0f : us / 58.0f) * 10) / 10;
}
#endif

int portPwmPin(const char* port) {
  if (!port || port[0] == '\0') return -1;
  int n = (port[0] == 'P' || port[0] == 'p') ? atoi(port + 1) : atoi(port);
  if (n < 1 || n > 8 || PORT_CHANNEL[n] < 0) return -1;
  return servoPin(PORT_CHANNEL[n]);
}

// OTA over WiFi (b.md): the OTA_UPDATE command can arrive over ANY transport (BLE/
// Serial/WS); the ESP downloads the .bin itself over WiFi, so browser mixed-content
// doesn't apply. No-brick: only ESP.restart() after Update.end(true) succeeds; on any
// failure we report OTA_FAIL and stay on the current firmware.
void doOtaUpdate(const String& url, const String& version) {
  auto fail = [](const char* reason, int code) {
    JsonDocument e; e["command"] = "OTA_FAIL"; e["reason"] = reason;
    if (code) e["code"] = code;
    sendJson(e);
  };
  if (WiFi.status() != WL_CONNECTED) { fail("wifi_down", 0); return; }
  if (url.length() == 0)             { fail("no_url", 0); return; }
  if (version.length() && version == FW_VERSION) { fail("same_version", 0); return; }

  // Free CPU/heap + silence the board before flashing (no playback mid-OTA).
  stopAllActuators();
#if HAS_SPEAKER
  spkStop = true; pcmStreamPlay = false; pcmStreamRecv = false; spkPcmPlay = false; spkToneFreq = 0;
#endif

  WiFiClientSecure secure;
  secure.setInsecure();                 // ESP-side fetch; skip cert chain
  WiFiClient plain;
  HTTPClient http;
  bool begun = url.startsWith("https")
                 ? http.begin(secure, url)
                 : http.begin(plain, url);
  if (!begun) { fail("begin", 0); return; }

  int code = http.GET();
  if (code != HTTP_CODE_OK) { fail("http", code); http.end(); return; }

  int total = http.getSize();
  if (total <= 0 || !Update.begin((size_t)total)) { fail("update_begin", total); http.end(); return; }

  WiFiClient* stream = http.getStreamPtr();
  uint8_t buf[1024];
  size_t written = 0;
  int lastPct = -1;
  while (http.connected() && written < (size_t)total) {
    size_t avail = stream->available();
    if (avail) {
      size_t n = avail < sizeof(buf) ? avail : sizeof(buf);
      int r = stream->readBytes(buf, n);
      if (r <= 0 || Update.write(buf, r) != (size_t)r) { fail("write", 0); Update.abort(); http.end(); return; }
      written += r;
      int pct = (int)(written * 100 / total);
      if (pct != lastPct && pct % 10 == 0) {
        lastPct = pct;
        JsonDocument p; p["command"] = "OTA_PROGRESS"; p["pct"] = pct; sendJson(p);
      }
    } else {
      delay(1);
    }
  }
  http.end();

  if (!Update.end(true)) { fail("end", (int)Update.getError()); return; }  // stays on old fw
  JsonDocument ok; ok["command"] = "OTA_OK"; ok["version"] = version; sendJson(ok);
  delay(300);
  ESP.restart();
}

// Build + send the HELLO_ACK. Called from loop() (NOT the onWrite host-task) once the
// MTU is negotiated, so the ~621-byte ack goes out in ~3 notifies instead of ~32 at
// MTU 23 — the notify storm that caused the connect-drop loop (docs/ai-firmware-rca.md).
void sendHelloAck() {
  // FIX 7 — advertise ONLY what actually compiles here.
  JsonDocument ack;
  ack["command"]  = "HELLO_ACK";
  ack["fw"]       = FW_VERSION;
  ack["board"]    = BOARD_NAME;
  ack["protocol"] = PROTOCOL_ID;
  JsonArray caps = ack["capabilities"].to<JsonArray>();
  caps.add("SET_PORT");
  caps.add("ATTACH");
  caps.add("DETACH");
#if HAS_SERVO_AUX
  caps.add("SET_HEAD_POSITION");   // accessory positional servo on P5
#endif
  caps.add("STOP_ALL");
  caps.add("STOP");
  caps.add("MOVE_TIMED");
  // Turning needs two independently driven sides. With HAS_SERVO_R = 0 there
  // is only one, so don't advertise it — see the ports scan below.
  if (HAS_SERVO_R) caps.add("TURN_TIMED");
  if (HAS_SERVO_R) caps.add("STEER_TIMED");
  caps.add("WAIT");
  caps.add("PLAY_TONE");
  caps.add("SET_WIFI");         // Phase 1: provision WiFi STA over BLE/Serial
  caps.add("OTA_UPDATE");       // firmware update over WiFi (no USB flasher)
#if HAS_RGB
  caps.add("SET_LED_COLOR");   // FW-06 RGB LED (GPIO16/17/5)
#endif
#if HAS_NEOPIXEL
  caps.add("SET_LED_COLOR");   // drives the WS2812B strip (24-bit)
  caps.add("NEOPIXEL_SET");
  caps.add("NEOPIXEL_EFFECT");
#endif
#if HAS_SPEAKER
  caps.add("SPEAKER_TONE");
  caps.add("SPEAKER_PLAY_PCM");
  caps.add("TTS_BEGIN");        // robot speaks streamed AI-reply PCM
  caps.add("TTS_CHUNK");
  caps.add("TTS_END");
  caps.add("TTS_STREAM");       // 2.6: plays while streaming, append + sr, replies TTS_DONE
  caps.add("TTS_ULAW");         // 2.6.1: TTS_BEGIN {fmt:"ulaw"} -> G.711 mu-law bytes
  if (psramFound()) caps.add("TTS_SR16");   // 1 MB buffer -> 16 kHz is safe over WiFi/relay
#endif
#if HAS_MIC
  caps.add("GET_SENSOR_DATA");   // mic level / clap reporters
  caps.add("MIC_STT");           // record mic -> stream to web for STT
  caps.add("MIC_STOP");          // 2.6: end a take early; MIC_STT takes sr/bits/vad
#endif
  if (oledOk) caps.add("DISPLAY_TEXT");   // OLED text — only if the panel answered
  if (oledOk) caps.add("DISPLAY_BITMAP"); // OLED pixel-art
  if (oledOk) { caps.add("LCD_TEXT"); caps.add("LCD_SHAPE"); caps.add("LCD_CLEAR"); }  // LCD blocks -> OLED
  if (oledOk) caps.add("SET_LED_BRIGHTNESS"); // OLED contrast/brightness
  // Web control-surface opcodes (guarded to match the handlers below).
  caps.add("DRIVE_DIRECT");
  caps.add("ESTOP");
#if HAS_SERVO_AUX
  caps.add("SET_GRIPPER");
  caps.add("CLAW_TIMED");
#endif
#if HAS_SPEAKER
  caps.add("SET_VOLUME");
#endif
  caps.add("STOP_SOUNDS");
  caps.add("PLAY_SOUND_EFFECT");
  caps.add("SET_BPM");
#if HAS_SPEAKER && HAS_MIC
  caps.add("RECORD_AUDIO");
  caps.add("PLAY_RECORDING");
#endif
  caps.add("SET_ANALOG");
  caps.add("SET_DIGITAL");
  caps.add("RESET_DISTANCE");
  caps.add("RESET_HEADING");
  // Report the ports that are REALLY wired by scanning the config.h table —
  // never a hardcoded list. A board claiming port 2 it doesn't have makes the
  // right joystick axis die silently, which reads as "the web app is broken".
  JsonArray ports = ack["ports"].to<JsonArray>();
  for (int i = 1; i <= 8; i++) {
    if (PORT_CHANNEL[i] >= 0) ports.add(i);
  }
  ack["driveMode"] = "servo";
  ack["hasBuzzer"]   = true;
  ack["hasOled"]     = oledOk;                // real I2C detection (0x3C), not a claim
  ack["hasRgbLed"]   = (bool)HAS_RGB;
  ack["hasNeoPixel"] = (bool)HAS_NEOPIXEL;
  ack["hasSpeaker"]  = (bool)HAS_SPEAKER;
  ack["hasMic"]      = (bool)HAS_MIC;
  ack["boardId"]     = BOARD_ID;
  // Modules actually detected on the bus so the web can enable their blocks.
  if (oledOk) {
    JsonArray periph = ack["peripherals"].to<JsonArray>();
    periph.add("oled-ssd1306");
  }
  // WiFi transport discovery: tell the web the robot's LAN address so it can open the
  // WebSocket (Phase 1). Absent when WiFi isn't up — web falls back to BLE/Serial.
  if (wifiUp) {
    ack["wifiIp"] = WiFi.localIP().toString();
    ack["wsPort"] = 81;
  }
  // Remote diagnostics — readable from the web over ANY link, so we never have to
  // open USB serial (which resets the board via the CH340C auto-reset) to debug.
  JsonObject diag = ack["diag"].to<JsonObject>();
  diag["reset"]      = resetReasonName(esp_reset_reason());
  diag["uptimeS"]    = (uint32_t)(millis() / 1000);
  diag["heapFree"]   = (uint32_t)ESP.getFreeHeap();
  diag["heapMin"]    = (uint32_t)ESP.getMinFreeHeap();
  diag["psram"]      = (uint32_t)ESP.getPsramSize();
  diag["psramFree"]  = (uint32_t)ESP.getFreePsram();
  diag["flash"]      = (uint32_t)ESP.getFlashChipSize();
  diag["rssi"]       = wifiUp ? (int)WiFi.RSSI() : 0;
  diag["relay"]      = relayConnected;
  diag["relayId"]    = relayId;
  diag["relayConns"] = relayConnectCount;
  diag["link"]       = bleConnected ? "ble" : (relayConnected ? "relay" : (wsClients ? "ws" : "usb"));
  sendJson(ack);
  watchdogArmed = true;         // the link is live from here on
  lastStatus = "Terhubung";
  oledStatus("Terhubung", bleConnected ? "via Bluetooth" : (relayConnected ? "via Internet" : "via USB"));
}

// Human-readable esp_reset_reason() — BROWNOUT here = power problem, not software.
const char* resetReasonName(esp_reset_reason_t r) {
  switch (r) {
    case ESP_RST_POWERON:  return "POWERON";
    case ESP_RST_SW:       return "SW";
    case ESP_RST_PANIC:    return "PANIC";
    case ESP_RST_INT_WDT:  return "INT_WDT";
    case ESP_RST_TASK_WDT: return "TASK_WDT";
    case ESP_RST_WDT:      return "WDT";
    case ESP_RST_BROWNOUT: return "BROWNOUT";
    case ESP_RST_DEEPSLEEP:return "DEEPSLEEP";
    case ESP_RST_EXT:      return "EXT";
    default:               return "OTHER";
  }
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
    // BUG B: do NOT build/send the 621-byte HELLO_ACK here — this runs in the onWrite
    // host-task and at the default MTU 23 that's ~32 synchronous notify()s = NimBLE
    // mbuf pool exhaustion -> dropped tail -> handshake never completes -> connect-drop
    // loop. Flag it; loop() calls sendHelloAck() once MTU is negotiated (or after a
    // short grace for serial). See docs/ai-firmware-rca.md (BUG B).
    helloPending = true;
    helloRxMs = millis();
    return;
  }


  if (strcmp(cmd, "HEARTBEAT") == 0) {
    JsonDocument ack;
    ack["command"] = "ACK";
    ack["seq"] = doc["seq"] | 0;
    sendJson(ack);
    return;
  }

  // --- WiFi provisioning (Phase 1): bootstrap WiFi via the existing BLE/Serial link.
  // Web connects over BLE first, sends SET_WIFI, robot joins the LAN, then the web can
  // switch to the WiFi (WebSocket) transport for AI/audio. Creds persist in NVS.
  if (strcmp(cmd, "SET_WIFI") == 0) {
    const char* ssid = p["ssid"] | "";
    const char* pass = p["pass"] | "";
    wifiPrefs.begin("robotku", false);
    wifiPrefs.putString("ssid", ssid);
    wifiPrefs.putString("pass", pass);
    wifiPrefs.end();
    startWiFiSTA(String(ssid), String(pass));
    JsonDocument r;
    r["command"] = "WIFI_STATUS";
    r["connecting"] = true;
    r["ssid"] = ssid;
    sendJson(r);
    return;
  }

  // --- Relay provisioning via JSON (web setup wizard sends this over BLE/Serial).
  // Same effect as the text "SET_RELAY <ID> <SECRET>" command.
  if (strcmp(cmd, "SET_RELAY") == 0) {
    const char* id = p["id"] | "";
    const char* secret = p["secret"] | "";
    if (strlen(id) != 6) {
      sendUnsupported("SET_RELAY");   // ID must be 6 chars
      return;
    }
    String idUp = String(id); idUp.toUpperCase();
    Preferences prefs;
    prefs.begin("relay", false);
    prefs.putString("id", idUp);
    prefs.putString("secret", secret);
    prefs.end();
    relayId = idUp;
    relaySecret = String(secret);
    relayEnabled = true;
    if (relayBegun) relayWs.disconnect();   // restart the client with the new identity
    relayBegun = false;
    relayConnected = false;
    JsonDocument r;
    r["command"] = "RELAY_STATUS";
    r["id"] = idUp;
    r["saved"] = true;
    sendJson(r);
    Serial.printf("[RELAY] Provisioned: ID=%s\n", idUp.c_str());
    return;
  }

  // --- OTA firmware update over WiFi (b.md). Command may arrive via BLE/Serial/WS;
  // the ESP downloads the .bin itself over WiFi (no browser mixed-content). Needs
  // SET_WIFI done first. See docs/ai-firmware-rca.md / b.md.
  if (strcmp(cmd, "OTA_UPDATE") == 0) {
    doOtaUpdate(String(p["url"] | ""), String(p["version"] | ""));
    return;
  }

  // --- Schematic pasang / cabut -------------------------------------------
  // The web's virtual schematic can detach a module; the hardware must then go
  // truly silent on that pin (no creeping continuous servo) and STAY silent until
  // it is re-attached. Channel via {"channel":0|1|2} or {"port":N} (config table).
  if (strcmp(cmd, "ATTACH") == 0 || strcmp(cmd, "DETACH") == 0) {
    bool attach = (cmd[0] == 'A');
    int ch;
    if (!p["channel"].isNull()) ch = p["channel"].as<int>();
    else { int port = p["port"] | 0; ch = (port >= 1 && port <= 8) ? PORT_CHANNEL[port] : -1; }
    if (ch < 0 || ch > 2 || !servoChannelWired(ch)) { sendUnsupported(cmd); return; }
    servoModulePresent[ch] = attach;
    if (!attach) {                 // cut now; a later drive re-attaches lazily
      servoSetAttached(ch, false);
      servoAngle[ch] = servoNeutralDeg(ch);
      oledDirty = true;
    }
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

  // --- Accessory servo: absolute angle (the schematic's servo slider) ------
  if (strcmp(cmd, "SET_HEAD_POSITION") == 0 || strcmp(cmd, "SET_SERVO") == 0) {
    if (!HAS_SERVO_AUX) { sendUnsupported(cmd); return; }   // no aux servo wired
    int angle = p["angle"] | (p["position"] | 90);
    servoWriteAngle(SERVO_AUX_CH, angle);   // positional: holds until changed
    lastStatus = "Servo";
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

  // --- Block: Stop (wheels) ------------------------------------------------
  if (strcmp(cmd, "STOP") == 0) {
    driveTank(0, 0);          // halt the drive servos; leave buzzer/LED alone
    motionEndsAtMs = 0;
    lastStatus = "Stop";
    return;
  }

  // --- Block: Steer (differential) ----------------------------------------
  if (strcmp(cmd, "STEER_TIMED") == 0) {
    if (!HAS_SERVO_R) { sendUnsupported("STEER_TIMED"); return; }  // needs two sides
    int speed    = constrain((int)(p["speed"] | 60), 0, 100);
    int steering = constrain((int)(p["steering"] | 0), -100, 100);
    long ms      = readDurationMs(p);
    float turn = steering / 100.0f;                                // -1..1
    int lspeed = constrain((int)(speed * (1.0f + turn)), -100, 100);
    int rspeed = constrain((int)(speed * (1.0f - turn)), -100, 100);
    driveTank(lspeed, rspeed);
    if (ms > 0) motionEndsAtMs = millis() + ms + MOTION_SAFETY_MARGIN_MS;
    lastStatus = "Belok";
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
    else if (!p["hz"].isNull())    freq = p["hz"].as<int>();     // Base mode / older web
    else if (!p["freq"].isNull())  freq = p["freq"].as<int>();
    else if (!p["note"].isNull())  freq = noteToFreq(p["note"].as<const char*>());
    else                           freq = 440;
    long ms = readDurationMs(p);
    if (ms <= 0) ms = 300;
    // target: "buzzer" = the physical buzzer (Base mode button), "speaker" = I2S amp,
    // absent = speaker when the board has one (K5, block programs), else buzzer.
    const char* target = p["target"] | "";
    bool toBuzzer = (strcmp(target, "buzzer") == 0);
#if HAS_SPEAKER
    if (!toBuzzer) { spkToneSquare = false; spkToneFreq = freq; spkToneEndMs = millis() + ms; }
    else           buzzerTone(freq, ms);
#else
    (void)toBuzzer;
    buzzerTone(freq, ms);   // non-blocking; loop() silences at the deadline
#endif
    lastStatus = "Nada";
    return;
  }

  // --- Block: Speaker tone (Makerkit I2S) ---------------------------------
  if (strcmp(cmd, "SPEAKER_TONE") == 0) {
#if HAS_SPEAKER
    int freq = !p["freq"].isNull() ? p["freq"].as<int>()
             : !p["frequency"].isNull() ? p["frequency"].as<int>() : 440;
    long ms = readDurationMs(p); if (ms <= 0) ms = 300;
    const char* wave = p["wave"] | "sine";
    spkToneSquare = (strcmp(wave, "square") == 0);
    spkToneFreq = freq; spkToneEndMs = millis() + ms;
    lastStatus = "Nada";
#else
    sendUnsupported("SPEAKER_TONE");
#endif
    return;
  }

  // --- Block: Speaker play PCM clip (Makerkit) ----------------------------
  if (strcmp(cmd, "SPEAKER_PLAY_PCM") == 0) {
#if HAS_SPEAKER
    // Only the built-in "welcome" clip for now; ignore unknown clip names gracefully.
    spkToneFreq = 0;
    spkPcmPlay = true;
    lastStatus = "Audio";
#else
    sendUnsupported("SPEAKER_PLAY_PCM");
#endif
    return;
  }

  // --- Streamed TTS: robot speaks the AI reply (TTS_BEGIN/CHUNK/END) ---------
  if (strcmp(cmd, "TTS_BEGIN") == 0) {
#if HAS_SPEAKER
    spkToneFreq = 0; spkPcmPlay = false;   // interrupt any tone/welcome clip
    if (!ensurePcmBuf()) { sendUnsupported("TTS_BEGIN"); return; }  // OOM -> skip, don't crash
#if HAS_MIC
    if (sttShared && sttActive) { sttActive = false; micSttSend = false; }  // same RAM: speech wins
#endif
    // append:true (next sentence of the same reply) keeps playing and queues behind
    // it; anything else starts a fresh take. An append that arrives after the
    // previous sentence already finished simply starts fresh too.
    bool append = (p["append"] | false) && (pcmStreamPlay || pcmStreamRecv);
    if (!append) {
      pcmStopAndWait();
      pcmStreamLen = 0;
      pcmPlayOff = 0;
      pcmStreamSr = ((p["sr"] | 8000) == 16000) ? 16000 : 8000;
      pcmStreamFmt = (strcmp(p["fmt"] | "", "ulaw") == 0) ? 1 : 0;
      // No `sr` = older web build: keep its buffer-then-play behaviour (play on TTS_END).
      long preMs  = p["sr"].isNull() ? 120000L : constrain((long)(p["pre_ms"] | 250), 50L, 120000L);
      pcmPrebuf   = (size_t)((long)pcmStreamSr * preMs / 1000);
    }
    pcmStreamRecv = true;
    lastStatus = "Bicara";
#else
    sendUnsupported("TTS_BEGIN");
#endif
    return;
  }
  if (strcmp(cmd, "TTS_CHUNK") == 0) {
#if HAS_SPEAKER
    if (pcmStreamRecv && pcmStreamBuf) {
      const char* b64 = p["data"] | "";
      size_t avail = pcmStreamCap - pcmStreamLen;
      size_t olen = 0;
      // Overflow is silent-by-design: once the buffer is full we drop the
      // tail rather than reject the whole clip (keeps a long reply partly audible).
      if (avail > 0 &&
          mbedtls_base64_decode(pcmStreamBuf + pcmStreamLen, avail, &olen,
                                (const unsigned char*)b64, strlen(b64)) == 0) {
        pcmStreamLen += olen;
      }
      // Start speaking as soon as a little audio is queued (streaming playback).
      if (!pcmStreamPlay && pcmStreamLen - pcmPlayOff >= pcmPrebufferBytes()) pcmStreamPlay = true;
    }
#else
    sendUnsupported("TTS_CHUNK");
#endif
    return;
  }
  if (strcmp(cmd, "TTS_END") == 0) {
#if HAS_SPEAKER
    pcmEndSeq = p["seq"] | 0;                     // echoed in TTS_DONE so the web knows WHICH end
    pcmStreamRecv = false;
    if (pcmStreamLen > pcmPlayOff) pcmStreamPlay = true;   // audioTask streams it out
    else if (!pcmStreamPlay) pcmDoneNotify = true;         // nothing to play: still answer
#else
    sendUnsupported("TTS_END");
#endif
    return;
  }

  // --- Reporters (sensor blocks) — reply with a TELEMETRY frame ---------------
  // Only sensors this board really has answer; anything else -> UNSUPPORTED.
  if (strcmp(cmd, "GET_SENSOR_DATA") == 0) {
    const char* sensor = p["sensor"] | "";
    const int aux = auxPin(p["port"] | "");
    JsonDocument r;
    r["command"] = "TELEMETRY";
    r["sensor"]  = sensor;
    bool known = true;
    if (false) {
#if HAS_MIC
    } else if (strcmp(sensor, "mic_level") == 0) {
      r["value"] = micLevel;
    } else if (strcmp(sensor, "mic_clap") == 0) {
      r["value"] = micClap ? 1 : 0;
      micClap = false;   // latch cleared on read
#endif
#if HAS_SPEAKER && HAS_MIC
    } else if (strcmp(sensor, "recording") == 0) {
      r["value"] = (recordMs != 0 || sttActive) ? 1 : 0;
#endif
#ifdef PIN_TOUCH1
    } else if (strcmp(sensor, "button1") == 0 || strcmp(sensor, "button2") == 0) {
      r["value"] = touchPressed(sensor[6] == '2' ? 1 : 0) ? 1 : 0;
#endif
    } else if (strcmp(sensor, "analog") == 0 && aux >= 0) {
      r["value"] = analogRead(aux);            // 0..4095 (12-bit ADC1)
    } else if (strcmp(sensor, "digital") == 0 && aux >= 0) {
      pinMode(aux, INPUT);
      r["value"] = digitalRead(aux);
#ifdef PIN_US_TRIG
    } else if (strcmp(sensor, "ultrasonic") == 0) {
      r["value"] = ultrasonicRead(strcmp(p["unit"] | "cm", "inch") == 0);
#endif
    } else {
      known = false;
    }
    if (!known) { sendUnsupported("GET_SENSOR_DATA"); return; }   // sensor not on this board
    sendJson(r);
    return;
  }

  // --- Block: LED color -----------------------------------------------------
  // V3: digital RGB (8-color). Makerkit: WS2812B, full 24-bit, optional `index`
  // (0..3 | "all"). A manual color cancels any running strip effect.
  if (strcmp(cmd, "SET_LED_COLOR") == 0 || strcmp(cmd, "NEOPIXEL_SET") == 0) {
#if HAS_NEOPIXEL
    neoActiveEffect = 0;
    int idx = -1;   // no index -> all pixels
    if (!p["index"].isNull()) {
      if (p["index"].is<int>()) idx = p["index"].as<int>();
      else { const char* s = p["index"].as<const char*>(); if (s && strcmp(s, "all") != 0) idx = atoi(s); }
    }
    neoSetPixel(idx, p["r"] | 0, p["g"] | 0, p["b"] | 0);
    lastStatus = "LED";
#elif HAS_RGB
    setLedColor(p["r"] | 0, p["g"] | 0, p["b"] | 0);
#else
    sendUnsupported(cmd);   // no LED on this board (FIX 4)
#endif
    return;
  }

  // --- Block: NeoPixel effect (Makerkit) ----------------------------------
  if (strcmp(cmd, "NEOPIXEL_EFFECT") == 0) {
#if HAS_NEOPIXEL
    const char* eff = p["effect"] | "off";
    long ms = readDurationMs(p);
    if      (strcmp(eff, "rainbow") == 0) neoActiveEffect = 1;
    else if (strcmp(eff, "chase")   == 0) neoActiveEffect = 2;
    else    { neoActiveEffect = 0; strip.clear(); strip.show(); }
    neoEffectEndsMs = (neoActiveEffect && ms > 0) ? millis() + ms : 0;
    lastStatus = "NeoPixel";
#else
    sendUnsupported("NEOPIXEL_EFFECT");
#endif
    return;
  }

  // --- Block: OLED text — give the screen a name/words --------------------
  if (strcmp(cmd, "DISPLAY_TEXT") == 0) {
    if (oledOk) {
      oledStatus(p["text"] | "", "");   // headline line; reuses the throttled render
    } else {
      sendUnsupported("DISPLAY_TEXT");   // OLED not detected (FIX 4)
    }
    return;
  }

  // --- Blocks: "LCD" text / shape / clear -> the OLED (this kit's display) ---
  // The LCD blocks target a matrix display other kits have; here the 128x64 OLED
  // shows them so the blocks do something instead of UNSUPPORTED.
  if (strcmp(cmd, "LCD_TEXT") == 0 || strcmp(cmd, "LCD_CLEAR") == 0 || strcmp(cmd, "LCD_SHAPE") == 0) {
    if (!oledOk) { sendUnsupported(cmd); return; }
    if (cmd[4] == 'T') { oledStatus(p["text"] | "", ""); return; }   // LCD_TEXT
    if (cmd[4] == 'C') { oledStatus("", ""); return; }               // LCD_CLEAR
    // LCD_SHAPE: 16x8 pixel art (cells 8x8 px on the panel), '1' = lit.
    static const struct { const char* name; const char* px; } SHAPES[] = {
      {"left_arrow",  "0000001000000000" "0000011000000000" "0000111111111100" "0001111111111100"
                      "0001111111111100" "0000111111111100" "0000011000000000" "0000001000000000"},
      {"right_arrow", "0000000001000000" "0000000001100000" "0011111111110000" "0011111111111000"
                      "0011111111111000" "0011111111110000" "0000000001100000" "0000000001000000"},
      {"heart",       "0000110001100000" "0001111011110000" "0001111111110000" "0001111111110000"
                      "0000111111100000" "0000011111000000" "0000001110000000" "0000000100000000"},
      {"smile",       "0000111111100000" "0001000000010000" "0010010001001000" "0010000000001000"
                      "0010100000101000" "0010011111001000" "0001000000010000" "0000111111100000"},
      {"sad",         "0000111111100000" "0001000000010000" "0010010001001000" "0010000000001000"
                      "0010011111001000" "0010100000101000" "0001000000010000" "0000111111100000"},
      {"star",        "0000000100000000" "0000001110000000" "0011111111111000" "0001111111110000"
                      "0000111111100000" "0001111011110000" "0011100000111000" "0010000000001000"},
    };
    const char* shape = p["shape"] | "";
    for (const auto& sh : SHAPES) {
      if (strcmp(shape, sh.name) == 0) {
        oledBmpW = 16; oledBmpH = 8; oledBmp = sh.px;
        oledBitmapMode = true; oledDirty = true; oledPushIfDue();
        return;
      }
    }
    sendUnsupported("LCD_SHAPE");   // unknown shape name
    return;
  }

  // --- Block: OLED brightness (SSD1306 contrast) --------------------------
  // The RGB LED is digital and can't dim, so this drives the ONE dimmable display:
  // the OLED's contrast register (0..255 mapped from 0..100%).
  if (strcmp(cmd, "SET_LED_BRIGHTNESS") == 0) {
    if (!oledOk) { sendUnsupported("SET_LED_BRIGHTNESS"); return; }
    int pct = constrain((int)(p["value"] | 100), 0, 100);
    oled.ssd1306_command(SSD1306_SETCONTRAST);
    oled.ssd1306_command((uint8_t)(pct * 255 / 100));
    lastStatus = "Terang";
    return;
  }

  // --- OLED pixel-art bitmap (from the web pixel editor) -------------------
  if (strcmp(cmd, "DISPLAY_BITMAP") == 0) {
    if (!oledOk) { sendUnsupported("DISPLAY_BITMAP"); return; }
    int w = p["w"] | 0;
    int h = p["h"] | 0;
    const char* px = p["pixels"] | "";
    if (w > 0 && h > 0 && w <= OLED_WIDTH && h <= OLED_HEIGHT && (int)strlen(px) >= w * h) {
      oledBmpW = w;
      oledBmpH = h;
      oledBmp = px;
      oledBitmapMode = true;
      oledDirty = true;
      oledPushIfDue();
    }
    return;
  }

  // --- Drive: live tank (Joystick-style, no deadline) ----------------------
  // Continuous control: the web keeps sending; the heartbeat watchdog is the net.
  if (strcmp(cmd, "DRIVE_DIRECT") == 0) {
    int left  = constrain((int)(p["left"]  | 0), -100, 100);
    int right = constrain((int)(p["right"] | 0), -100, 100);
    driveChannel(0, left);
    driveChannel(1, right);
    lastRxMs = millis();      // live continuous — no motionEndsAtMs deadline
    lastStatus = "Drive";
    return;
  }

  // --- Emergency stop: cut actuators AND any sound now ---------------------
  if (strcmp(cmd, "ESTOP") == 0) {
    stopAllActuators();
#if HAS_SPEAKER
    spkStop = true;
#endif
    lastStatus = "STOP";
    return;
  }

  // --- Gripper: aux positional servo open(0)/closed(180) -------------------
  if (strcmp(cmd, "SET_GRIPPER") == 0) {
#if HAS_SERVO_AUX
    const char* state = p["state"] | "closed";
    servoWriteAngle(SERVO_AUX_CH, strcmp(state, "open") == 0 ? 0 : 180);
    lastStatus = "Gripper";
#else
    sendUnsupported("SET_GRIPPER");
#endif
    return;
  }

  // --- Claw timed: drive the aux servo toward a direction ------------------
  if (strcmp(cmd, "CLAW_TIMED") == 0) {
#if HAS_SERVO_AUX
    const char* dir = p["direction"] | "open";
    bool opening = strstr(dir, "open") || strstr(dir, "up");
    servoWriteAngle(SERVO_AUX_CH, opening ? 0 : 180);
    long ms = readDurationMs(p);
    if (ms > 0) motionEndsAtMs = millis() + ms;   // safety deadline (aux holds)
    lastStatus = "Claw";
#else
    sendUnsupported("CLAW_TIMED");
#endif
    return;
  }

  // --- Volume: scale synthesized tone + TTS playback (0..100) --------------
  if (strcmp(cmd, "SET_VOLUME") == 0) {
#if HAS_SPEAKER
    spkVolume = constrain((int)(p["value"] | 100), 0, 100);
    lastStatus = "Volume";
#else
    sendUnsupported("SET_VOLUME");
#endif
    return;
  }

  // --- Stop all sounds: speaker + buzzer -----------------------------------
  if (strcmp(cmd, "STOP_SOUNDS") == 0) {
#if HAS_SPEAKER
    spkStop = true;
#endif
    buzzerOff();
    return;
  }

  // --- Sound effect: a few named buzzer tones ------------------------------
  if (strcmp(cmd, "PLAY_SOUND_EFFECT") == 0) {
    const char* effect = p["effect"] | "";
    if      (strcmp(effect, "beep")  == 0) buzzerTone(880, 120);
    else if (strcmp(effect, "chirp") == 0) buzzerTone(1320, 100);
    else if (strcmp(effect, "alarm") == 0) buzzerTone(600, 300);
    else                                   buzzerTone(1000, 120);
    lastStatus = "Efek";
    return;
  }

  // --- Music tempo: store BPM (advisory; see musicBpm) ---------------------
  if (strcmp(cmd, "SET_BPM") == 0) {
    musicBpm = constrain((int)(p["bpm"] | 120), 40, 300);
    lastStatus = "BPM";
    return;
  }

  // --- Voice memo: record into the shared buffer (single slot) -------------
  if (strcmp(cmd, "RECORD_AUDIO") == 0) {
#if HAS_SPEAKER && HAS_MIC
    if (ensurePcmBuf()) {
      int secs = constrain((int)(p["secs"] | 1), 1, 4);   // cap at the 4 s buffer
      recordLen = 0;
      recordMs  = millis() + (unsigned long)secs * 1000;  // micTask fills the buffer
      lastStatus = "Rekam";
    }
#endif
    return;   // ACK by silence — never UNSUPPORTED
  }

  // --- Voice input: record mic then stream it to the web for STT (Whisper) ---
  // New web: {secs, sr: 16000|8000, bits: 16|8, vad}. A bare {secs} (older web build)
  // gets the old wire format (8 kHz u8, fixed window) so it keeps working.
  if (strcmp(cmd, "MIC_STT") == 0) {
#if HAS_SPEAKER && HAS_MIC
    if (!sttBuf && psramFound()) {
      sttBuf = (int16_t*)ps_malloc(MIC_STT_CAP_PSRAM);
      sttCap = sttBuf ? MIC_STT_CAP_PSRAM / 2 : 0;
    }
    if (!sttBuf && ensurePcmBuf()) {            // no PSRAM: borrow the TTS buffer
      sttBuf = (int16_t*)pcmStreamBuf;
      sttCap = pcmStreamCap / 2;
      sttShared = true;
    }
    if (sttBuf) {
      if (sttShared) { pcmStopAndWait(); pcmStreamRecv = false; }
      const bool legacy = p["sr"].isNull();
      sttSr   = (!legacy && (p["sr"] | 16000) == 16000) ? 16000 : 8000;
      sttBits = (!legacy && (p["bits"] | 16) == 16) ? 16 : 8;
      sttVad  = !legacy && (p["vad"] | true);
      int secs = constrain((int)(p["secs"] | 3), 1, legacy ? 4 : 10);
      sttLen    = 0;
      sttSpeech = false;
      sttEndMs  = millis() + (unsigned long)secs * 1000;
      sttActive = true;                          // micTask fills sttBuf
      micSttSend = true;                         // loop() streams it when the take ends
      lastStatus = "Dengar";
    }
#endif
    return;
  }

  // --- Voice input: end the current take now (push-to-talk release / cancel) ---
  if (strcmp(cmd, "MIC_STOP") == 0) {
#if HAS_SPEAKER && HAS_MIC
    sttActive = false;                           // loop() sends what was captured
#endif
    return;
  }

  // --- Voice memo: play the last recording back ----------------------------
  if (strcmp(cmd, "PLAY_RECORDING") == 0) {
#if HAS_SPEAKER && HAS_MIC
    if (pcmStreamBuf && recordLen > 0) {
      pcmStopAndWait();
      pcmStreamSr   = 8000;         // memo is captured at 8 kHz u8
      pcmStreamFmt  = 0;
      pcmPlayOff    = 0;
      pcmStreamRecv = false;
      pcmStreamLen  = recordLen;    // hand the capture to the TTS playback path
      pcmStreamPlay = true;
      lastStatus = "Putar";
    }
#endif
    return;
  }

  // --- Generic PWM output on a web port ------------------------------------
  if (strcmp(cmd, "SET_ANALOG") == 0) {
    int pin = portPwmPin(p["port"] | "");
    if (pin < 0) pin = auxPin(p["port"] | "");   // G1..G6 = AUX_I/O header
    if (pin >= 0) {
      int value = constrain((int)(p["value"] | 0), 0, 255);
      analogWrite(pin, value);
      lastStatus = "Analog";
    }
    return;   // unknown/unwired port -> skip, no UNSUPPORTED
  }

  // --- Generic digital output on a web port --------------------------------
  if (strcmp(cmd, "SET_DIGITAL") == 0) {
    int pin = portPwmPin(p["port"] | "");
    if (pin < 0) pin = auxPin(p["port"] | "");   // G1..G6 = AUX_I/O header
    if (pin >= 0) {
      bool on;
      if (p["value"].is<const char*>()) {
        const char* v = p["value"].as<const char*>();
        on = (strcmp(v, "high") == 0 || strcmp(v, "1") == 0 || strcmp(v, "on") == 0);
      } else {
        on = (p["value"] | 0) != 0;
      }
      pinMode(pin, OUTPUT);
      digitalWrite(pin, on ? HIGH : LOW);
      lastStatus = "Digital";
    }
    return;
  }

  // --- Sensor origin resets: no fw-side sensor state -> ACK no-op ----------
  if (strcmp(cmd, "RESET_DISTANCE") == 0 || strcmp(cmd, "RESET_HEADING") == 0) {
    JsonDocument ack;
    ack["command"] = "ACK";
    ack["op"] = cmd;
    sendJson(ack);
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

  if (line.startsWith("SET_RELAY")) { handleSetRelay(line); return; }   // relay provisioning

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
    // Overflow guard. Must fit the largest command: DISPLAY_BITMAP carries a full
    // 128x64 = 8192-char pixel string (+ JSON wrapper), so allow ~9000. Anything
    // bigger is genuinely malformed -> drop it.
    if (buffer.length() > 9000) buffer = "";
  }
}

// =================================================================== BLE
class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* server) override {
    (void)server;
    bleConnected = true;
    lastRxMs = millis();
    setLedColor(0, 255, 0);   // #2: green RGB = "BLE connected" (V3 discrete LED)
#if HAS_NEOPIXEL
    neoActiveEffect = 0;              // #2: makerkit has no discrete RGB — light the
    neoSetPixel(-1, 0, 255, 0);       //     4 WS2812B NeoPixels green instead
#endif
    buzzerTone(1320, 140);    // #7: chirp on BLE connect too (USB only beeped because
                              //     plugging in resets the board -> startup tone)
    // NOTE: a loud speaker self-test blip USED to fire here, but on USB the
    // NeoPixel + buzzer + speaker current spike browned the board out at connect
    // -> reset -> reconnect loop ("putus-nyambung"). Removed: real TTS playback
    // exercises the speaker now, so the blip was redundant. The buzzer chirp above
    // (low current) still gives an audible "connected" cue.
  }
  void onDisconnect(NimBLEServer* server) override {
    bleConnected = false;
    bleMtu = 23;
    helloPending = false;        // BUG B: drop any un-sent deferred HELLO_ACK
    stopAllActuators();          // failsafe on link loss
#if HAS_SPEAKER
    pcmStreamRecv = false;       // drop any half-received TTS clip
    pcmStreamPlay = false;       // and stop the robot mid-sentence on link loss
#endif
    watchdogArmed = false;       // disarm until the next HELLO (FIX 6)
    setLedColor(0, 0, 0);        // #2: BLE indicator off when disconnected
#if HAS_NEOPIXEL
    neoActiveEffect = 0;
    neoSetPixel(-1, 0, 0, 0);     // makerkit: NeoPixels off on disconnect
#endif
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
// ---- WiFi + WebSocket (Phase 1) --------------------------------------------
// WS frames carry the SAME ';'-terminated JSON as BLE/Serial, so we just pump bytes
// through the shared feed()/handleCommand parser. Replies go out via sendTelemetry
// (which now also broadcasts to WS clients).
void onWsEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t len) {
  (void)num;
  if (type == WStype_CONNECTED) { if (wsClients < 255) wsClients++; }
  else if (type == WStype_DISCONNECTED) { if (wsClients) wsClients--; }
  else if (type == WStype_TEXT) {
    lastRxMs = millis();                       // WS traffic keeps the watchdog happy
    for (size_t i = 0; i < len; i++) feed(wsBuffer, (char)payload[i], false);
  }
}

bool startWiFiSTA(const String& ssid, const String& pass) {
  if (ssid.length() == 0) return false;
  if (WiFi.getMode() == WIFI_OFF) {
    Serial.println("[wifi] initialising radio...");
    WiFi.mode(WIFI_STA);
    // Default 19.5 dBm TX peaks draw enough to drop a weak USB port / power bank.
    WiFi.setTxPower(WIFI_POWER_11dBm);
    // Start WS server now that lwIP is up (deferred from setupWiFi on fresh boot).
    wsServer.begin();
    wsServer.onEvent(onWsEvent);
  }
  WiFi.setAutoReconnect(true);                 // re-associate on its own after a drop
  WiFi.begin(ssid.c_str(), pass.c_str());      // non-blocking; loop() reports when up
  wifiOn = true;
  wifiUp = false;
  wifiStartMs = millis();
  return true;
}

void setupWiFi() {
  // Read saved creds from NVS. begin() returns false on a fresh/erased NVS
  // (namespace doesn't exist yet) — guard so getString/end don't touch a
  // bad handle and silently hang or crash.
  String ssid, pass;
  bool lastStartReset = false;
  if (wifiPrefs.begin("robotku", false)) {
    ssid = wifiPrefs.getString("ssid", "");
    pass = wifiPrefs.getString("pass", "");
    lastStartReset = wifiPrefs.getBool("wifiTry", false);
    if (lastStartReset) wifiPrefs.putBool("wifiTry", false);   // retry on the boot after this one
    wifiPrefs.end();
  } else {
    Serial.println("[wifi] no saved creds (fresh NVS) — skipping WiFi");
  }

  // Only bring up WiFi + WebSocket server when we actually have creds to connect.
  // WiFi.mode(WIFI_STA) can block for seconds on fresh NVS / no RF cal data, and
  // wsServer.begin() needs lwIP which only inits after WiFi.mode(). If no creds,
  // skip entirely — BLE/Serial work fine, and SET_WIFI will start WiFi on demand.
  // Starting the radio here (with BLE already up) hung or browned out the S3 before
  // READY on 28 Nov 2026: OLED stuck on the splash, BLE dropped during discovery.
  // loop() starts it WIFI_BOOT_DELAY_MS after boot, so BLE/USB are usable first.
  if (ssid.length() && lastStartReset) {
    Serial.println("[wifi] last radio start reset the board — WiFi skipped this boot (SET_WIFI to retry)");
  } else if (ssid.length()) {
    wifiBootSsid = ssid;
    wifiBootPass = pass;
    Serial.println("[wifi] saved creds — radio starts from loop() after READY");
  } else {
    Serial.println("[wifi] no creds — WiFi+WS deferred until SET_WIFI");
  }
}

void setup() {
  // Default UART RX buffer is 256 B = ~22 ms at 115200 baud; one OLED refresh is ~30 ms,
  // so streamed TTS over USB lost bytes -> broken TTS_BEGIN/CHUNK/END -> silent or cut
  // replies (measured: 2 of 4 test takes). 16 KB rides out any loop() hiccup.
  Serial.setRxBufferSize(16384);   // must come before begin()
  Serial.begin(115200);

  // Servos (ESP32Servo) get the FULL 4-timer LEDC pool — the exact config proven
  // reliable on hardware by the pure servo-sweep sketch. Sharing ANY timer with the
  // buzzer made the servo hum/stall intermittently, so the buzzer is disabled for
  // now (see buzzerTone/buzzerOff) — servo drive is the priority; the buzzer is not
  // a reported defect and will be re-added on a dedicated non-LEDC path later.
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  // Servos (ESP32Servo): 50 Hz SG90. We do NOT attach here — a channel attaches
  // lazily on its first real drive and detaches at idle / on "cabut", so a bench
  // board and a released joystick emit NO servo signal and cannot creep. Park the
  // pins LOW now so they don't float (and twitch a servo) before the first drive.
  pinMode(PIN_SERVO_L, OUTPUT); digitalWrite(PIN_SERVO_L, LOW);
  if (HAS_SERVO_R)   { pinMode(PIN_SERVO_R, OUTPUT);   digitalWrite(PIN_SERVO_R, LOW); }
  if (HAS_SERVO_AUX) { pinMode(PIN_SERVO_AUX, OUTPUT); digitalWrite(PIN_SERVO_AUX, LOW); }
  stopAllActuators();   // clears any deadline; channels already detached

  // Passive buzzer on a GENERAL-PURPOSE hardware timer (timer 0, prescaler 80 ->
  // 1 MHz tick). NOT LEDC, so it cannot disturb the servos. The ISR toggles the pin;
  // buzzerTone() sets the alarm half-period. Silent until the first tone.
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
  buzzerTimer = timerBegin(0, 80, true);
  timerAttachInterrupt(buzzerTimer, &buzzerISR, true);

#if HAS_RGB
  pinMode(PIN_LED_R, OUTPUT);
  pinMode(PIN_LED_G, OUTPUT);
  pinMode(PIN_LED_B, OUTPUT);
  setLedColor(0, 0, 0);   // start dark
#endif

#if HAS_NEOPIXEL
  strip.begin();
  strip.setBrightness(60);   // 0-255; keep modest so 4 LEDs don't brown out USB
  strip.clear();
  strip.show();              // start dark
#endif

#ifdef PIN_TOUCH1
  touchInit();                       // pads must be untouched at boot (baseline)
#endif
#ifdef PIN_US_TRIG
  pinMode(PIN_US_TRIG, OUTPUT);
  digitalWrite(PIN_US_TRIG, LOW);
  pinMode(PIN_US_ECHO, INPUT_PULLDOWN); // no sensor -> reads LOW -> "-1", not noise
#endif
#if HAS_SPEAKER
  ulawInit();
  i2sSpeakerInit();
  // Audio runs on core 0 (Arduino loop() is core 1) so i2s_write can't stall the
  // command path. Only start the streamer if the I2S driver actually installed.
  if (spkReady) xTaskCreatePinnedToCore(audioTask, "audio", 4096, NULL, 1, NULL, 0);
#endif

#if HAS_MIC
  i2sMicInit();
  if (micReady) xTaskCreatePinnedToCore(micTask, "mic", 4096, NULL, 1, NULL, 0);
#endif

  // OLED
  Serial.println("[boot] OLED init...");
  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  oledOk = oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  Serial.printf("[boot] OLED %s\n", oledOk ? "OK" : "FAIL");
  if (oledOk) oledSplash();

  Serial.println("[boot] startupTone...");
  startupTone();                  // "robot hidup" cue (delay() ok in setup)

  Serial.println("[boot] BLE init...");
  setupBle();
  Serial.println("[boot] WiFi init...");
  setupWiFi();   // Phase 1: WS server + auto-join saved WiFi (if any)
  setupRelay();  // relay client: load NVS id/secret, connect when WiFi up

  Serial.println("[boot] READY");
  oledStatus("Siap", "USB / Bluetooth");
}

// ==================================================================== LOOP
void loop() {
  // 1) Drain USB serial.
  while (Serial.available() > 0) feed(serialBuffer, (char)Serial.read(), true);

  if (wifiBootSsid.length() && millis() > WIFI_BOOT_DELAY_MS) {
    Serial.println("[wifi] starting radio (deferred from setup)");
    wifiPrefs.begin("robotku", false); wifiPrefs.putBool("wifiTry", true); wifiPrefs.end();
    wifiTryMs = millis();
    startWiFiSTA(wifiBootSsid, wifiBootPass);
    wifiBootSsid = ""; wifiBootPass = "";
  }

  if (wifiTryMs && millis() - wifiTryMs > WIFI_SURVIVE_MS) {
    wifiPrefs.begin("robotku", false); wifiPrefs.putBool("wifiTry", false); wifiPrefs.end();
    wifiTryMs = 0;
  }

  loopRelay();   // relay client (self-gates on relayEnabled + WiFi up)

#if HAS_SPEAKER && HAS_MIC
  // After a MIC_STT take ends (VAD / MIC_STOP / timer), stream it to the web as base64
  // MIC_DATA chunks + MIC_END {sr, bits, speech} (web wraps WAV -> Whisper /stt -> chat).
  if (micSttSend && !sttActive) {
    micSttSend = false;
    const size_t n = sttLen;
    const bool b16 = (sttBits == 16);
    // Auto gain: lift the take so its peak sits near -3 dBFS (max x32, so a silent
    // take isn't blown up into hiss). Quiet speech otherwise reached Whisper too low.
    int peak = 0;
    for (size_t i = 0; i < n; i++) { int a = abs((int)sttBuf[i]); if (a > peak) peak = a; }
    int gainQ8 = peak > 0 ? (int)min(32L * 256, (24000L * 256) / peak) : 256;
    if (gainQ8 < 256) gainQ8 = 256;
    static uint8_t raw[2400];
    static unsigned char b64[3300];
    size_t i = 0, bytes = 0; int seq = 0;
    while (i < n) {
      size_t m = 0;
      while (i < n && m + 2 <= sizeof(raw)) {
        // NOTE: constrain() is a macro that evaluates its argument up to 3x — never
        // put i++ inside it (that skipped 2 of every 3 samples: 3x-speed audio).
        int v = ((int)sttBuf[i++] * gainQ8) >> 8;
        v = constrain(v, -32768, 32767);
        if (b16) { raw[m++] = (uint8_t)(v & 0xff); raw[m++] = (uint8_t)((v >> 8) & 0xff); }
        else     { raw[m++] = (uint8_t)((v >> 8) + 128); }
      }
      size_t olen = 0;
      if (mbedtls_base64_encode(b64, sizeof(b64), &olen, raw, m) == 0) {
        b64[olen] = 0;
        JsonDocument d;
        d["command"] = "MIC_DATA";
        d["params"]["seq"]  = seq++;
        d["params"]["data"] = (const char*)b64;
        sendJson(d);
      }
      bytes += m;
      delay(2);   // let the WiFi/relay socket drain between ~3 KB frames
    }
    JsonDocument e;
    e["command"] = "MIC_END";
    e["params"]["len"]    = (int)bytes;
    e["params"]["sr"]     = (int)sttSr;
    e["params"]["bits"]   = (int)sttBits;
    e["params"]["speech"] = (bool)sttSpeech;
    sendJson(e);
    lastStatus = "Siap";
  }
#endif

#if HAS_SPEAKER
  // Tell the web the robot finished speaking (it waits for this before listening
  // again, so the mic never records the robot's own voice in conversation mode).
  if (pcmDoneNotify) {
    pcmDoneNotify = false;
    JsonDocument d;
    d["command"] = "TTS_DONE";
    d["params"]["seq"] = (int)pcmEndSeq;
    sendJson(d);
  }
#endif

  // 1a) WiFi/WebSocket servicing (Phase 1). Pump the WS server and report once the
  // STA associates (so the web learns the robot's IP for the WiFi transport).
  if (wifiOn) {
    wsServer.loop();
    bool up = (WiFi.status() == WL_CONNECTED);
    if (up && !wifiUp) {
      wifiUp = true;
      wifiStartMs = 0;          // BUG FIX: connected -> stop the boot-timeout clock.
                                // Leaving it set made the FIRST later drop trip the
                                // timeout instantly and kill WiFi until a power cycle.
      MDNS.begin("robotku");                   // http://robotku.local, ws://robotku.local:81
      JsonDocument r;
      r["command"]  = "WIFI_STATUS";
      r["connected"] = true;
      r["ip"]       = WiFi.localIP().toString();
      r["wsPort"]   = 81;
      sendJson(r);
    } else if (!up && wifiUp) {
      wifiUp = false;
      Serial.println("[wifi] link lost — auto-reconnecting");
      oledStatus("WiFi putus", "menyambung ulang");
    }
    // Slow router / DHCP at boot: after WIFI_TIMEOUT_MS just TELL the user BLE/USB is
    // available. Never WiFi.disconnect(true) — the radio keeps retrying in the
    // background (setAutoReconnect), so the relay comes back by itself.
    if (!wifiUp && wifiStartMs && (millis() - wifiStartMs > WIFI_TIMEOUT_MS)) {
      Serial.println("[wifi] still not connected — BLE/USB usable, WiFi keeps retrying");
      wifiStartMs = 0;          // report once
      oledStatus("Siap", "BLE / USB");
    }
  }

  // 1b) Deferred HELLO_ACK (BUG B): send once the MTU is negotiated (>23), or
  // immediately for the serial path (no MTU) / after a short grace. This keeps the
  // 621-byte ack OFF the onWrite host-task, so it never fires ~32 notifies at the
  // default MTU 23 (the storm that dropped the tail -> connect loop).
  if (helloPending && (!bleConnected || bleMtu > 23 || (long)(millis() - helloRxMs) > 150)) {
    sendHelloAck();
    helloPending = false;
  }

  // 2) Non-blocking motion deadline (FIX 3): stop when a timed move expires.
  if (motionEndsAtMs != 0 && (long)(millis() - motionEndsAtMs) >= 0) {
    stopAllActuators();           // also clears motionEndsAtMs
    lastStatus = "Selesai";
    oledStatus("Selesai", "menunggu perintah");
  }

  // 2b) Non-blocking buzzer deadline: silence the tone when its duration expires.
  if (buzzerOffMs != 0 && (long)(millis() - buzzerOffMs) >= 0) buzzerOff();

#if HAS_NEOPIXEL
  // 2c) Step any running WS2812B effect (non-blocking; clears at its deadline).
  neoTick();
#endif

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
