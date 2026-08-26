// src/templates/builtin/seniSuara.ts — Seni & Suara collection.

import type { BuiltinTemplate } from '../types';
import { matrixThumb, soundThumb } from '../thumbnails';
import { SMILE, HEART, DIAMOND, CROSS, CHECK, FULL } from './patterns';

const showMatrix = (pattern: string, secs = 0.25) => ({
  type: 'display_matrix' as const,
  fields: { PATTERN: pattern },
  inputs: { DURATION: secs },
});

export const matrixAnim: BuiltinTemplate = {
  id: 'matrix_anim',
  name: 'Animasi Matrix',
  description: 'Enam pola LED berganti cepat membentuk animasi kecil di layar.',
  collection: 'seni-suara',
  tags: ['seni', 'led', 'perulangan'],
  difficulty: 1,
  learn: ['Rangkaian pola LED', 'Perulangan untuk animasi', 'Mengatur durasi tiap frame'],
  thumbnail: matrixThumb(),
  program: [
    {
      type: 'controls_repeat_ext',
      inputs: { TIMES: 3 },
      statements: {
        DO: [
          showMatrix(SMILE),
          showMatrix(HEART),
          showMatrix(DIAMOND),
          showMatrix(CROSS),
          showMatrix(CHECK),
          showMatrix(FULL),
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
