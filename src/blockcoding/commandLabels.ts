// src/blockcoding/commandLabels.ts
//
// Opcode → short Bahasa Indonesia label for the simulator status strip / monitor.
// Extracted from BlockCoding.tsx so the map has ONE home and is typed against the
// real opcode union — a renamed opcode becomes a compile error here.

import type { Opcode } from '../domain/protocol';

const LABELS: Partial<Record<Opcode, string>> = {
  MOVE_TIMED: 'Gerak',
  TURN_TIMED: 'Belok',
  STEER_TIMED: 'Setir',
  CLAW_TIMED: 'Capit',
  STOP: 'Berhenti',
  STOP_ALL: 'Berhenti Semua',
  WAIT: 'Tunggu',
  WAIT_UNTIL: 'Tunggu sampai',
  DISPLAY_MATRIX: 'LED Matrix',
  DISPLAY_TEXT: 'Teks LED',
  SET_LED_BRIGHTNESS: 'Kecerahan',
  CLEAR_MATRIX: 'Hapus Matrix',
  LCD_SHAPE: 'Bentuk LCD',
  LCD_TEXT: 'Teks LCD',
  LCD_CLEAR: 'Hapus LCD',
  SET_LED_COLOR: 'Warna LED',
  DISPLAY_ICON: 'Ikon',
  PLAY_TONE: 'Nada',
  PLAY_SOUND_EFFECT: 'Efek Suara',
  PLAY_INTERNAL_SOUND: 'Suara',
  RECORD_AUDIO: 'Rekam',
  PLAY_RECORDING: 'Putar Rekaman',
  SET_VOLUME: 'Volume',
  SET_BPM: 'BPM',
  STOP_SOUNDS: 'Stop Suara',
  SET_ANALOG: 'Set Analog',
  SET_DIGITAL: 'Set Digital',
  RESET_DISTANCE: 'Reset Jarak',
  RESET_HEADING: 'Reset Arah',
  SET_HEAD_POSITION: 'Kepala',
  SET_GRIPPER: 'Capit',
  META_SET_VAR: 'Set Variabel',
  META_CALL: 'Panggil Fungsi',
  AI_CAMERA: 'Kamera AI',
  AI_SET_MODEL: 'Pilih Model AI',
  GET_AI_DATA: 'Baca AI',
};

/** Human label for an opcode; falls back to the raw opcode string. */
export function commandLabel(command: string): string {
  return LABELS[command as Opcode] ?? command;
}
