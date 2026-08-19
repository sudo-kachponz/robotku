// src/domain/protocol.ts
//
// DOMAIN LAYER — pure protocol knowledge. Zero UI, zero transport, zero Blockly.
// Everything here is about the line-delimited JSON wire contract that both the
// web app and the resident firmware interpreter agree on (Stick'em-style: we
// stream commands to firmware, we do NOT compile/flash on Run).
//
// Wire contract (line-delimited JSON, one command per `;`):
//   {"command":"DRIVE_DIRECT","left":80,"right":80};{"command":"WAIT","ms":500};
//
// Opcodes are reused verbatim from robotProfiles.ts (astroidV2). Do NOT invent
// new opcodes here.

import { astroidV2 } from '../robotProfiles';

/** Protocol version negotiated in the HELLO handshake. */
export const PROTOCOL_VERSION = 'robotku-v1';

/** The set of opcodes the firmware understands, sourced from the robot profile. */
export const OPCODES = astroidV2.commands;

/**
 * SET_PORT — the ONE new opcode the spec allows beyond robotProfiles. It's the
 * primitive every live control mode maps its intent onto: drive one of the 8
 * output ports with a signed value. `{command:"SET_PORT",port:1..8,value:-100..100};`
 */
export const SET_PORT = 'SET_PORT';

/** Encode a single SET_PORT command (value clamped to -100..100). */
export function setPortLine(port: number, value: number): string {
  const v = Math.max(-100, Math.min(100, Math.round(value)));
  return encodeCommand({ command: SET_PORT, port, value: v });
}

/** Encode a DRIVE_DIRECT convenience command (tank/joystick). */
export function driveDirectLine(left: number, right: number): string {
  const l = Math.max(-100, Math.min(100, Math.round(left)));
  const r = Math.max(-100, Math.min(100, Math.round(right)));
  return encodeCommand({ command: OPCODES.driveDirect, left: l, right: r });
}

/** A single command as it travels on the wire (opaque payload beyond `command`). */
export interface RobotCommand {
  command: string;
  [key: string]: unknown;
}

/** Board identity returned by the HELLO handshake. */
export interface RobotInfo {
  fwVersion: string;
  board: string;
  protocol: string;
  capabilities: string[];
}

/** Turn a command object into a single `;`-terminated wire line. */
export function encodeCommand(cmd: RobotCommand): string {
  return `${JSON.stringify(cmd)};`;
}

/** HELLO handshake line the client sends right after connecting. */
export function helloLine(): string {
  return encodeCommand({ command: 'HELLO', protocol: PROTOCOL_VERSION });
}

/** Periodic heartbeat line. Firmware replies with ACK{seq}. */
export function heartbeatLine(seq: number): string {
  return encodeCommand({ command: 'HEARTBEAT', seq });
}

/**
 * Emergency stop: zero the motors, then hard ESTOP. Two commands, one string,
 * meant to bypass any queue.
 */
export function estopLines(): string {
  return (
    encodeCommand({ command: OPCODES.driveDirect, left: 0, right: 0 }) +
    encodeCommand({ command: OPCODES.estop })
  );
}

/**
 * Normalise whatever the block generator produced into an array of
 * `;`-terminated wire lines. Accepts either:
 *   - a JSON array string:  `[{"command":...},{"command":...}]`
 *   - a `;`-delimited blob:  `{"command":...};{"command":...};`
 * This keeps the existing block contract intact while giving the transport a
 * clean list to stream.
 */
export function normalizeProgram(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // Case 1: JSON array (what window.generateCodeForExecution() emits today).
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed) as RobotCommand[];
      return arr.map(encodeCommand);
    } catch {
      // fall through to `;`-splitting
    }
  }

  // Case 2: `;`-delimited JSON commands.
  return splitLines(trimmed);
}

/**
 * Split a `;` / newline delimited blob into individual `;`-terminated lines,
 * dropping anything that isn't a parseable JSON object. Used both for outgoing
 * programs and for decoding inbound telemetry frames.
 */
export function splitLines(blob: string): string[] {
  const out: string[] = [];
  for (const piece of blob.split(/[;\n\r]+/)) {
    const p = piece.trim();
    if (!p) continue;
    try {
      const obj = JSON.parse(p);
      out.push(encodeCommand(obj));
    } catch {
      // ignore partial / malformed fragments
    }
  }
  return out;
}

/** Parse inbound telemetry frames from a raw blob into command objects. */
export function parseTelemetry(blob: string): RobotCommand[] {
  const out: RobotCommand[] = [];
  for (const piece of blob.split(/[;\n\r]+/)) {
    const p = piece.trim();
    if (!p) continue;
    try {
      out.push(JSON.parse(p));
    } catch {
      // ignore malformed / partial frames — the caller keeps buffering
    }
  }
  return out;
}
