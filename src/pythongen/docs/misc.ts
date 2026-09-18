import type { DocEntry } from './types';

export const MISC_DOCS: DocEntry[] = [
  {
    slug: 'variables/set',
    title: 'variabel = nilai',
    category: 'Variables',
    summary: 'Menyimpan nilai ke sebuah variabel.',
    description: 'Membuat atau mengubah variabel. Variabel adalah "kotak" untuk menyimpan angka atau teks.',
    signature: { python: 'skor = 0', opcode: 'META_SET_VAR' },
    params: [
      { name: 'nama', type: 'teks', desc: 'Nama variabel.' },
      { name: 'nilai', type: 'apa saja', desc: 'Nilai yang disimpan.' },
    ],
    blockPreview: { blockType: 'variables_set', fields: { VAR: 'skor' } },
    examples: [{ title: 'Hitung skor', python: 'skor = 0\nskor = skor + 1', runnable: false }],
    seeAlso: ['variables/get'],
  },
  {
    slug: 'variables/get',
    title: 'membaca variabel',
    category: 'Variables',
    summary: 'Memakai nilai variabel.',
    description: 'Menulis nama variabel untuk memakai nilainya di dalam ekspresi.',
    signature: { python: 'skor' },
    returns: { type: 'apa saja', desc: 'Nilai yang tersimpan.' },
    blockPreview: { blockType: 'variables_get', fields: { VAR: 'skor' } },
    seeAlso: ['variables/set'],
  },
  {
    slug: 'templates/comment',
    title: 'komentar',
    category: 'Templates',
    summary: 'Catatan untuk manusia, diabaikan robot.',
    description: 'Baris yang diawali # adalah komentar. Robot tidak menjalankannya; gunanya untuk mencatat.',
    signature: { python: '# ini komentar' },
    blockPreview: { blockType: 'templates_comment', fields: { TEXT: 'catatan' } },
    seeAlso: [],
  },
];
