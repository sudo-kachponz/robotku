# Robotku Web — Prompt Pack v3

### Refactor brutal · Responsif mobile brutal · Siap deploy di server sendiri

Dari audit `robotku-main__3_.zip`. Semua angka dan path di bawah hasil pembacaan repo, bukan asumsi — pakai apa adanya di prompt supaya model tidak menebak.

---

## AUDIT SINGKAT (bukti, biar prompt-nya tidak ngarang)

**Berat & sampah**

- `public/` = **26 MB**, dan yang berat semua milik simulator 3D beta: `Cyberpunk.hdr` 5.8 MB, `rocks_ground_09_diff_2k.jpg` 3.4 MB, `rubber_tiles_rough_2k.jpg` 2.7 MB, `rubber_tiles_nor_gl_2k.jpg` 2.3 MB, `plastered_wall_05_diff_2k.jpg` 2.3 MB, `rubber_tiles_diff_2k.jpg` 1.7 MB, `Asteria-DashMinimal.glb` 2.1 MB, `brand/` 3.7 MB, `icons/` 1.8 MB. Di 4G sekolah, ini pertempuran utamanya.
- Ikut ter-commit: `tsconfig.tsbuildinfo` (293 KB, tidak ada di `.gitignore`), `Robotku Design System.html` (1.6 MB), dan 7 dump prompt di root (`a.md`, `o.md`, `fe.md`, `prompt.md`, `block.md`, `lms.md`, `baserobot.md`), plus `public/vite.svg` sisa Vite.

**Kode mati / salah tempat**

- `src/components/layout/AppShell.tsx` masih shell LMS: 7 menu ke `/pengumuman`, `/akademik/*`, `/master/*` — **tidak satu pun route itu ada** di `src/pages/`. Dengan `output: 'export'` dan tanpa `404.tsx`, kliknya = halaman mati.
- `operatorsCategory` dan `mechanismsCategory` diekspor tapi **tidak dipakai** `toolbox.ts` — bloknya tidak bisa dijangkau anak, padahal `mechanisms` sudah punya generator.
- `BlockCoding.tsx` 546 baris: class `RobotkuCategory` (±120 baris inline style) numpang di file yang sama, dan **tabel warna kategori ditulis dua kali** di file itu (di `setSelected` dan di listener `TOOLBOX_ITEM_SELECT`) — plus salinan ketiga di `visual/theme.ts`.
- Konstanta kinematika duplikat: `150 px/s`, `90 deg/s`, clamp `0.42` ada di `BaseMode.tsx` **dan** `runtime/SimSink.ts`.
- Tidak ada ESLint, Prettier, test, CI, error boundary, `404.tsx`/`500.tsx`.

**Responsif — praktis belum digarap**

- Total **11 `@media`** di seluruh app, 1 di antaranya `prefers-reduced-motion`. Jadi efektif 10 breakpoint untuk 20+ layar.
- `AppShell.module.css`: `width: 100vw`, `height: 100vh`, sidebar **fixed 320px**, `overflow: hidden` — di HP: sidebar makan 85% layar, konten tidak bisa di-scroll.
- `BlockCoding.module.css`: `.blocklyToolboxDiv { width: 360px !important }` dan label kategori `font-size: 30px` (inline di `RobotkuCategory`). Di layar 375 px, toolbox saja sudah 96% lebar.
- `zoom.startScale: 0.6` dipatok tanpa melihat lebar layar; di HP blok jadi mikroskopis, di tablet kekecilan.
- `viewport-fit=cover` sudah dipasang di `_app.tsx`, tapi **tidak ada satu pun `env(safe-area-inset-*)`** di CSS → notch dan home indicator iPhone menabrak dock & tombol.
- `touch-action` hanya di 3 file; sisanya (Blockly canvas, kartu simulator, modal) bebas ikut men-scroll halaman saat anak nge-drag blok.
- `.simCard` di ≤640px jadi `calc(100vw - 36px)` — menutupi hampir seluruh kanvas, sementara toolbar bulat 48px tetap di `top:20px; right:20px` di atasnya.

**Kenyataan pahit soal mobile (harus jujur di UI, bukan disembunyikan)**

