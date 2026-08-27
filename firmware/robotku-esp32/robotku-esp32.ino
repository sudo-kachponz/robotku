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

// ============================================================ ACTUATOR API
// One continuous-servo channel. value in [-100,100]: + = forward for that side
// AFTER invert is applied, 0 = stop (with trim), - = reverse.
void driveChannel(int ch, int value) {
  value = constrain(value, -100, 100);
  int trim;
  bool invert;
  Servo* s;
  if (ch == 0) { s = &servoL; invert = false;              trim = SERVO_L_TRIM; }
  else         { s = &servoR; invert = (SERVO_R_INVERT != 0); trim = SERVO_R_TRIM; }

  int eff = invert ? -value : value;
  // Continuous SG90: 90 = stop, ±90 span. Trim nudges the neutral point.
  int angle = SERVO_STOP_DEG + trim + (eff * 90) / 100;
  s->write(constrain(angle, 0, 180));
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
void oledStatus(const String& line1, const String& line2) {
  if (!oledOk) return;
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(2);
  oled.setCursor(0, 0);
  oled.println(F("Robotku"));
  oled.setTextSize(1);
  oled.setCursor(0, 22);
  oled.println(line1);
  oled.setCursor(0, 36);
  oled.println(line2);
  oled.display();
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
    caps.add("TURN_TIMED");
    caps.add("WAIT");
    caps.add("PLAY_TONE");
    JsonArray ports = ack["ports"].to<JsonArray>();
    ports.add(1);
    ports.add(2);                 // only the ports that are really wired
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

// Feed raw bytes into a per-interface buffer, dispatch on ';' or newline.
void feed(String& buffer, char c) {
  if (c == ';' || c == '\n') {
    String line = buffer;
    line.trim();
    buffer = "";
    if (line.length() > 0) handleCommand(line);
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
    for (char c : data) feed(bleBuffer, c);
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
  servoR.setPeriodHertz(50);
  servoL.attach(PIN_SERVO_L, SERVO_MIN_US, SERVO_MAX_US);
  servoR.attach(PIN_SERVO_R, SERVO_MIN_US, SERVO_MAX_US);
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
  while (Serial.available() > 0) feed(serialBuffer, (char)Serial.read());

  // 2) Non-blocking motion deadline (FIX 3): stop when a timed move expires.
  if (motionEndsAtMs != 0 && (long)(millis() - motionEndsAtMs) >= 0) {
    stopAllActuators();           // also clears motionEndsAtMs
    lastStatus = "Selesai";
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
}
