# Robotku — Prompt Fiksasi Block Coding & Simulator agar Sesuai Skematik

Prompt-prompt di bawah dibuat untuk ditempel ke coding agent (Claude Code / Cursor)
pada repo `robotku-main`. Urutan sudah berdasarkan ketergantungan. Jalankan **P0 dulu**;
setelah P0 selesai, **P1 dan P2 boleh paralel**. P3 penutup (verifikasi).

Setiap prompt sudah memuat **Fakta Hardware (dari skematik)** agar agen tidak menebak pin.

---

## FAKTA HARDWARE — Skematik ESP32_Controller_V3 (acuan semua prompt)

Board = ESP32-WROOM-32D. Yang **benar-benar ada** di board:

| Peran | Net skematik | GPIO | Catatan |
|---|---|---|---|
| Servo KIRI (drive) | PWM5 | GPIO33 | SG90 **continuous** (tank drive), bukan H-bridge |
| Servo KANAN (drive) | PWM4 | GPIO25 | hanya jika `HAS_SERVO_R=1` (disolder & diuji) |
| Port PWM lain | PWM3 / PWM2 / PWM | GPIO26 / GPIO27 / GPIO14 | header aktuator, belum tentu terpasang |
| Buzzer (pasif, tone) | BUZZ | **GPIO13** | firmware saat ini salah tulis 26 → fiksasi FW-02 |
| RGB LED (R/G/B) | LED1 / LED2 / LED3 | GPIO16 / GPIO17 / GPIO5 | common cathode, via R 100Ω |
| LED indikator | Bt_LED | GPIO4 | opsional |
| OLED SSD1306 (I2C) | SDA / SCL | GPIO21 / GPIO22 | teks status saja, **bukan** LCD grafis |
| Serial/flash | TXD/RXD (UART0) | GPIO1 / GPIO3 | via CH340C |
| Reserved (strapping) | — | GPIO0, GPIO12, GPIO15 | jangan dipakai aktuator |

Yang **TIDAK ADA** di board (tapi masih muncul di block & simulator warisan `astroidV2`):
LED Matrix 5×5, LCD grafis/shape, head servo Pitch/Yaw, sensor ultrasonic, suhu,
kelembaban, cahaya, heading/kompas. Gripper: **hanya ada bila servo/port dikonfigurasi**,
belum tentu terpasang.

Kapabilitas nyata singkatnya: **tank drive 2 servo + buzzer tone + RGB LED + OLED teks +
maksimal 5 port PWM**. Sisanya tidak boleh dikirim ke board tanpa jalur UNSUPPORTED.

Transport & protokol sudah benar: BLE Nordic UART Service
`6e400001-b5a3-f393-e0a9-e50e24dcca9e` (RX `...0002` write / TX `...0003` notify),
perintah = line-delimited JSON `{"command":"...","...":...};`. **Jangan diubah.**

---

## P0 — (URGENT #1) Profil Kapabilitas Board dari Skematik

**Tujuan:** buat SATU sumber kebenaran kapabilitas board (diturunkan dari skematik) yang
dibaca oleh firmware handshake, toolbox block, simulator, dan controller. Hentikan
`robotProfiles.ts` yang datar "semua opcode ada".

**Baca dulu (jangan ubah sebelum paham):**
`src/robotProfiles.ts`, `src/domain/protocol.ts`, `src/domain/ports.ts`,
`firmware/robotku-esp32/src/main.cpp` (bagian HELLO_ACK `capabilities[]` + scan `ports[]`),
`firmware/robotku-esp32/src/config.h`.

**Kerjakan:**
1. Buat tipe/objek `BoardProfile` baru (mis. `src/domain/boardProfile.ts`) yang mendeskripsikan
   hardware NYATA dari Fakta Hardware di atas: daftar `opcodes` yang didukung, `ports` (nomor
   port → GPIO + peran + `wired: boolean`), `actuators` (servoL, servoR opsional, buzzer, rgbLed,
   oled), dan `sensors` (kosong/duduk sesuai yang benar-benar terpasang — default: tidak ada
   ultrasonic/suhu/kelembaban/cahaya/heading).
2. Sediakan profil default `robotkuEsp32V3` yang cocok 1:1 dengan tabel Fakta Hardware.
3. Buat helper `isSupported(opcode, profile)` dan `portIsWired(port, profile)`.
4. Selaraskan dengan firmware: pastikan daftar `capabilities[]` dan `ports[]` di HELLO_ACK
   memakai konsep yang sama, sehingga profil web bisa **di-override oleh HELLO_ACK** saat
   robot benar-benar tersambung (profil statis = fallback saat simulator/guest).

**Kriteria selesai:**
- Ada satu `BoardProfile` yang jadi acuan; `robotProfiles.ts` tetap sebagai kamus opcode,
  tapi "didukung atau tidak" diputuskan `BoardProfile`, bukan keberadaan opcode.
- Profil cocok dengan tabel pin (lihat Fakta Hardware); tiap perbedaan ditulis sebagai TODO.
- Tidak ada perubahan pada UUID/format protokol.

---

## P1 — (URGENT #2) Guard Block: toolbox hanya menampilkan yang didukung board

**Tujuan:** wujudkan "board profile guard" (fitur M2 di IRD): block yang perintahnya tidak
bisa dijalankan board disembunyikan atau di-disable dengan tooltip alasannya — supaya tidak
ada perintah "gagal diam-diam".

**Baca dulu:** hasil P0 (`BoardProfile`), `src/categories/*.ts` (khususnya `looks.ts`,
`mechanisms.ts`, `sensors.ts`, `audio.ts`, `motors.ts`), pembuat toolbox/editor Blockly,
`src/blockcoding/generateProgram.ts`.

