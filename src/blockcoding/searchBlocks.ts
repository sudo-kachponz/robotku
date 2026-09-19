// src/blockcoding/searchBlocks.ts
//
// Search indexing and matching for Robotku Block Coding toolbox.
// Supports bilingual (Indonesian & English) search across all categories and blocks.

import { getAstroidToolbox } from '../toolbox';
import { type BoardProfile, robotkuEsp32V3 } from '../domain/boardProfile';

// Keyword synonyms map for smart Indonesian & English search
const BLOCK_KEYWORDS: Record<string, string[]> = {
  move_forward: ['maju', 'forward', 'jalan', 'gerak', 'lurus', 'depan', 'drive', 'motor', 'roda'],
  move_reverse: ['mundur', 'reverse', 'backward', 'belakang', 'mundur roda'],
  move_left: ['kiri', 'left', 'belok kiri', 'turn left', 'puter kiri'],
  move_right: ['kanan', 'right', 'belok kanan', 'turn right', 'puter kanan'],
  move_steer: ['setir', 'steer', 'belok', 'kemudi', 'arah'],
  move_claw: ['capit', 'claw', 'gripper', 'jepit', 'buka capit', 'tutup capit', 'lengan'],
  servo_single: ['servo', 'motor servo', 'port servo', 'uji servo', 'p1', 'p2', 'p3'],
  move_stop: ['stop', 'berhenti', 'diam', 'rem', 'mati roda'],
  move_stop_all: ['stop all', 'berhenti semua', 'matikan motor', 'stop total'],
  timing_wait: ['tunggu', 'wait', 'delay', 'detik', 'jeda', 'pause', 'waktu'],
  timing_wait_until: ['tunggu sampai', 'wait until', 'tunggu hingga', 'syarat'],
  program_start: ['start', 'mulai', 'awal', 'program start', 'jalankan'],
  display_text: ['display text', 'teks', 'tampilkan teks', 'tulisan', 'print', 'tulis', 'oled', 'lcd', 'layar'],
  display_kaomoji: ['kaomoji', 'wajah', 'emoticon', 'face', 'senyum', 'happy', 'sedih', 'cute', 'oled', 'lcd', 'layar'],
  display_set_brightness: ['kecerahan', 'brightness', 'terang', 'redup', 'cahaya', 'oled', 'lcd'],
  lcd_shape: ['lcd', 'oled', 'kotak', 'lingkaran', 'garis', 'shape', 'bentuk', 'layar', 'draw'],
  lcd_text: ['lcd text', 'teks lcd', 'oled', 'layar teks', 'lcd print', 'tulisan lcd', 'huruf'],
  lcd_clear: ['lcd hapus', 'clear lcd', 'oled hapus', 'clear oled', 'layar bersih', 'kosongkan layar'],
  set_led_color: ['warna led', 'rgb', 'lampu', 'led color', 'merah', 'hijau', 'biru', 'kuning', 'color'],
  display_icon: ['ikon', 'icon', 'simbol', 'heart', 'bintang'],
  audio_record: ['rekam', 'record', 'audio record', 'mikrofon', 'mic', 'suara rekaman'],
  audio_play_recording: ['putar rekaman', 'play recording', 'audio play', 'suara slot'],
  audio_sound_effect: ['efek suara', 'sound effect', 'sfx', 'bunyi', 'laser', 'beep', 'horn'],
  audio_play_tone_sec: ['nada', 'tone', 'nada detik', 'frekuensi', 'buzzer', 'bunyi nada', 'c4', 'd4', 'e4'],
  audio_play_tone_beat: ['nada ketukan', 'tone beat', 'ketukan', 'tempo'],
  audio_play_melody: ['melodi', 'lagu', 'melody', 'musik', 'song', 'twinkle', 'birthday', 'scale'],
  audio_set_volume: ['volume', 'suara keras', 'kekerasan', 'loudness', 'pelan'],
  audio_stop_sounds: ['stop suara', 'stop audio', 'diamkan suara', 'hening'],
  audio_set_bpm: ['bpm', 'tempo', 'kecepatan musik', 'speed music'],
  sensor_button1: ['tombol 1', 'button 1', 'touch 1', 'sentuh 1', 'pencet tombol'],
  sensor_button2: ['tombol 2', 'button 2', 'touch 2', 'sentuh 2', 'pencet tombol'],
  sensor_is_recording: ['sedang merekam', 'is recording', 'status mic'],
  sensor_set_analog: ['analog pin', 'set analog', 'potensio', 'pwm', 'g1', 'g2'],
  sensor_set_digital: ['digital pin', 'set digital', 'output pin', 'high low'],
  sensor_get_distance: ['jarak', 'distance', 'ultrasonic', 'sonar', 'cm', 'inch', 'halangan'],
  sensor_get_line_tracking: ['line tracking', 'sensor garis', 'tracking', 'garis hitam', 'line sensor'],
  sensor_get_ir_remote: ['remote', 'infra merah', 'ir remote', 'kontrol jarak jauh'],
  sensor_get_analog: ['baca analog', 'read analog', 'sensor analog'],
  sensor_get_digital: ['baca digital', 'read digital', 'sensor digital'],
  sensor_reset_distance: ['reset jarak', 'nolkan jarak'],
  sensor_reset_heading: ['reset arah', 'heading', 'kompas', 'derajat'],
  controls_repeat_ext: ['ulang', 'repeat', 'loop', 'perulangan', 'kali', 'berulang'],
  controls_whileUntil: ['while', 'until', 'selama', 'hingga', 'looping', 'terus menerus'],
  controls_for: ['for loop', 'hitung dari', 'count with', 'cacah'],
  controls_flow_statements: ['break', 'continue', 'keluar loop', 'lanjutkan', 'hentikan perulangan'],
  control_loop_forever: ['selamanya', 'forever', 'loop terus', 'tanpa henti'],
  controls_if: ['jika', 'if', 'maka', 'then', 'else', 'jika tidak', 'kondisi', 'percabangan'],
  logic_compare: ['sama dengan', 'bandingkan', 'compare', 'lebih besar', 'lebih kecil', '==', '!=', '>', '<', 'kurang dari'],
  logic_operation: ['dan', 'atau', 'and', 'or', 'logika', 'syarat ganda'],
  logic_negate: ['bukan', 'not', 'kebalikan', 'lawan'],
  logic_boolean: ['benar', 'salah', 'true', 'false', 'boolean', 'ya tidak'],
  logic_null: ['kosong', 'null', 'none'],
  logic_ternary: ['ternary', 'jika benar maka'],
  math_number: ['angka', 'number', 'nilai angka', 'digit'],
  math_arithmetic: ['tambah', 'kurang', 'kali', 'bagi', 'pangkat', 'math', 'hitung', '+', '-', '*', '/', 'penjumlahan'],
  math_single: ['akar', 'sqrt', 'sin', 'cos', 'tan', 'ln', 'log', 'abs', 'mutlak'],
  math_trig: ['trigonometri', 'sinus', 'cosinus', 'tangen'],
  math_constant: ['pi', 'e', 'konstanta', 'infinity', 'tak hingga'],
  math_number_property: ['genap', 'ganjil', 'prima', 'positif', 'negatif', 'habis dibagi'],
  math_round: ['bulatkan', 'round', 'ceiling', 'floor'],
  math_on_list: ['jumlah daftar', 'rata-rata', 'minimum', 'maksimum'],
  math_modulo: ['sisa bagi', 'modulo', 'mod'],
  math_constrain: ['batasi', 'constrain', 'rentang', 'limit'],
  math_random_int: ['acak bulat', 'random integer', 'angka acak', 'dadu'],
  math_random_float: ['acak pecahan', 'random fraction', 'desimal acak'],
  variables_get: ['variabel', 'ambil variabel', 'get variable', 'data'],
  variables_set: ['set variabel', 'simpan variabel', 'ubah variabel', 'nilai variabel'],
  math_change: ['tambah variabel', 'change variable by', 'tingkatkan nilai'],
  procedures_defnoreturn: ['buat fungsi', 'def function', 'fungsi baru', 'prosedur'],
  procedures_defreturn: ['fungsi kembalian', 'function return', 'fungsi menghasilkan'],
  procedures_callnoreturn: ['panggil fungsi', 'call function', 'jalankan fungsi'],
  procedures_callreturn: ['panggil fungsi kembalian', 'ambil hasil fungsi'],
  templates_comment: ['catatan', 'note', 'komentar', 'comment', 'keterangan'],
};

export function searchToolboxBlocks(
  query: string,
  profile: BoardProfile = robotkuEsp32V3,
): any[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const toolbox = getAstroidToolbox(profile, false);
  const results: any[] = [];
  const seenTypes = new Set<string>();

  if (!toolbox || typeof toolbox !== 'object' || !('contents' in toolbox)) return [];

  for (const cat of toolbox.contents as any[]) {
    if (cat.kind !== 'category' || !Array.isArray(cat.contents)) continue;

    const catName = (cat.name || '').toLowerCase();
    const catMatches = catName.includes(q);

    for (const item of cat.contents) {
      if (item.kind !== 'block' || typeof item.type !== 'string') continue;
      if (seenTypes.has(item.type)) continue;

      const type = item.type.toLowerCase();
      const customKeywords = BLOCK_KEYWORDS[item.type] || [];
      const keywordsMatch = customKeywords.some((kw) => kw.toLowerCase().includes(q));

      if (catMatches || type.includes(q) || keywordsMatch) {
        seenTypes.add(item.type);
        results.push(item);
      }
    }
  }

  return results;
}
