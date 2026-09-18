import type { DocEntry } from './types';

export const MECHANISMS_DOCS: DocEntry[] = [
  {
    slug: 'mechanisms/head',
    title: 'robot.head',
    category: 'Mechanisms',
    summary: 'Mengatur posisi kepala (dua servo).',
    description: 'Menyetel sudut pitch (angguk) dan yaw (geleng) kepala robot.',
    signature: { python: 'robot.head(pitch=90, yaw=90)', opcode: 'SET_HEAD_POSITION' },
    params: [
      { name: 'pitch', type: 'angka', default: '90', desc: 'Sudut angguk.', range: '80 … 100' },
      { name: 'yaw', type: 'angka', default: '90', desc: 'Sudut geleng.', range: '80 … 100' },
    ],
    blockPreview: { blockType: 'mechanism_set_head', fields: { PITCH: 90, YAW: 90 } },
    seeAlso: ['mechanisms/gripper'],
    notes: ['Butuh servo kepala terpasang.'],
  },
  {
    slug: 'mechanisms/gripper',
    title: 'robot.gripper',
    category: 'Mechanisms',
    summary: 'Membuka atau menutup penjepit.',
    description: 'Menggerakkan penjepit (gripper) ke posisi terbuka atau tertutup.',
    signature: { python: 'robot.gripper("open")', opcode: 'SET_GRIPPER' },
    params: [{ name: 'state', type: 'teks', default: '"open"', desc: '"open" atau "closed".' }],
    blockPreview: { blockType: 'mechanism_set_gripper', fields: { STATE: 'open' } },
    seeAlso: ['mechanisms/head', 'movement/claw'],
    notes: ['Butuh servo penjepit terpasang.'],
  },
];
