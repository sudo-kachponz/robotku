import type { DocEntry } from './types';

export const FUNCTIONS_DOCS: DocEntry[] = [
  {
    slug: 'functions/def',
    title: 'def (buat fungsi)',
    category: 'Functions',
    summary: 'Membuat fungsi yang bisa dipakai berkali-kali.',
    description:
      'Fungsi adalah kumpulan perintah yang diberi nama. Sekali dibuat, bisa dipanggil kapan saja tanpa menulis ulang.',
    signature: { python: 'def nama():\n    ...', opcode: 'META_FUNC_DEF' },
    blockPreview: { blockType: 'procedures_defnoreturn', fields: { NAME: 'maju' } },
    examples: [
      {
        title: 'Fungsi maju',
        python: 'def maju():\n    robot.forward(1)\n\nmaju()',
        runnable: true,
      },
    ],
    seeAlso: ['functions/call'],
  },
  {
    slug: 'functions/call',
    title: 'panggil fungsi',
    category: 'Functions',
    summary: 'Menjalankan fungsi yang sudah dibuat.',
    description: 'Menulis nama fungsi diikuti tanda kurung untuk menjalankan isinya.',
    signature: { python: 'nama()', opcode: 'META_CALL' },
    blockPreview: { blockType: 'procedures_callnoreturn', fields: { NAME: 'maju' } },
    seeAlso: ['functions/def'],
  },
];