- Web Serial: **hanya Chrome/Edge desktop**. Tidak ada di Android maupun iOS.
- Web Bluetooth: **ada di Chrome Android**, **tidak ada di Safari iOS** (semua browser di iOS pakai WebKit).
- Artinya di iPhone/iPad, seluruh alur Connect mati total; di Android hanya BLE. Aplikasi harus mendeteksi ini di awal dan menawarkan mode yang tetap berguna (Simulator + Block Coding + Academy), bukan melempar error saat tombol Connect ditekan.
- `output: 'export'` + host sendiri: **wajib HTTPS**. Web Bluetooth dan `getUserMedia` (AI kamera nanti) hanya jalan di secure context; `http://ip-lokal` = fitur mati diam-diam.

---

# PROMPT R1 — Refactor brutal (pre-deploy)

```
ROLE
You are doing a pre-deployment refactor of the Robotku web app (Next.js 15 Pages Router, React 19,
TypeScript strict, Blockly 12, static export). Goal: delete dead weight, kill duplication, and make
the codebase safe to hand to another engineer — WITHOUT changing any user-visible behaviour that
currently works. Every behavioural change must be called out explicitly in the summary.

GROUND RULE
This is a refactor, not a rewrite. After each step the app must still build (`npm run build`) and
typecheck (`npm run typecheck`). Work in small commits, one concern per commit, and show the diff
per file with a one-line "how to verify".

=== STEP 1: DELETE / QUARANTINE DEAD CODE ===
- src/components/layout/AppShell.tsx + AppShell.module.css: the nav points at /pengumuman,
  /akademik/jadwal, /akademik/nilai, /akademik/kehadiran, /master/guru, /master/siswa, /master/mapel —
  none of these routes exist in src/pages. Decide with evidence: if src/pages/dashboard.tsx is the
  only consumer and dashboard is not linked from the product flow, delete BOTH the shell and the
  page. If dashboard is still wanted, cut the nav down to routes that actually exist and add the
  missing pages as explicit stubs. Do not leave links to 404s in a static export.
- src/categories/operators.ts and src/categories/mechanisms.ts export categories that
  src/toolbox.ts never includes. Choose per category and say why: (a) add it to the toolbox because
  the blocks are wanted (mechanisms: Set Head / Set Gripper already have generators AND SimSink
  support — these look like an accidental omission), or (b) delete the unused category export while
  keeping the block definitions if other code depends on them. `operatorsCategory` duplicates
  Logic + Math + Text entries that already exist as their own categories — that one is a strong
  delete candidate; the generator overrides in that file must stay.
- Remove public/vite.svg (Vite leftover).
- Add to .gitignore: tsconfig.tsbuildinfo, .DS_Store, *.tsbuildinfo. Remove the committed
  tsconfig.tsbuildinfo from git.
- Move the 7 root markdown dumps (a.md, o.md, fe.md, prompt.md, block.md, lms.md, baserobot.md) and
  "Robotku Design System.html" (1.6 MB) into docs/ , and reference the design system from docs/README
  instead of shipping it at the repo root. If they are not needed for the build, they must not sit
  next to package.json.
- Run a dead-export scan (ts-prune or knip as a devDependency) and delete every unreferenced export
  it finds, EXCEPT files that exist purely for side effects (src/categories/* register blocks) —
  annotate those with a comment so the next scan skips them.

=== STEP 2: BREAK UP BlockCoding.tsx (546 lines) ===
Extract, keeping behaviour identical:
- src/components/blockcoding/RobotkuCategory.ts — the Blockly ToolboxCategory subclass currently
  living at the top of BlockCoding.tsx (lines ~24-130). While moving it, replace the ~120 lines of
  imperative `element.style.x = ...` with a CSS Module class + CSS custom properties
  (--cat-color set from this.colour_). Inline styles here are also what makes the sidebar
  impossible to make responsive later (PROMPT R2 depends on this).
- src/visual/categoryColors.ts — ONE source of truth for the 12 category colours and their
  low-saturation flyout tints. The map is currently written THREE times: RobotkuCategory.setSelected,
  the TOOLBOX_ITEM_SELECT listener in BlockCoding.tsx, and visual/theme.ts. Export
  `CATEGORY_COLOR[name]`, `CATEGORY_TINT[name]`, and have theme.ts derive its block styles from it.
- src/blockcoding/generateProgram.ts — lift generateCode() out of the component (it is also needed by
  tests and by the template CI check). Same filtering behaviour, but replace the silent
  `console.warn('Skipping non-JSON command segment')` with a returned diagnostics array
  `{ commands, skipped: string[] }` so the UI can surface "3 blok dilewati" instead of hiding it.
- Hooks: src/components/blockcoding/useBlocklyWorkspace.ts (inject + load + resize + dispose),
  useProgramRun.ts (runner/sink selection, run/stop/running state), useTelemetryLog.ts.
  BlockCoding.tsx should end up as layout + wiring, target under 200 lines.

=== STEP 3: KILL REMAINING DUPLICATION ===
- src/domain/kinematics.ts — the drive constants duplicated between BaseMode.tsx and SimSink.ts
  (150 px/s linear, 90 deg/s turn, 0.42 stage clamp, speed enum scaling). Both import from here.
  A child driving manually and a child running a Forward block must move identically; today that
  is a coincidence maintained by hand.
- src/domain/ports.ts already exists — verify SimSink, TransportSink, PortMode and PortBoard all use
  it and that no magic index 0/1 remains.
- Unify colour constants: PortMode/PortBoard export CW/CCW/TRACK; SimStage re-imports them (good) —
  make sure nothing else hardcodes #8085F4 / #F265AE.

=== STEP 4: ERROR HANDLING & OBSERVABILITY ===
- Add src/pages/_error.tsx, 404.tsx and 500.tsx in the Robotku design language (mascot + "kembali ke
  beranda"). A static export with no 404 page is a blank white screen.
- Add a React error boundary around the editor and each control mode: a Blockly or WebGL crash must
  not white-screen the whole app; show a recover card with "Muat ulang editor" that re-mounts.
- Replace bare `catch {}` swallows with a tiny logger (src/ui/logger.ts) that is silent in
  production but keeps a ring buffer of the last 100 events, surfaced in the Serial Monitor's "Raw"
  tab. Grep for `catch {` and `catch (e) {}` and fix every one — either handle it or log it.
- Guard every direct `window`/`document`/`navigator` access outside a useEffect. Static export
  pre-renders these pages at build time; anything at module scope will break `next build`.

=== STEP 5: TOOLING & GUARDRAILS ===
- ESLint (next/core-web-vitals + @typescript-eslint) + Prettier, with `npm run lint` and
  `npm run format:check`. Fix everything it reports; do not add blanket disables — if a rule is
  genuinely wrong for this codebase, disable it in the config with a comment explaining why.
- Add `npm run check` = typecheck + lint + build, and a GitHub Actions workflow running it on PRs.
- Add a bundle guard: after `next build`, fail if the First Load JS of /control/modes/code exceeds a
  committed budget (start from the current value + 10%). Blockly is big; this stops it getting worse.
- README rewrite: what the app is, how to run it, the architecture in 10 lines (transport ->
  protocol -> runtime -> sinks -> UI), the browser support matrix, and how to deploy.

=== STEP 6: ASSET DIET (26 MB public/) ===
- The heavy assets (Cyberpunk.hdr 5.8 MB, four 2K jpgs, Asteria-DashMinimal.glb 2.1 MB) are used ONLY
  by the opt-in three.js simulator. Make that explicit:
  * Move them to public/sim3d/ and load them lazily, only after the user turns on the 3D beta.
  * Recompress: 2K jpgs -> WebP at 1K (target <300 KB each), HDR -> a 1K .hdr or a baked env map
    (<800 KB), glb -> Draco/meshopt compressed (target <600 KB).
  * If, after PROMPT B of the previous pack, the 2D simulator is the default and 3D is not actually
    used in class, propose deleting the 3D path entirely and say what would be lost. Removing
    three.js also drops a large chunk from the bundle.
- brand/ (3.7 MB) and icons/ (1.8 MB): convert PNG -> WebP, generate proper favicon + apple-touch-icon
  + maskable icon sizes instead of pointing the favicon at a full-size mascot PNG
  (_app.tsx currently uses /brand/Robotku-Mascot-Logo.png as the icon).
- Target: public/ under 6 MB, and the first meaningful load of /control/modes/code under 2 MB
  transferred on a cold cache.

DELIVERABLE
A refactor report at the end: what was deleted (with line counts), what moved where, every
behavioural change (there should be almost none), the before/after of `public/` size and First Load
JS, and anything you found that looks wrong but you did NOT touch because it was out of scope.
```

---

# PROMPT R2 — Responsif mobile brutal

```
ROLE
Make the Robotku web app genuinely usable on phones and tablets. Current state: 11 @media rules in
the entire codebase, a 320px fixed sidebar with 100vw/100vh, a Blockly toolbox pinned at
`width: 360px !important` with 30px category labels, and zero safe-area handling despite
viewport-fit=cover. Treat every screen below as broken until proven otherwise on a real device.

TARGET MATRIX (test every screen at each)
  360x800  Android phone portrait (baseline — most Indonesian school devices)
  390x844  iPhone portrait (notch + home indicator)
  844x390  iPhone landscape (the realistic driving posture)
  768x1024 iPad portrait / 1024x768 landscape
  1280x800 small laptop
Plus: 200% browser zoom at 1280px, and prefers-reduced-motion.

=== FOUNDATION ===
1. src/theme/breakpoints.css — one set of tokens, used everywhere:
     --bp-sm: 480px; --bp-md: 768px; --bp-lg: 1024px; --bp-xl: 1280px;
   and a documented rule: mobile-first, min-width queries by default. Refactor the existing 10
   max-width queries to match the token set instead of the current ad-hoc 520/640/760/860/900/960.
2. Viewport height: replace every `100vh` with `100dvh` and keep a `100vh` line above it as the
   fallback (Academy.module.css and ControlLayout already do this correctly — AppShell.module.css
   and AcademyDetail.module.css do NOT). Mobile URL bars make 100vh taller than the screen; the
   bottom dock currently ends up under the browser chrome.
3. Safe areas: `viewport-fit=cover` is already set, but no CSS uses it. Add to globals.css
     :root { --safe-t: env(safe-area-inset-top); --safe-b: env(safe-area-inset-bottom);
             --safe-l: env(safe-area-inset-left); --safe-r: env(safe-area-inset-right); }
   and apply to: the bottom dock (ControlLayout), the toast container (currently `bottom: 86px`
   hardcoded in globals.css), the Block Coding right toolbar, the fullscreen/connect buttons, and
   every fixed-position modal. On a notched iPhone in landscape, --safe-l/--safe-r matter too.
4. Touch hygiene in globals.css: `-webkit-tap-highlight-color: transparent`,
   `overscroll-behavior: none` on the app root (stops pull-to-refresh firing while dragging blocks),
   `touch-action: manipulation` on buttons, and `touch-action: none` on every drag surface (Blockly
   canvas wrapper, joystick, sliders, the sim arena's draggable obstacle).
5. Minimum hit targets: 44x44 CSS px (Apple HIG) / 48x48 (Material) for EVERY interactive element.
   Audit the 48px round toolbar buttons (fine), but also the small `simToggle`, monitor Clear, the
   `portNum` labels, and academy chips. Write it as a lint-able rule in the CSS review checklist.

=== BLOCK CODING EDITOR (the hardest screen) ===
This screen is currently desktop-only in practice. Rework it into three layouts:
 A. >= 1024px — today's layout: left toolbox, canvas, right vertical toolbar, sim card floating.
 B. 768-1023px (tablet) — toolbox narrower (240px), sim card becomes a right-side dock that can
    collapse to a tab, toolbar buttons keep labels.
 C. < 768px (phone) — a genuinely different composition, not a squeezed desktop:
    - Toolbox becomes a BOTTOM SHEET: a horizontal, scrollable row of category chips pinned above
      the safe area; tapping one slides up a flyout sheet at ~55% height with the blocks; dragging a
      block out closes the sheet. Remove `width: 360px !important` and drive the toolbox width from
      a CSS variable per breakpoint.
    - Category label font: 30px inline (in RobotkuCategory) -> clamp(16px, 4vw, 30px) via CSS
      custom property. This is why STEP 2 of the refactor prompt must land first.
    - Right toolbar collapses into a single floating action button that expands into a radial/stacked
      menu (Run stays always-visible and large — it is the one button that matters).
    - Simulator: not a floating card. A bottom sheet with three snap points (peek 88px showing just
      the robot + Run state / half / full), swipeable, remembering the last snap point.
    - Serial monitor and the CV panel become full-screen sheets on phones, never draggable windows.
    - Blockly zoom: `startScale` must adapt — roughly 0.45 at 360px, 0.6 at 768px, 0.75 at 1280px;
      set `zoom.pinch: true`, keep wheel zoom off on touch, and re-run svgResize on
      orientationchange AND on visualViewport resize (the on-screen keyboard changes the viewport
      without firing window resize on iOS).
    - Blockly's own touch behaviour: verify long-press context menu, drag-to-trash, and that dragging
      a block never scrolls the page (that is what touch-action: none on the wrapper is for).
 In ALL layouts: an "unsaved work" guard on back/navigation, because losing a program on a phone
 back-swipe is the worst possible first experience.

=== CONTROL MODES (Base / Port / Tank / Joystick) ===
- These are landscape-first. Add a polite orientation hint on phones in portrait ("Putar HP-mu untuk
  kontrol yang lebih enak") — a dismissible overlay, not a hard block.
- Base Robot: the 3x3 pad must scale with the shorter viewport axis (`min(38vw, 38vh)` per button,
  clamped 56-96px), and the robot stage must never push the pad off-screen. In landscape, stage left
  / pad right; in portrait, stage top / pad bottom.
- Port Control: 8 full-width sliders + the board illustration do not fit a phone. On < 768px, drop
  the board to a collapsible section and make the sliders taller (min 44px thumb) with the value
  shown as a chip. Keyboard hints (Digit1..8, SHIFT) are desktop-only — hide them on touch devices
  rather than showing shortcuts nobody can press.
- Joystick/Tank: size the joystick from `min(60vw, 60vh)`; support two-finger simultaneous touch for
  Tank (two independent pointers) — verify with pointerId tracking, not mouse events.
- ControlLayout dock: on phones, dock items get labels under icons, sit above --safe-b, and the
  Connect/Fullscreen FABs must not overlap the dock.

=== ACADEMY / HOME / PROJECTS / SETTINGS ===
- Academy.module.css is 998 lines with 2 breakpoints. Convert the lesson grids to
  `grid-template-columns: repeat(auto-fill, minmax(clamp(150px, 42vw, 260px), 1fr))` so they reflow
  without new breakpoints, and make the detail view's `width:100vw; height:100vh` use dvh + safe area.
- Settings (318 lines, 433 CSS): forms must be single-column below 768px, inputs min-height 44px,
  numeric fields use `inputmode="numeric"`, and the sticky save bar respects --safe-b.
- Projects: cards to a single column on phones, with the primary action (Buka) as a full-width button
  rather than a small icon.
- Home/index: the hero and CTA must fit 360x800 with no horizontal scroll at 200% zoom.

=== HONEST CAPABILITY HANDLING (do not skip — this is a mobile-only failure) ===
Reality: Web Serial is desktop Chromium only. Web Bluetooth exists on Chrome Android but NOT on any
iOS browser (all of them are WebKit). Today the app only finds out when the user taps Connect and
gets an error.
- Extend src/transport/index.ts with `getCapabilities()` returning
  { serial: boolean, ble: boolean, platform: 'ios'|'android'|'desktop', secureContext: boolean }.
- On app start, if neither transport is available, switch the UI into "Mode Belajar": Block Coding +
  Simulator + Academy fully usable, Connect replaced by an explain-card ("HP ini belum bisa
  menyambung ke robot. Kamu tetap bisa membuat program dan mencobanya di simulator, lalu buka di
  laptop untuk dijalankan di robot."). Never a dead button, never a raw exception.
- If `!window.isSecureContext` (served over plain http), say so explicitly — this is the #1 cause of
  "Bluetooth-nya hilang" reports when self-hosting.
- Upgrade UnsupportedBrowserModal to render this matrix instead of a generic message.

=== PWA / OFFLINE (classroom wifi is unreliable) ===
- Add a web app manifest (name, short_name, theme #4F46E5, background, display: standalone,
  orientation: any, maskable icons 192/512) and apple-touch-icon + apple-mobile-web-app-* meta.
- Service worker (workbox or hand-rolled): precache the app shell, cache-first for fonts and brand
  assets, network-first for JSON. The 3D sim assets must be explicitly EXCLUDED from precache.
- Offline fallback page, and an "Anda sedang offline" toast rather than silent failures.

=== VERIFICATION (required in the deliverable) ===
- A screenshot matrix: every screen x every viewport in the target matrix, before and after.
- Real-device pass on at least one Android phone (Chrome) and one iPhone (Safari); list what works,
  what degrades, and what is impossible.
- Lighthouse mobile: Performance >= 80, Accessibility >= 95 on /, /control, /academy. Report the
  numbers, do not just claim them.
- Zero horizontal scrollbars at every listed viewport (automate: a Playwright check asserting
  document.scrollWidth <= innerWidth on every route).
- Axe-core clean on tap target size, contrast, and label rules.
```

---

# PROMPT R3 — Siap deploy & host sendiri

```
ROLE
Prepare the Robotku web app for deployment on our own server. It is a Next.js Pages Router app with
`output: 'export'` (next.config.mjs), so the build produces plain static files in out/ — no Node
process. Make that deployment correct, secure, and reproducible.

=== HARD REQUIREMENT: HTTPS ===
Web Bluetooth and getUserMedia (the AI camera work) only run in a secure context. Serving the app on
http://<lan-ip> silently disables them with no error the user can understand.
- Document and script two paths:
  a) Public domain: nginx/Caddy + Let's Encrypt (Caddy does it in 3 lines — prefer it).
  b) LAN-only workshop: a local CA (mkcert) with the cert installed on the class devices, or a real
     cert on a private domain with DNS-01. Explain the trade-offs honestly; a self-signed cert that
     users must click through does NOT grant a secure context reliably on Android.
- Add a runtime check: if `!window.isSecureContext`, show a persistent banner explaining which
  features are disabled and why.

=== SERVER CONFIG (deliver both nginx and Caddy) ===
- Static export routing: `trailingSlash` behaviour, `try_files $uri $uri/ $uri.html /404.html`,
  correct handling of /control/modes/code -> code.html.
- Caching: hashed /_next/static/* -> `immutable, max-age=31536000`; HTML -> `no-cache`;
  /sim3d/* and other big media -> long max-age with a versioned path.
- Compression: brotli + gzip for js/css/svg/json; do NOT re-compress jpg/webp/glb/hdr.
- Security headers: HSTS, X-Content-Type-Options, Referrer-Policy: strict-origin-when-cross-origin,
  Permissions-Policy explicitly ALLOWING camera=(self) and bluetooth=(self) (a restrictive default
  here will silently kill the AI panel), and a CSP. The CSP must account for Blockly's needs and for
  the `new Function(...)` sandbox in ProgramRunner/simulator_sequencer — that requires
  'unsafe-eval' in script-src, so either accept it with a written justification or replace the
  sandbox with a real expression interpreter. State the decision, do not leave it implicit.
- HTTP/2 or HTTP/3, and a sensible client_max_body_size if the share-code API is ever added.

=== BUILD & RELEASE ===
- Dockerfile (multi-stage: node:22-alpine build -> caddy/nginx-alpine serve) + docker-compose with
  the cert volume. Image target under 80 MB after the asset diet.
- `.env.example` and a documented list of build-time config (community URL, ESP32-Cam default URL,
  optional share-API base). With static export, env vars are baked at build time — say so loudly so
  nobody expects runtime config.
- Version stamp: inject the git SHA + build date, show it in Settings, and log it once on boot. When
  a class reports a bug you need to know which build they are on.
- Reproducible build: pin the Node version (.nvmrc + engines), commit the lockfile, and make CI build
  the Docker image on tags.

=== PRE-FLIGHT CHECKLIST (run and report actual results, not intentions) ===
 1. `npm run check` clean (typecheck + lint + build).
 2. out/ total size, and the transferred bytes for a cold load of / and /control/modes/code.
 3. Every route reachable, no 404 from an in-app link (crawl out/ and resolve every href).
 4. Lighthouse mobile + desktop on the deployed URL.
 5. Real device test over the deployed HTTPS URL: Android Chrome BLE connect to an actual board,
    desktop Chrome Web Serial connect, iPhone Safari -> "Mode Belajar" path works.
 6. Reload/back/forward and deep-link into every route (static export is where client-only routing
    assumptions break).
 7. Verify no source maps or docs/ content are served in production.
 8. A rollback plan: previous image tag + how to switch back in one command.
```

---

## Catatan

- **Urutan**: R1 → R2 → R3. R2 bergantung pada R1 langkah 2 — selama warna kategori dan style sidebar masih ditulis inline di `BlockCoding.tsx`, toolbox tidak bisa dibikin responsif tanpa menyakiti diri sendiri.
- **Yang paling menentukan sukses deploy** menurut audit: berat `public/` 26 MB dan keharusan HTTPS. Dua ini bisa dikerjakan paralel dengan R1/R2 karena tidak menyentuh kode aplikasi.
- **Satu keputusan yang perlu kamu ambil sebelum R1 jalan**: simulator 3D masih dipakai atau tidak. Kalau tidak, menghapusnya membuang three.js dari bundle **dan** ~19 MB aset sekaligus — itu perbaikan terbesar yang bisa didapat dari satu keputusan. Prompt R1 sudah minta model mengusulkan ini, tapi keputusannya tetap di kamu.
- **CSP vs `new Function`**: `ProgramRunner` mengevaluasi kondisi dengan `new Function`, jadi CSP produksi butuh `'unsafe-eval'`. Ini wajar untuk editor blok (Blockly sendiri begitu), tapi sebaiknya jadi keputusan tertulis, bukan kejutan waktu audit keamanan.
