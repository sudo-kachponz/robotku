# Handoff Robotku → Claude Code (lanjutan sesi 28 Nov 2026)

> **Cara pakai:** buka terminal, `cd ~/robotku && claude`, lalu ketik:
> *"Baca docs/HANDOFF-CLAUDE-CODE.md sampai habis, lalu kerjakan bagian 'Tugas berikutnya' berurutan. Tanya saya sebelum flash firmware atau push."*
>
> Dokumen ini berisi semua konteks dari sesi sebelumnya: fakta hardware yang sudah diukur,
> status software, cara flash, rencana uji lengkap (blok, I/O, mikrofon, AI, relay), dan
> rancangan + copywriting **Lab I/O** (pengganti Port Control). Bahasa kerja: Indonesia.

---

## 0. Aturan kerja (wajib)

1. **Semua file Robotku ada di `~/robotku` (repo) dan `~/robotku-tts-runtime` (Piper/Whisper lokal).
   Jangan pernah membuat atau menyimpan apa pun soal Robotku di `~/Private`** (itu area terenkripsi
   khusus pekerjaan Datasaur).
2. Commit tanpa trailer `Co-Authored-By: Claude` dan tanpa "Generated with Claude Code".
3. **Push dilakukan user sendiri** (auto-mode classifier menolak `git push`). Beri user perintah ini:
   ```bash
   cd ~/robotku && git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main
   ```
   (`gh` aktif sebagai akun `sudo-kachponz`; `~/.git-credentials` mungkin berisi token akun lain.)
4. **Flash firmware: tanya user dulu**, dan **jangan pernah menghentikan flash di tengah jalan**.
5. Sebelum mengklaim sesuatu "jalan di robot", buktikan di hardware (log serial / nilai telemetri).
6. Scratch file (skrip tes, rekaman) taruh di direktori sementara sesi, bukan di repo.

---

## 1. Peta repo & deploy

| Bagian | Lokasi |
|---|---|
| Web (Next.js 15 Pages Router, static export) | `src/` |
| Firmware ESP32 (PlatformIO) | `firmware/robotku-esp32/` (env `makerkit_s3`, `makerkit`, `v3`) |
| Worker AI (Cloudflare) `/chat` `/tts` `/stt` | `server/robotku-ai-backend/` |
| Worker relay (Cloudflare DO) `/ws` `/login` | `server/robotku-relay/` (+ `migrations/001_devices.sql`, `tools/seed-devices.mjs`) |
| Server TTS Piper lokal | `server/robotku-tts/server.py` (runtime: `~/robotku-tts-runtime`) |
| Dokumen produk | `docs/STEM-KIT.md` (kurikulum, BOM, roadmap) |

**Deploy:** push ke `main` → GitHub Actions `Deploy to hub.robotku.id` → `https://hub.robotku.id/development/`
(cabang `stable` → root). Cek versi live: `curl -s https://hub.robotku.id/development/version.json` (field `sha`).
Pantau: `gh run list --limit 3`, `gh run view <id> --log-failed`.

**Cek wajib sebelum commit:** `npx tsc --noEmit && npm run -s lint && npx vitest run` (terakhir: 296 tes lolos).

**Status commit:** `de33422` (font self-host) **belum di-push**; semua sebelumnya sudah live (`fc31890`).

---

## 2. Fakta hardware (terukur di board asli, 28 Nov 2026)

Board: **Robotku Makerkit S3 v1.3**, PCB putih, casing 3D-print hitam. Skematik: `~/Downloads/SCH_Makerkit-V1.3_2026-11-24.pdf`.

- Chip **ESP32-S3**, MAC `14:c1:9f:52:82:74`. Flash **16 MB QUAD** (Boya, eFuse quad) + PSRAM 8 MB octal
  → profil PlatformIO **`qio_opi`** (bukan `opi_opi`: itu boot-loop). Serial lewat **CH340C** (UART0, 115200).
