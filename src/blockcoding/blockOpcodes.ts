// src/blockcoding/blockOpcodes.ts
//
// P1 — the ONE block-type -> device-opcode map, used to guard the toolbox and the
// generated program against a BoardProfile. Only blocks that emit a DEVICE opcode
// (something streamed to the board) need an entry; host/meta blocks (loops, vars,
// math, AI, timing) are always allowed and are deliberately absent.
//
// Kept flat and hand-maintained on purpose: it's mechanical to read against the
// generators in src/categories/*, and the P3 reconciliation test fails loudly if a
// block starts emitting an opcode that isn't listed here.

import { astroidV2 } from '../robotProfiles';
import { isSupported, robotkuEsp32V3, type BoardProfile } from '../domain/boardProfile';

const C = astroidV2.commands;

export const BLOCK_OPCODE: Readonly<Record<string, string>> = {
  // Movement
  move_forward: C.moveTimed,
  move_reverse: C.moveTimed,
  move_left: C.turnTimed,
  move_right: C.turnTimed,
  move_steer: C.steerTimed,
  move_claw: C.clawTimed,
  move_stop: C.stop,
  move_stop_all: C.stopAll,
  // Display
  display_matrix: C.displayMatrix,
  display_text: C.displayText,
  display_set_brightness: C.setLedBrightness,
  display_clear_matrix: C.clearMatrix,
  set_led_color: C.setLedColor,
  lcd_shape: C.lcdShape,
  lcd_text: C.lcdText,
  lcd_clear: C.lcdClear,
  // Audio
  audio_record: C.recordAudio,
  audio_play_recording: C.playRecording,
  audio_sound_effect: C.playSoundEffect,
  audio_play_tone_sec: C.playTone,
  audio_play_tone_beat: C.playTone,
  audio_play_melody: C.playTone,
  audio_set_volume: C.setVolume,
  audio_stop_sounds: C.stopSounds,
  audio_set_bpm: C.setBpm,
  // Sensors & Data (reporters read GET_SENSOR_DATA; setters/resets are device ops)
  sensor_button1: C.getSensorData,
  sensor_button2: C.getSensorData,
  sensor_is_recording: C.getSensorData,
  sensor_get_analog: C.getSensorData,
  sensor_get_digital: C.getSensorData,
  sensor_ultrasonic: C.getSensorData,
  sensor_temperature: C.getSensorData,
  sensor_humidity: C.getSensorData,
  sensor_light: C.getSensorData,
  sensor_distance: C.getSensorData,
  sensor_heading: C.getSensorData,
  sensor_set_analog: C.setAnalog,
  sensor_set_digital: C.setDigital,
  sensor_reset_distance: C.resetDistance,
  sensor_reset_heading: C.resetHeading,
  // Mechanisms (head servo / gripper — no hardware by default)
  mechanism_set_head: C.setHeadPosition,
  mechanism_set_gripper: C.setGripper,
};

/**
 * Device opcodes in a generated command list that the active board can't run.
 * The firmware already answers UNSUPPORTED for these, but the host can surface the
 * problem up front (Run-time warning) and the P3 test uses it to catch drift.
 */
export function unsupportedOpcodesInProgram(
  commands: { command?: string }[],
  profile: BoardProfile = robotkuEsp32V3,
): string[] {
  const bad = new Set<string>();
  for (const c of commands) {
    const op = c?.command;
    if (op && !isSupported(op, profile)) bad.add(op);
  }
  return [...bad];
}
