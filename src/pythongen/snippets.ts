// src/pythongen/snippets.ts
//
// Flyout snippets for Python mode. `py` uses CodeMirror snippet syntax (${n:...}
// placeholders, Tab between them). `docs` points at a slug in docs/registry.ts —
// docs content lives there now (one source for panel + /docs/reference).

export interface Snippet {
  id: string;
  category: string;
  label: string;
  desc: string;
  py: string;
  docs: string; // slug in docs/registry.ts
}

export const SNIPPETS: Snippet[] = [
  // ---------- Movement ----------
  { id: 'forward', category: 'Movement', label: 'Maju', desc: 'Robot maju sekian detik', py: 'robot.forward(${1:1}, speed="${2:medium}")', docs: 'movement/forward' },
  { id: 'reverse', category: 'Movement', label: 'Mundur', desc: 'Robot mundur sekian detik', py: 'robot.reverse(${1:1}, speed="${2:medium}")', docs: 'movement/reverse' },
  { id: 'turn', category: 'Movement', label: 'Belok', desc: 'Belok kiri / kanan', py: 'robot.turn("${1:left}", ${2:1}, speed="${3:medium}")', docs: 'movement/turn' },
  { id: 'steer', category: 'Movement', label: 'Setir', desc: 'Maju sambil menyetir', py: 'robot.steer(${1:1}, steering=${2:0}, speed="${3:medium}")', docs: 'movement/steer' },
  { id: 'stop', category: 'Movement', label: 'Berhenti', desc: 'Hentikan roda', py: 'robot.stop(${1:2})', docs: 'movement/stop' },
  { id: 'stop_all', category: 'Movement', label: 'Stop semua', desc: 'Hentikan semua motor', py: 'robot.stop_all()', docs: 'movement/stop-all' },

  // ---------- Timing ----------
  { id: 'wait', category: 'Timing', label: 'Tunggu', desc: 'Jeda beberapa detik', py: 'wait(${1:1})', docs: 'timing/wait' },
  { id: 'wait_until', category: 'Timing', label: 'Tunggu sampai', desc: 'Tunggu sampai syarat benar', py: 'wait_until(${1:sensors.button1()})', docs: 'timing/wait-until' },

  // ---------- Program Flow ----------
  { id: 'forever', category: 'Program Flow', label: 'Ulang selamanya', desc: 'while True:', py: 'while True:\n\t${1:pass}', docs: 'flow/forever' },
  { id: 'repeat', category: 'Program Flow', label: 'Ulang N kali', desc: 'for _ in range(n):', py: 'for _ in range(${1:10}):\n\t${2:pass}', docs: 'flow/repeat' },
  { id: 'while', category: 'Program Flow', label: 'Selama', desc: 'while <syarat>:', py: 'while ${1:sensors.button1()}:\n\t${2:pass}', docs: 'flow/while' },
  { id: 'if', category: 'Program Flow', label: 'Jika', desc: 'if / else', py: 'if ${1:sensors.button1()}:\n\t${2:pass}\nelse:\n\t${3:pass}', docs: 'flow/if' },
  { id: 'break', category: 'Program Flow', label: 'Keluar loop', desc: 'break', py: 'break', docs: 'flow/break' },

  // ---------- Display ----------
  { id: 'text', category: 'Display', label: 'Tampilkan teks', desc: 'Tulis teks di layar', py: 'display.text("${1:Hi!}")', docs: 'display/text' },
  { id: 'face', category: 'Display', label: 'Tampilkan wajah', desc: 'Emoji kaomoji', py: 'display.face("${1:(^_^)}")', docs: 'display/face' },
  { id: 'brightness', category: 'Display', label: 'Kecerahan', desc: 'Atur kecerahan', py: 'display.brightness(${1:100})', docs: 'display/brightness' },
  { id: 'clear', category: 'Display', label: 'Bersihkan', desc: 'Kosongkan layar', py: 'lcd.clear()', docs: 'display/lcd-clear' },
  { id: 'led', category: 'Display', label: 'Warna LED', desc: 'Nyalakan LED warna', py: 'led.color("${1:#ff0000}", ${2:1})', docs: 'display/led-color' },

  // ---------- Audio ----------
  { id: 'tone', category: 'Audio', label: 'Bunyi nada', desc: 'Mainkan nada', py: 'audio.tone("${1:C4}", ${2:0.5})', docs: 'audio/tone' },
  { id: 'volume', category: 'Audio', label: 'Volume', desc: 'Atur volume', py: 'audio.volume(${1:80})', docs: 'audio/volume' },
  { id: 'audio_stop', category: 'Audio', label: 'Stop suara', desc: 'Hentikan suara', py: 'audio.stop()', docs: 'audio/stop' },

  // ---------- Sensors & Data ----------
  { id: 'ultrasonic', category: 'Sensors & Data', label: 'Jarak (ultrasonik)', desc: 'Baca jarak', py: 'sensors.ultrasonic(port="${1:G1}", unit="${2:cm}")', docs: 'sensors/ultrasonic' },
  { id: 'button1', category: 'Sensors & Data', label: 'Tombol 1', desc: 'Tombol A ditekan?', py: 'sensors.button1()', docs: 'sensors/button' },
  { id: 'analog', category: 'Sensors & Data', label: 'Baca analog', desc: 'Nilai analog port', py: 'sensors.analog("${1:G1}")', docs: 'sensors/analog' },
  { id: 'set_digital', category: 'Sensors & Data', label: 'Set digital', desc: 'Tulis HIGH/LOW', py: 'sensors.set_digital("${1:G1}", "${2:HIGH}")', docs: 'sensors/set-digital' },

  // ---------- Variables ----------
  { id: 'set_var', category: 'Variables', label: 'Buat variabel', desc: 'x = nilai', py: '${1:x} = ${2:0}', docs: 'variables/set' },

  // ---------- Functions ----------
  { id: 'def', category: 'Functions', label: 'Buat fungsi', desc: 'def nama():', py: 'def ${1:fungsi}():\n\t${2:pass}', docs: 'functions/def' },
  { id: 'call', category: 'Functions', label: 'Panggil fungsi', desc: 'nama()', py: '${1:fungsi}()', docs: 'functions/call' },

  // ---------- AI ----------
  { id: 'camera_on', category: 'AI', label: 'Nyalakan kamera', desc: 'camera.on()', py: 'camera.on()', docs: 'ai/camera' },
  { id: 'detected', category: 'AI', label: 'Terdeteksi?', desc: 'ai.detected("...")', py: 'ai.detected("${1:cat}")', docs: 'ai/detected' },
];

export const SNIPPET_CATEGORIES = [
  'Movement', 'Timing', 'Program Flow', 'Display', 'Audio', 'Sensors & Data', 'Variables', 'Functions', 'AI',
] as const;

export const SNIPPET_BY_ID: Readonly<Record<string, Snippet>> = Object.fromEntries(
  SNIPPETS.map((s) => [s.id, s]),
);
