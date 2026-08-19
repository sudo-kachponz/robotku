/* ============================================================================
 * Robotku ESP32 Firmware — resident command interpreter
 * ----------------------------------------------------------------------------
 * Talks the SAME line-delimited JSON protocol as the Robotku web app, over BOTH:
 *   - BLE Nordic UART Service (NUS)   -> Web Bluetooth
 *   - USB Serial @ 115200             -> Web Serial
 *
 * The web app STREAMS commands here; we interpret them live (Stick'em style).
 * There is no compile/flash on Run.
 *
 * Wire contract (one command per ';'):
 *   {"command":"DRIVE_DIRECT","left":80,"right":80};{"command":"WAIT","ms":500};
 *
 * Dependencies (Arduino Library Manager):
 *   - NimBLE-Arduino   (h2zero)     -- lightweight BLE stack
 *   - ArduinoJson      (bblanchon)  -- JSON parsing
 *
 * Board: any ESP32 dev board. Select it in Tools > Board before uploading.
 * ============================================================================
 */

#include <NimBLEDevice.h>
#include <ArduinoJson.h>

// ------------------------------------------------------------------ Identity
#define FW_VERSION   "1.0.0"
#define BOARD_NAME   "Robotku ESP32"
#define PROTOCOL_ID  "robotku-v1"
#define BLE_NAME     "Robotku"

// -------------------------------------------------------------- NUS UUIDs
// MUST match src/transport/BleTransport.ts exactly.
#define NUS_SERVICE_UUID  "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define NUS_RX_CHAR_UUID  "6e400002-b5a3-f393-e0a9-e50e24dcca9e"  // web writes here
#define NUS_TX_CHAR_UUID  "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // we notify here

// ----------------------------------------------------------- Pin mapping
// TODO: adjust these GPIOs to match your motor driver / servo wiring.
// Example assumes a dual H-bridge (e.g. TB6612/L298) with PWM speed control.
const int PIN_MOTOR_L_IN1 = 25;   // TODO: left motor direction A
const int PIN_MOTOR_L_IN2 = 26;   // TODO: left motor direction B
const int PIN_MOTOR_L_PWM = 27;   // TODO: left motor PWM (enable)
const int PIN_MOTOR_R_IN1 = 32;   // TODO: right motor direction A
const int PIN_MOTOR_R_IN2 = 33;   // TODO: right motor direction B
const int PIN_MOTOR_R_PWM = 14;   // TODO: right motor PWM (enable)

const int PIN_SERVO_HEAD    = 13; // TODO: head servo signal
const int PIN_SERVO_GRIPPER = 12; // TODO: gripper servo signal

const int PIN_LED = 2;            // TODO: onboard/status LED (or NeoPixel data)

// LEDC (ESP32 PWM) config for motor speed.
const int LEDC_FREQ = 20000;      // 20 kHz -> silent
const int LEDC_RES  = 8;          // 8-bit duty (0..255)
const int LEDC_CH_L = 0;
const int LEDC_CH_R = 1;

// ----------------------------------------------------- Heartbeat watchdog
const unsigned long HEARTBEAT_TIMEOUT_MS = 1000; // no HEARTBEAT for 1s -> failsafe
unsigned long lastHeartbeatMs = 0;
bool failsafeEngaged = false;

// --------------------------------------------------------------- BLE state
NimBLECharacteristic* txChar = nullptr;
bool bleConnected = false;

// Inbound line buffers (one per interface; both feed the same parser).
String bleBuffer = "";
String serialBuffer = "";

// ============================================================ ACTUATOR API
// Abstract the hardware behind these two functions so the opcode switch stays
// clean and portable to different chassis.

// drive(left,right): values in [-100, 100]. Negative = reverse.
void drive(int left, int right) {
  left  = constrain(left,  -100, 100);
  right = constrain(right, -100, 100);

  // Left motor
  digitalWrite(PIN_MOTOR_L_IN1, left >= 0 ? HIGH : LOW);
  digitalWrite(PIN_MOTOR_L_IN2, left >= 0 ? LOW  : HIGH);
  ledcWrite(LEDC_CH_L, map(abs(left), 0, 100, 0, 255));

  // Right motor
  digitalWrite(PIN_MOTOR_R_IN1, right >= 0 ? HIGH : LOW);
  digitalWrite(PIN_MOTOR_R_IN2, right >= 0 ? LOW  : HIGH);
  ledcWrite(LEDC_CH_R, map(abs(right), 0, 100, 0, 255));
}

