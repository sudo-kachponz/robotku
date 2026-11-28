# Robotku STEM Kit — Belajar AI & IoT dari Robot Sendiri

> Dokumen rancangan produk + kurikulum. Disusun 2026-11-28 dari hasil uji langsung di
> board **Makerkit ESP32-S3 v1.3** dengan firmware **2.6.2-mk** dan web Robotku (branch `main`).
>
> Penanda status di seluruh dokumen:
> - ✅ **Teruji** — sudah dicoba di hardware asli (USB, 2026-11-28).
> - 🟡 **Ada, belum teruji penuh** — kode sudah ada, belum dicoba dengan modul fisiknya / belum di-deploy.
> - 🔵 **Usulan** — belum dibangun; perlu dikerjakan (lihat §7 Roadmap).
> - ➕ **Add-on** — butuh modul tambahan di luar isi box standar.

---

## 1. Ringkasan produk

**Robotku STEM Kit** adalah robot beroda rakitan (rangka dowel kayu + board Makerkit) yang
diprogram dari browser, dengan **asisten AI berbahasa Indonesia yang bicara langsung dari
robotnya** dan **kontrol lewat internet (IoT)**. Satu kit dipakai dari pelajaran pertama
(gerak maju-mundur) sampai proyek akhir (robot asisten kelas yang bisa diajak ngobrol dan
dikendalikan dari rumah).

### Target pengguna

| Jenjang | Fokus | Mode yang dipakai |
|---|---|---|
| SD kelas 4–6 | Urutan, perulangan, sebab-akibat, "AI itu apa" | Base Robot, Block Coding, AI Labs (Fira) |
| SMP | Sensor, logika kondisi, data, cara kerja AI (STT → LLM → TTS) | Block Coding, Lab I/O 🔵, Robotku AI |
| SMA / SMK | Python, IoT, keamanan, etika AI, proyek mandiri | Python mode, relay IoT, capstone |
| Guru | Panduan, rubrik, kelas campuran | §6 Panduan guru |

### Beda dengan kit sejenis (benchmark: stickem.sg)

Stick'Em sudah punya pola yang kami ikuti: rangka stik + board, kontrol dari web (Base Robot,
Joystick, Port Control, Code). Robotku menambahkan tiga hal yang belum ada di sana:

1. **AI suara di robotnya sendiri.** Mic INMP441 dan speaker MAX98357A ada di board. Alurnya:
   robot mendengar → Whisper (STT) → LLM → Piper (TTS, suara anak) → robot menjawab lewat
   speakernya. Ini bukan suara laptop. ✅ alur end-to-end teruji di hardware (lihat §3.6).
2. **IoT sungguhan.** Robot terhubung ke relay internet (Cloudflare). Siswa bisa
   mengendalikan robot dari perangkat mana pun, login dengan **password hardware** yang ada di
   kartu dalam box. 🟡 kode selesai dan teruji dengan Postgres lokal, belum di-deploy.
3. **Bahasa Indonesia penuh.** Suara robot (Piper `id_ID`, dikalibrasi agar sejernih klip
   referensi "Halo, saya Fira, asisten pribadi Anda"), persona AI, UI, dan kurikulum.

---

## 2. Isi box

### 2.1 Isi standar

