# Robotku — Prompt: Beresin Blocker Sebelum Deploy ke `hub.robotku.id`

Berdasarkan audit `robotku-main__7_.zip` yang **dijalankan beneran** (`npm ci` → `next build` → `vitest run`), bukan pembacaan kode saja.

**Baseline terverifikasi (jangan sampai turun):**

- `next build` sukses, 17 route ter-export
- First Load JS `/control/modes/code` = **121 kB** (three.js sudah lazy ✅ R1 berhasil)
- **111 test lolos** di 19 file
- `out/` = 46 MB, dikurangi `sim3d/` 20 MB → **±26 MB per upload**

> **Sebelum menjalankan workflow deploy: rotasi kredensial FTP `hub.robotku.id`.** Host, user, dan password itu sudah tersebar di chat WhatsApp dan di riwayat percakapan ini — anggap sudah bocor. Ganti di hPanel, lalu simpan yang baru sebagai GitHub Secrets `FTP_HOST` / `FTP_USER` / `FTP_PASS`. Guard di workflow sudah ada dan akan menolak deploy kalau secret kosong; guard itu **tidak** mendeteksi kredensial lama yang masih valid.

---

## PROMPT — jalankan sebagai satu sesi, per slice, test di antaranya

```
ROLE
Repo robotku (Next.js 15 Pages Router, output:'export', TypeScript strict). Target: static deploy ke
https://hub.robotku.id lewat FTPS. Semua yang ada di sini adalah blocker atau near-blocker yang
SUDAH DIVERIFIKASI dengan menjalankan build — bukan dugaan. Kerjakan berurutan, jalankan
`npm test && npm run typecheck` setelah tiap slice, dan laporkan per slice.

BATAS KERJA (ada agent lain yang sedang refactor komponen)
- JANGAN sentuh: src/components/blockcoding/BlockCoding.tsx, hooks/useBlocklyWorkspace.ts, dan
  file hasil pecahannya (EditorToolbar/SimulatorCard/SerialMonitor/icons).
- Slice 7 di bawah menyentuh src/ secara luas — kerjakan TERAKHIR, dan lewati file di atas.
- Kalau butuh perubahan di file terlarang, tulis di docs/HANDOFF.md, jangan edit.

BASELINE YANG HARUS DIPERTAHANKAN (regresi = gagal)
- First Load JS /control/modes/code tetap <= 125 kB
- 111 test tetap hijau
- `next build` tetap sukses tanpa warning baru

──────────────────────────────────────────────────────────────────────────────
SLICE 1 — CI dijamin gagal di setiap push (BLOCKER TERTINGGI)
──────────────────────────────────────────────────────────────────────────────
BUKTI (saya jalankan sendiri):
    npm ci && npm run typecheck   -> 20 error TS2307:
       "Cannot find module '../../styles/Settings.module.css'"
       "Cannot find module '../../assets/Guide1.svg'"  (dst)
    npx next build && npm run typecheck -> exit 0
PENYEBAB: `next-env.d.ts` ada di .gitignore:18 dan hanya dibuat oleh `next build`. Deklarasi tipe
untuk CSS Modules dan import gambar ada di file itu. Di CI, checkout bersih -> file tidak ada ->
tsc gagal sebelum build sempat membuatnya.
FIX (pilih A, jangan B):
  A. Buat src/types/assets.d.ts yang mendeklarasikan sendiri modul-modul itu:
       declare module '*.module.css' { const c: Record<string,string>; export default c; }
       declare module '*.svg'  { const s: string; export default s; }
       declare module '*.png'  { const s: string; export default s; }
     Dengan begitu `typecheck` berdiri sendiri, tidak tergantung artefak build. Ini juga bikin
     kontributor baru bisa `npm run typecheck` di clone bersih.
  B. (jangan) sekadar menukar urutan step di workflow — itu menutupi masalahnya dan `npm run
     typecheck` lokal di clone bersih tetap gagal.
VERIFIKASI: `rm -rf .next next-env.d.ts && npm run typecheck` -> exit 0.

──────────────────────────────────────────────────────────────────────────────
SLICE 2 — Gate lint/deadcode palsu
──────────────────────────────────────────────────────────────────────────────
BUKTI: `npm run lint` -> "sh: 1: eslint: not found". Script "lint", "lint:fix", "deadcode" ada di
package.json tapi eslint / knip / prettier TIDAK ada di devDependencies dan tidak ada file config.
Di .github/workflows/deploy.yml step Lint diberi `continue-on-error: true`, jadi gate ini
kelihatan menjaga padahal tidak menjaga apa pun.
FIX:
 - devDeps: eslint, eslint-config-next, @typescript-eslint/{parser,eslint-plugin},
   eslint-plugin-unused-imports, prettier, eslint-config-prettier, knip.
 - eslint.config.mjs (flat config) extend next/core-web-vitals + typescript, dengan
   unused-imports/no-unused-imports = error dan no-console = warn (kecuali console.warn/error).
 - .prettierrc + .prettierignore. Format seluruh repo dalam SATU commit terpisah yang tidak
   mengubah logika apa pun, supaya diff berikutnya tetap bisa direview.
 - knip.json untuk Next Pages Router (entry: src/pages/**, vitest.config.ts).
 - Setelah lint hijau, HAPUS `continue-on-error: true` dari workflow. Gate yang tidak menggagalkan
   build lebih buruk daripada tidak ada gate, karena memberi rasa aman yang salah.
VERIFIKASI: `npm run lint` exit 0 tanpa continue-on-error; `npx knip` dilaporkan hasilnya.

──────────────────────────────────────────────────────────────────────────────
SLICE 3 — Favicon tidak ada sama sekali
──────────────────────────────────────────────────────────────────────────────
BUKTI: `ls out/favicon*` -> No such file or directory. Setiap page load menghasilkan 404 ke
/favicon.ico dan tab browser tampil kosong.
FIX: buat set ikon dari maskot Robotku:
 - public/favicon.ico (multi-size 16/32/48)
 - public/icons/icon-192.png, icon-512.png (maskable, padding aman 10%)
 - public/icons/apple-touch-icon.png (180x180)
 - link semuanya dari _document.tsx.
Ikon harus dioptimasi: 192px < 15 KB, 512px < 60 KB. Sumbernya boleh dari
public/brand/Robotku-Mascot-Logo.png (664 KB) tapi JANGAN dipakai apa adanya sebagai ikon.

──────────────────────────────────────────────────────────────────────────────
SLICE 4 — Manifest PWA dobel dan menunjuk file yang tidak ada
──────────────────────────────────────────────────────────────────────────────
BUKTI: ada DUA file dengan isi berbeda:
 - public/manifest.json          name "Robotku Playground", ikon -> /brand/Robotku-Mascot-Logo.png
                                 (664 KB, dipakai untuk 192 DAN 512 — salah)
 - public/manifest.webmanifest   name "Robotku", ikon -> /icons/icon-192.png & icon-512.png
                                 YANG TIDAK ADA (isi public/icons hanya confused/happy/mad/sad.png)
 - _document.tsx menunjuk /manifest.json
Akibat: install ke home screen gagal atau ikonnya rusak.
FIX: sisakan SATU file (public/manifest.webmanifest), hapus manifest.json, arahkan _document ke
file yang tersisa, dan pastikan setiap ikon yang dirujuk benar-benar ada (hasil Slice 3).
Set juga id, lang: "id", dan categories. Verifikasi lewat Chrome DevTools > Application > Manifest:
harus nol error dan tombol Install muncul.

──────────────────────────────────────────────────────────────────────────────
SLICE 5 — robots.txt mengiklankan sitemap yang tidak ada
──────────────────────────────────────────────────────────────────────────────
BUKTI: public/robots.txt berisi "Sitemap: https://hub.robotku.id/sitemap.xml"; `ls public/sitemap.xml`
-> tidak ada. Crawler dapat 404.
FIX: generate sitemap.xml di scripts/postbuild.mjs dengan cara membaca daftar route yang benar-benar
ter-export dari out/ (jangan hardcode daftar route — pasti basi begitu ada halaman baru).
Kecualikan /404 dan /500. Tulis <lastmod> dari waktu build.

──────────────────────────────────────────────────────────────────────────────
SLICE 6 — Font Google lewat @import (render-blocking + titik gagal di WiFi sekolah)
──────────────────────────────────────────────────────────────────────────────
BUKTI: src/theme/tokens.css:7
    @import url('https://fonts.googleapis.com/css2?family=Fredoka...&family=Plus+Jakarta+Sans...');
_document.tsx sudah punya <link rel="preconnect"> ke fonts.googleapis/gstatic TAPI tidak ada
<link rel="stylesheet">, jadi preconnect itu percuma dan font baru di-request setelah CSS selesai
di-parse (rantai blocking bertingkat).
FIX (self-host, ini produk untuk lab sekolah yang WiFi-nya sering memblokir domain luar):
 - Pakai next/font/google dengan Fredoka + Plus Jakarta Sans. Next akan mengunduh dan menyajikan
   font dari domain sendiri saat build — tidak ada request ke Google saat runtime.
 - Subset 'latin', display: 'swap', dan expose sebagai CSS variable yang dipakai tokens.css.
 - Hapus @import dari tokens.css dan hapus dua <link rel="preconnect"> yang jadi mubazir.
 - Cek berat: hanya bundel weight yang benar-benar dipakai (audit dulu — sekarang meminta 8 weight
   Plus Jakarta Sans; kemungkinan besar hanya 4-5 yang terpakai).
VERIFIKASI: buka Network tab dengan filter "font", pastikan nol request ke fonts.googleapis.com /
fonts.gstatic.com, dan tidak ada FOUT yang mencolok.

──────────────────────────────────────────────────────────────────────────────
SLICE 7 — Sisa kebersihan pra-rilis
──────────────────────────────────────────────────────────────────────────────
a) OG / meta share. _document.tsx tidak punya description maupun og:*. Link ini akan disebar guru
   lewat WhatsApp — sekarang preview-nya kosong. Tambahkan di _app.tsx (agar bisa di-override per
   halaman): title default, description Bahasa Indonesia, og:title/description/image/url/type,
   twitter:card summary_large_image. Buat public/og-image.png 1200x630 (< 200 KB) dengan maskot +
   nama produk. Pakai URL absolut https://hub.robotku.id/... karena WhatsApp tidak resolve relatif.
b) Kompresi aset brand. public/brand = 3.7 MB: Pose2.png 1.1 MB, Pose1.png 942 KB,
   Mascot-Robotku-School.png 872 KB, Robotku-Mascot-Logo.png 664 KB. Konversi ke WebP (quality ~82)
   dan turunkan resolusi ke ukuran tampil sebenarnya. Target folder < 700 KB. Sertakan angka
   sebelum/sesudah di docs/PERF-BASELINE.md.
c) Hapus public/vite.svg (sisa scaffolding Vite, tidak dirujuk siapa pun — konfirmasi dengan grep).
d) Buat .env.example (dirujuk .gitignore:!.env.example tapi filenya tidak ada) berisi
   NEXT_PUBLIC_* yang dipakai, dengan nilai dummy dan komentar. JANGAN pernah isi kredensial asli.
e) Sisa R2 yang masih menganga (hitungan saya di src/): 100 kemunculan `any`/`as any`,
   21 `console.log`, dan 9 `window.confirm|prompt|alert`. Untuk slice ini cukup:
   - hapus/ubah semua console.log jadi console.warn/error atau buang (lint akan menjaganya),
   - ganti window.confirm/prompt/alert yang ADA DI LUAR file terlarang dengan modal/toast aplikasi;
     yang ada di dalam file terlarang cukup dicatat di docs/HANDOFF.md.
   - `any`: kerjakan hanya di src/runtime, src/domain, src/blockcoding (paling berisiko), sisanya
     catat sebagai utang.
f) .htaccess (scripts/postbuild.mjs) — tambahkan:
   - `Options -Indexes` (sekarang direktori tanpa index bisa di-browse)
   - `serial=(self)` ke Permissions-Policy. Sekarang tidak rusak karena directive yang tak disebut
     tetap memakai default, tapi tulis eksplisit supaya tidak ada yang "merapikan" header ini nanti
     lalu mematikan Web Serial tanpa sadar.
   - HSTS `Strict-Transport-Security "max-age=31536000"` — TAPI baru aktifkan setelah HTTPS
     terverifikasi jalan di produksi. Salah pasang HSTS = situs tidak bisa diakses dan tidak bisa
     dibatalkan cepat. Taruh di belakang env flag ENABLE_HSTS=1, default mati.

──────────────────────────────────────────────────────────────────────────────
SLICE 8 — Perkuat pipeline deploy
──────────────────────────────────────────────────────────────────────────────
a) scripts/deploy.sh pass 2 memakai `--only-newer`, yang membandingkan timestamp FTP. Di shared
   hosting, timezone/clock server sering tidak sinkron sehingga file yang berubah bisa TERLEWAT.
   Untuk file HTML dan .htaccess (jumlahnya sedikit, ukurannya kecil), buang --only-newer supaya
   selalu diunggah ulang. Pertahankan --only-newer hanya untuk /_next/static yang namanya hashed.
b) Upload pertama ±26 MB (out/ 46 MB minus sim3d 20 MB). Tambahkan echo ukuran total sebelum
   mirror supaya operator tahu ini akan lama, dan `--parallel=4` sudah ada — pertahankan.
c) Tambahkan smoke check pasca-deploy di workflow: curl https://hub.robotku.id/version.json dan
   bandingkan sha-nya dengan GITHUB_SHA. Kalau beda -> gagalkan job. Tanpa ini, deploy yang
   setengah jalan akan lolos tanpa ketahuan.
d) Dokumentasikan rollback di docs/DEPLOY-CHECKLIST.md: simpan out/ versi sebelumnya sebagai zip
   bertanggal, dan cara me-mirror ulang.

──────────────────────────────────────────────────────────────────────────────
ACCEPTANCE (semua harus dibuktikan, bukan diklaim)
──────────────────────────────────────────────────────────────────────────────
 1. `rm -rf .next next-env.d.ts node_modules && npm ci && npm run typecheck` -> exit 0.
 2. `npm run lint` -> exit 0, DAN `continue-on-error` sudah dihapus dari workflow.
 3. `npm test` -> 111 test tetap hijau (angka tidak boleh turun).
 4. `npm run build` -> First Load JS /control/modes/code masih <= 125 kB (tempel tabelnya).
 5. out/favicon.ico, out/icons/icon-{192,512}.png, out/sitemap.xml, out/og-image.png semuanya ada.
 6. DevTools > Application > Manifest: nol error, tombol Install muncul.
 7. Network tab: nol request ke fonts.googleapis.com / fonts.gstatic.com.
 8. `grep -rn "console\.log" src | wc -l` -> 0.
 9. public/brand < 700 KB (sertakan angka sebelum/sesudah).
10. docs/DEPLOY-CHECKLIST.md diperbarui: setiap item dicentang dengan bukti (perintah + outputnya).
```

