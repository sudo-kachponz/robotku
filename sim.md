# Prompt: Samakan Block Coding + Simulator dengan Hardware Robotku yang Nyata

Disusun dari skematik `ESP32_Controller_V3` (`SCH_Schematic3_2026-08-31`), lima foto board & modul, dan repo terbaru.

---

## Apa yang skematik + foto ungkapkan

Board-nya **bukan** seperti yang diasumsikan web sekarang. Ini yang benar-benar ada:

| Yang nyata di PCB | Bukti |
|---|---|
| **5 port PWM/servo** — tiap port 3 pin: `GND / 5V / PWM` | Header H5(5V), H6(GND), H7(PWM), masing-masing 1×5. Net: `PWM`, `PWM2`, `PWM3`, `PWM4`, `PWM5`. Foto: blok header bawah 3 baris (kuning/merah/hitam) × 5 kolom |
| **5 port I2C** — tiap port 4 pin: `GND / VCC / SCL / SDA` | Header H1(VCC), H2(GND), H3(SCL), H4(SDA), masing-masing 1×5. Foto: blok header atas 4 baris × 5 kolom |
| **RGB LED 5 mm common cathode** | `U1 LED-RGB 共阴 插件 直径5mm`, net `LED1/LED2/LED3` |
| **Buzzer pasif via transistor** | `BUZ1` + `Q3 S9013`, net `BUZZ` |
| **LED status Bluetooth** | net `Bt_LED`, silkscreen `LED1` di board |
| **CH340C + USB-C** | `U17 CH340C`, konektor USB-C |
| **Tombol RESET & BOOT** | `RST`, `BOOT1` |

Dan yang **TIDAK ADA** di board — ini bagian pentingnya:

- **Tidak ada driver motor / H-bridge.** Penggerak = servo lewat header PWM. Pertanyaan "servo continuous atau motor DC" sudah terjawab oleh skematik: **servo**.
- **Tidak ada display di board.** OLED 0.96" itu **modul terpisah** yang ditancapkan ke salah satu port I2C (foto 4: modul dengan pin `GND VDD SCK SDA` dan kabel pelangi).
- **Tidak ada LED matrix 5×5.** Tidak ada sensor onboard apa pun.
- **Tidak ada 8 port generik.** Yang ada 5 PWM + 5 I2C, dua jenis konektor berbeda.

## Akibatnya di web sekarang

`src/domain/ports.ts` memodelkan **8 slot** dengan nama `M1..M4` (motor) dan `G1..G8` (bus) — dua-duanya tidak ada di hardware. `Port Control` menampilkan 8 slider identik. `config.h` firmware memetakan `PORT_CHANNEL[9]` dengan 8 entri. Semuanya perlu diselaraskan ke **P1–P5 (PWM)** dan **I1–I5 (I2C)**.

## Yang belum bisa saya pastikan

**Net `PWM`…`PWM5` dan `BUZZ` tersambung ke GPIO berapa** — teks skematik yang bisa saya baca hanya memuat daftar pin ESP32 dan daftar net, bukan koneksinya. Jadi angka GPIO di prompt ini sengaja saya tinggal sebagai `TODO` yang harus dikonfirmasi engineer, bukan saya tebak. Ini juga berarti `PIN_SERVO_R 25` dan `PIN_BUZZER 26` di `config.h` sekarang **belum terverifikasi terhadap skematik**.

---

## PROMPT