| Komponen | Detail | Status |
|---|---|---|
| **Board Makerkit ESP32-S3 v1.3** | PCB putih dalam casing 3D-print hitam | ✅ |
| ↳ MCU | ESP32-S3-WROOM-1 **N16R8** (flash 16 MB quad, PSRAM 8 MB octal) — WiFi + Bluetooth LE | ✅ psram 8385991 B terbaca |
| ↳ Mikrofon | INMP441 (I2S, MIC_SCK IO14, MIC_WS IO21, MIC_SD IO13) | ✅ level, tepuk, rekam, STT |
| ↳ Speaker | Amplifier MAX98357A (I2S) + speaker | ✅ nada, klip, TTS streaming |
| ↳ Buzzer | Buzzer aktif (IO12) | ✅ |
| ↳ LED RGB | 4× WS2812B (IO11), nomor 1–4 di PCB | ✅ warna + efek |
| ↳ Layar | OLED SSD1306 128×64 di header **I2C BUS** (SDA IO38, SCL IO39) | ✅ teks, gambar piksel, bentuk |
| ↳ Sentuh | Pad **TOUCH 1** (IO1); Touch2 di IO2 | ✅ terbaca (0 saat tidak disentuh) |
| ↳ Indikator | LED POWER, LED **BT** (IO48), LED **WIFI** (IO47), tombol RESET | ✅ (LED BT/WiFi belum dikendalikan firmware 🔵) |
| ↳ Header | **SERVO** PWM1–4 (PWM/5V/GND), **AUX** 5–6, **Distance_Sensor** (VCC/TRIG/ECHO/GND), **INPUT & OUTPUT** (IN/GND/VCC), **UART** | ✅ PWM1, PWM2, AUX/servo P5, G1–G6 |
| ↳ USB | USB-C via CH340C (upload + Web Serial) | ✅ |
| Servo penggerak | 2× SG90 *continuous* + 2 roda hijau + dudukan servo kuning | ✅ maju/mundur/belok/steer |
| Rangka | Dowel kayu + sambungan sudut kuning + gusset oranye + klip 3D-print hitam | ✅ (rakitan) |
| Daya | Power bank + kabel USB-C | ✅ — **wajib untuk audio keras**, lihat §6.3 |
| Kartu login | **Password hardware** `XXXX-XXXX-XXXX-XXXX` + kode relay 6 karakter | 🟡 sistem siap, perlu deploy |
| Panduan cepat | Kartu QR ke hub.robotku.id + langkah rakit | 🔵 |

### 2.2 Paket add-on (direkomendasikan per kelas)

| Modul ➕ | Dipasang di | Dukungan firmware hari ini | Dipakai di pelajaran |
|---|---|---|---|
| **HC-SR04** (sensor jarak ultrasonik) | Header **Distance_Sensor** (Trig = AUX6/IO16, Echo = AUX5/IO15) | 🟡 ada (`ultrasonic`, cm/inch). Tanpa sensor terbaca −1. Belum dicoba dengan modul fisik. **Echo 5 V → pakai pembagi 1k/2k.** | L3, capstone penjaga |
| **LDR / modul cahaya** (analog) | INPUT & OUTPUT → port **G1–G4** | ✅ `analog` di G1–G6 terbaca (0–4095). Blok "cahaya" khusus 🔵 (`light` = UNSUPPORTED) — sementara pakai blok baca analog. | L3 |
| **Sensor garis IR** (2–3 buah, digital) | Port **G1–G6** | ✅ `digital` di G1–G6 terbaca. Blok "line follower" 🔵 | Capstone pengikut garis |
| **AHT20** (suhu + kelembapan, I2C) | Header **I2C BUS** (bersama OLED) | 🔵 `temperature`/`humidity` = UNSUPPORTED, perlu driver | L5 IoT data |
| **Servo SG90 posisi** (gripper/kepala) | **AUX 5** (port P5) | ✅ `SET_PORT` P5 → sudut; blok "servo posisi" ✅ (diperbaiki di 2.6.2) | L2, capstone gripper |
| **Push button / tombol arcade** | Port G (digital) | ✅ lewat baca digital | L2 |
| **IMU (MPU6050) untuk heading** | I2C BUS | 🔵 `heading` = UNSUPPORTED | Lanjutan |
| **Kabel jumper + breadboard mini** | — | — | L3 |

> Blok sensor yang modulnya belum ada (suhu, kelembapan, cahaya, jarak-roda, heading) saat ini
> masih tampil aktif di toolbox, tetapi robot menjawab `UNSUPPORTED`. Penandaan otomatis
> (abu-abu + alasan) masuk roadmap §7.

---

## 3. Peta fitur ↔ konsep belajar