---

## Urutan & perkiraan

| Slice | Isi                            | Sifat                    |
| ----- | ------------------------------ | ------------------------ |
| 1     | `next-env.d.ts` / typecheck CI | **blocker**, cepat       |
| 2     | eslint + knip + prettier       | **blocker gate**, sedang |
| 3–5   | favicon, manifest, sitemap     | **blocker**, cepat       |
| 6     | self-host font                 | penting, sedang          |
| 7     | og:image, kompresi, sisa R2    | penting                  |
| 8     | pipeline hardening             | penting                  |

Slice 1, 3, 4, 5 bisa selesai dalam satu duduk. Yang paling memakan waktu justru Slice 2, karena begitu ESLint aktif dia akan memunculkan puluhan temuan yang selama ini tidak terlihat — itu wajar, dan lebih baik ketahuan sekarang daripada setelah live.

## Yang masih belum bisa diselesaikan tanpa hardware/device

R4 (matriks responsif di device nyata) dan R5 (koneksi ESP32 lintas-device) tetap tertunda sampai robotmu ada dan kamu punya akses ke iPhone/tablet untuk uji. Delapan slice di atas tidak menyentuh keduanya, jadi bisa jalan paralel.

Satu hal terakhir soal keamanan yang perlu ditegaskan: guard secret di workflow hanya memeriksa apakah secret **kosong**. Kalau kredensial lama yang bocor itu masih valid dan dimasukkan ke Secrets, guard-nya akan lolos dengan senang hati. Rotasi di hPanel adalah langkah manual yang tidak bisa digantikan kode.
