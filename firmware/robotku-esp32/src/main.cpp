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
