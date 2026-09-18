// src/pythongen/snippets.ts
//
// Flyout snippets for Python mode + inline docs (Indonesian, kid-friendly). One
// source drives PyFlyout cards, the CM6 snippet insertion (${n:...} placeholders,
// Tab between them), and the DocsPanel. `py` uses CodeMirror snippet syntax.

export interface SnippetDoc {
  title: string;
  body: string;
  example: string;
  params?: { name: string; desc: string }[];
}
export interface Snippet {
  id: string;
  category: string;
  label: string;
  desc: string;
  py: string;
  doc: SnippetDoc;
}

export const SNIPPETS: Snippet[] = [
  // ---------- Movement ----------
  { id: 'forward', category: 'Movement', label: 'Maju', desc: 'Robot maju sekian detik',
    py: 'robot.forward(${1:1}, speed="${2:medium}")',
    doc: { title: 'robot.forward', body: 'Menggerakkan robot maju selama beberapa detik.', example: 'robot.forward(2, speed="fast")',
      params: [{ name: 'detik', desc: 'lama gerak (detik)' }, { name: 'speed', desc: '"slow" / "medium" / "fast"' }] } },
  { id: 'reverse', category: 'Movement', label: 'Mundur', desc: 'Robot mundur sekian detik',
    py: 'robot.reverse(${1:1}, speed="${2:medium}")',
    doc: { title: 'robot.reverse', body: 'Menggerakkan robot mundur.', example: 'robot.reverse(1, speed="slow")',
      params: [{ name: 'detik', desc: 'lama gerak (detik)' }, { name: 'speed', desc: 'kecepatan' }] } },
  { id: 'turn', category: 'Movement', label: 'Belok', desc: 'Belok kiri / kanan',
    py: 'robot.turn("${1:left}", ${2:1}, speed="${3:medium}")',
    doc: { title: 'robot.turn', body: 'Membelokkan robot ke kiri atau kanan.', example: 'robot.turn("right", 1, speed="fast")',
      params: [{ name: 'arah', desc: '"left" atau "right"' }, { name: 'detik', desc: 'lama belok' }, { name: 'speed', desc: 'kecepatan' }] } },
  { id: 'steer', category: 'Movement', label: 'Setir', desc: 'Maju sambil menyetir',
    py: 'robot.steer(${1:1}, steering=${2:0}, speed="${3:medium}")',
    doc: { title: 'robot.steer', body: 'Maju sambil menyetir. Steering −100 (kiri) … 100 (kanan).', example: 'robot.steer(2, steering=30, speed="medium")',
      params: [{ name: 'detik', desc: 'lama gerak' }, { name: 'steering', desc: '−100..100' }, { name: 'speed', desc: 'kecepatan' }] } },
  { id: 'stop', category: 'Movement', label: 'Berhenti', desc: 'Hentikan roda',
    py: 'robot.stop(${1:2})',
    doc: { title: 'robot.stop', body: 'Menghentikan roda (2 atau 4 roda).', example: 'robot.stop(2)', params: [{ name: 'roda', desc: '2 atau 4' }] } },
  { id: 'stop_all', category: 'Movement', label: 'Stop semua', desc: 'Hentikan semua motor',
    py: 'robot.stop_all()',
    doc: { title: 'robot.stop_all', body: 'Menghentikan seluruh motor seketika.', example: 'robot.stop_all()' } },

  // ---------- Timing ----------
  { id: 'wait', category: 'Timing', label: 'Tunggu', desc: 'Jeda beberapa detik',
    py: 'wait(${1:1})',
    doc: { title: 'wait', body: 'Menjeda program selama beberapa detik.', example: 'wait(0.5)', params: [{ name: 'detik', desc: 'lama jeda' }] } },
  { id: 'wait_until', category: 'Timing', label: 'Tunggu sampai', desc: 'Tunggu sampai syarat benar',
    py: 'wait_until(${1:sensors.button1()})',
    doc: { title: 'wait_until', body: 'Menunggu sampai suatu kondisi bernilai benar.', example: 'wait_until(sensors.distance("G1") < 10)', params: [{ name: 'kondisi', desc: 'ekspresi Boolean' }] } },

  // ---------- Program Flow ----------
  { id: 'forever', category: 'Program Flow', label: 'Ulang selamanya', desc: 'while True:',
    py: 'while True:\n\t${1:pass}',
    doc: { title: 'while True:', body: 'Mengulang blok di dalamnya terus-menerus.', example: 'while True:\n    robot.forward(1)' } },
  { id: 'repeat', category: 'Program Flow', label: 'Ulang N kali', desc: 'for _ in range(n):',
    py: 'for _ in range(${1:10}):\n\t${2:pass}',
    doc: { title: 'for _ in range(n):', body: 'Mengulang sebanyak n kali.', example: 'for _ in range(4):\n    robot.forward(1)\n    robot.turn("right", 1)', params: [{ name: 'n', desc: 'berapa kali diulang' }] } },
  { id: 'while', category: 'Program Flow', label: 'Selama', desc: 'while <syarat>:',
    py: 'while ${1:sensors.button1()}:\n\t${2:pass}',
    doc: { title: 'while <syarat>:', body: 'Mengulang selama syarat benar.', example: 'while sensors.distance("G1") > 10:\n    robot.forward(0.2)' } },
  { id: 'if', category: 'Program Flow', label: 'Jika', desc: 'if / else',
    py: 'if ${1:sensors.button1()}:\n\t${2:pass}\nelse:\n\t${3:pass}',
    doc: { title: 'if / else', body: 'Menjalankan blok berbeda tergantung syarat.', example: 'if sensors.distance("G1") < 10:\n    robot.stop_all()\nelse:\n    robot.forward(1)' } },
  { id: 'break', category: 'Program Flow', label: 'Keluar loop', desc: 'break',
    py: 'break', doc: { title: 'break', body: 'Keluar dari perulangan.', example: 'while True:\n    if sensors.button1():\n        break' } },

  // ---------- Display ----------
  { id: 'text', category: 'Display', label: 'Tampilkan teks', desc: 'Tulis teks di layar',
    py: 'display.text("${1:Hi!}")',
    doc: { title: 'display.text', body: 'Menampilkan teks di layar OLED.', example: 'display.text("Halo!")', params: [{ name: 'teks', desc: 'kalimat yang ditampilkan' }] } },
  { id: 'face', category: 'Display', label: 'Tampilkan wajah', desc: 'Emoji kaomoji',
    py: 'display.face("${1:(^_^)}")',
    doc: { title: 'display.face', body: 'Menampilkan wajah kaomoji.', example: 'display.face("(^_^)")' } },
  { id: 'brightness', category: 'Display', label: 'Kecerahan', desc: 'Atur kecerahan',
    py: 'display.brightness(${1:100})',
    doc: { title: 'display.brightness', body: 'Mengatur kecerahan layar (0–100).', example: 'display.brightness(50)', params: [{ name: 'nilai', desc: '0..100' }] } },
  { id: 'clear', category: 'Display', label: 'Bersihkan', desc: 'Kosongkan layar',
    py: 'display.clear()', doc: { title: 'display.clear', body: 'Mengosongkan layar.', example: 'display.clear()' } },
  { id: 'led', category: 'Display', label: 'Warna LED', desc: 'Nyalakan LED warna',
    py: 'led.color("${1:#ff0000}", ${2:1})',
    doc: { title: 'led.color', body: 'Menyalakan LED dengan warna (hex) selama beberapa detik.', example: 'led.color("#00ff00", 2)', params: [{ name: 'warna', desc: 'hex, mis "#ff0000"' }, { name: 'detik', desc: 'lama nyala' }] } },

  // ---------- Audio ----------
  { id: 'tone', category: 'Audio', label: 'Bunyi nada', desc: 'Mainkan nada',
    py: 'audio.tone("${1:C4}", ${2:0.5})',
    doc: { title: 'audio.tone', body: 'Memainkan nada (mis. "C4") selama beberapa detik.', example: 'audio.tone("C4", 0.5)', params: [{ name: 'nada', desc: 'nama nada' }, { name: 'detik', desc: 'durasi' }] } },
  { id: 'volume', category: 'Audio', label: 'Volume', desc: 'Atur volume',
    py: 'audio.volume(${1:80})', doc: { title: 'audio.volume', body: 'Mengatur volume (0–100).', example: 'audio.volume(60)', params: [{ name: 'nilai', desc: '0..100' }] } },
  { id: 'audio_stop', category: 'Audio', label: 'Stop suara', desc: 'Hentikan suara',
    py: 'audio.stop()', doc: { title: 'audio.stop', body: 'Menghentikan semua suara.', example: 'audio.stop()' } },

  // ---------- Sensors & Data ----------
  { id: 'ultrasonic', category: 'Sensors & Data', label: 'Jarak (ultrasonik)', desc: 'Baca jarak',
    py: 'sensors.ultrasonic(port="${1:G1}", unit="${2:cm}")',
    doc: { title: 'sensors.ultrasonic', body: 'Membaca jarak dari sensor ultrasonik.', example: 'if sensors.ultrasonic(port="G1") < 10:\n    robot.stop_all()', params: [{ name: 'port', desc: 'port sensor, mis "G1"' }, { name: 'unit', desc: '"cm" / "inch"' }] } },
  { id: 'button1', category: 'Sensors & Data', label: 'Tombol 1', desc: 'Tombol A ditekan?',
    py: 'sensors.button1()', doc: { title: 'sensors.button1', body: 'Bernilai benar saat tombol 1 ditekan.', example: 'if sensors.button1():\n    display.text("A!")' } },
  { id: 'analog', category: 'Sensors & Data', label: 'Baca analog', desc: 'Nilai analog port',
    py: 'sensors.analog("${1:G1}")', doc: { title: 'sensors.analog', body: 'Membaca nilai analog (0–1023) dari port.', example: 'x = sensors.analog("G1")', params: [{ name: 'port', desc: 'port, mis "G1"' }] } },
  { id: 'set_digital', category: 'Sensors & Data', label: 'Set digital', desc: 'Tulis HIGH/LOW',
    py: 'sensors.set_digital("${1:G1}", "${2:HIGH}")', doc: { title: 'sensors.set_digital', body: 'Menyetel pin digital ke HIGH atau LOW.', example: 'sensors.set_digital("G1", "HIGH")', params: [{ name: 'port', desc: 'port' }, { name: 'nilai', desc: '"HIGH" / "LOW"' }] } },

  // ---------- Variables ----------
  { id: 'set_var', category: 'Variables', label: 'Buat variabel', desc: 'x = nilai',
    py: '${1:x} = ${2:0}', doc: { title: 'variabel', body: 'Menyimpan nilai ke sebuah variabel.', example: 'skor = 0\nskor = skor + 1' } },

  // ---------- Functions ----------
  { id: 'def', category: 'Functions', label: 'Buat fungsi', desc: 'def nama():',
    py: 'def ${1:fungsi}():\n\t${2:pass}', doc: { title: 'def', body: 'Membuat fungsi yang bisa dipanggil berkali-kali.', example: 'def maju():\n    robot.forward(1)\n\nmaju()' } },
  { id: 'call', category: 'Functions', label: 'Panggil fungsi', desc: 'nama()',
    py: '${1:fungsi}()', doc: { title: 'panggil fungsi', body: 'Menjalankan fungsi yang sudah dibuat.', example: 'maju()' } },

  // ---------- AI ----------
  { id: 'camera_on', category: 'AI', label: 'Nyalakan kamera', desc: 'camera.on()',
    py: 'camera.on()', doc: { title: 'camera.on', body: 'Menyalakan kamera AI.', example: 'camera.on()' } },
  { id: 'detected', category: 'AI', label: 'Terdeteksi?', desc: 'ai.detected("...")',
    py: 'ai.detected("${1:cat}")', doc: { title: 'ai.detected', body: 'Bernilai benar bila objek terdeteksi kamera.', example: 'if ai.detected("cat"):\n    display.text("kucing!")', params: [{ name: 'label', desc: 'nama objek' }] } },
];

export const SNIPPET_CATEGORIES = [
  'Movement', 'Timing', 'Program Flow', 'Display', 'Audio', 'Sensors & Data', 'Variables', 'Functions', 'AI',
] as const;

export const SNIPPET_BY_ID: Readonly<Record<string, Snippet>> = Object.fromEntries(
  SNIPPETS.map((s) => [s.id, s]),
);