- Pin (sudah diverifikasi): mic INMP441 **SCK IO14, WS IO21, SD IO13** (L/R=GND); speaker MAX98357A
  BCLK IO41, LRC IO42, DIN IO40; OLED SSD1306 SDA IO38 / SCL IO39; buzzer IO12; 4× WS2812B IO11;
  servo **P1 = IO10 (roda kiri), P2 = IO9 (roda kanan), P5 = IO19 (servo aksesori)**; **TOUCH 1 = IO1**
  (pad Touch2 **tidak ada** di PCB); AUX_I/O1–6 = web **G1–G6** = IO4, IO5, IO6, IO7, IO15, IO16;
  HC-SR04 di header Distance_Sensor: **Trig IO16 (AUX6), Echo IO15 (AUX5)** — Echo 5 V perlu pembagi 1k/2k;
  LED status: wifi IO47, BT IO48 (belum dikendalikan firmware).
- Firmware sekarang: **2.6.2-mk** (BLE + WiFi + relay + OTA). Kode relay robot ini di NVS: **`KV5KDZ`**.
- Library penting: `madhephaestus/ESP32Servo @ 3.0.9` **dikunci** untuk S3 (≥3.1 pakai MCPWM dan
  **hang di `Servo::attach()`** pada core 2.0.17 → robot beku saat perintah gerak pertama).
- UART RX buffer diperbesar ke 16 KB (TTS lewat USB dulu kehilangan byte).

### ⚠ Masalah terbuka #1 — robot restart terus (blocker)
Sejak ~19:23, board **mati-hidup ±1×/detik**: log boot selalu berhenti di `[boot] startupTone...` lalu
`rst:0x1 (POWERON)`; kernel: `usb 1-4: USB disconnect` + `error -71`. Karena BLE baru di-init **setelah**
nada pembuka, robot **tidak pernah muncul di scan Bluetooth** (sudah dicek: adapter laptop sehat, flag
Chrome `enable-experimental-web-platform-features` aktif, scan 15 s tidak menemukan robot).
Siang hari nada yang sama normal → kemungkinan jalur daya (kabel/port/power bank/buzzer) melemah.

**Langkah diagnosis yang disarankan (minta izin user dulu):**
1. Tambah guard di `src/main.cpp` sekitar `startupTone();` di `setup()`:
   `#ifndef NO_STARTUP_TONE ... #endif`.
2. Build + flash **app saja** (chip tertahan di bootloader selama flash, jadi aman walau USB goyang):
   ```bash
   cd ~/robotku/firmware/robotku-esp32
   PLATFORMIO_BUILD_FLAGS="-D NO_STARTUP_TONE" pio run -e makerkit_s3
   python ~/.platformio/packages/tool-esptoolpy/esptool.py --chip esp32s3 -p /dev/ttyUSB0 -b 460800 \
     write_flash 0x10000 .pio/build/makerkit_s3/firmware.bin
   ```
   (PlatformIO CLI: `python3 -m venv /tmp/pio && /tmp/pio/bin/pip install platformio`; toolchain sudah ada di `~/.platformio`.)
3. Tangkap log boot tanpa reset DTR/RTS (set `dtr=False, rts=False` sebelum `open()`), cari
   `[boot] READY`. Jika stabil → nada pembuka pemicu drop daya; ganti nada jadi lebih lembut/singkat
   atau pindah ke setelah BLE init. Minta user cek kabel USB-C, port, power bank, dan buzzer secara fisik.

---

## 3. Flash firmware (prosedur lengkap)

```bash
cd ~/robotku/firmware/robotku-esp32
pio run -e makerkit_s3 -e makerkit -e v3          # semua varian harus SUCCESS
# app saja (cepat, NVS/relay aman):
python ~/.platformio/packages/tool-esptoolpy/esptool.py --chip esp32s3 -p /dev/ttyUSB0 -b 460800 write_flash 0x10000 .pio/build/makerkit_s3/firmware.bin
```
Bin gabungan untuk web flasher (offset 0): S3 = bootloader@0x0, partitions@0x8000, boot_app0@0xe000, app@0x10000;
ESP32 klasik = bootloader@0x1000. Simpan ke `public/firmware/robotku-<ver>-s3.bin` / `-mk.bin`, update
`public/firmware/manifest*.json` dan versi di `src/components/control/FirmwarePanel.tsx`, naikkan `FW_VERSION` di `main.cpp`.
Verifikasi setelah flash: kirim `{"command":"HELLO","params":{}};` → `HELLO_ACK.fw`, `diag.psram≈8385991`, `diag.flash=16777216`.

