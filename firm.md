text

# Prompt Firmware Robotku — Target: Joystick + 6 Blok, lewat USB & Bluetooth

Ruang lingkup sengaja dipersempit: **6 opcode dari 34**, cukup untuk membuktikan Joystick dan Block Coding benar-benar menggerakkan robot lewat kedua transport. Sisanya menyusul setelah ini terbukti.

---

## Temuan yang mendasari prompt ini

**Joystick dan Block Coding gagal karena sebab berbeda** — ini penting, karena menentukan cara mendiagnosis kalau salah satunya masih gagal setelah fix.

| | Yang dikirim web | Kenapa gagal |
|---|---|---|
| **Joystick** (`useDrive.ts:45` → `setPortLine`) | `{"command":"SET_PORT","port":1,"value":80};` — **flat, sudah benar** | `SET_PORT` **tidak ada** di firmware → dibuang di baris `// Unknown command: ignore silently` |
| **Block Coding** (`TransportSink.ts:47` → `encodeCommand`) | `{"command":"MOVE_TIMED","params":{"direction":"backward","speed":40,"duration_ms":2000}};` — **nested** | firmware baca `doc["speed"]` di level atas → kosong → default 60/500; `direction` tak pernah dibaca |

---

## PROMPT

```
ROLE
Perbaiki firmware/robotku-esp32/robotku-esp32.ino supaya DUA fitur web ini benar-benar
menggerakkan robot, lewat USB Serial (115200) MAUPUN Web Bluetooth (BLE NUS):
  (1) Mode Joystick
  (2) Block Coding — 6 blok saja: Forward, Reverse, Left, Right, Wait, Play Tone, Stop All

JANGAN ubah UUID NUS atau baud rate — lapisan transport-nya sudah benar. Yang rusak adalah
parsing protokol, model eksekusi yang memblokir, dan peta pin.
JANGAN implement opcode di luar daftar di bawah. Balas UNSUPPORTED untuk sisanya.

HARDWARE YANG TERBUKTI JALAN (dari sketsa bench test1.txt — jadikan ini sumber kebenaran):
  OLED   : SSD1306 128x64, I2C 0x3C, SDA=GPIO21, SCL=GPIO22
  Buzzer : GPIO26 — tone(pin, freq, durasi) / noTone(pin)
  Servo  : SG90 CONTINUOUS di GPIO33 — ESP32Servo, setPeriodHertz(50),
           attach(pin, 500, 2400), write(90)=diam, write(180)=CW penuh, write(0)=CCW penuh
Pertahankan splash logo + nada startup saat boot — itu sinyal "robot hidup" untuk anak.

╔══════════════════════════════════════════════════════════════════════════════╗
║ FIX 1 — PETA PIN: firmware sekarang akan merusak buzzer dan servo             ║
╚══════════════════════════════════════════════════════════════════════════════╝
Firmware saat ini: PIN_MOTOR_L_IN2 = 26 dan PIN_MOTOR_R_IN2 = 33 — persis pin buzzer dan
pin servo yang sudah terbukti jalan. Kalau di-flash apa adanya, pin buzzer akan digerakkan
sebagai jalur arah motor.
Buat config.h berisi SELURUH pin di satu tempat:
    #define PIN_OLED_SDA   21
    #define PIN_OLED_SCL   22
    #define PIN_BUZZER     26
    #define PIN_SERVO_L    33      // terbukti jalan
    #define PIN_SERVO_R    25      // TODO: konfirmasi GPIO bebas sebelum menyolder
Hindari GPIO 6–11 (flash), 34–39 (input-only, tidak bisa PWM), dan 0/2/12/15 (strapping)
untuk output. Tulis aturan ini sebagai komentar supaya tidak ada yang memasang servo di
GPIO 34 lalu bingung kenapa diam.

PEMETAAN PORT → GPIO (wajib, ini yang bikin Joystick jalan):
`SET_PORT` mengirim port 1..8; firmware belum punya pemetaan apa pun. Buat tabel di config.h:
    port 1 -> PIN_SERVO_L
    port 2 -> PIN_SERVO_R
    port 3..8 -> belum terpasang (balas UNSUPPORTED, jangan diam)
Jadikan tabel, bukan rangkaian if — supaya penambahan port nanti satu baris.

╔══════════════════════════════════════════════════════════════════════════════╗
║ FIX 2 — TERIMA FORMAT NESTED (inilah sebab Block Coding tidak jalan)          ║
╚══════════════════════════════════════════════════════════════════════════════╝
Tambahkan shim di awal handleCommand(), lalu baca SEMUA parameter dari `p`:
    JsonObject p = doc["params"].is<JsonObject>() ? doc["params"].as<JsonObject>()
                                                  : doc.as<JsonObject>();
Menerima dua-duanya: nested (Block Coding) dan flat (Joystick, sketsa bench lama). Dengan
begitu perubahan di sisi web nanti tidak memaksa flash ulang semua board.
Durasi diterima dengan nama apa pun: "duration_ms" | "ms" | "duration".
WAJIB baca "direction": forward|backward untuk MOVE_TIMED, left|right untuk TURN_TIMED.
Sekarang mundur dan belok kiri sama sekali tidak ada di kode.

╔══════════════════════════════════════════════════════════════════════════════╗
║ FIX 3 — JANGAN MEMBLOKIR (sekarang watchdog membunuh gerakan panjang)         ║
╚══════════════════════════════════════════════════════════════════════════════╝
handleCommand() memanggil delay(ms). Selama itu loop() mati: byte BLE menumpuk DAN
HEARTBEAT tidak terbaca — padahal HEARTBEAT_TIMEOUT_MS = 1000. Jadi gerakan >1 detik selalu
berakhir dengan watchdog mematikan motor. Di sisi lain TransportSink juga tidur selama
duration_ms di browser, jadi "maju 1 detik" memakan 2 detik.
Model baru — firmware TIDAK PERNAH memblokir:
  - Perintah bertimer menyetel aktuator lalu mencatat motionEndsAtMs = millis() + ms + 300.
  - loop() memeriksa tenggat itu tiap putaran dan menghentikan aktuator saat lewat.
  - Hapus semua delay() dari jalur perintah (delay() di setup() tidak apa-apa).
  - Browser tetap pemegang urutan waktu; tenggat di firmware adalah JARING PENGAMAN kalau
    perintah stop hilang di jalan. Margin 300 ms supaya keduanya tidak saling rebut.
Tulis alasan ini sebagai komentar — orang berikutnya akan tergoda "menyederhanakannya" kembali.

╔══════════════════════════════════════════════════════════════════════════════╗
║ FIX 4 — 6 OPCODE TARGET                                                       ║
╚══════════════════════════════════════════════════════════════════════════════╝
Semua parameter dibaca lewat `p` dari FIX 2.

  SET_PORT {port:1..8, value:-100..100}        <- Joystick
     Petakan lewat tabel FIX 1. Servo continuous: sudut = 90 + (value * 90 / 100), clamp 0..180.
     Sisi kanan menghadap arah berlawanan di sasis, jadi sediakan SERVO_R_INVERT di config.h.
     Sediakan juga SERVO_L_TRIM / SERVO_R_TRIM (default 0): SG90 continuous hampir tidak pernah
     benar-benar diam di 90, dan tanpa trim robot akan merayap saat seharusnya berhenti.
     Port yang tidak terpasang -> balas UNSUPPORTED.

  STOP_ALL {}                                   <- keduanya, kerjakan PALING AWAL
     Semua port ke netral, batalkan motionEndsAtMs. Ini keselamatan, bukan fitur.

  MOVE_TIMED {direction, speed, duration_ms}    <- Block: Forward / Reverse
     forward = kedua sisi maju, backward = kedua sisi mundur. Hormati speed 0..100.

  TURN_TIMED {direction, speed, duration_ms}    <- Block: Left / Right
     left = kiri mundur + kanan maju, right = kebalikannya.

  WAIT {duration_ms}                            <- Block: Wait
     Non-blocking. Firmware tidak perlu benar-benar menunggu (browser yang mengatur urutan);
     cukup no-op yang di-ACK, supaya jelas perintahnya sampai.

  PLAY_TONE {frequency|note, duration_ms}       <- Block: Play Tone
     tone(PIN_BUZZER, freq, ms). Non-blocking — tone() sudah asinkron di ESP32.

  Opcode lain apa pun -> {"command":"UNSUPPORTED","op":"<opcode>"};
  JANGAN diam. Baris `// Unknown command: ignore silently` yang sekarang adalah alasan
  kenapa Joystick gagal tanpa jejak apa pun.

