# Peta Pin Robotku — V3 vs Makerkit V1.2

> Status: **DRAFT — step 1 dari taskbaru.md.** Dokumen ini ditulis SEBELUM kode apa
> pun. Beberapa pin varian Makerkit **belum terbukti** dan ditandai jelas. Jangan
> menulis `pins_makerkit.h` final sampai baris **PERLU KONFIRMASI** di §2 dijawab.
>
> Sumber kebenaran:
> - V3 → `firmware/robotku-esp32/src/config.h` (terbukti di hardware V3).
> - Makerkit → hanya kode yang JALAN di `ESP32 Robotku_Makerkit-V1.2/` (test per-modul).
>   Apa pun di luar itu = tebakan dan TIDAK dicantumkan sebagai fakta.

---

## 1. Tabel GPIO berdampingan

Legenda: ✅ terbukti dari kode yang jalan · ❓ belum ada bukti (perlu skematik/ukur) ·
— tidak dipakai di varian itu.

| Fungsi | V3 (config.h) | Makerkit V1.2 | Bukti Makerkit |
|---|---|---|---|
| Servo kiri (drive, port 1 / PWM1) | GPIO33 ✅ | GPIO14 ✅ | skematik (SCH_2026-09-30) |
| Servo kanan (drive, port 2 / PWM2) | GPIO25 ✅ | GPIO27 ✅ | skematik |
| Servo aksesoris (positional, port 5 / PWM5) | GPIO26 ✅ | GPIO33 ✅ | skematik |
| OLED SDA (I2C) | GPIO21 ✅ | GPIO21 ✅ | skematik (sama V3) |
| OLED SCL (I2C) | GPIO22 ✅ | GPIO22 ✅ | skematik (sama V3) |
| Port PWM3 / PWM4 (unwired) | — | GPIO26 / GPIO25 | skematik |
| Status LED (Bt_LED) | GPIO4 (unverified) | GPIO4 ✅ | skematik |
| Buzzer | GPIO13 ✅ | GPIO13 ✅ | `src/main.cpp` |
| RGB LED diskrit R / G / B | GPIO16 / 17 / 5 ✅ | **hilang (lihat K1)** | — |
| NeoPixel WS2812B (DATA, 4 LED) | — | GPIO32 ✅ | `test/testRGB.cpp` |
| Mic INMP441 SCK/BCLK (I2S0) | — | GPIO17 ✅ | `test/testMic.cpp` |
| Mic INMP441 WS/LRCL (I2S0) | — | GPIO5 ✅ | `test/testMic.cpp` |
| Mic INMP441 SD/DOUT (I2S0) | — | GPIO16 ✅ | `test/testMic.cpp` |
| Speaker MAX98357A BCLK (I2S1) | — | GPIO19 ✅ | `test/testSpeaker.cpp` |
| Speaker MAX98357A LRC (I2S1) | — | GPIO23 ✅ | `test/testSpeaker.cpp` |
| Speaker MAX98357A DIN (I2S1) | — | GPIO18 ✅ | `test/testSpeaker.cpp` |
| Port PWM P1..P5 | via PORT_CHANNEL ✅ | PWM1=14,2=27,3=26,4=25,5=33 ✅ | skematik |
| Port I2C I1..I5 | share bus 21/22 ✅ | share bus 21/22 ✅ | skematik |

**Tabrakan yang memaksa perubahan:** V3 memakai 16/17/5 untuk RGB diskrit; di Makerkit
tiga pin itu **persis** dipakai mic INMP441 (SD=16, SCK=17, WS=5). Keduanya tidak
mungkin ada bersamaan → lihat K1.

---

## 2. PIN MAKERKIT — TERKONFIRMASI dari skematik (2026-09-30)

Sumber: `SCH_Schematic3_2026-09-30.pdf` (netlist ESP32-WROOM-32D). `pins_makerkit.h`
sudah diisi angka nyata, `#error` dihapus, `pio run -e makerkit` **EXIT 0**.

- [x] `PIN_SERVO_L = 14` (header PWM1 → web port 1)
- [x] `PIN_SERVO_R = 27` (header PWM2 → web port 2)
- [x] `PIN_SERVO_AUX = 33` (header PWM5 → web port 5)
- [x] `PIN_OLED_SDA = 21`, `PIN_OLED_SCL = 22` (sama V3)
- [x] Port PWM: PWM1=14, PWM2=27, PWM3=26, PWM4=25, PWM5=33; I2C share 21/22
- [x] `HAS_SERVO_R = 1` (2 servo drive)