// setServo(pin,val): val in [0,180] degrees. Simple software mapping.
// TODO: replace with ESP32Servo library for smooth control if desired.
void setServo(int pin, int val) {
  val = constrain(val, 0, 180);
  // Placeholder: pulse-width would be generated here.
  // For now we just record intent; wire ESP32Servo for real motion.
  (void)pin;
  (void)val;
}

void stopAllActuators() {
  drive(0, 0);
  ledcWrite(LEDC_CH_L, 0);
  ledcWrite(LEDC_CH_R, 0);
}

void setLed(uint8_t r, uint8_t g, uint8_t b) {
  // Minimal: turn LED on if any channel is non-zero.
  // TODO: drive a NeoPixel/RGB LED for true colour.
  digitalWrite(PIN_LED, (r || g || b) ? HIGH : LOW);
}

// =============================================================== TELEMETRY
// Send a line back to the web app over whichever links are active.
void sendTelemetry(const String& line) {
  if (bleConnected && txChar) {
    // Chunk to <=180 bytes to be safe on default MTU.
    const size_t maxChunk = 180;
    for (size_t i = 0; i < line.length(); i += maxChunk) {
      String chunk = line.substring(i, i + maxChunk);
      txChar->setValue((uint8_t*)chunk.c_str(), chunk.length());
      txChar->notify();
    }
  }
  Serial.print(line); // also mirror to USB serial
}

void sendJson(JsonDocument& doc) {
  String out;
  serializeJson(doc, out);
  out += ";";
  sendTelemetry(out);
}

// =========================================================== COMMAND PARSER
void handleCommand(const String& jsonLine) {
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, jsonLine);
  if (err) {
    return; // ignore malformed fragment
  }

  const char* cmd = doc["command"] | "";

  // --- System / handshake -------------------------------------------------
  if (strcmp(cmd, "HELLO") == 0) {
    StaticJsonDocument<256> ack;
    ack["command"] = "HELLO_ACK";
    ack["fw"] = FW_VERSION;
    ack["board"] = BOARD_NAME;
    ack["protocol"] = PROTOCOL_ID;
    JsonArray caps = ack.createNestedArray("capabilities");
    caps.add("DRIVE_DIRECT");
    caps.add("MOVE_TIMED");
    caps.add("TURN_TIMED");
    caps.add("SET_HEAD_POSITION");
    caps.add("SET_GRIPPER");
    caps.add("SET_LED_COLOR");
    caps.add("DISPLAY_ICON");
    caps.add("PLAY_INTERNAL_SOUND");
    caps.add("GET_SENSOR_DATA");
    sendJson(ack);
    lastHeartbeatMs = millis(); // treat HELLO as liveness
    failsafeEngaged = false;
    return;
  }

  if (strcmp(cmd, "HEARTBEAT") == 0) {
    lastHeartbeatMs = millis();
    failsafeEngaged = false;
    StaticJsonDocument<64> ack;
    ack["command"] = "ACK";
    ack["seq"] = doc["seq"] | 0;
    sendJson(ack);
    return;
  }

  if (strcmp(cmd, "ESTOP") == 0) {
    stopAllActuators();
    return;
  }

  // --- Drive --------------------------------------------------------------
  if (strcmp(cmd, "DRIVE_DIRECT") == 0) {
    drive(doc["left"] | 0, doc["right"] | 0);
    return;
  }

  if (strcmp(cmd, "MOVE_TIMED") == 0) {
    int speed = doc["speed"] | 60;
    int ms    = doc["ms"] | doc["duration"] | 500;
    drive(speed, speed);
    delay(ms);           // blocking is fine: commands are streamed sequentially
    drive(0, 0);
    return;
  }

  if (strcmp(cmd, "TURN_TIMED") == 0) {
    int speed = doc["speed"] | 60;
    int ms    = doc["ms"] | doc["duration"] | 500;
    // Positive speed = turn right (left forward, right reverse).
    drive(speed, -speed);
    delay(ms);
    drive(0, 0);
    return;
  }

  if (strcmp(cmd, "WAIT") == 0) {
    delay(doc["ms"] | doc["duration"] | 0);
    return;
  }

  // --- Head & gripper -----------------------------------------------------
  if (strcmp(cmd, "SET_HEAD_POSITION") == 0) {
    setServo(PIN_SERVO_HEAD, doc["position"] | doc["angle"] | 90);
    return;
  }

  if (strcmp(cmd, "SET_GRIPPER") == 0) {
    // position 0..100 -> 0..180 deg
    int pos = doc["position"] | 0;
    setServo(PIN_SERVO_GRIPPER, map(constrain(pos, 0, 100), 0, 100, 0, 180));
    return;
  }

  // --- Looks --------------------------------------------------------------
  if (strcmp(cmd, "SET_LED_COLOR") == 0) {
    // Accept {"color":"#RRGGBB"} or {"r":,"g":,"b":}
    if (doc.containsKey("color")) {
      const char* hex = doc["color"];
      long v = strtol(hex[0] == '#' ? hex + 1 : hex, nullptr, 16);
      setLed((v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF);
    } else {
      setLed(doc["r"] | 0, doc["g"] | 0, doc["b"] | 0);
    }
    return;
  }

  if (strcmp(cmd, "DISPLAY_ICON") == 0) {
    // TODO: render doc["icon"] on an attached display/LED matrix.
    return;
  }

  // --- Sound --------------------------------------------------------------
  if (strcmp(cmd, "PLAY_INTERNAL_SOUND") == 0) {
    // TODO: play doc["sound"] via buzzer/DAC.
    return;
  }

  // --- Sensors ------------------------------------------------------------
  if (strcmp(cmd, "GET_SENSOR_DATA") == 0) {
    StaticJsonDocument<128> resp;
    resp["command"] = "SENSOR_DATA";
    resp["sensor"]  = doc["sensor"] | "distance";
    resp["value"]   = 0; // TODO: read real sensor
    sendJson(resp);
    return;
  }

  // Unknown command: ignore silently (forward-compatible).
}

