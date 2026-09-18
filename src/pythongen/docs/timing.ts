import type { DocEntry } from './types';

export const TIMING_DOCS: DocEntry[] = [
  {
    slug: 'timing/start',
    title: 'Start Program',
    category: 'Timing',
    summary: 'Titik awal program.',
    description:
      'Blok topi tempat program dimulai. Di Python, ini adalah baris teratas program (tidak perlu ditulis).',
    signature: { python: '# awal program' },
    blockPreview: { blockType: 'program_start' },
    seeAlso: ['flow/forever'],
  },
  {
    slug: 'timing/wait',
    title: 'wait',
    category: 'Timing',
    summary: 'Menjeda program beberapa detik.',
    description: 'Program berhenti sejenak selama waktu yang ditentukan sebelum lanjut ke baris berikutnya.',
    signature: { python: 'wait(detik)', opcode: 'WAIT' },
    params: [{ name: 'detik', type: 'angka', default: '1', desc: 'Lama jeda dalam detik.' }],
    blockPreview: { blockType: 'timing_wait' },
    examples: [
      {
        title: 'Maju lalu tunggu',
        python: 'robot.forward(1)\nwait(0.5)',
        blocks: [
          { type: 'move_forward', fields: { SPEED: 'medium' }, inputs: { DURATION: 1 } },
          { type: 'timing_wait', inputs: { DURATION: 0.5 } },
        ],
        runnable: true,
      },
    ],
    seeAlso: ['timing/wait-until'],
  },
  {
    slug: 'timing/wait-until',
    title: 'wait_until',
    category: 'Timing',
    summary: 'Menunggu sampai suatu syarat benar.',
    description:
      'Program menunggu terus sampai kondisi yang diberikan bernilai benar (True), baru lanjut.',
    signature: { python: 'wait_until(kondisi)', opcode: 'WAIT_UNTIL' },
    params: [{ name: 'kondisi', type: 'boolean', desc: 'Ekspresi yang bernilai True/False.' }],
    blockPreview: { blockType: 'timing_wait_until' },
    examples: [
      {
        title: 'Tunggu tombol ditekan',
        python: 'wait_until(sensors.button1())',
        blocks: [{ type: 'timing_wait_until', inputs: { CONDITION: { type: 'sensor_button1' } } }],
        runnable: false,
      },
    ],
    seeAlso: ['timing/wait', 'sensors/button'],
  },
];