Konvensi header (harus dipatuhi saat menyolder): steker servo drive KIRI ke PWM1,
KANAN ke PWM2, aksesoris ke PWM5 — supaya semantik port 1/2/5 tetap sama seperti V3
(§4). PWM3 (GPIO26) & PWM4 (GPIO25) di-breakout tapi belum diwire di firmware.

---

## 3. Keputusan K1..K5

### K1 — Nasib RGB LED di PCB baru → **PERTANYAAN, rekomendasi (b)**
Karena mic mengambil 16/17/5, RGB diskrit tidak mungkin di pin lama. Dua kemungkinan:
- (a) RGB diskrit tetap ada tapi pindah pin — **tak ada bukti**, butuh 3 pin bebas baru.
- (b) RGB diskrit **diganti WS2812B 4 LED di GPIO32** — **ada bukti** (`testRGB.cpp`).

**Rekomendasi: (b).** Ini satu-satunya jalur yang didukung bukti. Konsekuensi bila (b):
- Varian: `HAS_RGB=0, HAS_NEOPIXEL=1` (Makerkit) vs `HAS_RGB=1, HAS_NEOPIXEL=0` (V3).
- Komentar panjang di config.h "PWM RGB bikin servo stutter karena rebutan timer LEDC"
  menjadi **usang untuk Makerkit** — WS2812B pakai peripheral **RMT**, bukan LEDC.
  Ditulis ulang per-varian, tidak dibiarkan menyesatkan.
- `SET_LED_COLOR` di Makerkit tidak perlu snap ke 8 warna (24-bit penuh). Tambah param
  `index` (0..3 | "all") yang **OPSIONAL** → perintah lama tanpa index tetap sah
  (kompat mundur, taskbaru §7 & §4).

**→ Butuh jawaban user sebelum koding.** (Detail tetap: kalau (a), sebutkan 3 pin barunya.)

### K2 — Inkonsistensi port aux yang sudah ada (perbaiki sekalian) → **firmware yang benar**
- `config.h`: `PIN_SERVO_AUX=26`, `SERVO_AUX_PORT=5` → HELLO_ACK melaporkan **port 5 wired**.
- `src/domain/boardProfile.ts`: `3:{gpio:26}`, `5:{gpio:14, wired:false}` → **salah**.
- `src/domain/hardware.ts`: P5 tanpa gpio.

**Keputusan: firmware (config.h) yang benar.** Itu yang menyetir servo fisik, dan
HELLO_ACK `ports[]` sudah mengonfirmasi port 5 wired saat runtime. Perbaikan:
`boardProfile.ts` & `hardware.ts` → **port 5 = GPIO26, role `aux-servo`**; port 3 tanpa
gpio terkonfirmasi (tandai unknown). Hanya berdampak tampilan statis/offline; di runtime
`profileFromHello()` menimpa `wired` dari `ports[]` live — tapi tabel statis tak boleh
menyesatkan.

### K3 — Audit GPIO (ringkas di sini, per butir di §4)
Tidak ada pin dipakai dua fungsi **di dalam satu varian**. Kolisi 16/17/5 hanya
*antar* varian (RGB V3 vs mic Makerkit) — dan itu diselesaikan lewat pemisahan varian.
Detail aturan boot/ADC/strapping di §4.

### K4 — I2S habis
ESP32 punya **2 port I2S**. Makerkit: mic = `I2S_NUM_0`, speaker = `I2S_NUM_1`.
**Tidak ada port I2S tersisa.** Fitur audio I2S lain di masa depan harus berbagi salah
satu port ini (mis. TX/RX di port yang sama), bukan menambah port baru.

### K5 — PLAY_TONE: buzzer vs I2S → **rekomendasi: Makerkit pakai I2S, V3 tetap buzzer**
Timer LEDC hanya 4: sekarang `tone()`(buzzer) + 3×ESP32Servo = 4, **mentok**.
- **V3:** `PLAY_TONE` tetap ke buzzer (tak ada speaker). Tidak berubah.
- **Makerkit (rekomendasi):** sintesis nada sine/square di RAM → `i2s_write` ke speaker.
  Ini **membebaskan 1 timer LEDC** (buzzer tak lagi butuh ESP32PWM) dan kualitas suara
  jauh lebih baik. Buzzer tetap sebagai **fallback** bila `HAS_SPEAKER=0`.
  Implementasi: `PLAY_TONE`/`SPEAKER_TONE` → `if (HAS_SPEAKER) tone via I2S; else buzzer`.