╔══════════════════════════════════════════════════════════════════════════════╗
║ FIX 5 — BLE MTU (kalau USB jalan tapi Bluetooth tidak, biasanya ini)          ║
╚══════════════════════════════════════════════════════════════════════════════╝
sendTelemetry() memotong per 180 byte, padahal MTU BLE default 23 (payload 20). Notifikasi
jadi terpotong dan JSON telemetri rusak.
  - NimBLEDevice::setMTU(247), lalu baca nilai hasil negosiasi per koneksi.
  - Potong sebesar (MTU hasil negosiasi - 3), jangan konstanta.
  - Jangan pernah memotong baris tanpa ';' penutup — parser web memecah pada ';', jadi baris
    terpotong bisa terbaca sebagai perintah utuh yang salah.

╔══════════════════════════════════════════════════════════════════════════════╗
║ FIX 6 — WATCHDOG YANG SEKARANG SALAH TEMBAK                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝
Logika sekarang: `bool linkActive = bleConnected || (lastHeartbeatMs != 0);`
lastHeartbeatMs diisi di setup(), jadi tidak pernah 0 — board kosong di meja akan memicu
failsafe tiap detik selamanya.
Perbaiki: watchdog baru aktif setelah HELLO pertama, mati saat disconnect, timeout 2000 ms.
Saat failsafe: hentikan aktuator, tampilkan ikon "link putus" di OLED, dan kirim
    {"command":"FAILSAFE","reason":"heartbeat_timeout"};

