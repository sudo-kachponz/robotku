import type { DocEntry } from './types';

export const FLOW_DOCS: DocEntry[] = [
  {
    slug: 'flow/forever',
    title: 'while True',
    category: 'Program Flow',
    summary: 'Mengulang blok di dalamnya selamanya.',
    description: 'Kode di dalam `while True:` diulang terus-menerus sampai program dihentikan.',
    signature: { python: 'while True:\n    ...', opcode: 'META_START_INFINITE_LOOP' },
    blockPreview: { blockType: 'controls_forever' },
    examples: [
      {
        title: 'Maju terus',
        python: 'while True:\n    robot.forward(1)',
        blocks: [
          {
            type: 'controls_forever',
            statements: { DO: [{ type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 1 } }] },
          },
        ],
        runnable: true,
      },
    ],
    seeAlso: ['flow/repeat', 'flow/while', 'flow/break'],
  },
  {
    slug: 'flow/repeat',
    title: 'for _ in range(n)',
    category: 'Program Flow',
    summary: 'Mengulang sebanyak n kali.',
    description: 'Menjalankan kode di dalamnya sebanyak n kali lalu berhenti.',
    signature: { python: 'for _ in range(n):\n    ...', opcode: 'META_START_LOOP' },
    params: [{ name: 'n', type: 'angka', default: '10', desc: 'Berapa kali diulang.' }],
    blockPreview: { blockType: 'controls_repeat_ext' },
    examples: [
      {
        title: 'Kotak',
        python: 'for _ in range(4):\n    robot.forward(1)\n    robot.turn("right", 1)',
        blocks: [
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
        runnable: true,
      },
    ],
    seeAlso: ['flow/forever', 'flow/while'],
  },
  {
    slug: 'flow/while',
    title: 'while <syarat>',
    category: 'Program Flow',
    summary: 'Mengulang selama syarat masih benar.',
    description: 'Kode di dalamnya diulang selama kondisi bernilai True. Berhenti saat kondisi menjadi False.',
    signature: { python: 'while kondisi:\n    ...', opcode: 'META_START_INFINITE_LOOP' },
    params: [{ name: 'kondisi', type: 'boolean', desc: 'Diperiksa tiap putaran.' }],
    blockPreview: { blockType: 'controls_while' },
    examples: [
      {
        title: 'Maju sampai dekat dinding',
        python: 'while sensors.ultrasonic(port="G1") > 10:\n    robot.forward(0.2)',
        runnable: false,
      },
    ],
    seeAlso: ['flow/forever', 'flow/break', 'sensors/ultrasonic'],
  },
  {
    slug: 'flow/break',
    title: 'break',
    category: 'Program Flow',
    summary: 'Keluar dari perulangan.',
    description: 'Menghentikan loop yang sedang berjalan dan lanjut ke kode setelahnya.',
    signature: { python: 'break', opcode: 'META_BREAK_LOOP' },
    blockPreview: { blockType: 'controls_break' },
    examples: [
      {
        title: 'Berhenti saat tombol ditekan',
        python: 'while True:\n    if sensors.button1():\n        break',
        runnable: false,
      },
    ],
    seeAlso: ['flow/continue', 'flow/forever'],
  },
  {
    slug: 'flow/continue',
    title: 'continue',
    category: 'Program Flow',
    summary: 'Lompat ke putaran loop berikutnya.',
    description: 'Melewati sisa kode di putaran ini dan langsung mulai putaran berikutnya.',
    signature: { python: 'continue', opcode: 'META_CONTINUE_LOOP' },
    blockPreview: { blockType: 'controls_continue' },
    seeAlso: ['flow/break', 'flow/forever'],
  },
  {
    slug: 'flow/if',
    title: 'if / else',
    category: 'Program Flow',
    summary: 'Menjalankan kode berbeda tergantung syarat.',
    description:
      'Jika kondisi benar (True), jalankan blok pertama; kalau tidak, jalankan blok `else`.',
    signature: { python: 'if kondisi:\n    ...\nelse:\n    ...', opcode: 'META_IF' },
    params: [{ name: 'kondisi', type: 'boolean', desc: 'Diperiksa sekali.' }],
    blockPreview: { blockType: 'controls_if' },
    examples: [
      {
        title: 'Berhenti kalau dekat',
        python: 'if sensors.ultrasonic(port="G1") < 10:\n    robot.stop_all()\nelse:\n    robot.forward(1)',
        runnable: false,
      },
    ],
    seeAlso: ['flow/while', 'sensors/ultrasonic'],
  },
];