// Feed raw bytes into a per-interface buffer, dispatch on ';'.
void feed(String& buffer, char c) {
  if (c == ';' || c == '\n') {
    String line = buffer;
    line.trim();
    buffer = "";
    if (line.length() > 0) handleCommand(line);
  } else {
    buffer += c;
    if (buffer.length() > 600) buffer = ""; // overflow guard
  }
}

// =================================================================== BLE
class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* server) override {
    (void)server;
    bleConnected = true;
    lastHeartbeatMs = millis();
  }
  void onDisconnect(NimBLEServer* server) override {
    bleConnected = false;
    stopAllActuators();           // failsafe on link loss
    server->startAdvertising();   // allow reconnection
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
  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  NimBLEService* service = server->createService(NUS_SERVICE_UUID);

  NimBLECharacteristic* rxChar = service->createCharacteristic(
    NUS_RX_CHAR_UUID,
    NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  rxChar->setCallbacks(new RxCallbacks());

  txChar = service->createCharacteristic(
    NUS_TX_CHAR_UUID,
    NIMBLE_PROPERTY::NOTIFY);

  service->start();

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(NUS_SERVICE_UUID);
  adv->setName(BLE_NAME);
  adv->start();
}

// =================================================================== SETUP
void setup() {
  Serial.begin(115200);

  pinMode(PIN_MOTOR_L_IN1, OUTPUT);
  pinMode(PIN_MOTOR_L_IN2, OUTPUT);
  pinMode(PIN_MOTOR_R_IN1, OUTPUT);
  pinMode(PIN_MOTOR_R_IN2, OUTPUT);
  pinMode(PIN_LED, OUTPUT);

  ledcSetup(LEDC_CH_L, LEDC_FREQ, LEDC_RES);
  ledcAttachPin(PIN_MOTOR_L_PWM, LEDC_CH_L);
  ledcSetup(LEDC_CH_R, LEDC_FREQ, LEDC_RES);
  ledcAttachPin(PIN_MOTOR_R_PWM, LEDC_CH_R);

  stopAllActuators();
  setupBle();

  lastHeartbeatMs = millis();
}

// ==================================================================== LOOP
void loop() {
  // Pull any bytes waiting on USB serial.
  while (Serial.available() > 0) {
    feed(serialBuffer, (char)Serial.read());
  }

  // Heartbeat watchdog: if the app stops talking, stop the robot.
  // (Only enforced while something is connected, so a bare bench board idles.)
  bool linkActive = bleConnected || (lastHeartbeatMs != 0);
  if (linkActive && !failsafeEngaged &&
      (millis() - lastHeartbeatMs > HEARTBEAT_TIMEOUT_MS)) {
    stopAllActuators();
    failsafeEngaged = true;
  }
}