╔══════════════════════════════════════════════════════════════════════════════╗
║ FIX 7 — HELLO_ACK YANG JUJUR                                                  ║
╚══════════════════════════════════════════════════════════════════════════════╝
HELLO_ACK sekarang mengiklankan kemampuan yang tidak ada (SET_GRIPPER menunjuk fungsi kosong).
Isi capabilities HANYA dengan 6 opcode yang benar-benar dikompilasi, plus:
    "ports": [1,2]        // port yang benar-benar terpasang
    "driveMode": "servo"
    "hasBuzzer": true, "hasOled": true

CATATAN PUSTAKA
- ArduinoJson 7 sudah men-deprecate StaticJsonDocument — pakai JsonDocument.
- Kunci versi di README: NimBLE-Arduino, ArduinoJson, ESP32Servo, Adafruit_SSD1306,
  Adafruit_GFX, dan versi ESP32 Arduino core — core 3.x mengubah API LEDC
  (ledcSetup/ledcAttachPin -> ledcAttach) dan itu akan mematahkan build tanpa peringatan jelas.
- Sertakan platformio.ini di samping .ino (test1.txt sudah ditulis untuk PlatformIO).

═══════════════════════════════════════════════════════════════════════════════
URUTAN VERIFIKASI — kerjakan berurutan, jangan lompat
═══════════════════════════════════════════════════════════════════════════════
TAHAP A — Serial Monitor 115200, tempel manual (belum menyentuh web sama sekali)
  A1  {"command":"HELLO","protocol":"robotku-v1"};
      -> HELLO_ACK berisi 6 opcode dan ports:[1,2]
  A2  {"command":"SET_PORT","port":1,"value":80};        -> servo kiri berputar
      {"command":"SET_PORT","port":1,"value":0};         -> servo kiri DIAM (uji trim)
  A3  {"command":"MOVE_TIMED","params":{"direction":"backward","speed":40,"duration_ms":2000}};
      -> MUNDUR 40% selama 2 detik lalu berhenti sendiri
      (Sebelum fix hasilnya: maju, 60%, 500 ms. Ini tes tunggal paling menentukan.)
  A4  {"command":"PLAY_TONE","params":{"frequency":440,"duration_ms":500}};  -> buzzer bunyi
  A5  {"command":"STOP_ALL"}; di tengah gerakan                              -> berhenti seketika
  A6  {"command":"DISPLAY_MATRIX"};                                          -> balasan UNSUPPORTED
  Kalau TAHAP A gagal, JANGAN lanjut. Tidak ada gunanya menyalahkan Bluetooth.

TAHAP B — Joystick lewat USB (Web Serial)
  B1  Connect, gerakkan stick -> servo mengikuti, halus, tanpa lonjakan
  B2  Lepas stick -> kembali netral, tidak merayap
  B3  Tutup tab di tengah gerakan -> robot berhenti dalam 2 detik (failsafe)

TAHAP C — Joystick lewat Bluetooth
  Perilaku identik dengan TAHAP B. Kalau B jalan dan C tidak, itu murni BLE — periksa FIX 5.

TAHAP D — Block Coding lewat USB, 6 blok
  D1  Forward 1 detik -> memakan ~1 detik, BUKAN 2 (regresi FIX 3)
  D2  Reverse 2 detik kecepatan pelan -> benar-benar mundur, benar-benar pelan
  D3  Left lalu Right -> arah berlawanan (butuh dua servo terpasang)
  D4  Repeat 3x [Forward 0.5s, Play Tone] -> tiga kali, urutan benar
  D5  Program 5 detik selesai tanpa watchdog menyala (regresi FIX 3)
  D6  Program yang sama dijalankan di simulator 2D -> arah dan urutan sama,
      durasi selisih di bawah 10%
  D7  Tekan Stop di tengah program -> robot berhenti di bawah 200 ms

TAHAP E — Block Coding lewat Bluetooth
  Ulangi D1–D7. Identik.
```

---

## Yang perlu disiapkan sebelum prompt ini dijalankan

**Servo kedua di GPIO 25.** Tanpa itu, TAHAP D3 (belok kiri/kanan) dan seluruh Joystick dua sumbu tidak bisa dibuktikan — dengan satu servo robot hanya bisa berputar di tempat. Ini prasyarat, bukan opsional, kalau tujuannya menunjukkan Joystick benar-benar jalan.

**Konfirmasi GPIO 25 memang bebas** di rangkaianmu. Saya memilihnya karena aman secara umum di ESP32, tapi saya tidak bisa melihat wiring-mu — kalau PCB Robotku sudah memakainya untuk hal lain, ganti sebelum menyolder.

## Kenapa urutannya begini

TAHAP A memisahkan masalah protokol dari masalah transport. Kalau A3 sudah benar (mundur 40% selama 2 detik), berarti diagnosis `params` tepat dan sisanya tinggal formalitas. Kalau masih maju setengah detik, shim-nya belum kena dan tidak ada gunanya menguji BLE.

TAHAP B sebelum C dengan alasan sama: Joystick lewat USB adalah jalur paling sederhana — satu opcode, tanpa timing, tanpa nested params. Kalau USB jalan dan BLE tidak, penyebabnya hampir pasti MTU di FIX 5, bukan hal lain.
