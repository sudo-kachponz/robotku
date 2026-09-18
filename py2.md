# TASK v2 — Perdalam dokumentasi Python Mode + tambah 7 tema IDE

## 0. STATUS YANG SUDAH ADA (sudah diverifikasi dari repo, jangan dikerjakan ulang)
Sudah jadi:
- src/pythongen/apiMap.ts      -> 72 entry (block <-> python <-> opcode <-> docs id)
- src/pythongen/compile.ts     -> parser Python -> RuntimeCommand[] (453 baris)
- src/pythongen/index.ts       -> generatePython()
- src/pythongen/snippets.ts    -> ~30 kartu flyout + doc inline sederhana
- src/components/blockcoding/python/PyEditor.tsx  -> CodeMirror 6, drag-drop dasar, lint gutter
- src/components/blockcoding/python/PyFlyout.tsx  -> flyout HTML, kartu draggable, ghost chip
- src/components/blockcoding/python/DocsPanel.tsx -> slide-over 52 baris
- src/components/blockcoding/ViewToggle.tsx       -> toggle Blocks/Python
- src/test/python.gen.test.ts, python.parity.test.ts
- docs/PYTHON-MODE.md (255 baris) — keputusan CM6 & dialek, TETAP BERLAKU

Aturan C1–C5 dari spec sebelumnya TETAP MENGIKAT:
C1 tanpa runtime kedua, C2 kontrak wire tidak berubah, C3 board guard berlaku,
C4 tanpa hex hardcode di komponen, C5 mode Blok tetap default.

