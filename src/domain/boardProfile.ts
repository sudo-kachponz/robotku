// src/domain/boardProfile.ts
//
// P0 — the ONE source of truth for what a board can actually do, derived from the
// ESP32_Controller_V3 schematic (see pin.md "FAKTA HARDWARE"). robotProfiles.ts
// stays the flat opcode DICTIONARY (every command the language can emit); THIS
// file decides "supported or not" per board. Read by the toolbox guard (P1), the
// simulator (P2) and the reconciliation test (P3) so they can never disagree.
//
// A static profile (robotkuEsp32V3) is the fallback used offline / for guests /
// in the simulator. When a real robot connects, HELLO_ACK's capabilities[]/ports[]
// OVERRIDE it via profileFromHello() — the board itself is always the last word.

import { RUNTIME_OPCODES } from './protocol';

const OP = RUNTIME_OPCODES;

/** One physical PWM output port: which GPIO, its role, and whether it's really soldered. */
export interface PortSpec {
  gpio: number;
  role: string;
  wired: boolean;
}

export interface BoardProfile {
  id: string;
  name: string;
  /** DEVICE opcodes this board can execute. Host/meta opcodes are always allowed
   *  (see HOST_ONLY) and are NOT listed here. */
  opcodes: ReadonlySet<string>;
  /** 1-based physical PWM ports. Ports absent from the map don't exist on the board. */
  ports: Record<number, PortSpec>;
  actuators: {
    servoL: boolean;
    servoR: boolean;
    buzzer: boolean;
    rgbLed: boolean;
    oled: boolean;
    gripper: boolean;
  };
  sensors: {
    ultrasonic: boolean;
    temperature: boolean;
    humidity: boolean;
    light: boolean;
    heading: boolean;
  };
}

/**
 * Opcodes the HOST runs — never streamed to the board, so they're supported on
 * every profile and must never be guarded/disabled in the toolbox. META_* control
 * flow, host timing, and AI camera opcodes.
 */
export const HOST_ONLY: ReadonlySet<string> = new Set<string>([
  OP.WAIT,
  OP.WAIT_UNTIL,
  OP.GET_AI_DATA,
  OP.AI_CAMERA,
  OP.AI_SET_MODEL,
  OP.META_SET_VAR,
  OP.META_FUNC_DEF,
  OP.META_FUNC_END,
  OP.META_CALL,
  OP.META_RETURN,
  OP.META_START_LOOP,
  OP.META_START_INFINITE_LOOP,
  OP.META_END_LOOP,
  OP.META_BREAK_LOOP,
  OP.META_CONTINUE_LOOP,
  OP.META_IF,
  OP.META_ELSE_IF,
  OP.META_ELSE,
  OP.META_END_IF,
]);

// Device opcodes the Robotku V3 hardware can actually drive. Drawn 1:1 from the
// schematic capability line: tank drive (2 servos) + SET_PORT + buzzer tone +
// RGB LED + OLED text. Everything NOT here is UNSUPPORTED on this board.
//
// TODO(firmware): SET_LED_COLOR / SET_LED_BRIGHTNESS / DISPLAY_TEXT are wired in
// hardware (RGB on GPIO16/17/5, OLED on I2C) but have no handler in main.cpp yet
// (see FW-06). They belong in the profile — the board CAN do them — but until the
// firmware lands they'll answer UNSUPPORTED. Gripper stays OFF until a servo/port
// is configured for it.
const ROBOTKU_V3_OPCODES: ReadonlySet<string> = new Set<string>([
  // Drive — tank, two continuous servos
  OP.driveDirect,
  OP.moveTimed,
  OP.turnTimed,
  OP.steerTimed,
  OP.stop,
  OP.stopAll,
  OP.estop,
  'SET_PORT',
  // Audio — passive buzzer, tone only
  OP.playTone,
  // Display — RGB LED + OLED text
  OP.setLedColor,
  OP.setLedBrightness,
  OP.displayText,
]);

/**
 * Default static profile — matches the FAKTA HARDWARE table 1:1 for a fully-built
 * Robotku V3 (both drive servos populated). A one-servo bench board reports the
 * truth over HELLO_ACK and profileFromHello() narrows this down.
 */
export const robotkuEsp32V3: BoardProfile = {
  id: 'robotku-esp32-v3',
  name: 'Robotku V3 (ESP32)',
  opcodes: ROBOTKU_V3_OPCODES,
  ports: {
    1: { gpio: 33, role: 'drive-left', wired: true },
    2: { gpio: 25, role: 'drive-right', wired: true },
    3: { gpio: 26, role: 'aux-pwm', wired: false },
    4: { gpio: 27, role: 'aux-pwm', wired: false },
    5: { gpio: 14, role: 'aux-pwm', wired: false },
  },
  actuators: { servoL: true, servoR: true, buzzer: true, rgbLed: true, oled: true, gripper: false },
  sensors: { ultrasonic: false, temperature: false, humidity: false, light: false, heading: false },
};

/** Is `opcode` runnable on this board? Host/meta opcodes are always true. */
export function isSupported(opcode: string, profile: BoardProfile = robotkuEsp32V3): boolean {
  if (HOST_ONLY.has(opcode)) return true;
  return profile.opcodes.has(opcode);
}

/** Is physical port `port` (1-based) soldered & usable on this board? */
export function portIsWired(port: number, profile: BoardProfile = robotkuEsp32V3): boolean {
  return profile.ports[port]?.wired ?? false;
}

/**
 * Fold a live HELLO_ACK into a board profile: the connected robot's advertised
 * capabilities[] and ports[] REPLACE the static guesses (P0 criterion — the board
 * overrides the fallback). Anything the firmware omits keeps the static default.
 */
export function profileFromHello(
  caps: readonly string[] | undefined,
  ports: readonly number[] | undefined,
  base: BoardProfile = robotkuEsp32V3,
): BoardProfile {
  const opcodes = caps && caps.length ? new Set<string>(caps) : base.opcodes;

  let portMap = base.ports;
  if (ports && ports.length) {
    const wired = new Set(ports);
    portMap = {};
    for (const [num, spec] of Object.entries(base.ports)) {
      portMap[Number(num)] = { ...spec, wired: wired.has(Number(num)) };
    }
    // Ports the board advertises that the static table doesn't know about.
    for (const p of ports) {
      if (!portMap[p]) portMap[p] = { gpio: -1, role: 'unknown', wired: true };
    }
  }

  return { ...base, opcodes, ports: portMap };
}
