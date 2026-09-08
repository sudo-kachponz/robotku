nalisis lengkap. Fakta terkonfirmasi:

  ┌──────────────────────────────┬──────────────────────────────────────────────────────────────┬──────────────────────┐
  │            Temuan            │                            Bukti                             │   Aman diperbaiki?   │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────┼──────────────────────┤
  │ config.h ganda               │ hanya src/main.cpp yang #include "config.h" (→               │ ✅ hapus top-level   │
  │                              │ src/config.h); top-level config.h yatim & beda isi           │                      │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────┼──────────────────────┤
  │ firmware/build/ 27 MB masuk  │ .gitignore cuma abaikan .pio/, bukan build/                  │ ✅ gitignore + hapus │
  │ tree                         │                                                              │                      │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────┼──────────────────────┤
  │ serial_check.py redundan     │ fungsinya subset test_serial.py                              │ ✅ hapus             │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────┼──────────────────────┤
  │ Checkout ganda               │ .next 346M + out 43M + node_modules × 2                      │ ⚠️ perlu keputusan   │
  │ Downloads+Documents          │                                                              │                      │
  ├──────────────────────────────┼──────────────────────────────────────────────────────────────┼──────────────────────┤
  │ Edit firmware/JoystickMode   │ tsc/compile bersih                                           │ sudah rapi, pass     │
  │ saya                         │                                                              │ ringan saja          │
  └──────────────────────────────┴──────────────────────────────────────────────────────────────┴──────────────────────┘

  Firmware ESP32 sendiri tidak boros (flash 49%, RAM 11%) — "memori penuh" yang nyata itu disk (build artifacts + dua
  checkout).

  Berikut prompt kerjanya, belum saya eksekusi — tinggal kamu setujui/atur:

  PROMPT — Cleanup Robotku (behavior-preserving, no functional change)

  KONTEKS
  - Repo kanonik yang dijalankan user: /home/firania/Documents/robotku (branch main, bersih).
  - Checkout lama tempat kerja sesi lalu: /home/firania/Downloads/robotku (22 file dirty).
  - Board sudah ter-flash firmware dari Downloads/firmware & lolos tes BLE.

  TUJUAN
  Bersihkan spaghetti & bloat (disk "memori penuh") TANPA mengubah perilaku yang
  sudah bekerja. Setiap langkah wajib diverifikasi.

  ATURAN KERAS 
  - Jangan ubah logika/UX yang berjalan. Tidak ada refactor spekulatif.
  - Jangan sentuh file agent lain (BoardPanel.tsx, SimStage.tsx, sim/*) kecuali
    menghapus artefak/duplikat murni.
  - Definition of done: firmware `arduino-cli compile` EXIT 0 (flash tetap ~49%);
    `npx tsc --noEmit` bersih; `next build` EXIT 0; rute /control/modes/joystick = 200.

  TUGAS 
  A. Firmware hygiene (di folder yang disepakati)
     1. Hapus firmware/robotku-esp32/config.h (top-level, yatim). Kanonik = src/config.h.
        Verifikasi: grep tak ada include lain; compile EXIT 0.
     2. Tambah "firmware/build/" ke .gitignore; hapus dir build/ dari tree (regenerate saat compile).
     3. Hapus firmware/serial_check.py (disatukan ke test_serial.py). Sisakan test_serial.py + test_ble.py.
     4. Pass ringan main.cpp/config.h edit servo: buang komentar/guard duplikat bila ada,
        TANPA ubah logika (servoSetAttached, driveChannel, helper servoPin/servoObj/servoChannelWired,
        ATTACH/DETACH, SET_HEAD_POSITION). Konfirmasi flash/RAM tak berubah.

  B. Frontend
     5. Documents/.../JoystickMode.tsx: pastikan tak ada import tak terpakai; tsc bersih. Tak ada perubahan lain.

  C. Konsolidasi checkout (butuh keputusan user, JANGAN hapus tanpa konfirmasi)
     6. Inventaris apa yang HANYA ada di Downloads (firmware edits, BoardPanel ATTACH/DETACH glue,
        skrip tes). Putuskan: port ke Documents atau buang. Setelah aman, Downloads/robotku
        boleh dihapus untuk membebaskan disk (~ratusan MB node_modules/.next).

  OUTPUT
  Diff kecil per langkah + hasil verifikasi (compile/tsc/build/route). Laporkan yang
  di-skip dan alasannya.

  Dua hal yang perlu kamu putuskan sebelum saya jalankan:
  1. Cleanup dikerjakan di folder mana? Karena firmware & skrip tes yang saya edit ada di Downloads, tapi kanonikmu
  Documents. Idealnya: port firmware+skrip ke Documents dulu, baru bersihkan, lalu hapus Downloads. Atau kamu mau saya
  bereskan di Downloads saja?
  2. Task C (hapus checkout lama) — saya lakukan atau kamu sendiri?