## 1. UTANG TEKNIS — KERJAKAN DULUAN (tema mustahil tanpa ini)
Saat ini C4 dilanggar di beberapa tempat dan itu memblokir seluruh fitur tema:
- src/components/blockcoding/python/PyEditor.tsx: HighlightStyle & EditorView.theme
  memakai hex literal (#a626a4, #9aa0b4, #c18401, #986801, #1b1840, #ffffff, #f7f8fc,
  #b9bdd4, #eef0ff)
- src/components/blockcoding/BlockCoding.module.css: .pyProblems/.pyProbErr/.pyProbWarn
  memakai #e7e9f2, #fffaf7, #f3e6de, #b91c1c, #9a6a00
- src/components/blockcoding/python/PyFlyout.module.css & DocsPanel.module.css: audit ulang
Tugas 1:
  a. Tambahkan token editor ke src/theme/tokens.css:
     --code-bg, --code-fg, --code-gutter-bg, --code-gutter-fg, --code-active-line,
     --code-selection, --code-keyword, --code-string, --code-number, --code-comment,
     --code-ident, --code-fn, --code-error, --code-warn
  b. PyEditor harus MEMBACA token itu lewat getComputedStyle(document.documentElement)
     saat mount dan saat tema berubah, lalu me-rebuild HighlightStyle + EditorView.theme
     via Compartment (@codemirror/state). Jangan reload editor — state & undo harus utuh.
  c. Semua CSS Module di mode Python pindah ke var(--...).
  d. Tambah test/lint rule: gagal kalau ada literal hex 6 digit di src/components/**.
     (boleh script node sederhana di scripts/, dipanggil dari npm run lint)

## 2. DOKUMENTASI v2 — setara MakeCode (ini keluhan utama)
Acuan visual: makecode.microbit.org/reference/input/on-gesture dan panel docs in-editor-nya.
Yang ditiru = STRUKTUR & KEDALAMAN, bukan branding.

### 2.1 Pindahkan sumber docs
Docs sekarang menempel di SNIPPETS (~30). Pindahkan ke registry sendiri yang dikunci
oleh field `docs` di apiMap.ts, supaya SEMUA 72 entry punya dokumentasi.
Buat src/pythongen/docs/registry.ts + satu file per kategori (movement.ts, display.ts, ...).
Model konten per entri:
  {
    slug: 'movement/forward',
    title: 'robot.forward',
    category: 'Movement',
    summary: string,                    // 1-2 kalimat, bahasa anak
    description: string,                // paragraf penjelas
    signature: { python: string, opcode: string },   // mis. 'robot.forward(detik, speed="medium")' + 'MOVE_TIMED'
    params: [{ name, type, default, desc, range? }],
    returns?: { type, desc },
    blockPreview: { blockType: string, fields?: Record<string,unknown> },
    examples: [{ title, desc, python: string, blocks?: workspaceJson, runnable?: boolean }],
    seeAlso: string[],                  // slug lain
    notes?: string[],                   // mis. "butuh modul OLED", "1 baris -> 2 command"
    boardNote?: string                  // otomatis dari isSupported(): "Tidak tersedia di board V3"
  }
Test wajib: setiap entry di API (apiMap.ts) yang punya `docs` HARUS punya baris di
registry, dan setiap slug di `seeAlso` harus resolve. Gagal kalau tidak.

### 2.2 Preview blok yang benar-benar dirender
MakeCode menampilkan gambar blok asli di halaman docs. Lakukan hal yang sama:
render blok lewat Blockly headless (workspace tak terlihat + getRobotkuTheme()),
ambil SVG-nya, dan tampilkan. Pelajari cara pxt/pxt-microbit merender blok untuk docs
(verifikasi sendiri di GitHub). Wajib:
- di-cache per (blockType, fields, tema) supaya tidak merender ulang tiap buka panel
- fallback ke chip berwarna kategori kalau render gagal (JANGAN crash)
- ikut berubah warnanya saat tema berganti

### 2.3 Bagian signature
MakeCode menampilkan dua baris: JAVASCRIPT dan PYTHON. Robotku tidak punya JavaScript
(generator-nya menghasilkan JSON command), jadi tampilkan dua baris ini:
  [PYTHON]  robot.forward(detik, speed="medium")
  [OPCODE]  MOVE_TIMED  { direction, speed, duration_ms, left, right }
Baris OPCODE justru lebih berguna di sini karena itulah yang dikirim ke ESP32.
Beri label kecil di kanan atas tiap blok kode, persis pola MakeCode.

### 2.4 Bagian Contoh yang bisa dijalankan
Tiap contoh punya tab: [ Blok | Python | ▶ ]
- Blok  -> render preview blok dari `blocks` (workspace JSON)
- Python-> kode contoh dengan syntax highlight
- ▶     -> muat contoh ke editor & jalankan di simulator.
          Pakai jalur yang SUDAH ADA: insertTemplate() + handleTryTemplate() di
          BlockCoding.tsx. Jangan bikin jalur run baru.
          Kalau user punya program yang belum disimpan, minta konfirmasi dulu
          (pola window.confirm di handleUseTemplate: Ganti / Tambahkan / Batal).

### 2.5 Halaman docs berdiri sendiri + tombol ↗
Buat route baru:
  src/pages/docs/reference/index.tsx            -> indeks semua API, dikelompokkan per kategori, ada search
  src/pages/docs/reference/[...slug].tsx        -> halaman satu API
CATATAN PENTING: next.config.mjs memakai output:'export' + trailingSlash:true dan
ada guard yang menolak src/pages/api/*. Jadi WAJIB getStaticPaths({ fallback: false })
yang dibangkitkan dari registry, dan tidak boleh ada API route / server-side apa pun.
Isi halaman:
  Breadcrumb: Docs > Referensi > <Kategori> > <nama>
  judul, summary, preview blok, signature, Parameters (tabel), Returns,
  Contoh (dengan tab Blok/Python/▶), Catatan, See Also, tombol print
Tombol ↗ di DocsPanel membuka route ini di TAB BARU (target="_blank" rel="noopener"),
dengan anchor ke bagian yang sedang dilihat.
Body halaman dan body panel WAJIB komponen React yang sama (src/components/docs/DocsBody.tsx)
supaya isi tidak pernah berbeda antara panel dan halaman.
Halaman docs juga harus ikut tema (bagian 3) dan bisa dibuka tanpa robot terhubung.

### 2.6 Jalan masuk ke docs
- tombol "?" di kartu flyout (sudah ada) -> panel
- kotak search di atas flyout (BELUM ADA — tambahkan): fuzzy match nama + summary,
  lintas kategori, Enter membuka docs
- Ctrl/Cmd+hover identifier di CodeMirror -> tooltip ringkas + link "Selengkapnya"
- klik baris di panel Problems yang menyebut nama API -> buka docs API itu

### 2.7 Panel Problems juga diperdalam (masih terlalu polos)
Sekarang cuma daftar teks selalu tampil. Jadikan:
- header: "Problems" + badge merah jumlah, chevron untuk collapse, divider bisa di-drag
- pesan identik berulang digabung dengan badge angka (persis MakeCode)
- klik baris -> loncat + select range di editor
- tombol "Explain with AI" -> modal placeholder, JANGAN panggil API apa pun
- warning board guard (isSupported) ditampilkan terpisah dari error parser

## 3. TUJUH TEMA IDE (ala VS Code)
Tema: spring, summer, autumn, winter, space, forest, underwater.
Default tetap tampilan sekarang; petakan sebagai `spring` ATAU tambahkan `robotku`
sebagai default ke-8 — putuskan, lalu tulis alasannya di docs.

### 3.1 Bentuk implementasi
- src/theme/themes/<nama>.css -> override token di :root[data-theme="<nama>"]
- src/theme/themes/index.ts   -> registry { id, label, mode: 'light'|'dark', swatch: [3 warna], blocklyOverrides }
- Provider kecil di src/pages/_app.tsx: baca localStorage 'robotku.theme',
  set document.documentElement.dataset.theme. Hindari FOUC: set lewat script kecil
  inline di _document.tsx sebelum hydration.
- Tiap tema WAJIB mendefinisikan ULANG grup token ini (jangan sebagian):
  surface, surface-2, bg, line, line-soft, seluruh skala ink-*, semantic (blue/green/
  amber/purple/red + -bg), seluruh token --code-* dari bagian 1, dan
  --flyout-bg-color default.

### 3.2 Bagian yang harus ikut berubah (jangan setengah jalan)
  a. Blockly: workspace background, grid colour, toolbox bg/fg, flyout bg, scrollbar,
     insertion marker. Rebuild tema lewat getRobotkuTheme(themeId) lalu
     workspace.setTheme(...) — JANGAN dispose workspace (program user harus tetap utuh).
  b. Warna 12 kategori (src/visual/categoryColors.ts): tiap tema punya varian.
     Pertahankan IDENTITAS hue (Movement tetap hijau, AI tetap pink) tetapi sesuaikan
     lightness/saturation supaya terbaca di tema gelap. Jangan mengacak hue.
  c. CodeMirror: token --code-* lewat Compartment (bagian 1b).
  d. ControlLayout navbar, dock, panel sim, toast, modal, TemplateGallery, CvPanel,
     halaman docs, panel Problems.
  e. Sim board SVG (src/components/blockcoding/sim/BoardSvg.tsx) — minimal
     background & label agar tidak menyala putih di tema gelap.

### 3.3 Mode gelap
space dan underwater = gelap; forest = gelap-hijau (putuskan sendiri, catat di docs).
Untuk tema gelap: naikkan --insertion/--marker contrast, turunkan glass blur flyout
(backdrop-filter blur(16px) di tema gelap sering jadi bubur), dan pastikan
`color-scheme: dark` di-set supaya scrollbar native ikut.

### 3.4 Pemilih tema
- Di src/pages/control/settings.tsx: grid kartu dengan 3 swatch + nama + preview mini
  (blok + sepotong kode), pilihan langsung diterapkan live (pola VS Code)
- Quick switcher di toolbar editor (ikon palet) untuk ganti cepat tanpa pindah halaman
- Hormati prefers-color-scheme HANYA untuk pilihan pertama; setelah user memilih,
  pilihannya menang
- Hormati prefers-reduced-motion: transisi warna dimatikan (BlockCoding.tsx sudah
  punya listener `reduced`, pakai itu)

### 3.5 RISIKO YANG HARUS DIUJI (ini bagian yang biasanya jebol)
12 warna kategori x 7 tema = 84 kombinasi. Yang sering gagal: teks blok putih di atas
kategori kuning/cyan pada tema terang, dan blok hijau/cyan yang "menyala" di tema gelap.
Tulis test kontras otomatis (src/test/theme.contrast.test.ts):
- teks blok vs warna kategori >= 4.5:1 untuk SEMUA tema
- --ink-700 vs --surface >= 4.5:1
- --code-fg vs --code-bg >= 4.5:1
- tiap pasang kategori dalam satu tema harus punya jarak warna minimum (deltaE)
  supaya tetap bisa dibedakan
Test ini harus GAGAL kalau ada tema yang tidak lolos, bukan sekadar warning.

## 4. URUTAN KERJA (tunjukkan hasil tiap tahap, tunggu review)
1. Utang teknis bagian 1 (token --code-*, Compartment, hapus hex) + lint rule
2. Registry docs + test kelengkapan 72 entry
3. DocsBody.tsx (komponen bersama) + DocsPanel dipasang ulang di atasnya
4. Preview blok headless + cache
5. Route /docs/reference (indeks + [...slug]) + tombol ↗
6. Contoh yang bisa dijalankan (▶) lewat insertTemplate/handleTryTemplate
7. Search flyout + hover tooltip + Problems panel v2
8. Registry tema + 7 file CSS + provider + anti-FOUC
9. Blockly setTheme + varian warna kategori + CM6 Compartment + sisa UI
10. Pemilih tema di settings + quick switcher
11. Test kontras + rapikan

## 5. DEFINISI SELESAI (buktikan dengan output, jangan diklaim)
[ ] npm run typecheck / lint / test / build -> semua exit 0
[ ] npm run deadcode -> tidak ada file yatim baru
[ ] Setiap entry apiMap yang punya `docs` punya halaman docs yang bisa dibuka
[ ] /docs/reference/movement/forward/ ada di hasil `out/` static export dan bisa
    dibuka langsung (deep link, tanpa JS state sebelumnya)
[ ] Tombol ↗ membuka tab baru ke halaman yang isinya identik dengan panel
[ ] Tombol ▶ pada contoh memuat blok ke workspace dan menjalankannya di simulator
[ ] Ganti tema saat ada program di workspace -> program TIDAK hilang, warna blok
    berubah, warna syntax editor berubah, undo history editor tetap utuh
[ ] Ganti tema saat panel docs terbuka -> preview blok ikut berganti warna
[ ] Reload halaman -> tema bertahan, tidak ada kedipan putih (FOUC)
[ ] theme.contrast.test.ts hijau untuk 7 tema
[ ] Tidak ada literal hex 6 digit tersisa di src/components/**
[ ] Bundle mode Blok tidak membesar (bandingkan docs/PERF-BASELINE.md); docs registry
    dan CM6 tetap lazy

## 6. NON-GOALS
Tidak mengubah firmware/protokol, tidak menambah dependency selain yang benar-benar
perlu untuk tema (idealnya nol), tidak memanggil API AI, tidak menambah API route
(akan menggagalkan build karena guard di next.config.mjs).
