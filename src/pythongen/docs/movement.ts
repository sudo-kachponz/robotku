import type { DocEntry } from './types';

const SPEED: { name: string; type: string; default: string; desc: string } = {
  name: 'speed',
  type: 'teks',
  default: '"medium"',
  desc: 'Kecepatan: "slow", "medium", atau "fast".',
};

export const MOVEMENT_DOCS: DocEntry[] = [
  {
    slug: 'movement/forward',
    title: 'robot.forward',
    category: 'Movement',
    summary: 'Robot maju lurus selama beberapa detik.',
    description:
      'Menjalankan kedua roda ke depan selama waktu yang ditentukan, lalu berhenti otomatis.',
    signature: { python: 'robot.forward(detik, speed="medium")', opcode: 'MOVE_TIMED' },
    params: [{ name: 'detik', type: 'angka', default: '1', desc: 'Lama gerak dalam detik.' }, SPEED],
    blockPreview: { blockType: 'move_forward', fields: { SPEED: 'medium' } },
    examples: [
      {
        title: 'Maju 2 detik',
        python: 'robot.forward(2, speed="fast")',
        blocks: [{ type: 'move_forward', fields: { SPEED: 'fast' }, inputs: { DURATION: 2 } }],
        runnable: true,
      },
    ],
    seeAlso: ['movement/reverse', 'movement/turn', 'movement/stop'],
  },
  {
    slug: 'movement/reverse',
    title: 'robot.reverse',
    category: 'Movement',
    summary: 'Robot mundur selama beberapa detik.',
    description: 'Menjalankan kedua roda ke belakang selama waktu yang ditentukan.',
    signature: { python: 'robot.reverse(detik, speed="medium")', opcode: 'MOVE_TIMED' },
    params: [{ name: 'detik', type: 'angka', default: '1', desc: 'Lama gerak dalam detik.' }, SPEED],
    blockPreview: { blockType: 'move_reverse', fields: { SPEED: 'medium' } },
    examples: [
      {
        title: 'Mundur pelan',
        python: 'robot.reverse(1, speed="slow")',
        blocks: [{ type: 'move_reverse', fields: { SPEED: 'slow' }, inputs: { DURATION: 1 } }],
        runnable: true,
      },
    ],
    seeAlso: ['movement/forward', 'movement/stop'],
  },
  {
    slug: 'movement/turn',
    title: 'robot.turn',
    category: 'Movement',
    summary: 'Robot belok ke kiri atau kanan.',
    description:
      'Memutar robot ke arah yang dipilih selama beberapa detik. Arah "left" memutar ke kiri, "right" ke kanan.',
    signature: { python: 'robot.turn(arah, detik, speed="medium")', opcode: 'TURN_TIMED' },
    params: [
      { name: 'arah', type: 'teks', default: '"left"', desc: '"left" atau "right".' },
      { name: 'detik', type: 'angka', default: '1', desc: 'Lama belok dalam detik.' },
      SPEED,
    ],
    blockPreview: { blockType: 'move_left', fields: { SPEED: 'medium' } },
    examples: [
      {
        title: 'Belok kanan cepat',
        python: 'robot.turn("right", 1, speed="fast")',
        blocks: [{ type: 'move_right', fields: { SPEED: 'fast' }, inputs: { DURATION: 1 } }],
        runnable: true,
      },
    ],
    seeAlso: ['movement/forward', 'movement/steer'],
    notes: ['"left" memakai blok belok kiri, "right" memakai blok belok kanan.'],
  },
  {
    slug: 'movement/steer',
    title: 'robot.steer',
    category: 'Movement',
    summary: 'Maju sambil menyetir ke kiri/kanan.',
    description:
      'Maju sambil membelokkan arah. Nilai steering −100 (belok penuh kiri) sampai 100 (belok penuh kanan); 0 = lurus.',
    signature: { python: 'robot.steer(detik, steering=0, speed="medium")', opcode: 'STEER_TIMED' },
    params: [
      { name: 'detik', type: 'angka', default: '1', desc: 'Lama gerak.' },
      { name: 'steering', type: 'angka', default: '0', desc: 'Arah setir.', range: '−100 … 100' },
      SPEED,
    ],
    blockPreview: { blockType: 'move_steer', fields: { STEERING: 0, SPEED: 'medium' } },
    examples: [
      {
        title: 'Belok halus ke kanan',
        python: 'robot.steer(2, steering=30, speed="medium")',
        blocks: [
          { type: 'move_steer', fields: { STEERING: 30, SPEED: 'medium' }, inputs: { DURATION: 2 } },
        ],
        runnable: true,
      },
    ],
    seeAlso: ['movement/turn', 'movement/forward'],
  },
  {
    slug: 'movement/claw',
    title: 'robot.claw',
    category: 'Movement',
    summary: 'Menggerakkan capit (claw) pada port tertentu.',
    description: 'Memutar motor capit searah/berlawanan jarum jam selama beberapa detik.',
    signature: {
      python: 'robot.claw(detik, speed="medium", direction="clockwise", port="P1")',
      opcode: 'CLAW_TIMED',
    },
    params: [
      { name: 'detik', type: 'angka', default: '1', desc: 'Lama gerak.' },
      SPEED,
      {
        name: 'direction',
        type: 'teks',
        default: '"clockwise"',
        desc: '"clockwise" atau "anticlockwise".',
      },
      { name: 'port', type: 'teks', default: '"P1"', desc: 'Port servo, P1–P5.' },
    ],
    blockPreview: { blockType: 'move_claw', fields: { SPEED: 'medium', DIRECTION: 'clockwise', PORT: 'P1' } },
    examples: [
      {
        title: 'Buka capit',
        python: 'robot.claw(1, speed="slow", direction="clockwise", port="P3")',
        runnable: true,
      },
    ],
    seeAlso: ['movement/servo', 'mechanisms/gripper'],
  },
  {
    slug: 'movement/stop',
    title: 'robot.stop',
    category: 'Movement',
    summary: 'Menghentikan roda.',
    description: 'Menghentikan gerak roda. Pilih 2 (dua roda) atau 4 (empat roda).',
    signature: { python: 'robot.stop(roda)', opcode: 'STOP' },
    params: [{ name: 'roda', type: 'angka', default: '2', desc: 'Jumlah roda: 2 atau 4.' }],
    blockPreview: { blockType: 'move_stop', fields: { WHEELS: '2' } },
    examples: [{ title: 'Berhenti', python: 'robot.stop(2)', runnable: true }],
    seeAlso: ['movement/stop-all', 'movement/forward'],
  },
  {
    slug: 'movement/stop-all',
    title: 'robot.stop_all',
    category: 'Movement',
    summary: 'Menghentikan semua motor seketika.',
    description: 'Tombol darurat: menghentikan seluruh motor sekaligus.',
    signature: { python: 'robot.stop_all()', opcode: 'STOP_ALL' },
    blockPreview: { blockType: 'move_stop_all' },
    examples: [{ title: 'Stop total', python: 'robot.stop_all()', runnable: true }],
    seeAlso: ['movement/stop'],
  },
  {
    slug: 'movement/servo',
    title: 'robot.servo',
    category: 'Movement',
    summary: 'Menguji satu servo di port tertentu.',
    description:
      'Memutar satu servo pada kecepatan tertentu selama beberapa detik, lalu berhenti. Berguna untuk menguji tiap servo sendiri-sendiri.',
    signature: { python: 'robot.servo(port, kecepatan, detik)', opcode: 'SET_PORT' },
    params: [
      { name: 'port', type: 'teks', default: '"P1"', desc: 'Port servo, P1–P5.' },
      { name: 'kecepatan', type: 'angka', default: '100', desc: 'Kecepatan.', range: '−100 … 100' },
      { name: 'detik', type: 'angka', default: '1', desc: 'Lama gerak.' },
    ],
    blockPreview: { blockType: 'servo_single', fields: { PORT: 'P1', SPEED: 100 } },
    examples: [{ title: 'Uji servo P1', python: 'robot.servo("P1", 100, 2)', runnable: true }],
    seeAlso: ['movement/claw'],
    notes: ['Satu baris ini menghasilkan 2 perintah: putar servo, lalu berhentikan.'],
  },
];