**→ Rekomendasi, minta persetujuan.** Bila ditolak, Makerkit tetap pakai buzzer (aman,
tapi timer tetap mentok — tak ada headroom bila kelak butuh timer LEDC lain).

---

## 4. Audit keselamatan GPIO per varian

Pin terpakai:
- **V3:** 5, 13, 16, 17, 21, 22, 25, 26, 33.
- **Makerkit:** 4, 5, 13, 14, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33; input analog 34, 35, 36, 39 (H8).

| Aturan ESP32 | V3 | Makerkit | Catatan |
|---|---|---|---|
| **6..11 (flash SPI) — jangan disentuh** | aman ✅ | aman ✅ | tak ada pin di 6..11 di kedua varian |
| **34..39 (input-only) — tak boleh output** | aman ✅ | aman ✅ | 34/35/36/39 dipakai Makerkit sebagai **input analog** (H8), bukan output — sah |
| **strapping 0,2,12,15 — jangan output** | aman ✅ | aman ✅ | tak dipakai output; GPIO12 dibiarkan unconnected (aman, harus LOW saat boot) |
| **GPIO5 = strapping (harus HIGH saat boot)** | dipakai RGB-B (output) | **dipakai mic WS (I2S)** | ⚠️ lihat catatan di bawah |
| **GPIO14 (servo L / PWM1)** | — | output PWM servo | GPIO14 mengeluarkan sinyal clock sesaat saat boot (pin HSPI) — glitch singkat, tak masalah untuk servo |
| **ADC2 (0,2,4,12..15,25..27) mati saat WiFi** | GPIO25/26 di ADC2 | output servo/LED di 4,14,25,26,27 (bukan analogRead) | ✅ **input analog Makerkit ada di 34/35/36/39 = ADC1** → tetap jalan saat WiFi. Batasan ADC2 hanya mengikat kalau kelak ada analogRead di pin 25/26/27 |

**⚠️ GPIO5 + INMP441 (harus diverifikasi di hardware):**
GPIO5 adalah pin strapping yang harus HIGH saat boot (default: pull-up internal → HIGH).
Di Makerkit dipakai sebagai **WS mic**, yang merupakan **input** bagi INMP441 (ESP32 =
master, mendrive WS). Sebelum I2S diinit, pin ditentukan pull-up ESP32 = HIGH, jadi
**risiko rendah**. TAPI: bila modul mic/kabel menarik GPIO5 LOW saat boot, board **tidak
akan boot**. **Verifikasi:** flash + boot dengan mic terpasang; kalau gagal boot, ini
cacat desain PCB (lapor apa adanya, jangan ditutupi — taskbaru §3-K3). Bila berisiko,
usul pindah WS ke pin non-strapping.

---

## 5. welcome_audio.h (flash vs RAM)
`include/welcome_audio.h`: `const int16_t welcomeAudio[]`, 55589 sample, 16 kHz mono,
~111 KB. Di ESP32, array `const` global otomatis masuk **`.rodata` (flash)** dan dibaca
lewat flash cache — **tidak** disalin ke RAM (beda dari AVR PROGMEM). Jadi cukup `const`;
`i2s_write` streaming langsung dari alamat flash per-chunk. Definisi selesai (§9)
"welcome_audio di flash, bukan RAM" dibuktikan lewat angka RAM `pio run` yang **tidak**
naik ~111 KB.

---

## 6. Keputusan (SUDAH DIJAWAB user — 2026-09-30)
1. **K1 → (b)** WS2812B 4 LED di GPIO32. Makerkit: `HAS_RGB=0, HAS_NEOPIXEL=1`;
   V3: `HAS_RGB=1, HAS_NEOPIXEL=0`. `SET_LED_COLOR` dapat param `index` OPSIONAL.
2. **Pin ❓ → pasang `#error`.** `pins_makerkit.h` mengisi pin terbukti (mic/speaker/
   neopixel/buzzer) lalu `#error` untuk servo L/R/AUX, OLED, port P1..P5 & I2C.
   Konsekuensi: **`pio run -e makerkit` sengaja GAGAL** sampai user memberi angka
   dari skematik. DoD "makerkit EXIT 0" TERBLOKIR by design sampai itu.
3. **K5 → alihkan ke I2S.** Makerkit: `PLAY_TONE`/`SPEAKER_TONE` disintesis ke speaker
   I2S (buzzer fallback bila `HAS_SPEAKER=0`), membebaskan 1 timer LEDC. V3 tetap buzzer.
4. **Servo drive Makerkit → 2** (`HAS_SERVO_R=1`), sama seperti V3 penuh. (Pin fisiknya
   tetap ❓ sampai skematik.)
