/* ============================================================================
 * relay_client.h — Optional relay client for Robotku ESP32
 * ----------------------------------------------------------------------------
 * Connects to the relay server (wss://robotku-relay.hubrobotku.workers.dev)
 * so the robot can be controlled from https://hub.robotku.id over the internet.
 *
 * Usage in main.cpp (3 lines):
 *   #include "relay_client.h"           // at the top with other includes
 *   setupRelay();                       // at the end of setup(), AFTER setupWiFi()
 *   loopRelay();                        // inside loop(), after wsServer.loop()
 *
 * Disable: comment out the #include line → compiles without relay, zero impact.
 *
 * Requires: WebSockets library (already in platformio.ini), WiFi connected.
 * Robot ID + secret stored in NVS namespace "relay" (keys "id" and "secret").
 * Set via Serial/BLE: SET_RELAY <ID> <SECRET> (the web setup wizard sends it).
 *
 * DOES NOT MODIFY any existing firmware behavior. Uses the same feed() and
 * sendTelemetry() functions. All relay control frames (RELAY) are handled here.
 * ==========================================================================*/
#pragma once

#include <WebSocketsClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// ── Config ──
#define RELAY_HOST "robotku-relay.hubrobotku.workers.dev"
#define RELAY_PORT 443
#define RELAY_RECONNECT_MS 3000      // library-managed retry interval (NOT our own loop)
#define RELAY_ALIVE_MS     10000     // app-level "robot_alive" so the relay DO can detect a dead robot
#define RELAY_PING_MS      15000     // WS ping (detects half-open TCP on the robot side)
#define RELAY_PONG_MS      5000
#define RELAY_PONG_MISSES  2
// Per-frame Serial/OLED logging BLOCKS loop() (UART 115200 + I2C) and hijacked the
// user's OLED content. Keep 0 in production; set 1 only while debugging on a bench.
#ifndef RELAY_DEBUG
#define RELAY_DEBUG 0
#endif

// ── External functions from main.cpp (already exist, no changes needed) ──
extern void feed(String &buffer, char c, bool fromSerial);
extern void handleCommand(const String &line);
extern void handleTextCommand(const String &raw);
extern void stopAllActuators();
extern void oledStatus(const String& line1, const String& line2);
extern bool watchdogArmed;
extern unsigned long lastRxMs;

// ── State ──
static WebSocketsClient relayWs;
static String relayBuffer;
static String relayId;
static String relaySecret;
static String relayPath;
static bool relayEnabled = false;
static bool relayConnected = false;
static bool relayBegun = false;           // beginSSL() called ONCE per id/secret
static unsigned long relayAliveAt = 0;
static uint32_t relayConnectCount = 0;    // reported in HELLO_ACK diag

// ── Forward decl ──
static void onRelayEvent(WStype_t type, uint8_t *payload, size_t len);
static void relayFeed(const char *data, size_t len);
static void relaySend(const String &line);

// ── Public API ──

// Call once in setup(), after setupWiFi().
static void setupRelay()
{
  Preferences prefs;
  prefs.begin("relay", true); // read-only
  relayId = prefs.getString("id", "");
  relaySecret = prefs.getString("secret", "");
  prefs.end();

  if (relayId.length() != 6 || relaySecret.length() == 0)
  {
    Serial.println("[RELAY] No relay ID/secret in NVS. Use SET_RELAY <ID> <SECRET> to configure.");
    return;
  }

  relayEnabled = true;
  Serial.printf("[RELAY] ID=%s, will connect when WiFi is up\n", relayId.c_str());
}

// Start the client exactly once. The WebSockets library owns reconnects from here on
// (setReconnectInterval). The old code called beginSSL() every 5 s while a TLS
// handshake (2-6 s on ESP32) was still in flight -> two reconnect mechanisms fought,
// the socket flapped and the relay DO kept a dead robot socket (HELLO_ACK timeout).
static void relayStart()
{
  relayPath = "/ws?role=robot&id=" + relayId;
  relayWs.beginSSL(RELAY_HOST, RELAY_PORT, relayPath.c_str());
  relayWs.setExtraHeaders(("Authorization: Bearer " + relaySecret).c_str()); // copied into a String by the lib
  relayWs.onEvent(onRelayEvent);
  relayWs.setReconnectInterval(RELAY_RECONNECT_MS);
  relayWs.enableHeartbeat(RELAY_PING_MS, RELAY_PONG_MS, RELAY_PONG_MISSES);
  relayBegun = true;
  Serial.printf("[RELAY] Client started -> %s%s\n", RELAY_HOST, relayPath.c_str());
}

// Call every loop() iteration.
static void loopRelay()
{
  if (!relayEnabled)
    return;

  // No WiFi: don't hammer connect attempts. The library resumes on its own once
  // WiFi is back (WiFi itself auto-reconnects — see startWiFiSTA()).
  if (WiFi.status() != WL_CONNECTED)
  {
    if (relayConnected)
    {
      relayConnected = false;
      stopAllActuators();   // safety: lost the link
      watchdogArmed = false;
    }
    return;
  }

  if (!relayBegun)
    relayStart();

  relayWs.loop();

  // App-level liveness so the relay can tell a live robot from a half-open socket
  // (Cloudflare answers WS pings itself, so the DO never sees them).
  if (relayConnected && (millis() - relayAliveAt > RELAY_ALIVE_MS))
  {
    relayAliveAt = millis();
    static const char alive[] = "{\"command\":\"RELAY\",\"event\":\"robot_alive\"};";
    relayWs.sendTXT(alive, sizeof(alive) - 1);
  }
}