### 3.1 Base Robot ✅
Kontrol D-pad 3×3 (Grab · ▲ · Release / ◀ · ▶ / ▼ · Buzzer) dengan ilustrasi robot top-down
yang ikut bergerak dan roda yang berputar.
- **Konsep:** arah, motor diferensial (kiri-kanan berlawanan = belok di tempat), sebab-akibat.
- **Teruji:** `SET_PORT` P1/P2, buzzer, `SET_GRIPPER`. Robot asli tidak punya capit; tombol
  Grab/Release disiapkan untuk add-on gripper.

### 3.2 Joystick / Tank ✅
Stik analog 360° dan dua tuas tank (`DRIVE_DIRECT`).
- **Konsep:** nilai kontinu −100..100, *mixing* kiri/kanan, kecepatan vs arah.

### 3.3 Port Control → **Lab I/O** 🔵
Hari ini: slider per port. Usulan: jadikan **Lab I/O**, meja eksperimen hardware tanpa coding:
- slider servo P1/P2/P5 + **trim titik netral** servo continuous (supaya tidak "merayap"),
- **nilai sensor live**: sentuh, level mic, tepuk, ultrasonik, analog/digital G1–G6,
- tombol LED RGB, buzzer, nada speaker, OLED teks.
- **Konsep:** PWM, sinyal analog vs digital, kalibrasi, membaca datasheet.
- Fungsi sekarang yang sudah teruji: `SET_PORT` P5 ✅, port tak ada (P3) dijawab `UNSUPPORTED` ✅.

### 3.4 Block Coding ✅
Editor Blockly (Zelos) + simulator. **75 blok** di toolbox, diuji satu per satu di robot pada
2026-11-28:

| Kategori | Blok | Hasil di robot |
|---|---|---|
| Movement | maju, mundur, kiri, kanan, steer, capit, servo posisi, uji servo, stop, stop semua | ✅ 10/10 |
| Display | teks OLED, kaomoji, kecerahan, warna LED, NeoPixel, efek NeoPixel, LCD bentuk/teks/clear (di OLED) | ✅ 9/9 |
| Audio | rekam, putar rekaman, efek suara, nada (detik/ketukan), melodi, volume, stop suara, BPM, klip speaker | ✅ 10/10 |
| Sensors & Data | tombol 1/2, sedang merekam, level mic, tepuk, tulis/baca analog, tulis/baca digital, ultrasonik, reset jarak/heading | ✅ 12 berfungsi; 5 UNSUPPORTED karena hardware tidak ada (suhu, kelembapan, cahaya, jarak-roda, heading) |
| Program Flow, Logic, Math, Timing | loop, if/else, while, break, logika, operasi, angka acak, tunggu | ✅ berjalan di browser |
| AI | kamera, model, deteksi objek, Fira bicara/tanya/ngobrol | ✅ kamera di browser; suara lewat robot (§3.6) |

Total: **46 blok perangkat berfungsi** di hardware, 26 blok host, 3 blok AI suara.

### 3.5 Python mode ✅
Blok yang sama punya padanan Python (`sensors.button1()`, dll.). Untuk SMA: transisi dari
blok ke teks dengan API yang sama.

### 3.6 Robotku AI ("Sahabatku AI") — suara di robot ✅/🟡
Panel AI di Block Coding:
- **Ketik** pertanyaan, atau tekan **🎤** (mic robot, berhenti sendiri saat kamu diam), atau
  **🗣 Mode Ngobrol** (dengar → jawab → dengar lagi; bilang "berhenti" untuk selesai).
- Alur: mic robot (16 kHz 16-bit lewat WiFi/relay) → **Whisper** → **LLM** (persona anak,
  jawaban singkat tanpa emoji saat diucapkan) → **Piper id_ID** (pitch 1.3 = suara anak,
  dipilih langsung di robot) → speaker robot (μ-law 16 kHz, dikalibrasi) → `TTS_DONE`.
- **Teruji di hardware:** alur lengkap berjalan, VAD berhenti 0,94 s setelah suara selesai,
  `TTS_DONE` tepat waktu.
