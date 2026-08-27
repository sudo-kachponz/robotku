// src/templates/builtin/sensor.ts — Sensor collection.

import type { BuiltinTemplate } from '../types';
import { sensorThumb, motionThumb } from '../thumbnails';

const ultrasonic = (op: string, value: number) => ({
  type: 'logic_compare' as const,
  fields: { OP: op },
  inputs: { A: { type: 'sensor_ultrasonic', fields: { UNIT: 'cm', PORT: 'G1' } }, B: value },
});

export const avoidObstacle: BuiltinTemplate = {
  id: 'avoid_obstacle',
  name: 'Hindari Rintangan',
  description: 'Terus maju; kalau ada penghalang dekat, mundur dan belok.',
  collection: 'sensor',
  tags: ['sensor', 'ultrasonic', 'perulangan'],
  requires: ['ultrasonic'],
  difficulty: 2,
  learn: [
    'Membaca sensor ultrasonic',
    'Blok Jika/Selain itu (if/else)',
    'Loop selamanya (forever)',
  ],
  thumbnail: sensorThumb(),
  program: [
    {
      type: 'controls_forever',
      statements: {
        DO: [
          {
            type: 'controls_if',
            extraState: { hasElse: true },
            inputs: { IF0: ultrasonic('LT', 20) },
            statements: {
              DO0: [
                { type: 'move_reverse', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.5 } },
                { type: 'move_right', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.5 } },
              ],
              ELSE: [
                { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.3 } },
              ],
            },
          },
        ],
      },
    },
  ],
};

export const lineFollow: BuiltinTemplate = {
  id: 'line_follow',
  name: 'Ikuti Garis',
  description: 'Dua sensor cahaya di G1 & G2 memandu robot menyetir kiri atau kanan.',
  collection: 'sensor',
  tags: ['sensor', 'analog', 'steering'],
  difficulty: 3,
  learn: ['Membaca pin analog', 'Membandingkan dua sensor', 'Menyetir dengan nilai steering'],
  thumbnail: motionThumb('M28 78 q40 -60 104 -40', '#8B5CF6', 3),
  program: [
    {
      type: 'controls_forever',
      statements: {
        DO: [
          {
            type: 'controls_if',
            extraState: { hasElse: true },
            inputs: {
              IF0: {
                type: 'logic_compare',
                fields: { OP: 'GT' },
                inputs: {
                  A: { type: 'sensor_get_analog', fields: { PORT: 'G1' } },
                  B: { type: 'sensor_get_analog', fields: { PORT: 'G2' } },
                },
              },
            },
            statements: {
              DO0: [
                {
                  type: 'move_steer',
                  fields: { STEERING: '-40', SPEED: 'medium' },
                  inputs: { DURATION: 0.2 },
                },
              ],
              ELSE: [
                {
                  type: 'move_steer',
                  fields: { STEERING: '40', SPEED: 'medium' },
                  inputs: { DURATION: 0.2 },
                },
              ],
            },
          },
        ],
      },
    },
  ],
};

export const buttonRace: BuiltinTemplate = {
  id: 'button_race',
  name: 'Balapan Tombol',
  description: 'Tekan Tombol 1 untuk mulai, Tombol 2 untuk berhenti — jaraknya tercatat.',
  collection: 'sensor',
  tags: ['sensor', 'tombol', 'jarak'],
  difficulty: 2,
  learn: [
    'Blok Tunggu sampai (wait until)',
    'Reset & baca jarak tempuh',
    'Keluar loop dengan Break',
  ],
  thumbnail: motionThumb('M24 50 h112', '#8B5CF6', 2.4),
  program: [
    { type: 'timing_wait_until', inputs: { CONDITION: { type: 'sensor_button1' } } },
    { type: 'sensor_reset_distance', fields: { PORT: 'G1' } },
    {
      type: 'controls_forever',
      statements: {
        DO: [
          {
            type: 'controls_if',
            inputs: { IF0: { type: 'sensor_button2' } },
            statements: { DO0: [{ type: 'controls_break' }] },
          },
          { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 0.2 } },
        ],
      },
    },
    { type: 'display_text', fields: { TEXT: 'Selesai!' } },
  ],
};

export const sensorTemplates = [avoidObstacle, lineFollow, buttonRace];