**Fakta yang harus tercermin:** block yang saat ini merujuk hardware TIDAK ADA di board —
`display_matrix` / `display_clear_matrix` / LCD (looks.ts), `mechanism_set_head` (pitch/yaw),
`sensor_ultrasonic` / `sensor_temperature` / `sensor_humidity` / `sensor_light` /
`sensor_heading` / `sensor_distance` (sensors.ts). Yang didukung: drive (tank), `SET_PORT`,
gripper (bila diwire), buzzer/tone, `SET_LED_COLOR` (RGB), teks OLED.

**Kerjakan:**
1. Saat membangun toolbox, saring/disable block yang opcode-nya `!isSupported(...)` menurut
   `BoardProfile` aktif. Default (belum konek) pakai profil `robotkuEsp32V3`.
2. Block yang tak didukung: beri gaya "disabled" + tooltip ("Hardware ini tidak ada pada board
   Robotku V3") — JANGAN hapus definisinya (biar profil board lain masih bisa memakainya nanti).
3. `generateProgram` harus menolak/menandai block tak didukung, dan slider Port Control untuk
   port `wired:false` di-disable, bukan diam.
4. Saat robot tersambung, pakai `capabilities[]`/`ports[]` dari HELLO_ACK untuk memperbarui
   guard secara live.

**Kriteria selesai:**
- Tidak mungkin men-drag & menjalankan block yang mengirim opcode di luar kapabilitas board
  tanpa peringatan.
- Program hasil generate tidak pernah memuat opcode yang board tak dukung tanpa jalur
  UNSUPPORTED.
- Toolbox untuk profil default hanya menampilkan block yang relevan dengan skematik.

---

## P2 — (URGENT #3) Fidelity Simulator: modelkan robot Robotku yang NYATA

**Tujuan:** buat simulator mencerminkan robot sesungguhnya (tank drive 2 servo, buzzer, RGB,
OLED teks, 5 port), bukan robot generik warisan. Fitur yang tak ada hardware-nya ditandai
jelas "simulasi saja / tidak ada di board" atau dihilangkan dari UI sim.

**Baca dulu:** hasil P0, `src/runtime/SimSink.ts`, komponen SimStage/RobotSprite di
`src/pages`/`src/components`, `src/runtime/ProgramRunner.ts`, `src/pages/control/BaseMode` (acuan
kinematika).

**Fakta yang harus dipatuhi:** drive = DUA servo continuous (kiri GPIO33, kanan GPIO25 bila
ada), `SET_PORT value 0` = benar-benar diam (hormati trim), `SET_LED_COLOR` → warna RGB,
buzzer = tone. State sim saat ini (`SimState`) memuat `matrix[25]`, `lcdShape`, `headPitch/Yaw`,
sensor `ultrasonic/temperature/humidity/light/heading` — semuanya TANPA padanan hardware.

**Kerjakan:**
1. Samakan kinematika `SimSink` dengan `driveChannel()` firmware & BaseMode (tank drive), bukan
   model differential generik bila berbeda.
2. Untuk opcode tak didukung board (matrix, LCD shape, head servo, sensor hantu): jadikan
   no-op yang **tercatat di console sim** ("diabaikan: tidak ada di board Robotku V3"), atau
   sembunyikan panel/visualnya di SimStage.
3. Pastikan `SET_PORT`, `DRIVE_DIRECT`, `SET_LED_COLOR`, buzzer, dan teks OLED tervisualisasi
   benar; port `wired:false` tidak digambar sebagai aktuator hidup.
4. Simulator memakai `BoardProfile` yang sama dengan guard block (P1) agar dua-duanya konsisten.

**Kriteria selesai:**
- Perilaku sim = perilaku firmware untuk opcode yang didukung (drive, port, LED, buzzer).
- Fitur hantu tidak lagi tampil sebagai kemampuan nyata; kalau muncul, jelas berlabel "sim only".
- Simulator dan toolbox membaca profil yang sama (tidak ada dua daftar kapabilitas berbeda).

---

## P3 — (Penutup) Tes rekonsiliasi opcode: block → protokol → firmware

**Tujuan:** jaring pengaman otomatis supaya setiap opcode yang bisa dipancarkan block punya
handler firmware ATAU balasan UNSUPPORTED yang terdefinisi — dan ini tidak melenceng lagi ke depan.

**Baca dulu:** `src/robotProfiles.ts`, `src/domain/protocol.ts`, `src/categories/*.ts`,
`firmware/robotku-esp32/src/main.cpp` (daftar `strcmp(cmd, "...")`), `vitest.config.ts`.

**Kerjakan:**
1. Tulis test (vitest) yang: mengumpulkan semua opcode yang mungkin di-generate oleh block,
   lalu memverifikasi tiap opcode berada di salah satu dari — (a) didukung `BoardProfile` &
   ada handler firmware, atau (b) host-only (AI/META, tak dikirim ke board), atau (c) terdaftar
   sebagai UNSUPPORTED yang sengaja.
2. Test gagal bila ada opcode "menggantung" (dikirim ke board tanpa handler & tanpa UNSUPPORTED).
3. Hasilnya: tabel opcode ↔ status, disimpan ke `docs/` sebagai lampiran Protokol Robotku v1.

**Kriteria selesai:**
- `npm run test` menandai opcode menggantung sebagai kegagalan.
- Ada dokumen opcode-vs-handler yang sinkron dengan firmware dan `BoardProfile`.

---

### Catatan urutan
- **P0 wajib pertama** — P1 & P2 bergantung pada `BoardProfile`.
- Sinkronkan juga dengan fiksasi firmware di file Excel (FW-02 buzzer GPIO13, FW-06 RGB
  GPIO16/17/5), karena guard/sim yang benar tidak ada artinya kalau firmware masih salah pin.