- **Belum beres:** server STT yang live masih Whisper v1 tanpa kunci bahasa (sekali salah
  menebak bahasa). Worker baru (large-v3-turbo, `language: id`) sudah ditulis, belum di-deploy 🟡.
  Server Piper baru jalan di PC lokal; perlu hosting publik 🟡.
- **Konsep:** STT, LLM, TTS sebagai tiga "indra" terpisah; latensi; halusinasi; privasi.

### 3.7 AI Labs — Fira (Tamagotchi) ✅
Enam tahap yang "membuka indra" satu per satu: TELUR → DENGAR (mic, tepuk 5×) → BICARA
(TTS) → PAHAM (STT, 10 ucapan) → BERPIKIR (LLM, 5 percakapan) → BERTINDAK (tools). Bar
kesehatan memakai telemetri asli (level mic, antrean suara, sisa token, baterai).
- **Konsep:** AI = sensor + model + aksi; kenapa AI bisa lambat; batas konteks.

### 3.8 IoT relay + login password hardware 🟡
- Robot terhubung ke relay internet dengan kode 6 karakter. Siswa login dengan **password
  hardware** dari kartu box; server mengembalikan kode relay + token login web.
- Tabel `robot_devices` (Postgres), password disimpan hanya sebagai hash SHA-256, bisa dicabut.
- Status: kode + tes selesai (Postgres lokal). Perlu: hosting Postgres + deploy worker (§7).
- **Konsep:** client–server, autentikasi, token, kenapa password tidak disimpan mentah.

### 3.9 Firmware OTA + web flasher ✅
Flash pertama lewat browser (web flasher, `robotku-2.6.2-s3.bin`), update berikutnya via WiFi (OTA).
- **Konsep:** firmware vs software, versi, partisi.

---

## 4. Kurikulum berjenjang

Empat level × 6–8 pertemuan (1 pertemuan = 2 × 40 menit). Setiap level ditutup dengan proyek
mini. Level 1–2 cocok untuk SD kelas atas; Level 3–4 untuk SMP/SMA.

### Level 1 — "Robot Pertamaku" (gerak & urutan) · 6 pertemuan

| # | Tujuan | Konsep | Aktivitas | Fitur / blok | Output | Durasi |
|---|---|---|---|---|---|---|
| 1.1 | Kenal kit & keselamatan | Bagian robot: board, servo, sensor | Rakit rangka dowel, pasang board & servo | — | Robot terakit | 80' |
| 1.2 | Menghubungkan robot | USB / Bluetooth, apa itu firmware | Flash 2.6.2 via web flasher, sambung | Web flasher, Connect | Robot "Terhubung" di OLED | 80' |
| 1.3 | Mengendalikan langsung | Arah, motor kiri-kanan | Lomba slalom botol pakai D-pad | **Base Robot** | Lintasan selesai | 80' |
| 1.4 | Program pertama | Urutan (sequence) | Gambar persegi di lantai | maju, kiri, tunggu | Program persegi | 80' |
| 1.5 | Cahaya & suara | Output | Lampu lalu lintas mini | warna LED, nada, teks OLED | Robot lampu lalin | 80' |
| 1.6 | **Proyek mini** | Gabungan | "Robot penari": gerak + LED + melodi | Movement, Display, Audio | Pertunjukan 30 detik | 80' |

### Level 2 — "Robot yang Berpikir" (perulangan & kondisi) · 7 pertemuan

| # | Tujuan | Konsep | Aktivitas | Fitur / blok | Output | Durasi |
|---|---|---|---|---|---|---|
| 2.1 | Perulangan | `repeat`, `forever` | Persegi dengan 1 loop, bukan 8 blok | ulangi, selamanya | Program lebih pendek | 80' |
| 2.2 | Kondisi | `if / else` | Robot bereaksi saat pad disentuh | tombol 1, jika-maka | Robot "kaget" disentuh | 80' |
| 2.3 | Variabel | Menyimpan nilai | Penghitung sentuhan di OLED | variabel, teks OLED | Counter | 80' |
| 2.4 | Mendengar | Level suara, ambang | Robot berhenti saat kelas ribut | level mic, bandingkan | "Robot pustakawan" | 80' |
| 2.5 | Tepuk tangan | Event, debounce | Tepuk = maju, tepuk lagi = berhenti | tepuk, variabel | Robot tepuk | 80' |
| 2.6 | Servo posisi | Sudut 0–180° | Gerakkan servo P5 seperti jarum jam ➕ | servo posisi | Jam/penunjuk | 80' |
| 2.7 | **Proyek mini** | Gabungan | "Robot penjaga kelas": diam → bunyi bila ribut | mic, LED, buzzer, loop | Demo | 80' |

