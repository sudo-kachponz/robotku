// src/templates/builtin/seniSuara.ts — Seni & Suara collection.

import type { BuiltinTemplate } from '../types';
import { matrixThumb, soundThumb } from '../thumbnails';

const showLed = (color: string, secs = 0.25) => ({
  type: 'set_led_color' as const,
  fields: { COLOR: color },
  inputs: { DURATION: secs },
});

export const matrixAnim: BuiltinTemplate = {
  id: 'matrix_anim',
  name: 'Pelangi LED',
  description: 'Enam warna LED berganti cepat membentuk animasi pelangi.',
  collection: 'seni-suara',
  tags: ['seni', 'led', 'perulangan'],
  difficulty: 1,
  learn: ['Rangkaian warna LED', 'Perulangan untuk animasi', 'Mengatur durasi tiap frame'],
  thumbnail: matrixThumb(),
  program: [
    {
      type: 'controls_repeat_ext',
      inputs: { TIMES: 3 },
      statements: {
        DO: [
          showLed('#EF4444'), // merah
          showLed('#F97316'), // oranye
          showLed('#FACC15'), // kuning
          showLed('#22C55E'), // hijau
          showLed('#0EA5E9'), // biru
          showLed('#8B5CF6'), // ungu
        ],
      },
    },
  ],
};

export const song: BuiltinTemplate = {
  id: 'song',
  name: 'Lagu Sederhana',
  description: 'Deret nada per ketukan memainkan melodi pendek yang ceria.',
  collection: 'seni-suara',
  tags: ['suara', 'musik', 'tempo'],
  difficulty: 2,
  learn: ['Set BPM (tempo)', 'Nada per beat', 'Menyusun melodi'],
  thumbnail: soundThumb(),
  program: [
    { type: 'audio_set_bpm', fields: { BPM: '120' } },
    ...['C4', 'D4', 'E4', 'C4', 'E4', 'G4', 'G4', 'C5'].map((note) => ({
      type: 'audio_play_tone_beat' as const,
      fields: { NOTE: note, WAIT: 'true' },
      inputs: { BEATS: 1 },
    })),
  ],
};

export const seniSuaraTemplates = [matrixAnim, song];
