// src/templates/builtin/gerakDasar.ts — Gerak Dasar collection.

import type { BuiltinTemplate } from '../types';
import { helloThumb, motionThumb } from '../thumbnails';
import { SMILE, HEART } from './patterns';

export const helloRobot: BuiltinTemplate = {
  id: 'hello_robot',
  name: 'Halo Robot',
  description: 'Robot maju, tersenyum di layar, lalu berbunyi. Program pertamamu!',
  collection: 'gerak-dasar',
  tags: ['pemula', 'gerak', 'suara'],
  difficulty: 1,
  learn: ['Menjalankan blok berurutan', 'Menampilkan pola LED', 'Membunyikan nada'],
  thumbnail: helloThumb(),
  program: [
    { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 1 } },
    { type: 'display_matrix', fields: { PATTERN: SMILE }, inputs: { DURATION: 1 } },
    { type: 'audio_play_tone_sec', fields: { NOTE: 'C4', WAIT: 'true' }, inputs: { DURATION: 1 } },
    { type: 'display_matrix', fields: { PATTERN: HEART }, inputs: { DURATION: 1 } },
  ],
};

export const squarePath: BuiltinTemplate = {
  id: 'square_path',
  name: 'Jalan Kotak',
  description: 'Maju lalu belok kanan, empat kali — jejaknya membentuk kotak.',
  collection: 'gerak-dasar',
  tags: ['gerak', 'perulangan'],
  difficulty: 1,
  learn: ['Blok Ulangi (repeat)', 'Menggabungkan maju & belok', 'Membaca jejak di simulator'],
  thumbnail: motionThumb('M40 78 h44 v-44 h-44 v44'),
  program: [
    {
      type: 'controls_repeat_ext',
      inputs: { TIMES: 4 },
      statements: {
        DO: [
          { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 1 } },
          { type: 'move_right', fields: { SPEED: 'medium' }, inputs: { DURATION: 1 } },
        ],
      },
    },
  ],
};

export const dance: BuiltinTemplate = {
  id: 'dance',
  name: 'Menari',
  description: 'Goyang kiri-kanan mengikuti irama, sambil menyalakan LED dan nada.',
  collection: 'gerak-dasar',
  tags: ['gerak', 'suara', 'perulangan'],
  difficulty: 2,
  learn: ['Mengatur BPM (tempo)', 'Nada per ketukan (beat)', 'Menyelaraskan gerak & suara'],
  thumbnail: motionThumb('M80 70 q-24 -20 0 -40 q24 20 0 40', '#16A34A', 2),
  program: [
    { type: 'audio_set_bpm', fields: { BPM: '140' } },
    {
      type: 'controls_repeat_ext',
      inputs: { TIMES: 4 },
      statements: {
        DO: [
          { type: 'move_left', fields: { SPEED: 'fast' }, inputs: { DURATION: 0.4 } },
          {
            type: 'audio_play_tone_beat',
            fields: { NOTE: 'E4', WAIT: 'false' },
            inputs: { BEATS: 1 },
          },
          { type: 'move_right', fields: { SPEED: 'fast' }, inputs: { DURATION: 0.4 } },
          {
            type: 'audio_play_tone_beat',
            fields: { NOTE: 'G4', WAIT: 'true' },
            inputs: { BEATS: 1 },
          },
          { type: 'display_matrix', fields: { PATTERN: HEART }, inputs: { DURATION: 0.2 } },
        ],
      },
    },
  ],
};

export const gerakDasarTemplates = [helloRobot, squarePath, dance];