---

## 4. Rencana uji SUPER DETAIL

Semua tes hardware: robot di **power bank** bila memungkinkan (port USB laptop bisa drop saat audio keras);
kirim `HEARTBEAT` tiap 0,5 s selama tes (watchdog firmware 2 s → `FAILSAFE`).
Format perintah: JSON + `;` + newline, contoh `{"command":"PLAY_TONE","params":{"frequency":880,"duration_ms":250}};`.

### 4.1 Konektivitas
| # | Jalur | Langkah | Lulus jika |
|---|---|---|---|
| K1 | USB Serial (Web Serial) | Panel Sambungkan → langkah 2 → Kabel USB | badge Online, `HELLO_ACK` diterima |
| K2 | Bluetooth (Web Bluetooth) | langkah 2 → Bluetooth → pilih "Robotku" | sama seperti K1, link `ble` |
| K3 | WiFi provisioning | langkah 4 isi SSID 2.4 GHz | telemetri `WIFI_STATUS {connected:true, ip}` |
| K4 | Relay | setelah K3, HELLO_ACK `diag.relay=true` → "Pindah ke internet" | kontrol jalan lewat relay, kode `KV5KDZ` |
| K5 | Reconnect | reload tab | tersambung lagi otomatis ke relay tersimpan |
| K6 | OTA | Firmware panel → update lewat WiFi | `OTA_*` sukses, fw versi baru di HELLO_ACK |
| K7 | Failsafe | putus link saat motor jalan | motor berhenti ≤2 s, frame `FAILSAFE` |

### 4.2 Semua blok (Block Coding) — cara uji otomatis
1. Buat tes sementara (jangan di-commit) yang membuka `getAstroidToolbox()`, membangun tiap blok di workspace
   Blockly headless + `program_start`, lalu `generateProgram(ws)` → simpan JSON perintah per blok
   (reporter dibungkus `variables_set`). Lihat `src/test/harness.ts` untuk pola.
2. Skrip Python mengirim perintah device tiap blok ke robot (batasi durasi gerak ≤300 ms, kecepatan ≤30%),
   setelah tiap blok kirim `GET_SENSOR_DATA mic_level` sebagai cek "robot masih hidup".
3. Klasifikasi: OK / OK+DATA / UNSUPPORTED / HANG / REBOOT.

**Hasil acuan (fw 2.6.2, 28 Nov):** semua blok gerak, display (termasuk LCD→OLED), LED (semua & per-LED
`NEOPIXEL_SET index 0–3`), audio, tombol 1 (TOUCH 1), analog/digital G1–G6, ultrasonik (−1 tanpa sensor)
→ **OK**. Blok yang **sudah dihapus** dari toolbox karena hardware tidak ada: capit/claw, gripper, kepala,
tombol 2, suhu, kelembapan, cahaya, jarak tempuh, heading (+ reset). Definisi tetap ada agar proyek lama terbuka.

### 4.3 Input/Output manual (butuh manusia)
| Tes | Aksi user | Dibaca | Lulus |
|---|---|---|---|
| Sentuh | sentuh pad TOUCH 1 | `button1` | 1 saat disentuh, 0 dilepas |
| LED per lampu | panel LED: LED 2 hijau, LED 4 biru | mata | hanya lampu itu menyala |
| Buzzer | tombol Buzzer Base Robot | telinga | bunyi dari buzzer board (bukan laptop) |
| Servo | Base Robot ▲▼◀▶ | roda | arah benar; berhenti saat dilepas (cek trim netral) |
| G1–G6 | potensiometer/LDR ke G1 | `analog` | nilai berubah 0–4095 |
| HC-SR04 ➕ | tangan 10/30 cm | `ultrasonic` | nilai ±2 cm |