### Level 3 — "Sensor & Data" (analog, digital, PWM) · 7 pertemuan

| # | Tujuan | Konsep | Aktivitas | Fitur / blok | Output | Durasi |
|---|---|---|---|---|---|---|
| 3.1 | Digital vs analog | 0/1 vs 0–4095 | Baca G1 dengan & tanpa LDR ➕ | baca analog/digital, **Lab I/O 🔵** | Tabel nilai | 80' |
| 3.2 | PWM | Duty cycle, kecepatan servo | Kalibrasi titik netral servo | Port Control / Lab I/O 🔵 | Servo tidak merayap | 80' |
| 3.3 | Jarak | Gelombang ultrasonik, cm | Ukur jarak benda ➕ HC-SR04 | ultrasonik | Grafik jarak | 80' |
| 3.4 | Robot menghindar | Kondisi + sensor | Maju; jika < 20 cm belok | ultrasonik, jika, gerak | Robot anti-tabrak | 80' |
| 3.5 | Mengikuti garis | Sensor IR digital ➕ | Ikuti lakban hitam | baca digital G1/G2, loop | Line follower 🔵 blok khusus | 80' |
| 3.6 | Data & grafik | Sampling, rata-rata | Catat level mic 1 menit | variabel, list, simulator | Grafik kebisingan | 80' |
| 3.7 | **Proyek mini** | Gabungan | "Robot parkir otomatis" | ultrasonik, gerak, LED | Demo | 80' |

### Level 4 — "AI & IoT" · 8 pertemuan

| # | Tujuan | Konsep | Aktivitas | Fitur / blok | Output | Durasi |
|---|---|---|---|---|---|---|
| 4.1 | AI itu apa | Sensor → model → aksi | Tetaskan Fira di AI Labs (tahap 0–1) | **AI Labs** | Fira menetas | 80' |
| 4.2 | Mesin bicara (TTS) | Teks → suara, pitch, kejernihan | Robot membacakan puisi | Fira bicara, μ-law, pitch | Robot berpuisi | 80' |
| 4.3 | Mesin mendengar (STT) | Suara → teks, VAD, halusinasi | Uji Whisper dengan kalimat sulit | 🎤 mic robot | Tabel akurasi | 80' |
| 4.4 | Mesin berpikir (LLM) | Prompt, persona, batas jawaban | Rancang pertanyaan yang baik | Robotku AI (ketik) | Kumpulan prompt | 80' |
| 4.5 | Etika & privasi AI | Data suara, bias, kejujuran AI | Diskusi kasus; aturan kelas | — | Poster aturan AI | 80' |
| 4.6 | Asisten suara | STT → LLM → TTS penuh | **Mode Ngobrol** 🗣 | Fira ngobrol | Percakapan 5 giliran | 80' |
| 4.7 | IoT | WiFi, relay, login, token | Kendalikan robot dari HP teman | relay + password hardware 🟡 | Kontrol jarak jauh | 80' |
| 4.8 | **Proyek mini** | Gabungan | Robot asisten yang bisa dipanggil dari rumah | AI + relay | Demo | 80' |

---

## 5. Proyek capstone (pilih satu per tim, 3–4 pertemuan)