// Handle SET_RELAY command (Serial / BLE / LAN WS — never from the relay itself).
//   if (raw.startsWith("SET_RELAY")) { handleSetRelay(raw); return; }
static void handleSetRelay(const String &raw)
{
  // Format: SET_RELAY <ID> <SECRET>
  int sp1 = raw.indexOf(' ');
  if (sp1 < 0) { Serial.println("[RELAY] Usage: SET_RELAY <ID> <SECRET>"); return; }
  int sp2 = raw.indexOf(' ', sp1 + 1);
  if (sp2 < 0) { Serial.println("[RELAY] Usage: SET_RELAY <ID> <SECRET>"); return; }

  String id = raw.substring(sp1 + 1, sp2);
  String secret = raw.substring(sp2 + 1);
  id.trim();
  id.toUpperCase();
  secret.trim();

  if (id.length() != 6)
  {
    Serial.println("[RELAY] ID must be 6 characters");
    return;
  }

  Preferences prefs;
  prefs.begin("relay", false); // read-write
  prefs.putString("id", id);
  prefs.putString("secret", secret);
  prefs.end();

  relayId = id;
  relaySecret = secret;
  relayEnabled = true;

  Serial.printf("[RELAY] Saved ID=%s, secret=%d chars. Reconnecting...\n",
                id.c_str(), (int)secret.length());

  // New identity -> restart the client with the new path/header.
  if (relayBegun) relayWs.disconnect();
  relayBegun = false;
  relayConnected = false;
}

// Send telemetry/reply to relay (called from sendTelemetry in main.cpp).
// No Serial/OLED work here: this runs for EVERY outbound frame.
static void relaySend(const String &line)
{
  if (!relayConnected) return;
  bool ok = relayWs.sendTXT(line.c_str(), line.length());
#if RELAY_DEBUG
  Serial.printf("[RELAY TX] %d %.*s\n", ok, (int)(line.length() > 120 ? 120 : line.length()), line.c_str());
#else
  (void)ok;
#endif
}

// ── Internal ──

static void onRelayEvent(WStype_t type, uint8_t *payload, size_t len)
{
  switch (type)
  {
  case WStype_CONNECTED:
    relayConnected = true;
    relayConnectCount++;
    relayBuffer = "";               // never carry a partial frame across sessions
    relayAliveAt = 0;               // announce liveness right away
    Serial.printf("[RELAY] Connected (#%u)\n", (unsigned)relayConnectCount);
    break;

  case WStype_DISCONNECTED:
    if (relayConnected) Serial.println("[RELAY] Disconnected");
    relayConnected = false;
    relayBuffer = "";
    stopAllActuators();             // safety: lost the controller path
    watchdogArmed = false;
    break;

  case WStype_TEXT:
    lastRxMs = millis(); // relay traffic feeds the watchdog
#if RELAY_DEBUG
    Serial.printf("[RELAY RX] %.*s\n", (int)(len > 120 ? 120 : len), (const char*)payload);
#endif
    relayFeed((const char *)payload, len);
    break;

  default:
    break;
  }
}

static void relayFeed(const char *data, size_t len)
{
  // Frames end with ';' or '\n'. One WS message may hold several frames, and a very
  // large command may still span two messages, so the partial tail is kept in
  // relayBuffer (reset on (re)connect).
  for (size_t i = 0; i < len; i++) {
    char c = data[i];
    if (c == ';' || c == '\n') {
      String frame = relayBuffer;
      relayBuffer = "";
      frame.trim();
      if (frame.length() == 0) continue;

      // RELAY control frame?
      if (frame.indexOf("\"RELAY\"") >= 0) {
        JsonDocument doc;
        if (deserializeJson(doc, frame) == DeserializationError::Ok) {
          const char *cmd = doc["command"] | "";
          const char *event = doc["event"] | "";
          if (strcmp(cmd, "RELAY") == 0) {
            if (strcmp(event, "controller_joined") == 0) {
              Serial.println("[RELAY] Controller joined");
              watchdogArmed = false;
            } else if (strcmp(event, "controller_left") == 0) {
              Serial.println("[RELAY] Controller left -> stopping motors");
              stopAllActuators();
              watchdogArmed = false;
            }
            continue;  // consumed — don't feed to command parser
          }
        }
      }

      // Block credential changes from the internet path (security)
      if (frame.indexOf("\"SET_WIFI\"") >= 0 || frame.startsWith("SET_RELAY")) {
        JsonDocument d;
        d["command"] = "UNSUPPORTED";
        d["op"] = frame.startsWith("SET_RELAY") ? "SET_RELAY" : "SET_WIFI";
        d["reason"] = "blocked from relay";
        String out;
        serializeJson(d, out);
        out += ";";
        relaySend(out);
        continue;
      }

      // Normal command — feed to parser
      if (frame[0] == '{') handleCommand(frame);
      else                 handleTextCommand(frame);
    } else {
      relayBuffer += c;
      if (relayBuffer.length() > 9000) relayBuffer = "";
    }
  }
}
