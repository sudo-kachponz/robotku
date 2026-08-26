// src/templates/builtin/tantangan.ts — Tantangan collection (teaches Variables & Functions).

import type { BuiltinTemplate } from '../types';
import { counterThumb, funcThumb } from '../thumbnails';
import { CHECK } from './patterns';

const get = (name: string) => ({ type: 'variables_get' as const, fields: { VAR: name } });

export const counterGame: BuiltinTemplate = {
  id: 'counter_game',
  name: 'Hitung Mundur',
  description: 'Pakai variabel untuk menghitung — tiap bunyi mengurangi angka sampai nol.',
  collection: 'tantangan',
  tags: ['variabel', 'perulangan', 'logika'],
  difficulty: 2,
  learn: [
    'Membuat & memakai variabel',
    'Mengubah variabel dalam loop',
    'Menguji nilai dengan Jika',
  ],
  thumbnail: counterThumb(),
  program: [
    { type: 'variables_set', fields: { VAR: 'sisa' }, inputs: { VALUE: 3 } },
    {
      type: 'controls_repeat_ext',
      inputs: { TIMES: 3 },
      statements: {
        DO: [
          {
            type: 'audio_play_tone_sec',
            fields: { NOTE: 'A4', WAIT: 'true' },
            inputs: { DURATION: 0.3 },
          },
          {
            type: 'variables_set',
            fields: { VAR: 'sisa' },
            inputs: {
              VALUE: {
                type: 'math_arithmetic',
                fields: { OP: 'MINUS' },
                inputs: { A: get('sisa'), B: 1 },
              },
            },
          },
        ],
      },
    },
    {
      type: 'controls_if',
      inputs: {
        IF0: { type: 'logic_compare', fields: { OP: 'EQ' }, inputs: { A: get('sisa'), B: 0 } },
      },
      statements: {
        DO0: [
          { type: 'display_matrix', fields: { PATTERN: CHECK }, inputs: { DURATION: 0.6 } },
          { type: 'move_forward', fields: { SPEED: 'fast' }, inputs: { DURATION: 0.6 } },
        ],
      },
    },
  ],
};

export const patrolFunc: BuiltinTemplate = {
  id: 'patrol_func',
  name: 'Patroli',
  description: 'Buat fungsi "Putar" sekali, panggil empat kali untuk berpatroli.',
  collection: 'tantangan',
  tags: ['fungsi', 'perulangan', 'gerak'],
  difficulty: 3,
  learn: [
    'Mendefinisikan fungsi (Define)',
    'Memanggil fungsi berulang',
    'Merapikan program dengan fungsi',
  ],
  thumbnail: funcThumb(),
  program: [
    {
      type: 'controls_repeat_ext',
      inputs: { TIMES: 4 },
      statements: { DO: [{ type: 'procedures_callnoreturn', fields: { NAME: 'Putar' } }] },
    },
    {
      type: 'procedures_defnoreturn',
      fields: { NAME: 'Putar' },
      statements: {
        STACK: [
          { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.5 } },
          { type: 'move_right', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.5 } },
        ],
      },
    },
  ],
};

export const tantanganTemplates = [counterGame, patrolFunc];