| # | Proyek | Yang dipelajari | Hardware | Status fitur |
|---|---|---|---|---|
| 1 | **Robot penjaga pintu** — mendeteksi orang mendekat, menyapa dengan suara | Sensor jarak, kondisi, TTS | ➕ HC-SR04 | 🟡 (ultrasonik siap, perlu uji modul) |
| 2 | **Asisten kelas** — siswa bertanya, robot menjawab lewat speaker | STT, LLM, TTS, prompt, etika | Standar | ✅ alur jalan; 🟡 butuh worker baru untuk STT stabil |
| 3 | **Penghitung tepuk / kuis tepuk** — guru bertanya, tim menjawab dengan tepuk | Event mic, variabel, OLED | Standar | ✅ |
| 4 | **Robot pengikut garis** | Sensor IR, loop kontrol | ➕ 2–3 sensor IR | ✅ baca digital; 🔵 blok khusus |
| 5 | **Smart home mini** — lampu (LED), "kipas" (servo P5) dikendalikan dari HP | IoT, relay, keamanan login | Standar (+ servo ➕) | 🟡 relay perlu deploy |
| 6 | **Stasiun cuaca kelas** — suhu/kelembapan tampil di OLED & web | Data, sampling, IoT | ➕ AHT20 | 🔵 driver sensor |
| 7 | **Robot pemandu tur sekolah** — berhenti di titik, menjelaskan lokasi | Urutan, TTS, gerak | Standar | ✅ |
| 8 | **Pengukur kebisingan perpustakaan** — LED hijau/kuning/merah + peringatan suara | Analog, ambang, OLED | Standar | ✅ |
| 9 | **Robot penyortir warna/objek** — kamera browser mendeteksi objek, robot bergerak | AI vision, kondisi | Kamera laptop | ✅ blok kamera di browser |
| 10 | **Fira Tamagotchi kelas** — merawat Fira sampai tahap BERPIKIR | Siklus AI, data telemetri | Standar | ✅ |

Kriteria capstone: masalah nyata di sekolah, minimal 1 sensor + 1 aktuator + 1 bagian AI atau
IoT, presentasi 5 menit, dokumentasi program.

---

## 6. Panduan guru, asesmen, keselamatan, privasi

### 6.1 Persiapan kelas
- 1 kit per 2–3 siswa. Chromebook/laptop dengan **Chrome atau Edge** (Web Serial/Bluetooth).
- Flash semua board ke **2.6.2** sebelum pertemuan pertama (web flasher, ±1 menit/board).
- Bagikan kartu password hardware per kit; simpan daftar kartu di tempat aman (password
  hanya muncul sekali saat dibuat).
- Siapkan power bank terisi penuh untuk setiap kit.

### 6.2 Rubrik penilaian (per proyek)

| Aspek | 1 — Mulai | 2 — Berkembang | 3 — Cakap | 4 — Mahir |
|---|---|---|---|---|
| **Logika program** | Urutan acak | Urutan benar, tanpa loop/kondisi | Pakai loop & kondisi tepat | Program efisien, variabel/fungsi |
| **Penggunaan sensor** | Tidak pakai | Membaca nilai | Mengambil keputusan dari nilai | Kalibrasi & menangani nilai salah (−1, noise) |
| **AI / IoT** | — | Memakai fitur apa adanya | Mengubah prompt/alur untuk tujuan | Menjelaskan STT/LLM/TTS & batasnya |
| **Debugging** | Bergantung guru | Mencoba ulang | Menemukan penyebab | Menguji sistematis & mencatat |
| **Kolaborasi & presentasi** | Pasif | Ikut serta | Peran jelas | Memimpin & menjelaskan ke kelas |
| **Etika & keselamatan** | Belum paham | Tahu aturan | Menerapkan aturan | Menjelaskan alasan aturan |

### 6.3 Keselamatan (wajib dibacakan pertemuan 1)
- **Audio keras → pakai power bank.** Speaker di skala penuh bisa menarik arus melebihi port
  USB laptop (~500 mA); saat uji, board sempat putus dari USB (brownout). Untuk bicara/musik,
  hidupkan robot dari power bank.
- **HC-SR04:** pin Echo mengeluarkan 5 V, sedangkan input board 3,3 V. Pasang pembagi
  tegangan 1 kΩ / 2 kΩ di Echo.
