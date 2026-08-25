# Robotku — Prompt Landing Page ("Selamat Datang di Robotku Lab", gaya robotku.id)

Merombak **tata letak & gaya** landing page app agar seperti **robotku.id** (hero biru pekat immersive, navbar, judul chunky rounded, CTA pink, ilustrasi + sparkle). **Fitur sudah benar** (dua kartu Web Control & Robotku Academy) — yang diubah **hanya penempatan/UI dan teks judul jadi "Selamat Datang di Robotku Lab"**.

> Wajib: terapkan `PROMPT_Robotku_DesignSystem_Reference.md` (token DS + Plus Jakarta Sans + vibe robotku.id). File yang disentuh: `src/pages/index.tsx` + `src/styles/Home.module.css`. **Jangan ubah fungsi/link kartu** — hanya layout & gaya. Wire kartu Academy ke `/academy` (in-app), bukan stub eksternal.

---

## PROMPT (salin ke Claude Code)

```
GOAL
Redesign ONLY the layout & styling of the landing page (src/pages/index.tsx + src/styles/Home.module.css) to match the robotku.id marketing style (deep-indigo immersive hero, top navbar, chunky rounded heading, pink CTA, mascot/illustration + sparkles). Change the heading to "Selamat Datang di Robotku Lab". Keep the two feature cards (Web Control, Robotku Academy) — their content/links/badges are correct; only re-place and re-skin them. Do NOT change functionality. Use DS tokens + Plus Jakarta Sans; add a rounded DISPLAY font for big headings.

FIX THE "TOO LIGHT" LOOK
- The current page renders too white. The hero and page must be DEEP INDIGO/navy immersive like robotku.id, NOT a light gradient. Use a strong indigo gradient background (e.g. linear-gradient(160deg, var(--indigo-900) 0%, var(--indigo-800) 55%, var(--indigo-700) 100%)) with a subtle sparkle/pattern layer. White is only for the feature cards on top.

DISPLAY FONT (rounded, chunky — like robotku.id headings)
- Add a display font for big headings: @import Fredoka (weights 500–700) as var(--font-display) with fallback to Plus Jakarta Sans. Use it ONLY for the hero heading + section titles; body stays Plus Jakarta Sans. (If you confirm the exact site font later, swap it here.)

LAYOUT (match robotku.id)
1) TOP NAVBAR (sticky, transparent over hero): Robotku horizontal logo (left). Right: a few text links optional (Program · Academy · Event) + a PINK pill button ".rb-btn-pink" labelled "robotku.id ↗" linking to https://robotku.id (target _blank). Keep it minimal and clean.
2) HERO (full-width, deep-indigo, rounded corners --r-2xl, generous padding), TWO columns:
   - LEFT (text): a small eyebrow pill "ROBOTKU WEB PLATFORM" (indigo-100 bg / indigo-700 text, pill). Big heading in --font-display, white, ~clamp(40px, 6vw, 68px), tight leading:
        "Selamat Datang di" (white) + line break + "Robotku Lab" (accent — pink #EC2D8F, or a highlighted style).
     Subtitle in white-80 (--rk-on-muted): "Kendalikan robotmu langsung dari browser. Pilih mode dan coba coding!" — optionally end with a yellow-highlighted tag like the reference (a <mark> with yellow bg, dark text), e.g. #BikinRobotMu.
     A big PINK pill CTA "Mulai Sekarang →" linking to /control (primary action). Optional secondary ghost/white link "Buka Academy →" to /academy.
   - RIGHT (visual): the Robotku mascot (/brand/Pose1.png) large (~clamp(220px, 30vw, 380px)) with a drop-shadow, plus 2–3 yellow star/sparkle accents around it (small SVG stars), echoing robotku.id. On mobile, stack (text above, mascot below).
3) SECTION "MODUL & FITUR UTAMA" (centered heading in --font-display, white) BELOW the hero:
   - The SAME two cards as now, re-placed as a 2-column grid of elevated WHITE cards (.rb-card, --r-lg, shadow) on the indigo bg:
     * WEB CONTROL — icon, badge "SIAP DIGUNAKAN" (indigo/blue pill top-right), title, desc "Sambungkan robot via Bluetooth atau USB, lalu jelajahi 5 mode kontrol.", primary CTA "Mulai →" → /control.
     * ROBOTKU ACADEMY — icon, badge "MODUL BELAJAR" (pink pill), title, desc "Materi belajar, tutorial interaktif, dan tantangan robotika untuk siswa & pengajar.", CTA "Buka Academy →" → /academy (in-app; remove the external confirm() stub).
   - Keep the existing card icons or use lucide (Bot for Web Control, GraduationCap for Academy). White card, ink text inside, colored badge, indigo/pink CTA.
4) FOOTER: small, on indigo — social icons (Instagram/YouTube/TikTok) + phone "0851-7964-0032" + version "v1.0.0" (like the current footer, but on the immersive bg). Optional.

STYLE NOTES
- Cards are the ONLY white areas; hero + page = deep indigo. Big rounded display headings; large, bold, kid-friendly. Pink for primary CTAs & the "Robotku Lab" accent; yellow only for the highlighted tag.
- Everything uses DS tokens + Plus Jakarta Sans (+ --font-display for headings). Fully responsive: hero 2-col → stacked on mobile; feature cards 2-col → 1-col on mobile.

ACCEPTANCE
- Landing shows a DEEP INDIGO immersive hero (not white) with navbar, eyebrow pill, chunky rounded heading "Selamat Datang di Robotku Lab" (Robotku Lab in pink), subtitle (+optional yellow tag), pink CTA → /control, and a large mascot with sparkles on the right.
- Below, "MODUL & FITUR UTAMA" with the two white feature cards (Web Control → /control, Robotku Academy → /academy) unchanged in function, restyled/re-placed.
- Matches robotku.id vibe; responsive; no functional changes beyond wiring Academy to /academy. Show diffs for index.tsx and Home.module.css (+ any font import).
```

---

## Catatan
- Ini murni **UI placing + gaya + teks judul** ("Selamat Datang di Robotku Lab") — dua kartu fitur (Web Control / Academy) fungsinya tetap, cuma dipindah & di-skin agar immersive seperti robotku.id.
- Judul chunky rounded di robotku.id kemungkinan **Fredoka/Baloo 2**; saya set sebagai `--font-display` (heading saja), body tetap Plus Jakarta Sans. Kalau kamu konfirmasi font persisnya dari DevTools robotku.id, tinggal ganti satu baris `--font-display`.
- Kartu Academy diarahkan ke `/academy` in-app (LMS), bukan lagi stub `confirm()` ke robotku.id.