### 4.4 Mikrofon (fokus — belum terbukti penuh)
| Tes | Prosedur | Lulus |
|---|---|---|
| M1 level | diam 2 s lalu bicara 2 s, baca `mic_level` tiap 200 ms | median bicara ≥ 1,5× median diam (diam terukur ~1.000–1.500 mean / peak 3.000–6.000 setelah HPF 150 Hz) |
| M2 tepuk | baca `mic_clap` (latch) setelah 3 s diam → harus 0; lalu tepuk sekali | 0 saat diam, 1 setelah tepuk (jangan jalankan blok audio sebelumnya: suara speaker bisa memicu latch) |
| M3 rekam | `RECORD_AUDIO secs 3` sambil bicara, lalu `PLAY_RECORDING` | suara sendiri terdengar dari speaker robot |
| M4 MIC_STT | `MIC_STT {secs:8, sr:16000, bits:16, vad:true}` | `MIC_END.speech=true`, rekaman berhenti ±0,9 s setelah diam |
| M5 loopback | putar nada 523 Hz dari speaker sambil rekam | frekuensi dominan 520 ±10 Hz |
Kalibrasi bila gagal: `VAD_MIN_LEVEL` (600), `CLAP_THRESHOLD` (9000, `src/config.h`).

### 4.5 AI ("Sahabatku/Robotku AI")
Alur: mic robot → `/stt` (Whisper) → `/chat` (LLM, persona Indonesia, `voice:true`) → TTS → speaker robot
(μ-law 16 kHz di WiFi/relay, 8 kHz di BLE/USB) → `TTS_DONE {seq}`.
- **Worker AI belum di-deploy**: versi live masih Whisper v1 tanpa kunci bahasa (pernah menghasilkan teks
  Korea) dan `/tts` live rusak (MeloTTS dimatikan Cloudflare 20 Nov). Deploy: `cd server/robotku-ai-backend && npx wrangler login && npx wrangler deploy` (user yang login).
- TTS sementara: Piper lokal. Jalankan:
  `cd ~/robotku-tts-runtime && PIPER_VOICE=voices/id_ID-news_tts-medium.onnx venv/bin/python ~/robotku/server/robotku-tts/server.py`
  lalu di console halaman: `localStorage.setItem('robotku.ttsUrl','http://localhost:5002/tts')`.
- Suara: Piper `id_ID-news_tts`, **pitch 1.3** (dipilih user "suara nomor 3"), EQ dikalibrasi ke klip
  `include/welcome_audio.h`. Jangan ubah tanpa persetujuan.
- Uji: A1 ketik pertanyaan → robot menjawab dari speaker; A2 🎤 mic robot → transkrip benar (Indonesia);
  A3 🗣 Mode Ngobrol 3 giliran, bilang "berhenti" untuk keluar; A4 tanpa robot → suara laptop + toast alasan.
- Untuk debug cepat di terminal: buat skrip yang memakai `faster-whisper` model `turbo` (bahasa `id`) di
  `~/robotku-tts-runtime/venv` + `/chat` + Piper → robot (lewat serial atau relay).

### 4.6 Relay & login kode hardware
- Kode hardware `XXXX-XXXX-XXXX-XXXX` (80 bit) → tabel Postgres `robot_devices` (hash SHA-256 saja) →
  `/login` mengembalikan kode relay + token. **Belum online**: worker relay baru belum di-deploy dan
  **Postgres belum di-hosting** (Hostinger shared tidak bisa Postgres; pilihan: Supabase/Neon/VPS — keputusan user).
- Uji lokal: `initdb` + `psql -f migrations/001_devices.sql`, `TEST_DATABASE_URL=... npm test` di `server/robotku-relay` (9 tes).
- Setelah semua web memakai token: set `REQUIRE_WEB_LOGIN = "1"` di `wrangler.toml` (keamanan: tanpa ini kode 6 karakter cukup untuk mengendalikan robot).

---

## 5. Lab I/O — pengganti "Port Control" (belum dibangun)

**Untuk apa:** meja eksperimen hardware **tanpa coding**. Siswa menggerakkan tiap output dan melihat tiap
sensor secara langsung → pelajaran PWM, analog vs digital, kalibrasi. Juga alat cepat guru untuk mengecek
robot sebelum kelas. Saat ini `src/components/modes/PortMode.tsx` hanya slider P1–P5 (P3/P4 tidak terpasang
di firmware). Gambar board sudah memakai `MakerkitBoardArt` dengan header yang menyala.