- **Servo:** mulai dengan kecepatan ≤ 30% dan durasi pendek di atas meja; uji di lantai.
  Tombol **Stop semua** / `STOP_ALL` selalu tersedia; watchdog firmware memutus motor bila
  koneksi hilang > 2 detik.
- Jangan menyolder/mencabut kabel servo saat board menyala. Rangka dowel: hati-hati serpihan.

### 6.4 Privasi & etika AI untuk anak
- Rekaman mic hanya dikirim saat siswa menekan 🎤 atau mengaktifkan Mode Ngobrol; LED/teks
  status menunjukkan robot sedang mendengar.
- Audio dikirim ke server STT untuk diubah jadi teks; **jangan ucapkan data pribadi** (nama
  lengkap, alamat, nomor telepon). Jadikan ini aturan kelas.
- Kunci API AI ada di server, bukan di browser; siswa tidak perlu akun AI.
- Ajarkan bahwa AI bisa salah (contoh nyata dari uji: STT pernah salah menebak bahasa) — siswa
  memeriksa jawaban, bukan menelan mentah-mentah.
- Password hardware = identitas robot; jangan dibagikan ke luar tim. Guru bisa mencabutnya.
- 🔵 Usulan: halaman "Privasi untuk orang tua" + opsi mematikan AI suara per kelas.

---

## 7. Gap & roadmap teknis agar kit siap dijual

| # | Pekerjaan | Kenapa | Perkiraan |
|---|---|---|---|
| 1 | **Deploy web `/development`** (push semua commit `main`) | Semua perbaikan hari ini belum live; CI sudah tidak terblokir lint | 10 menit |
| 2 | **Deploy worker AI** (Whisper large-v3-turbo `language: id`, persona suara, proxy TTS) | STT live masih salah tebak bahasa | 30 menit + uji |
| 3 | **Hosting server Piper** (VPS/HF Space) + set `TTS_SERVER_URL` | Sekarang hanya jalan di PC lokal | 0,5–1 hari |
| 4 | **Hosting Postgres** untuk password hardware | Hostinger shared (FTP) tidak bisa menjalankan Postgres; pilih VPS / Supabase / Neon, atau ganti MySQL Hostinger | 0,5 hari |
| 5 | **Deploy worker relay** + seed password tiap kit, lalu `REQUIRE_WEB_LOGIN=1` | Tanpa ini, kode relay 6 karakter saja cukup untuk mengendalikan robot | 0,5 hari |
| 6 | **Penandaan blok per sensor** (abu-abu + alasan bila sensor tidak ada) | Blok suhu/cahaya/heading tampak aktif tapi UNSUPPORTED | 1 hari (firmware kirim daftar sensor di HELLO_ACK + web) |
| 7 | **Lab I/O** (pengganti Port Control) + **UI trim servo** | Pelajaran PWM/kalibrasi; servo continuous merayap | 2–3 hari |
| 8 | **Driver add-on**: AHT20 (suhu/kelembapan), LDR → blok `light`, IMU heading | Supaya blok yang ada benar-benar jalan dengan paket add-on | 1–2 hari per sensor |
| 9 | **Blok khusus line follower** + uji HC-SR04 fisik | Capstone 3 & 4 | 1 hari |
| 10 | **LED BT/WiFi** di board dikendalikan firmware | Indikator koneksi untuk siswa | 1–2 jam |
| 11 | **Konten Academy**: masukkan kurikulum §4 ke `src/data/lessons.ts` (kategori sudah ada: Robotku Basics, AI & Machine Learning, Makerspace & Robotics, Sciences) | Guru bisa langsung pakai di web | 2–4 hari |
| 12 | **Kartu panduan & kemasan** (QR, langkah rakit, password) | Pengalaman unboxing | Desain |
| 13 | Uji lapangan 1 kelas (20–30 siswa), catat kendala | Validasi durasi & tingkat kesulitan | 2 minggu |

Urutan yang disarankan: 1 → 2 → 4 → 5 → 3 (fondasi online), lalu 6 → 7 → 11 (pengalaman
belajar), lalu add-on (8–9) dan uji lapangan (13).
