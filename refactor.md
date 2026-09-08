# Robotku Refactor & Firmware Port Progress

Status: **COMPLETED & VERIFIED** (Branch: `main`)

---

## 1. Ringkasan Eksekusi & Status Terkini

Semua tugas pada Task A, B, dan C telah diintegrasikan langsung ke workspace kanonik `/home/firania/Documents/robotku`.

| Komponen | Status | Hasil Verifikasi |
|---|---|---|
| **Firmware Port & Merge** | ✅ Selesai | `arduino-cli compile` **EXIT 0** (Flash: 50%, RAM: 11%) |
| **Servo Fixes & P5 Aux** | ✅ Terintegrasi | `ATTACH`, `DETACH`, `SET_HEAD_POSITION`, lazy-attach & idle-detach aktif |
| **Buzzer & OLED Bitmap** | ✅ Terjaga | `buzzerPwm` (timer allocator 0-3), `DISPLAY_BITMAP`, `SET_LED_BRIGHTNESS` tetap utuh |
| **Skrip Uji Firmware** | ✅ Tersinkronisasi | `test_serial.py`, `test_ble.py`, `flash.sh` ada di `Documents/robotku/firmware/` |
| **Git Hygiene & Bloat** | ✅ Bersih | `firmware/build/` masuk `.gitignore`; tidak ada file yatim |
| **Frontend TypeCheck** | ✅ Lolos | `npx tsc --noEmit` **EXIT 0** (0 error) |
| **Unit & Parity Tests** | ✅ Lolos | 26 test suite / 201 tests **100% Passed** (`vitest run`) |
| **Production Build** | ✅ Lolos | `npm run build` **EXIT 0** (30/30 static pages) |

---

## 2. Detail Perubahan Firmware (`Documents/robotku/firmware/robotku-esp32`)

### A. Integrasi Fitur Servo dari Downloads tanpa Merusak Fitur Documents
1. **Lazy Attach & Idle Detach ([`src/main.cpp`](file:///home/firania/Documents/robotku/firmware/robotku-esp32/src/main.cpp))**:
   - Di `setup()`, pin servo (`PIN_SERVO_L`, `PIN_SERVO_R`, `PIN_SERVO_AUX`) diinisialisasi `OUTPUT` dan di-park `LOW` agar tidak floating / twitch saat boot.
   - Servo hanya di-attach secara dinamis pada perintah jalan pertama, dan di-detach pada saat diam/idle (`SERVO_DEADBAND`) atau saat modul dicabut (`DETACH`). Ini mencegah servo continuous SG90 berputar sendiri (*creeping*).
2. **Schematic Pasang / Cabut (`ATTACH` & `DETACH`)**:
   - Menangani pesan virtual schematic untuk melepas atau memasang kembali modul servo pada channel/port tertentu.
3. **Accessory Positional Servo (`SET_HEAD_POSITION` / `SET_SERVO`)**:
   - Menangani pergerakan servo aksesoris P5 (sudut absolut 0–180°).
4. **Alokasi Timer LEDC Mandiri ([`config.h`](file:///home/firania/Documents/robotku/firmware/robotku-esp32/src/config.h) & [`main.cpp`](file:///home/firania/Documents/robotku/firmware/robotku-esp32/src/main.cpp))**:
   - `ESP32PWM::allocateTimer(0..3)` digunakan untuk mengalokasikan timer 0, 1, 2 untuk `servoL`, `servoR`, `servoAux`, dan timer 3 untuk `buzzerPwm`.
   - Menghindari konflik timer bawaan `tone()` yang sebelumnya membuat servo ikut bergetar/bernyanyi (*servo singing bug*).
5. **Fitur Ekstra yang Tetap Utuh**:
   - `DISPLAY_BITMAP` (OLED pixel editor web)
   - `SET_LED_BRIGHTNESS` (kontras SSD1306)
   - `STOP`, `STEER_TIMED`
   - `HELLO_ACK` dengan payload kapabilitas lengkap.

---

## 3. Hasil Pengujian & Ukuran Memori

### Firmware (`arduino-cli compile --fqbn esp32:esp32:esp32 firmware/robotku-esp32`)
```
Sketch uses 656357 bytes (50%) of program storage space. Maximum is 1310720 bytes.
Global variables use 36764 bytes (11%) of dynamic memory, leaving 290916 bytes for local variables. Maximum is 327680 bytes.
```

### Next.js & TypeScript
- `npx tsc --noEmit` -> **0 Error**
- `npx vitest run` -> **26 passed (26) / 201 passed (201)**
- `npm run build` -> **30 static routes generated successfully**

---

## 4. Pembersihan Disk (Pilihan Task C: Hapus Checkout Lama)

Folder `/home/firania/Downloads/robotku` sudah tidak diperlukan karena seluruh firmware, skrip test (`test_ble.py`, `test_serial.py`, `flash.sh`), dan perbaikan telah digabung ke `/home/firania/Documents/robotku`.

Untuk membebaskan disk space (~500MB+ dari duplicate `.next` dan `node_modules`), folder tersebut aman dihapus dengan:
```bash
rm -rf /home/firania/Downloads/robotku
```
Semua pekerjaan selanjutnya berjalan terpusat di `/home/firania/Documents/robotku`.