```
ROLE
Repo robotku (Next.js 15, TypeScript strict) + firmware/robotku-esp32.
Selaraskan model port, palet blok, dan aset simulator dengan hardware Robotku yang SEBENARNYA
(board ESP32_Controller_V3). Sekarang web memodelkan 8 port generik M1..M4/G1..G8 dan menawarkan
blok untuk perangkat yang tidak ada di board (LED matrix, LCD, capit, sensor onboard).
Kerjakan per slice, `npm test && npm run typecheck` di antara tiap slice.

GROUND TRUTH — dari skematik ESP32_Controller_V3 + foto board:
  MCU        : ESP32-WROOM-32D
  5x port PWM  (servo)  : tiap port 3 pin GND / 5V / PWM. Net PWM, PWM2, PWM3, PWM4, PWM5.
  5x port I2C           : tiap port 4 pin GND / VCC / SCL / SDA. SATU bus I2C dipararel ke 5 konektor.
  RGB LED 5mm common cathode (net LED1/LED2/LED3)
  Buzzer pasif lewat transistor S9013 (net BUZZ)
  LED status Bluetooth (net Bt_LED)
  CH340C + USB-C, tombol RESET + BOOT
  TIDAK ADA: driver motor/H-bridge, display onboard, LED matrix, sensor onboard.
  OLED 0.96" SSD1306 = MODUL EKSTERNAL yang ditancap ke port I2C (pin GND VDD SCK SDA).
  Servo = SG90 (foto: bodi biru, horn putih 2 lengan).

⚠ YANG BELUM DIKETAHUI — JANGAN DITEBAK
  Pemetaan net PWM..PWM5, BUZZ, LED1..LED3, Bt_LED ke nomor GPIO ESP32 tidak terbaca dari
  skematik yang tersedia. Tulis semuanya sebagai konstanta ber-TODO di satu tempat
  (firmware/config.h dan src/domain/hardware.ts), beri komentar "BELUM DIVERIFIKASI TERHADAP
  SKEMATIK — konfirmasi ke hardware engineer sebelum solder/flash". Jangan sebar angka GPIO ke
  file lain. Nilai PIN_SERVO_R=25 dan PIN_BUZZER=26 yang ada sekarang juga masuk kategori ini.

─────────────────────────────────────────────────────────────────────────────
SLICE 1 — Satu sumber kebenaran hardware: src/domain/hardware.ts
─────────────────────────────────────────────────────────────────────────────
File baru yang mendeskripsikan board, dipakai oleh runtime, UI, simulator, dan aset:
    export type PortKind = 'pwm' | 'i2c';
    export interface HardwarePort {
      id: string;            // 'P1'..'P5' | 'I1'..'I5'
      kind: PortKind;
      index: number;         // 1..5 dalam jenisnya
      pins: string[];        // ['GND','5V','PWM'] | ['GND','VCC','SCL','SDA']
      colors: string[];      // warna header sesuai FOTO — lihat SLICE 4
      gpio?: number;         // TODO: belum diverifikasi
    }
    export interface BoardProfile {
      id: 'esp32-controller-v3';
      name: 'Robotku Controller V3';
      pwmPorts: HardwarePort[];   // P1..P5
      i2cPorts: HardwarePort[];   // I1..I5 (SATU bus, 5 konektor paralel)
      hasRgbLed: true; hasBuzzer: true; hasStatusLed: true;
      hasMotorDriver: false; hasOnboardDisplay: false; hasMatrix: false;
      onboardSensors: [];         // kosong
    }
Sertakan katalog modul yang bisa ditancapkan:
    PERIPHERALS = [
      { id:'oled-ssd1306', name:'Layar OLED 0.96"', bus:'i2c', addr:0x3C,
        pins:['GND','VDD','SCK','SDA'] },
      { id:'servo-sg90',   name:'Servo SG90',       bus:'pwm', pins:['GND','5V','PWM'] },
    ]
Katalog ini yang nanti mengendalikan blok mana yang aktif (SLICE 3) dan gambar apa yang muncul di
simulator (SLICE 4). Tambah modul baru = satu entri, bukan menyebar if di banyak file.

─────────────────────────────────────────────────────────────────────────────
SLICE 2 — Ganti model 8 port jadi 5 PWM + 5 I2C
─────────────────────────────────────────────────────────────────────────────
src/domain/ports.ts sekarang memakai M1..M4 (motor) dan G1..G8 (bus) — dua-duanya tidak ada di
board ini. Tulis ulang berdasarkan hardware.ts:
  - portIndex() menerima 'P1'..'P5' dan 'I1'..'I5'; nama lama 'M1'/'G3' dipetakan ke P/I dengan
    peringatan sekali di konsol (jangan diam-diam, dan jangan pula memutus proyek lama anak).
  - portLabel() -> 'P1 · PWM' / 'I1 · I2C'.
  - NUM_PORTS -> dua konstanta: NUM_PWM_PORTS = 5, NUM_I2C_PORTS = 5.
  - Migrasi workspace tersimpan: blok yang menyebut M1..M4 -> P1..P4, G1..G5 -> I1..I5, sisanya
    (G6..G8) ditandai tidak tersedia. Jalankan saat load, tampilkan satu toast ringkas.
Perbarui SimSink, TransportSink, PortMode, PortBoard, SimStage supaya memakai dua kelompok ini —
jangan ada lagi indeks 0..7 telanjang.
Firmware: PORT_CHANNEL[9] -> tabel PWM_PORT_GPIO[6] (indeks 1..5), dan HELLO_ACK melaporkan
    "pwmPorts":[...], "i2cPorts":[...]
hanya untuk port yang benar-benar tersambung ke GPIO (bukan yang masih TODO).

─────────────────────────────────────────────────────────────────────────────
SLICE 3 — Palet blok mengikuti hardware, tanpa membohongi anak
─────────────────────────────────────────────────────────────────────────────
Prinsip: blok untuk perangkat yang tidak ada TIDAK dihapus (masih berguna di simulator), tapi
diberi chip "butuh modul X" dan menghasilkan UNSUPPORTED yang jelas saat board tersambung.

  a. BLOK BARU yang hardware-nya nyata tapi web belum punya:
     - rgb_set_color   "Nyalakan LED RGB warna [colour]"      -> SET_LED_COLOR {r,g,b}
     - rgb_off         "Matikan LED RGB"
     - servo_set_angle "Servo di port [P1..P5] ke sudut [0-180]"   -> SET_SERVO {port,angle}
       (Servo POSISIONAL. Foto menunjukkan horn 2 lengan — tipikal servo posisional. Kalau
       ternyata yang dipakai continuous, blok ini tetap valid dan blok kecepatan di bawah yang
       dipakai; sediakan keduanya dan biarkan profil board memilih.)
     - servo_set_speed "Servo di port [P1..P5] kecepatan [-100..100]"  -> SET_PORT {port,value}
     - buzzer: blok Audio yang ada sudah cocok (buzzer pasif + tone()) — biarkan.

  b. BLOK YANG PERLU MODUL, beri chip "butuh Layar OLED":
     display_matrix, display_text, display_set_brightness, display_clear_matrix,
     lcd_shape, lcd_text, lcd_clear
     Semuanya dipetakan ke OLED SSD1306 eksternal. DISPLAY_MATRIX 5x5 digambar sebagai 25 kotak
     besar di OLED (lihat SLICE 4 untuk versi simulatornya).

  c. BLOK TANPA HARDWARE SAMA SEKALI di board ini — beri chip "belum tersedia di robot ini",
     tetap jalan di simulator:
     move_claw, mechanism_set_head, mechanism_set_gripper (tidak ada aktuator capit/kepala),
     seluruh kategori Sensors (tidak ada sensor onboard; ultrasonik/cahaya nanti lewat port I2C
     atau PWM sebagai GPIO — dan itu belum ada di board),
     audio_record, audio_play_recording (tidak ada mikrofon).

  d. Movement (move_forward/reverse/left/right/steer) tetap ada dan memetakan ke dua servo di
     P1 & P2. Kalau HELLO_ACK melaporkan hanya satu port PWM tersambung, tampilkan chip
     "butuh 2 servo" pada blok belok — jangan diam.

  e. Sumber kebenaran ketersediaan: HELLO_ACK saat tersambung, BoardProfile saat offline.
     Satu fungsi `isBlockSupported(blockType, profile)` dipakai palet, badge, dan runtime —
     jangan ada tiga tempat memutuskan hal yang sama.

─────────────────────────────────────────────────────────────────────────────
SLICE 4 — Aset & animasi simulator harus mirip board aslinya
─────────────────────────────────────────────────────────────────────────────
Ganti panel port generik di SimStage dengan gambar board yang dikenali anak sebagai benda yang
dia pegang. SVG murni, tanpa dependensi baru, tanpa foto bitmap (harus tajam & ringan).

  BOARD (src/components/blockcoding/sim/BoardSvg.tsx), sesuai foto:
   - PCB biru tua (#12386B..#0E2E5C) rasio ~4:3, sudut membulat, 4 lubang baut di pojok.
   - Casing 3D-print hijau toska (#2FC49A) sebagai bingkai di belakang PCB — ini yang paling
     dikenali anak dari foto.
   - Modul ESP32-WROOM logam perak di kiri, dengan area antena kotak-kotak hitam menjorok keluar
     tepi kiri.
   - Buzzer bundar hitam di tengah dengan lubang di pusatnya.
   - LED RGB 5mm bening di sebelah kiri buzzer -> menyala mengikuti SET_LED_COLOR, dengan glow.
   - LED status kecil (silkscreen LED1) -> berkedip saat BLE tersambung, mati saat terputus.
   - Konektor USB di kanan (papan adaptor ungu + soket) -> menyala saat mode USB Serial.
   - Silkscreen "ROBOTKU SCHOOL" putih di kanan atas.
   - Tombol RESET & BOOT kecil di kiri.
   HEADER — warna WAJIB sesuai foto, ini penanda utama buat anak mencocokkan kabel:
   - Blok atas (I2C, 4 baris × 5 kolom), dari tepi ke dalam: hitam GND, merah VCC, hijau SCL,
     kuning SDA. Label kecil di sisi board persis seperti silkscreen.
   - Blok bawah (PWM, 3 baris × 5 kolom): kuning PWM, merah 5V, hitam GND.
   - Tiap kolom = satu port; beri area sentuh/klik per port untuk memilihnya.

  ANIMASI PER PORT
   - Port PWM aktif: gradien tengah-ke-luar seperti fillBg() di PortMode (CW #8085F4 / CCW #F265AE),
     ditambah ikon servo kecil yang horn-nya BERPUTAR sesuai nilai — untuk servo posisional,
     sudutnya mengikuti SET_SERVO; untuk continuous, berputar terus dengan kecepatan sesuai nilai.
   - Port I2C dengan OLED terpasang: gambar modul OLED (sesuai foto — PCB biru kecil, layar hitam,
     4 pin berlabel GND VDD SCK SDA, bingkai cetak hijau toska) tersambung ke port itu dengan
     kabel pelangi melengkung. Isi layarnya me-render DISPLAY_MATRIX / DISPLAY_TEXT / LCD_TEXT
     sungguhan, bukan placeholder.
   - Port kosong: pin abu-abu redup, dan saat sebuah blok menyebut port itu, port-nya berdenyut
     supaya anak tahu harus menancapkan apa di mana.

  MODUL YANG BISA DIPASANG
   - Panel kecil "Pasang modul" -> pilih Servo SG90 atau Layar OLED, lalu pilih port. Modul yang
     terpasang muncul di gambar, dan blok yang tadinya berchip "butuh modul" langsung aktif.
   - Servo SG90 digambar sesuai foto: bodi biru bening, horn putih dua lengan, dudukan cetak
     hijau toska.
   - Simpan susunan modul di localforage lewat pola persistence.ts yang sudah ada, supaya susunan
     kelas tidak hilang saat refresh.

  ARENA ROBOT tetap seperti sekarang (RobotSprite + trail), tapi jumlah roda mengikuti berapa
  servo yang terpasang: 1 servo -> robot hanya berputar di tempat dan tampilkan hint
  "pasang servo kedua untuk bisa belok". Jangan animasikan gerakan yang mustahil di hardware.

  KUALITAS: prefers-reduced-motion mematikan putaran horn & kedip LED (nilai tetap terlihat);
  seluruh board punya aria-label; render tetap SVG (target < 25 kB, tanpa canvas per-widget).

─────────────────────────────────────────────────────────────────────────────
SLICE 5 — Firmware ikut menyesuaikan
─────────────────────────────────────────────────────────────────────────────
  - config.h: ganti PORT_CHANNEL[9] jadi PWM_PORT_GPIO[6] (1..5) + I2C_SDA/I2C_SCL + PIN_RGB_R/G/B
    + PIN_STATUS_LED + PIN_BUZZER. SEMUA yang belum diverifikasi terhadap skematik diberi
    komentar TODO yang mencolok, dan port yang GPIO-nya belum diketahui diisi -1 sehingga
    firmware membalas UNSUPPORTED alih-alih menggerakkan pin acak.
  - Opcode baru: SET_SERVO {port,angle} (servo posisional) dan SET_LED_COLOR {r,g,b} (RGB LED).
  - HELLO_ACK melaporkan pwmPorts/i2cPorts yang benar-benar terpasang + hasRgbLed + board id
    "esp32-controller-v3".
  - Deteksi OLED: saat boot, pindai bus I2C untuk 0x3C. Kalau ada, laporkan
    "peripherals":["oled-ssd1306"] di HELLO_ACK dan aktifkan blok Display otomatis. Kalau tidak
    ada, jangan blokir boot (firmware sekarang while(true) menggantung kalau OLED tidak terdeteksi
    — itu bikin board tampak mati padahal cuma tidak ada layar).

ACCEPTANCE
 1. Port Control menampilkan 5 port PWM + 5 port I2C dengan warna header sama seperti foto, bukan
    8 slider identik.
 2. Buka proyek lama yang memakai M1/G3 -> ter-migrasi ke P1/I3 dengan satu toast, tidak error.
 3. Blok Display berchip "butuh Layar OLED"; setelah OLED dipasang di simulator, chip hilang dan
    matriks 5x5 tergambar di layar OLED simulator.
 4. rgb_set_color mengubah warna LED 5mm di gambar board, dan (dengan board tersambung) LED asli.
 5. servo_set_angle 0/90/180 memutar horn di gambar ke sudut yang sesuai.
 6. Dengan satu servo terpasang, blok belok menampilkan chip "butuh 2 servo" dan robot di arena
    hanya berputar di tempat.
 7. Gambar board dibandingkan berdampingan dengan foto: urutan & warna header, posisi ESP32,
    buzzer, LED, USB, dan silkscreen cocok.
 8. Tidak ada satu pun nomor GPIO yang ditulis di luar config.h dan hardware.ts.
```

---

## Satu hal yang harus kamu tanyakan sebelum prompt ini dijalankan

**Net `PWM`–`PWM5`, `BUZZ`, `LED1/2/3`, dan `Bt_LED` itu GPIO berapa?** Ini tidak terbaca dari skematik yang saya terima — yang bisa saya ekstrak hanya daftar pin ESP32 dan daftar nama net, tanpa koneksinya. Tanpa jawaban itu, firmware hanya bisa mengisi `-1` dan membalas `UNSUPPORTED`, dan gambar board di simulator tidak bisa dicocokkan ke port fisik.

Minta ke engineer: netlist EasyEDA (Export → Netlist), atau cukup daftar seperti `PWM=GPIO13, PWM2=GPIO12, …`.

**Dan satu koreksi penting terhadap asumsi kita sebelumnya:** `config.h` sekarang memakai `PIN_SERVO_L 33` dan `PIN_SERVO_R 25` — angka itu berasal dari sketsa bangku `test1.txt`, **bukan** dari board ini. Di board V3, servo masuk lewat header PWM, dan GPIO-nya belum tentu 33/25. Jangan solder atau flash berdasarkan angka itu sampai netlist-nya dikonfirmasi.