**Isi halaman (urutan):**
1. Gambar board (header aktif menyala, LED ikut warna).
2. **Servo**: P1 Roda kiri, P2 Roda kanan, P5 Servo tambahan (slider −100…100, lepas = berhenti) +
   **Trim titik berhenti** per servo continuous (simpan di settings, kirim ke firmware sebagai trim).
3. **Sensor langsung** (polling `GET_SENSOR_DATA` 4×/detik, hanya yang ada di board): Sentuh (TOUCH 1),
   Level mic + Tepuk, Jarak HC-SR04, Analog G1–G6, Digital G1–G6.
4. **Output**: LED 1–4 (warna per lampu), Buzzer, Nada speaker (frekuensi), Teks OLED.

**Copywriting (Bahasa Indonesia, siap pakai):**
- Judul: **Lab I/O** · Subjudul: *"Coba setiap bagian robot satu per satu — tanpa coding."*
- Kartu Servo: judul **"Gerakkan servo"**; label slider kiri *"Mundur"*, tengah *"Berhenti"*, kanan *"Maju"*;
  P1 *"Roda kiri"*, P2 *"Roda kanan"*, P5 *"Servo tambahan"*.
  Info ⓘ: *"Servo bergerak karena sinyal PWM: lebar pulsa menentukan arah dan kecepatan. 1,5 ms = berhenti."*
- Trim: **"Atur titik berhenti"** — *"Roda masih pelan berputar saat Berhenti? Geser sampai roda benar-benar diam, lalu Simpan."*
- Kartu Sensor: judul **"Baca sensor"**; Sentuh *"Sentuh pad TOUCH 1 di board"*; Mikrofon *"Bicara atau tepuk tangan dekat robot"*;
  Jarak *"Pasang sensor HC-SR04 di header Distance_Sensor"* (tampil *"Belum terpasang"* bila −1);
  Analog *"Nilai 0–4095 dari pin G1–G6 (misal potensiometer atau sensor cahaya)"*; Digital *"0 atau 1 (misal tombol)"*.
  Info ⓘ: *"Analog = banyak nilai (seperti volume); digital = hanya nyala/mati."*
- Kartu Output: **"Nyalakan output"**; LED *"Pilih lampu 1–4 lalu warnanya"*; Buzzer *"Bunyikan buzzer"*;
  Speaker *"Mainkan nada (Hz)"*; OLED *"Tulis teks di layar"*.
- Status kosong: *"Sambungkan robot dulu untuk mencoba Lab I/O."* · Error: *"Robot tidak menjawab. Cek kabel atau Bluetooth, lalu coba lagi."*

**Tes wajib:** render test seperti `src/test/connectSetup.test.ts`; hardware: semua kartu menghasilkan efek nyata.

---

## 6. Status UI terbaru (sudah live kecuali disebut)
- Base Robot: gambar board asli, gerak ala stickem (condong saat ditahan, kembali saat dilepas), tanpa Grab/Release.
- Panel Sambungkan Robot: 5 slide bergambar (Nyalakan → Sambungkan sebentar → Kode relay → WiFi → Internet), swipe/panah/titik.
- Panel LED: pilih Semua / LED 1–4.
- Tombol fullscreen di bar atas pada halaman full-bleed.
- Font self-host (`de33422`, **belum push**).

## 7. Tugas berikutnya (urut)
1. Minta user push `de33422`; pantau deploy sampai `version.json` = sha terbaru.
2. Selesaikan **masalah restart robot** (§2) — tanpa ini Bluetooth/WiFi/AI tidak bisa diuji.
3. Jalankan rencana uji §4 (K1–K7, blok, I/O, M1–M5, A1–A4); catat hasil ke `docs/TEST-REPORT-<tanggal>.md`.
4. Bangun **Lab I/O** (§5) dengan copywriting di atas.
5. Keputusan user: hosting Postgres + deploy worker AI & relay, lalu `REQUIRE_WEB_LOGIN=1`.
6. Lihat roadmap lengkap di `docs/STEM-KIT.md` §7.
