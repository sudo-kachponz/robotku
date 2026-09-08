 Prompt: Simulator Bergaya Wokwi — Kabel, Template LED/Suara/Animasi OLED, dan Bloknya

Dari audit `robotku-main__2_.zip`: `src/domain/boardProfile.ts` sudah ada (bagus), tapi **belum ada satu pun komponen visual board** (`src/components/blockcoding/sim/` tidak ada), `domain/ports.ts` masih model lama M1–M4/G1–G8, dan **belum ada blok RGB maupun OLED** sama sekali (`grep rgb_|oled_|SET_LED_COLOR` → kosong).

Jadi tiga hal harus dikerjakan bersamaan, karena saling bergantung: **blok** → **template** → **visual**. Template tidak bisa dibuat kalau bloknya belum ada, dan visual tidak ada gunanya kalau tidak ada yang menggerakkannya.

---

## PROMPT

```
ROLE
Repo robotku (Next.js 15, React 19, TypeScript strict, Blockly 12).
Bikin simulator bergaya Wokwi: papan Robotku digambar lengkap dengan MODUL dan KABEL yang
tersambung pin-ke-pin, plus paket template LED RGB / suara / animasi OLED yang bisa diklik-jalan,
dan blok-blok baru yang membuat template itu bisa dibongkar-pasang anak.

TATA LETAK YANG DIMINTA
  KIRI  = area Blockly (block coding) — seperti sekarang.
  KANAN = panel simulator, isinya dari atas ke bawah:
            1. gambar papan + modul + kabel (Wokwi-style)
            2. rak Template: klik satu kartu -> LANGSUNG jalan di simulator
          Kartu template yang diklik juga MEMUAT bloknya ke kanvas kiri, supaya anak bisa
          melihat "template ini terbuat dari blok apa" lalu mengubahnya. Ini jembatan dari
          mode gampang ke mode blok — jangan bikin dua dunia yang terpisah.

Kerjakan urut SLICE 1 -> 5. `npm test && npm run typecheck` di antara tiap slice.
Aturan tegas: SVG + CSS murni, tanpa dependensi baru, tanpa <canvas>, tanpa bitmap.
Hasil tiap slice harus KELIHATAN di layar sebelum lanjut ke slice berikutnya.

═══════════════════════════════════════════════════════════════════════════
SLICE 1 — Blok baru (fondasi; tanpa ini template tidak bisa ditulis)
═══════════════════════════════════════════════════════════════════════════
Repo belum punya blok RGB maupun OLED sama sekali. Tambahkan, pakai pola defineOnce() yang sudah
dipakai kategori lain, dan daftarkan di toolbox.

  KATEGORI "Lampu" (warna #EC4899)
   - rgb_set_color   "Nyalakan LED [colour picker]"        -> SET_LED_COLOR {r,g,b}
   - rgb_set_rgb     "Nyalakan LED merah[n] hijau[n] biru[n]" (0-255, terima ekspresi via numArg)
   - rgb_off         "Matikan LED"
   - rgb_fade_to     "Ubah warna perlahan ke [colour] selama [n] detik"
       -> dipecah runtime jadi beberapa SET_LED_COLOR bertahap (~20 langkah), BUKAN opcode baru
   - rgb_hue         "Nyalakan LED warna pelangi ke-[0-360]"  -> HSL->RGB di generator
       Blok inilah yang bikin template pelangi bisa ditulis anak dengan satu variabel + repeat.

  KATEGORI "Layar" (tambahkan ke kategori Display yang sudah ada)
   - oled_clear          "Bersihkan layar"
   - oled_text_at        "Tulis [teks] di x[n] y[n]"
   - oled_shape_at       "Gambar [hati|senyum|bintang|kotak|lingkaran|panah] di x[n] y[n] ukuran[n]"
   - oled_pixel          "Titik di x[n] y[n]"
   - oled_show           "Tampilkan"  (buffer -> layar; jelaskan di tooltip kenapa perlu)
   - oled_animation      "Mainkan animasi [dropdown preset] selama [n] detik"
       preset: bola-memantul, mata-berkedip, hati-berdenyut, loading, teks-berjalan, gelombang
       Ini "blok besar" untuk pemula; preset yang sama juga tersedia sebagai template versi
       blok-per-blok (SLICE 3) supaya anak bisa membongkarnya.

  KATEGORI Audio (tambahan)
   - audio_beep      "Bip [pendek|sedang|panjang]"
   - audio_siren     "Sirene [polisi|ambulans|alarm] selama [n] detik"
       -> runtime memecahnya jadi deret PLAY_TONE naik-turun; jangan opcode baru.
   - audio_sweep     "Nada dari [n] Hz ke [n] Hz selama [n] detik"

  SEMUA blok di atas WAJIB:
   - memakai numArg() dari categories/_args.ts untuk input angka (biar variabel & Math jalan)
   - punya penanganan di SimSink (render ke state) DAN TransportSink (kirim ke board)
   - punya test di src/test/blocks/ mengikuti pola coverage.test.ts yang sudah ada — coverage
     guard akan menggagalkan build kalau ada blok baru tanpa test.

═══════════════════════════════════════════════════════════════════════════
SLICE 2 — Gambar papan + modul + KABEL (bagian yang diminta paling jelas)
═══════════════════════════════════════════════════════════════════════════
File: src/components/blockcoding/sim/BoardSvg.tsx, OledModule.tsx, ServoModule.tsx, Wiring.tsx
dan sim/palette.ts (SEMUA warna hex ditaruh di sini, jangan disebar inline).

  PAPAN (viewBox 400x300, sesuai foto Controller V3):
   - Casing 3D-print hijau toska #2FC49A sebagai bingkai tebal ~14px mengelilingi PCB.
   - PCB biru tua, gradien #12386B -> #0E2E5C, sudut membulat, 4 sekrup silver di pojok.
   - Modul ESP32-WROOM perak di KIRI (x 20..115, y 95..175), area antena hitam berpola kotak
     menjorok keluar tepi kiri.
   - LED RGB 5mm kubah bening (cx 160 cy 130 r 11) — menyala + glow radial mengikuti state.
   - Buzzer hitam bundar (cx 172 cy 190 r 26) dengan lubang pusat dan tanda "+".
   - Silkscreen "ROBOTKU SCHOOL" putih di kanan atas.
   - Papan adaptor USB ungu + soket logam di kanan; chip CH340C; regulator AMS1117.
   - Tombol BOOT (kiri atas) dan RESET (kiri bawah).
   HEADER — warna & urutan HARUS persis foto, ini yang dipakai anak mencocokkan kabel asli:
     Blok I2C (atas, 4 baris x 5 kolom), dari atas: GND hitam #1B1B1B, VCC merah #D42E2E,
       SCL hijau #2FA84F, SDA kuning #E8C41F. Kolom = port I1..I5.
     Blok PWM (bawah, 3 baris x 5 kolom), dari atas: PWM kuning, 5V merah, GND hitam.
       Kolom = port P1..P5.
     Tiap kolom satu <g> dengan area klik, cursor pointer, aria-label ("Port I2C 3").

  KABEL (Wikwi-style — INI YANG DIMINTA):
   Wiring.tsx menggambar kabel dari SETIAP PIN modul ke PIN header yang benar, satu kabel per
   pin, bukan satu berkas. Warna kabel mengikuti konvensi yang dipakai di dunia nyata:
       GND -> hitam    VCC/5V -> merah    SCL -> hijau    SDA -> biru    PWM/sinyal -> kuning
   Bentuk jalur: keluar tegak lurus dari pin, belok siku, lalu masuk tegak lurus ke pin tujuan
   (gaya diagram Wokwi), dengan sudut dibulatkan sedikit. Hitung titiknya dari koordinat kolom
   port + indeks pin, jangan hardcode per kasus.
   - Hover sebuah kabel -> kabel menyala + tooltip "SDA -> SDA" dan pin di kedua ujung ikut
     menyala. Ini nilai edukasinya: anak belajar kabel mana ke mana.
   - Toggle "Tampilkan kabel" (default ON). Saat OFF, modul tetap tampil tapi kabel disembunyikan
     supaya gambar bersih.
   - Modul digambar DI BAWAH papan seperti contoh Wokwi, dengan jarak cukup supaya kabel terbaca.

  MODUL OLED (sesuai foto): bingkai cetak hijau toska + 4 sekrup, PCB biru, 4 pin berlabel
  KIRI->KANAN "GND VDD SCK SDA" (jangan diubah urutannya), layar hitam rasio 128x64.
  Isi layar me-render state sungguhan: teks (2 baris, marquee kalau kepanjangan), matriks 5x5,
  bentuk, titik — bukan placeholder.

  MODUL SERVO SG90 (sesuai foto): bodi biru bening, dudukan hijau toska, horn PUTIH palang dua
  lengan berlubang. Horn berputar mengikuti sudut/kecepatan port terkait.

  PASANG MODUL: panel kecil "Pasang modul" -> pilih Servo/OLED -> klik kolom port di gambar.
  Modul + kabelnya langsung muncul. Simpan susunan lewat pola localforage di app/persistence.ts.
  OLED hanya boleh ke port I2C, Servo hanya ke port PWM — tolak dengan pesan ramah, jangan diam.

═══════════════════════════════════════════════════════════════════════════
SLICE 3 — Paket template LED / Suara / Animasi OLED
═══════════════════════════════════════════════════════════════════════════
Tambahkan file src/templates/builtin/lampuSuara.ts dan animasiOled.ts, ikuti bentuk
BlockTemplate yang sudah ada (id, name, description, collection, tags, difficulty, learn[],
thumbnail SVG animasi, workspace JSON).

  KOLEKSI "Lampu & Suara"
   1. kedip_rgb      "Kedip Warna"      — ulang: merah 0.3s, mati 0.3s, biru 0.3s, mati
   2. pelangi        "Pelangi"          — variabel hue 0..360, repeat, rgb_hue + wait 20ms
   3. napas          "Lampu Bernapas"   — rgb_fade_to terang <-> redup, berulang
   4. polisi         "Lampu Polisi"     — merah/biru bergantian cepat + audio_siren polisi
   5. bip_bip        "Bip Bip"          — audio_beep pendek 3x + LED ikut berkedip tiap bip
   6. sirene         "Sirene"           — audio_sweep 400->1200 Hz naik-turun, LED merah berdenyut
   7. alarm          "Alarm"            — nada tinggi putus-putus + LED kuning kedip cepat
   8. disko          "Disko"            — warna acak (math_random_int) + bip mengikuti irama

  KOLEKSI "Animasi Layar"
   9.  bola_pantul   "Bola Memantul"    — variabel x,y + arah, oled_clear/shape_at/show dalam loop
   10. mata_kedip    "Mata Berkedip"    — dua lingkaran, sesekali jadi garis
   11. hati_denyut   "Hati Berdenyut"   — oled_shape_at hati, ukuran naik-turun
   12. teks_jalan    "Teks Berjalan"    — teks bergeser x dari kanan ke kiri
   13. loading       "Loading"          — titik berputar / bar bertambah
   14. jam_hitung    "Hitung Mundur"    — variabel + oled_text_at, dari 10 ke 0, lalu bip

  ATURAN PENTING
   - Template 9-14 ditulis dengan blok DASAR (variabel + repeat + oled_shape_at/text_at/clear/show),
     BUKAN dengan oled_animation preset. Justru itu gunanya: anak melihat animasi Wokwi-style itu
     ternyata cuma loop + koordinat. oled_animation preset tetap ada sebagai jalan pintas pemula.
   - Setiap template WAJIB lolos CI guard yang sudah ada: dimuat ke workspace headless, dijalankan
     3 detik di SimSink, dan harus menghasilkan minimal satu perubahan state. Template yang tidak
     melakukan apa-apa menggagalkan build.
   - Thumbnail: SVG animasi kecil yang benar-benar bergerak saat kartu di-hover (LED kedip,
     bola memantul) — bukan ikon diam. Inilah yang membuat rak template terasa menarik.

═══════════════════════════════════════════════════════════════════════════
SLICE 4 — Rak Template di panel kanan
═══════════════════════════════════════════════════════════════════════════
Di bawah gambar papan, tambahkan rak template ringkas (bukan modal galeri yang sudah ada):
  - Strip kategori: Lampu & Suara / Animasi Layar / Gerak / Semua.
  - Kartu kecil dengan thumbnail animasi + nama. Dua aksi per kartu:
      [Jalankan]  -> langsung jalan di simulator, TANPA menyentuh kanvas kiri
      [Buka blok] -> memuat bloknya ke kanvas kiri (pakai insert.ts yang sudah ada:
                     regenerasi id, Blockly.Events.setGroup supaya satu Ctrl+Z, konfirmasi
                     kalau kanvas tidak kosong)
  - Saat sebuah template sedang jalan, tombol berubah jadi [Hentikan].
  - Kartu yang butuh modul (OLED/servo) yang belum terpasang: tampilkan chip "butuh Layar OLED"
    dan tawarkan "Pasang otomatis" yang memasangkannya ke port kosong pertama yang cocok.
  - Rak ini harus bisa di-collapse; di layar < 1024px ia jadi bottom sheet, satu panel saja yang
    terbuka pada satu waktu (ikuti pola responsif yang sudah dipakai panel lain).

═══════════════════════════════════════════════════════════════════════════
SLICE 5 — Panel "Coba Langsung" (uji tanpa menyusun blok)
═══════════════════════════════════════════════════════════════════════════
Panel kecil di bawah gambar:
  - Color picker -> LED RGB di gambar berubah seketika
  - Kotak teks   -> muncul di layar OLED seketika
  - Tombol Bip / Sirene -> buzzer berdenyut + suara
  - Slider sudut servo -> horn berputar
Beri label kecil "hanya simulator". Kalau board sungguhan sedang tersambung, ubah labelnya jadi
"kirim ke robot" dan benar-benar kirimkan opcode-nya — jangan sampai anak mengubah warna di layar
sementara LED aslinya diam, karena itu akan terbaca sebagai kerusakan.

KUALITAS (berlaku semua slice)
 - prefers-reduced-motion: matikan putaran horn, kedip LED, gelombang buzzer, marquee, dan
   thumbnail animasi — nilainya tetap terlihat statis.
 - Semua elemen interaktif punya aria-label Bahasa Indonesia dan bisa dicapai keyboard.
 - Gambar papan + kabel < 30 kB dalam bundel; tidak ada re-render per frame di luar langganan
   store; widget daun (pin, kabel, dot matriks) di-memo.

ACCEPTANCE — buktikan dengan tangkapan layar di docs/SIM-VISUAL.md
 1. Panel kanan menampilkan gambar papan biru + casing hijau toska. (Kalau tidak terlihat,
    poin lain tidak berlaku.)
 2. Pasang OLED di port I3 -> modul muncul DI BAWAH papan dengan EMPAT kabel terpisah
    (hitam/merah/hijau/biru) menuju kolom ke-3 blok header ATAS. Hover kabel -> tooltip pin.
 3. Template "Pelangi" diklik Jalankan -> LED di gambar berputar warna terus-menerus.
 4. Template "Sirene" -> nada naik-turun terdengar + LED merah berdenyut + gelombang buzzer.
 5. Template "Bola Memantul" -> bola bergerak dan memantul di layar OLED.
 6. Klik [Buka blok] pada "Bola Memantul" -> bloknya muncul di kanvas kiri; ubah angka kecepatan,
    jalankan lagi, animasinya ikut berubah.
 7. Semua 14 template lolos CI guard "harus mengubah state".
 8. Ctrl+Z sekali menghapus seluruh template yang baru dimuat.
 9. Refresh halaman -> modul yang terpasang masih terpasang.
```

---

## Dua hal yang perlu kamu putuskan

**Pertama, `domain/ports.ts` masih model lama.** Header di gambar akan berlabel I1–I5 dan P1–P5, tapi kode di baliknya masih bicara M1–M4/G1–G8. Prompt ini sengaja tidak menyentuh model port supaya tidak melebar — tapi artinya untuk sementara ada dua penamaan yang hidup bersamaan. Kalau kamu mau sekalian diberesin, itu slice terpisah (SLICE 2 dari prompt sebelumnya) dan sebaiknya dikerjakan **sebelum** ini, bukan sesudah.

**Kedua, `oled_animation` preset itu pisau bermata dua.** Dia membuat template animasi bisa dipakai anak kelas 3 dengan satu blok. Tapi kalau semua template animasi dibuat dari preset itu, anak tidak belajar apa-apa saat membukanya — isinya cuma satu blok. Karena itu prompt di atas meminta template 9–14 ditulis dengan blok dasar (variabel + loop + koordinat), dan preset hanya sebagai jalan pintas. Kalau kamu ingin sebaliknya, bilang saja — tapi menurut saya nilai jual "buka blok" justru hilang.

