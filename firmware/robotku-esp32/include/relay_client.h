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
 * Set via Serial Monitor: type SET_RELAY <ID> <SECRET>
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
#define RELAY_RECONNECT_MS 5000

// ── External functions from main.cpp (already exist, no changes needed) ──
extern void feed(String &buffer, char c, const char *src);
extern void stopAllActuators();
extern bool watchdogArmed;
extern unsigned long lastRxMs;

// ── State ──
static WebSocketsClient relayWs;
static String relayBuffer;
static String relayId;
static String relaySecret;
static bool relayEnabled = false;
static bool relayConnected = false;
static unsigned long relayLastAttempt = 0;

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

// Call every loop() iteration.
static void loopRelay()
{
  if (!relayEnabled)
    return;

  // Only connect when WiFi is up
  if (WiFi.status() != WL_CONNECTED)
  {
    if (relayConnected)
    {
      relayConnected = false;
      relayWs.disconnect();
    }
    return;
  }

  // Connect if not connected (with backoff)
  if (!relayConnected && (millis() - relayLastAttempt > RELAY_RECONNECT_MS))
  {
    relayLastAttempt = millis();
    String path = "/ws?role=robot&id=" + relayId;

    relayWs.beginSSL(RELAY_HOST, RELAY_PORT, path);
    relayWs.setExtraHeaders(("Authorization: Bearer " + relaySecret).c_str());
    relayWs.onEvent(onRelayEvent);
    relayWs.setReconnectInterval(RELAY_RECONNECT_MS);

    Serial.printf("[RELAY] Connecting to %s%s\n", RELAY_HOST, path.c_str());
  }

  relayWs.loop();
}

// Handle SET_RELAY command from Serial Monitor.
// Call this from handleTextCommand() in main.cpp:
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

  Serial.printf("[RELAY] Saved ID=%s, secret=%d chars. Connecting...\n",
                id.c_str(), (int)secret.length());

  // Force reconnect
  relayConnected = false;
  relayLastAttempt = 0;
}

// Send telemetry/reply to relay (call from sendTelemetry in main.cpp):
//   if (relayConnected) relaySend(line);
static void relaySend(const String &line)
{
  if (relayConnected)
    relayWs.sendTXT(line);
}

// ── Internal ──

static void onRelayEvent(WStype_t type, uint8_t *payload, size_t len)
{
  switch (type)
  {
  case WStype_CONNECTED:
    relayConnected = true;
    Serial.printf("[RELAY] Connected to relay server\n");
    break;

  case WStype_DISCONNECTED:
    relayConnected = false;
    Serial.printf("[RELAY] Disconnected from relay\n");
    // Stop motors on controller disconnect (safety)
    stopAllActuators();
    watchdogArmed = false;
    break;

  case WStype_TEXT:
    lastRxMs = millis(); // relay traffic feeds the watchdog
    relayFeed((const char *)payload, len);
    break;

  default:
    break;
  }
}

static void relayFeed(const char *data, size_t len)
{
  // Check for RELAY control frames before feeding to command parser
  String raw = String(data);

  if (raw.indexOf("\"RELAY\"") >= 0)
  {
    // Parse RELAY frame
    String clean = raw;
    clean.replace(";", "");
    clean.trim();

    JsonDocument doc;
    if (deserializeJson(doc, clean) == DeserializationError::Ok)
    {
      const char *cmd = doc["command"] | "";
      const char *event = doc["event"] | "";

      if (strcmp(cmd, "RELAY") == 0)
      {
        if (strcmp(event, "controller_joined") == 0)
        {
          Serial.println("[RELAY] Controller joined");
          // Reset watchdog state for new controller
          watchdogArmed = false;
          return;
        }
        if (strcmp(event, "controller_left") == 0)
        {
          Serial.println("[RELAY] Controller left -> stopping motors");
          stopAllActuators();
          watchdogArmed = false;
          return;
        }
        // Other RELAY events: ignore
        return;
      }
    }
  }

  // Not a RELAY frame — feed to normal command parser
  // Block SET_WIFI from relay (security: only Serial/local WS)
  if (raw.indexOf("\"SET_WIFI\"") >= 0)
  {
    JsonDocument d;
    d["command"] = "UNSUPPORTED";
    d["op"] = "SET_WIFI";
    d["reason"] = "SET_WIFI blocked from relay";
    String out;
    serializeJson(d, out);
    out += ";";
    relaySend(out);
    Serial.println("[RELAY] SET_WIFI blocked from relay");
    return;
  }

  // Feed each char to the existing parser
  for (size_t i = 0; i < len; i++)
    feed(relayBuffer, data[i], "RELAY");
}
