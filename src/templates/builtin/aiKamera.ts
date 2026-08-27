// src/templates/builtin/aiKamera.ts — AI Kamera collection.
//
// These lean on the AI camera (PROMPT E). Until AI is wired, ai_object_detected is
// a stub that returns false, so the gallery shows a "butuh AI" gate on these cards.
// The programs are still real & valid — they just wait for a model to see something.

import type { BuiltinTemplate } from '../types';
import { aiThumb } from '../thumbnails';
import { CHECK, CROSS } from './patterns';

const sees = (label: string) => ({ type: 'ai_detected' as const, fields: { LABEL: label } });

export const stopGo: BuiltinTemplate = {
  id: 'stop_go',
  name: 'Stop & Go',
  description: 'Telapak terbuka = maju, kepalan tangan = berhenti. Tanganmu kemudinya!',
  collection: 'ai-kamera',
  tags: ['ai', 'kamera', 'gestur'],
  requires: ['kamera'],
  difficulty: 2,
  learn: [
    'Klasifikasi gambar (Teachable Machine)',
    'Blok deteksi AI di dalam kondisi',
    'Program berjalan dari browser',
  ],
  thumbnail: aiThumb(),
  program: [
    {
      type: 'controls_forever',
      statements: {
        DO: [
          {
            type: 'controls_if',
            extraState: { elseIfCount: 1, hasElse: true },
            inputs: { IF0: sees('open_palm'), IF1: sees('closed_fist') },
            statements: {
              DO0: [
                { type: 'display_matrix', fields: { PATTERN: CHECK }, inputs: { DURATION: 0.2 } },
                { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.3 } },
              ],
              DO1: [
                { type: 'display_matrix', fields: { PATTERN: CROSS }, inputs: { DURATION: 0.2 } },
                { type: 'move_stop_all' },
              ],
              ELSE: [{ type: 'move_stop_all' }],
            },
          },
        ],
      },
    },
  ],
};

export const balloonChase: BuiltinTemplate = {
  id: 'balloon_chase',
  name: 'Kejar Balon',
  description: 'Robot mengejar balon yang dilihat kamera, belok mengikuti posisinya.',
  collection: 'ai-kamera',
  tags: ['ai', 'kamera', 'deteksi'],
  requires: ['kamera'],
  difficulty: 3,
  learn: ['Deteksi objek (bounding box)', 'Belok mengikuti target', 'Berhenti saat sudah dekat'],
  thumbnail: aiThumb('#EC2D8F'),
  program: [
    {
      type: 'controls_forever',
      statements: {
        DO: [
          {
            type: 'controls_if',
            extraState: { hasElse: true },
            inputs: { IF0: sees('balloon') },
            statements: {
              DO0: [
                { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.3 } },
              ],
              ELSE: [{ type: 'move_left', fields: { SPEED: 'slow' }, inputs: { DURATION: 0.2 } }],
            },
          },
        ],
      },
    },
  ],
};

export const balloonPop: BuiltinTemplate = {
  id: 'balloon_pop',
  name: 'Pecahkan Balon',
  description: 'Kejar balon lalu jepit dengan capit dan bunyikan nada saat berhasil.',
  collection: 'ai-kamera',
  tags: ['ai', 'kamera', 'capit'],
  requires: ['kamera', 'capit'],
  difficulty: 3,
  learn: ['Menggabungkan AI + aktuator', 'Mengontrol capit', 'Umpan balik suara'],
  thumbnail: aiThumb('#EC2D8F'),
  program: [
    {
      type: 'controls_forever',
      statements: {
        DO: [
          {
            type: 'controls_if',
            inputs: { IF0: sees('balloon') },
            statements: {
              DO0: [
                { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.3 } },
                { type: 'mechanism_set_gripper', fields: { STATE: 'closed' } },
                {
                  type: 'audio_play_tone_sec',
                  fields: { NOTE: 'C5', WAIT: 'true' },
                  inputs: { DURATION: 0.3 },
                },
                { type: 'mechanism_set_gripper', fields: { STATE: 'open' } },
              ],
            },
          },
        ],
      },
    },
  ],
};

export const rpsReferee: BuiltinTemplate = {
  id: 'rps_referee',
  name: 'Wasit Suit',
  description: 'Kamera mengenali gunting-batu-kertas dan menampilkan hasilnya.',
  collection: 'ai-kamera',
  tags: ['ai', 'kamera', 'permainan'],
  requires: ['kamera'],
  difficulty: 2,
  learn: ['Model 3 kelas (RPS)', 'Percabangan banyak (else-if)', 'Menampilkan hasil di layar'],
  thumbnail: aiThumb('#EC2D8F'),
  program: [
    {
      type: 'controls_forever',
      statements: {
        DO: [
          {
            type: 'controls_if',
            extraState: { elseIfCount: 2 },
            inputs: { IF0: sees('scissors'), IF1: sees('paper'), IF2: sees('stone') },
            statements: {
              DO0: [{ type: 'display_text', fields: { TEXT: 'Gunting' } }],
              DO1: [{ type: 'display_text', fields: { TEXT: 'Kertas' } }],
              DO2: [{ type: 'display_text', fields: { TEXT: 'Batu' } }],
            },
          },
        ],
      },
    },
  ],
};

export const smileLight: BuiltinTemplate = {
  id: 'smile_light',
  name: 'Senyum = Lampu',
  description: 'Wajah tersenyum menyalakan LED hijau, cemberut menyalakan merah.',
  collection: 'ai-kamera',
  tags: ['ai', 'kamera', 'emosi'],
  requires: ['kamera'],
  difficulty: 2,
  learn: ['Model ekspresi wajah', 'Memetakan kelas ke aksi', 'LED sebagai umpan balik'],
  thumbnail: aiThumb('#EC2D8F'),
  program: [
    {
      type: 'controls_forever',
      statements: {
        DO: [
          {
            type: 'controls_if',
            extraState: { hasElse: true },
            inputs: { IF0: sees('smiling') },
            statements: {
              DO0: [
                { type: 'display_matrix', fields: { PATTERN: CHECK }, inputs: { DURATION: 0.3 } },
              ],
              ELSE: [
                { type: 'display_matrix', fields: { PATTERN: CROSS }, inputs: { DURATION: 0.3 } },
              ],
            },
          },
        ],
      },
    },
  ],
};

export const aiKameraTemplates = [stopGo, balloonChase, balloonPop, rpsReferee, smileLight];
