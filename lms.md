markdown

# Robotku — Prompt Pack v3
### Refactor brutal · Dead code · Memori · Responsif · ESP32 lintas-device · Deploy ke `hub.robotku.id`

Disusun dari audit `robotku-main__5_.zip`. Enam prompt, dijalankan berurutan **R1 → R6**.

> **Sebelum apa pun: ganti kredensial FTP itu.** Host/user/password `hub.robotku.id` sudah tersebar di chat WhatsApp dan sekarang ada di riwayat percakapan ini. Rotasi di hPanel, lalu simpan yang baru sebagai **GitHub Actions Secret** (`FTP_HOST`, `FTP_USER`, `FTP_PASS`) — jangan pernah masuk ke repo, `.env` yang ter-commit, atau `README`. Prompt R6 sudah mengasumsikan ini.

---

## AUDIT v5 — bukti, bukan opini

**Sudah beres (bagus):** runtime 2D tersambung, `_args.ts` + ekspresi run-time, Variables/Functions, `domain/ports.ts`, `FanOutSink`, 18 file test + `coverage.test.ts`, Templates gallery, AI/CV + engine lazy, `ErrorBoundary`, `capabilities.ts`, `theme/breakpoints.css`, `404/500`.

**Masih bermasalah:**

| # | Temuan | Bukti |
|---|---|---|
| 1 | **three.js masuk chunk utama halaman Block Coding** walau 3D cuma beta opt-in | `BlockCoding.tsx:12-13` `import { Simulator } from '../../simulator'` (static). `three` ≈ 600 KB min |
| 2 | **`public/` 26 MB**, hampir semua aset 3D | `Cyberpunk.hdr` 5.8 MB, `Asteria-DashMinimal.glb` 2.1 MB, 4 tekstur 2k = 9.7 MB, `public/icons` 1.8 MB, `public/brand` 3.7 MB |
| 3 | **Artefak build & dokumen ikut ter-commit** | `tsconfig.tsbuildinfo` 530 KB, `Robotku Design System.html` 1.6 MB, 7 file `.md` prompt di root **dan** duplikatnya di `docs/` |
| 4 | **`onTelemetry` cuma menyimpan SATU callback** — subscriber kedua menimpa yang pertama | `app/connection.ts:22` `let telemetryCb = null`, `:26` `telemetryCb = cb`. Serial Monitor + `telemetryCache` saling rebut |
| 5 | **`BlockCoding.tsx` 521 baris**, 11 handler + 13 komponen ikon + peta label perintah dalam satu file | `commandLabel()` peta 30 entri, `SidebarIcon..AiIcon` di bawah komponen |
| 6 | **8 file CSS tanpa satu pun `@media`** | `Settings.module.css` (433), `AcademyDetail.module.css` (619), `AppShell.module.css`, `CvPanel.module.css`, `ConnectPanel`, `Projects`, `ControlHome`, `globals` |
| 7 | **Sidebar app lebar mati 320px** | `AppShell.module.css:13` — di layar 360px, konten tersisa 40px |
| 8 | **Transport cuma BLE + Serial** | `transport/index.ts` — iOS Safari tidak punya keduanya; `capabilities.ts` mendeteksi tapi tidak ada jalan keluar |
| 9 | Dependensi ML terdaftar penuh di `dependencies` | `@tensorflow/tfjs`, `coco-ssd`, `@teachablemachine/image`, `@mediapipe/tasks-vision` — sudah lazy-import, tapi tetap ikut `npm ci` & butuh audit tree-shaking |
| 10 | Bahasa UI campur | tombol `Run / Save / Share / Download / Monitor` (EN) vs tooltip & toast Bahasa Indonesia |

---

# PROMPT R1 — Dead code purge + diet bundle & aset

```
ROLE
Repo: robotku (Next.js 15 Pages Router, output:'export', TypeScript strict). Target hosting is a
static shared host reached over FTP, so every kilobyte is upload time and first-paint time.
Job: remove everything unused and get the shipped payload as small as honestly possible. Measure
before and after — no claim without a number.

STEP 0 — MEASURE FIRST (put the numbers in docs/PERF-BASELINE.md)
  npm run build           -> record First Load JS per route from the Next build table
  du -sh public out       -> record asset + export size
  npx source-map-explorer '.next/static/chunks/*.js'  (add as a devDependency)
Record: /control/modes/code First Load JS, total out/ size, and the 5 biggest chunks.

STEP 1 — AUTOMATED DEAD CODE SWEEP
  Add devDeps: knip, depcheck, eslint + @typescript-eslint + eslint-plugin-unused-imports.
  Add scripts: "lint", "lint:fix", "deadcode": "knip".
  Configure knip for a Next Pages Router project; entry points = src/pages/**, vitest configs.
  Fix EVERY finding rather than ignoring it. Expected classes of finding:
   - unused exports (e.g. helper functions kept "just in case")
   - unused files (check src/categories/operators.ts vs logic.ts/math.ts overlap, and whether
     mechanismsCategory / operatorsCategory are actually reachable from src/toolbox.ts — if a
     category is registered but not in the toolbox, either add it to the toolbox or delete it;
     do not leave blocks that exist but no child can reach)
   - unused deps in package.json
  Rule: delete, do not comment out. Git is the archive.

STEP 2 — THREE.JS OFF THE CRITICAL PATH (the single biggest win)
  BlockCoding.tsx currently does `import { Simulator } from '../../simulator'` and
  `import { SimulatorSequencer } from '../../simulator_sequencer'` at module scope, so three.js
  ships to every child who opens Block Coding even though 3D is an opt-in beta that defaults OFF.
  - Convert to `const { Simulator } = await import('../../simulator')` inside the `use3D` effect.
  - Same for SimulatorSequencer.
  - Type-only imports stay static via `import type`.
  - Verify with source-map-explorer that `three` no longer appears in the code page's initial chunk.
  - While the 3D module is loading, show a small "Menyiapkan 3D…" state in the sim card.

STEP 3 — ASSET DIET (public/ is 26 MB)
  - Move every 3D-only asset (Cyberpunk.hdr 5.8 MB, Asteria-DashMinimal.glb 2.1 MB, the four *_2k
    textures ≈ 9.7 MB) into public/sim3d/ and load them ONLY from the 3D path. Then decide with a
    number in hand: if the 3D beta is not being demoed at launch, exclude the whole folder from the
    FTP upload (R6 handles that) and have the 3D toggle show "Aset 3D belum diunggah".
  - Compress what stays: PNG -> WebP for public/brand (3.7 MB) and public/icons (1.8 MB) with a
    PNG fallback only where a browser needs it; target < 800 KB for both folders combined. Keep the
    favicon a PNG.
  - HDR: if 3D stays, downscale to 1k and convert the 2k textures to 1k WebP/KTX2. A classroom
    laptop does not need 2k PBR.
  - Audit public/sounds (132 KB, fine) and public/levels*.json (three files — check all three are
    actually fetched; delete the orphan).

STEP 4 — REPO HYGIENE
  - Delete tsconfig.tsbuildinfo from git and add it to .gitignore (it is a build artifact, 530 KB).
  - `Robotku Design System.html` (1.6 MB) and the seven root .md prompt files are duplicated in
    docs/. Keep ONE copy under docs/, delete the root copies, and make sure nothing in src/ imports
    them. Add a docs/README.md index.
  - .gitignore: add out/, coverage/, *.tsbuildinfo, .env*.
  - package.json "name" is "robotku-playground" — align it with the product name and set
    "private": true (already), plus "engines": { "node": ">=20" }.

STEP 5 — DEPENDENCY REVIEW
  - The four ML packages are correctly lazy-imported (ai/engines/*). Confirm with the build that
    none of them appear in any static chunk. If @tensorflow/tfjs does leak in, switch to
    @tensorflow/tfjs-core + the specific backend (webgl) instead of the meta-package.
  - @blockly/field-colour and @blockly/field-colour-hsv-sliders: confirm any block actually uses a
    colour field; if not, remove both.
  - Pin exact versions for the ML packages (they move fast and a silent minor can break inference).

ACCEPTANCE (all numbers go in docs/PERF-BASELINE.md, before -> after)
 1. /control/modes/code First Load JS drops by at least 400 KB (three.js removed).
 2. `npx knip` reports zero unused files, exports and dependencies.
 3. `npm run lint` clean with unused-imports as an error, not a warning.
 4. out/ total shrinks to under 6 MB with sim3d/ excluded (state the number if it differs).
 5. `npm run build && npm test && npm run typecheck` all green.
 6. Opening Block Coding with 3D OFF loads zero WebGL code (verify in the Network tab).
```

---

# PROMPT R2 — Anti-spaghetti refactor

```
ROLE
Refactor for readability and boundaries. No behaviour change; the vitest suite is the contract and
must stay green at every step. Work file by file, smallest diff that achieves the structure.

TARGET 1 — BlockCoding.tsx (521 lines, 11 handlers, 13 inline icon components, a 30-entry label map)
Split into a container that owns state and presenters that own markup:
  src/components/blockcoding/BlockCoding.tsx        <- container only, target < 150 lines
  src/components/blockcoding/EditorToolbar.tsx      <- the 10 action buttons + icons
  src/components/blockcoding/SimulatorCard.tsx      <- sim card shell, 2D/3D switch, error state
  src/components/blockcoding/SerialMonitor.tsx      <- monitor panel
  src/components/blockcoding/icons.tsx              <- every inline SVG, one export each
  src/blockcoding/commandLabels.ts                  <- the opcode -> Indonesian label map
Extract the logic into hooks, each with ONE responsibility:
  src/components/blockcoding/hooks/useProgramRuntime.ts
     owns: simSink, runner lifecycle, pickSink, run/stop/pause/step/reset/speed, running & paused
     state, scope, the AI host-execution notice. Returns a typed object.
  src/components/blockcoding/hooks/useEditorActions.ts
     owns: save / share / download / save-as-template / use-template / try-template.
  src/components/blockcoding/hooks/useSim3D.ts
     owns: the lazy three.js lifecycle from R1 and simError.
The container then reads like a table of contents: three hooks, five JSX children.

TARGET 2 — LAYERING RULES (enforce, don't just document)
  Add eslint-plugin-boundaries (or import/no-restricted-paths) with these layers:
    domain/  transport/  runtime/  ai/  templates/   <- no React, no imports from components/ or pages/
    app/                                             <- may use domain + transport, no React
    components/                                      <- may use everything except pages/
    pages/                                           <- may use components + app
  Any violation is a lint error. This is what stops the spaghetti from growing back.

TARGET 3 — SINGLE SOURCE OF TRUTH
  - Category colours already live in src/visual/categoryColors.ts. Grep for hardcoded hex that
    duplicates them (RobotkuCategory.ts, BlockCoding.module.css `#EC2D8F !important`,
    SimStage/CvPanel) and replace with CSS custom properties generated from that one file.
  - Opcode strings ('MOVE_TIMED', 'GET_AI_DATA', …) are typed as loose strings in several places.
    Define `export const OPCODES = {...} as const; export type Opcode = typeof OPCODES[keyof ...]`
    in src/domain/protocol.ts and use it in ProgramRunner, SimSink, TransportSink, commandLabels.
    A typo becomes a compile error.
  - `any` audit: `commands: any[]`, `cmd: {command: string; params: any}`, `scope: Record<string,
    unknown>`. Introduce `RobotCommand` and `CommandParams` types and remove every `any` in
    src/runtime and src/blockcoding. Where a value is genuinely dynamic, use `unknown` + a narrow.

TARGET 4 — FIX THE REAL BUGS FOUND WHILE REFACTORING (each needs a regression test)
  a) src/app/connection.ts:22 keeps ONE telemetry callback (`telemetryCb = cb`), so a second
     subscriber silently replaces the first, and `onTelemetry(() => {})` is used as a fake
     unsubscribe in useBlocklyWorkspace.ts:115. Convert to a Set with a real unsubscribe:
       export function onTelemetry(cb): () => void
     and update every caller. Test: two subscribers both receive a frame; unsubscribing one leaves
     the other working.
  b) window.confirm / window.prompt are used for template insert, project name and template name.
     Replace with the app's own modal + toast (accessible, styled, works on mobile where prompt() is
     ugly and on some in-app browsers is blocked entirely).
  c) `handleTryTemplate` uses `setTimeout(() => handleRun(), 80)` — a race with Blockly's async
     render. Replace with an effect keyed on a `pendingRun` flag set after insertTemplate resolves.
  d) UI language is mixed (buttons EN, tooltips/toasts ID). Pick Bahasa Indonesia for all
     user-facing strings, move them to src/i18n/strings.ts as a flat typed record, and reference
     them everywhere. This is also the seam for an English build later.

TARGET 5 — READABILITY OF THE CODE ITSELF
  - Add prettier + a shared config, and format the whole repo in ONE commit that touches nothing
    else (so future diffs stay reviewable).
  - Every file over 300 lines gets a header comment stating its single responsibility. Files still
    over 400 lines after the split (SimSink 659, ProgramRunner 501, SimStage 479) must be examined:
    SimStage should split into SimStage/ArenaSection, PortSection, OutputSection, SensorRack,
    VariablesWatch; SimSink should split its opcode handlers into a `handlers/` map keyed by opcode
    instead of one giant switch.
  - Delete commented-out code and "TODO" comments that no longer apply.

ACCEPTANCE
 1. `npm test` green before and after every extracted module (run it between steps, not just at the end).
 2. BlockCoding.tsx under 150 lines; no file in src/components over 400 lines.
 3. `npm run lint` passes including the boundary rules; deliberately adding
    `import ... from '../../components/...'` inside src/runtime fails the lint.
 4. Zero `any` in src/runtime, src/blockcoding, src/domain (grep proves it).
 5. Two telemetry subscribers coexist (new test).
 6. No window.confirm / window.prompt / window.alert anywhere in src (grep proves it).
```

---

# PROMPT R3 — Memori seringan mungkin

```
ROLE
Make the app survive a two-hour classroom session on a 4 GB Chromebook with 30 tabs of nothing else.
Everything here needs a measured before/after in docs/PERF-BASELINE.md — heap snapshots, not vibes.

MEASUREMENT PROTOCOL (write it down so it is repeatable)
 - Chrome DevTools > Memory > Heap snapshot at: (1) app load, (2) editor open, (3) after running a
   forever program for 60 s and stopping, (4) after 20 open/close cycles of every panel,
   (5) after 10 minutes idle with the camera on then off.
 - Snapshot 4 must be within ~10% of snapshot 2. Any monotonic growth is a leak; find it with
   "Comparison" view and the Detached DOM filter.
 - Also record `performance.memory.usedJSHeapSize` in a dev-only overlay behind ?perf=1.

LEAK AUDIT — check each of these explicitly and state the verdict
 1. Blockly: workspace.dispose() on unmount; ALSO dispose the injected toolbox + flyout, remove the
    change listeners added in useBlocklyWorkspace, and clear the `--flyout-bg-color` custom property.
    Blockly leaks hard if the injection div is reused — assert `document.querySelectorAll('.blocklyWidgetDiv')`
    stays at one after 20 mount/unmount cycles.
 2. Telemetry: after R2's Set-based onTelemetry, verify unsubscribers actually run. The monitor's
    array is sliced to 200 — keep that, and cap each line's length (a runaway firmware line can be
    megabytes; truncate at 500 chars with an ellipsis).
 3. SimSink: `trail` capped at 200 points — verify the cap is enforced on every push path, and that
    `reset()` empties it. `commit()` spreads a new state object at up to 40 fps; make sure the old
    objects are not retained by any closure (the external-store snapshot must be the only reference).
 4. ProgramRunner: the compiled-expression Map must be cleared on stop(), otherwise every edited
    program leaks another Function. The `wakers` Set must be empty after stop() — assert it.
 5. Timers/rAF: grep every setTimeout/setInterval/requestAnimationFrame in src and confirm each has
    a matching clear in the same scope. Any orphan is a bug.
 6. cvStore: this is the heaviest one.
    - tfjs tensors must be disposed: wrap inference in tf.tidy() and dispose any tensor that escapes;
      log tf.memory().numTensors in the perf overlay and assert it is flat across 1000 frames.
    - The engine must be dispose()d when the model changes, not just replaced.
    - MediaStream tracks stopped on panel close AND on unmount (already done in BlockCoding — verify
      it also happens when the model switches to ESP32-Cam and back).
    - The offscreen canvas for the ESP32-Cam path must be reused, not recreated per frame.
    - Inference paused on document.hidden (verify with a tab switch, not by reading the code).
 7. AudioContext: SimSink creates one lazily. Create at most one per app (module singleton), close
    it on unmount, and never create one before the first user gesture.
 8. Images: the template gallery renders inline SVG thumbnails — confirm they are not re-parsed on
    every render (memoise), and that the gallery unmounts its content when closed rather than
    rendering hidden.

RENDER COST (memory's twin)
 - SimStage subscribes via useSyncExternalStore. Verify the snapshot function is stable and does not
   allocate; a new object per call causes an infinite re-render loop in React 19 or, at best,
   a render per frame. Split into per-section subscriptions so a port change does not re-render the
   arena.
 - React.memo the leaf widgets (matrix dots, port bars) and key them cheaply.
 - Profile a forever program for 30 s: target < 8 ms scripting per frame on a mid Chromebook.

BUDGETS (add to docs/PERF-BASELINE.md and treat as a gate)
 - Heap after editor open: < 120 MB. After 60 s forever + stop: < 130 MB.
 - tf.memory().numTensors: flat.
 - Detached DOM nodes after 20 panel cycles: 0.

ACCEPTANCE
 1. Snapshot 4 within 10% of snapshot 2, with the numbers pasted into the doc.
 2. A deliberately introduced leak (comment out one dispose) is caught by a new vitest test that
    counts listeners/timers after mount+unmount — so this does not regress silently.
 3. Camera on 10 min then off: heap returns to within 15 MB of pre-camera, numTensors back to base.
```

---

# PROMPT R4 — Responsif & readability brutal

```
ROLE
Make every screen usable and readable from a 360x640 phone up to a 2560px classroom display, on
touch and mouse, in portrait and landscape. Block Coding already has breakpoints; the rest of the app
does not. Fix the whole app, not just the editor.

DEVICE MATRIX (test every screen on each — list results in docs/RESPONSIVE-QA.md)
  360x640  phone portrait      | 390x844 iPhone | 412x915 Android
  640x360  phone landscape     (the worst case: the editor toolbar must not eat the canvas)
  768x1024 tablet portrait     | 1024x768 tablet landscape (the actual classroom device)
  1280x800 laptop              | 1920x1080 | 2560x1440 projector
  Plus: 200% browser zoom at 1280x800 (accessibility requirement, behaves like 640px wide)

FILES WITH ZERO MEDIA QUERIES — every one needs a mobile-first pass
  styles/Settings.module.css (433 lines), styles/AcademyDetail.module.css (619),
  styles/Projects.module.css, styles/ControlHome.module.css,
  components/layout/AppShell.module.css, components/blockcoding/CvPanel.module.css,
  components/control/ConnectPanel.module.css, components/control/ConnectionBadge.module.css

SPECIFIC FIXES
 1. AppShell.module.css:13 — sidebar is a hard `width: 320px`. On a 360px phone that leaves 40px.
    Make it: >=1280px persistent 280px rail; 768-1279px collapsed 72px icon rail with tooltips;
    <768px an off-canvas drawer opened by a header hamburger, closed on route change and on Esc,
    with a focus trap and a backdrop. The drawer must not be in the tab order when closed.
 2. Use the breakpoint tokens consistently. CSS custom properties cannot be used inside @media, so
    define the four breakpoints ONCE as documented constants in theme/breakpoints.css comments and
    use the literal px values everywhere — no ad-hoc 860px / 959px / 520px values (those exist today
    in Academy, ModeControls, ControlLayout). Pick 480 / 768 / 1024 / 1280 and normalise every file.
 3. Fluid type + spacing: replace fixed font sizes with a clamp() scale in tokens.css
    (--fs-xs .. --fs-3xl) and use it. Minimum body text 14px; the current 11-12.5px in the serial
    monitor, sim card header, CvPanel labels and Blockly flyout labels is below what a child can
    read comfortably — floor everything at 13px, body at 15-16px on phones.
 4. Touch targets: every interactive element >= 44x44 CSS px on coarse pointers
    (`@media (pointer: coarse)`). The editor toolbar shrinks to 38-40px on phones today — that is
    below the threshold; keep 44 and reduce the button COUNT instead (see 5).
 5. Editor toolbar has 10 buttons. On phones, show 4 primary (Sidebar, Run, Stop, Simulator) and
    move the rest into an overflow "…" sheet. A horizontal scroll strip of 10 circles is not usable
    with a thumb.
 6. Blockly on touch: set `zoom.startScale` from viewport width (0.5 phone / 0.6 tablet / 0.75
    desktop) instead of a fixed 0.6; enable pinch zoom; set `touch-action: none` on the injection
    div only (not the page) and `overscroll-behavior: contain` on scrollable panels so dragging a
    block does not pull-to-refresh the page.
 7. Panels (sim card, monitor, CvPanel, template gallery) are absolutely positioned cards. Below
    768px they must become bottom sheets: full width, drag handle, max-height 70dvh, stacked one at
    a time (opening one closes the others), never overlapping the toolbar.
 8. Safe areas: BlockCoding.module.css already uses --safe-*; define those vars once in globals.css
    from env(safe-area-inset-*) and apply them to EVERY fixed/absolute element app-wide (toasts at
    bottom 86px, the control dock, ConnectPanel, modals). Test on an iPhone with a home indicator.
 9. Height: replace every bare 100vh with `100dvh` (with a 100vh fallback line first) — some files
    already do, others do not. Mobile Safari's toolbar makes 100vh wrong by ~60px.
 10. Landscape phone (640x360): the sim card + monitor + toolbar cannot all be visible. Define an
     explicit priority: canvas always visible; at most one panel open; the toolbar collapses to a
     single FAB that expands.

READABILITY / A11Y (this is not optional polish for a kids' product)
 - Contrast: audit every text/background pair against WCAG AA (4.5:1 body, 3:1 large). Known
   suspects: --rk-on-muted on glass surfaces, the monitor's #b9f5cf on dark, category labels in
   their own colour on a tinted flyout. Fix by darkening the token, not by adding a shadow.
 - Focus: `:focus-visible` ring exists in globals.css — verify it is visible on every control
   including Blockly's own buttons and the bottom sheets. Tab through each page end to end.
 - Every icon-only button gets an aria-label in Bahasa Indonesia (the editor toolbar's <span>
   labels are visually hidden on phones — make sure the accessible name survives).
 - Modals/sheets: role="dialog" aria-modal, focus trap, Esc, restore focus to the opener.
 - prefers-reduced-motion: extend beyond RobotSprite to the gallery thumbnails, sheet transitions,
   and the running-block glow.
 - Language: after R2's i18n extraction, verify no English leaks into user-facing text.

TOOLING
 - Add a Playwright (or Cypress) visual smoke test that loads each route at 3 viewports
   (360x640, 768x1024, 1280x800) and asserts: no horizontal scrollbar on <body>, no element
   overflowing the viewport width, and the primary action is visible without scrolling.
 - Add `@media (prefers-contrast: more)` and a dark-mode check only if the DS defines one; if not,
   explicitly document that dark mode is out of scope rather than half-implementing it.

ACCEPTANCE
 1. docs/RESPONSIVE-QA.md filled in: every route x every viewport, pass/fail with a screenshot.
 2. Zero horizontal scroll at 360px on every route (automated).
 3. 200% zoom at 1280px is fully usable (manual, documented).
 4. All touch targets >= 44px on coarse pointers (automated spot check).
 5. Full keyboard traversal of every page with a visible focus ring, no trap outside modals.
 6. No text below 13px anywhere in the shipped CSS (grep the built CSS).
```

---

# PROMPT R5 — ESP32 nyambung dari device apa pun

```
ROLE
Today src/transport/index.ts offers exactly two kinds: 'ble' and 'serial'. Both are Chromium-only.
src/transport/capabilities.ts already detects the gap but the app has no answer for a user whose
browser cannot do either. The product promise is "buka hub.robotku.id dari device apa pun, lalu
sambung ke ESP32". Close that gap honestly — with real fallbacks and an interface that never lies
about what this device can do.

THE ACTUAL CONSTRAINT MATRIX (state it in docs/CONNECTIVITY.md, it drives everything else)
  Web Serial (USB)  : Chrome/Edge/Opera desktop only. Not Android, not iOS, not Firefox, not Safari.
  Web Bluetooth     : Chrome/Edge desktop + Chrome Android. NOT iOS Safari, NOT Firefox, NOT Safari
                      macOS. iOS users can only do BLE through a third-party browser (Bluefy, WebBLE).
  Both require a secure context (https:// or localhost) AND a user gesture.
  LAN WebSocket to the ESP32's own IP: works on every browser BUT the page is served over https and
  ws://192.168.x.x is mixed content -> blocked by every modern browser. `wss://` to a bare LAN IP
  cannot get a valid certificate. THIS IS THE KEY BLOCKER, and no amount of code on our side fixes
  it from an https page.

DESIGN — four transport kinds behind the existing RobotTransport interface
 1. 'serial'  — unchanged.
 2. 'ble'     — unchanged, but see the reliability work below.
 3. 'lan'     — direct WebSocket to the ESP32 SoftAP/station (ws://<ip>:81). Only offered when the
    page itself is on http (i.e. the firmware-hosted local UI, or localhost dev). On https, the UI
    must not offer it and must explain why in one sentence rather than failing silently.
 4. 'cloud'   — MQTT over WSS (or a WSS relay) so ANY device including iOS Safari can drive a robot
    that is on WiFi. This is the only option that satisfies "any device" from an https page.
    Implement it against a pluggable broker config (env: NEXT_PUBLIC_MQTT_WSS_URL) with a public
    managed broker for launch; topics `robotku/<pairCode>/cmd` and `robotku/<pairCode>/telemetry`.
    The client publishes the same line-delimited JSON the serial/BLE transports send, so
    TransportSink and the firmware protocol are untouched.
    Pairing: the robot prints/serves a 6-character pair code; the web app asks for it (or scans a
    QR from the robot's LCD / a sticker). No accounts.
    Security: a pair code is a capability — rotate it on every boot, scope the topics to it, and
    document plainly that anyone with the code can drive that robot. Add a "Putuskan semua" button.

FIRMWARE SIDE (firmware/robotku-esp32/robotku-esp32.ino) — spec it, and implement if in scope
 - WiFi provisioning: SoftAP `Robotku-XXXX` + a captive portal that serves a minimal local UI over
   http://192.168.4.1 (this is where 'lan' mode lives, and it is the offline-classroom answer).
 - After provisioning, connect to the school WiFi and subscribe to the MQTT topics for 'cloud' mode.
 - mDNS `robotku-XXXX.local` for the LAN case.
 - The command parser must stay identical across all four transports — one protocol, four pipes.

UI — src/components/control/ConnectPanel.tsx (currently 150 lines, one flow)
 - On open, run getCapabilities() and render a RANKED list of what THIS device can actually do,
   with a one-line reason for anything unavailable. Never show a disabled button with no explanation.
   Examples of the copy (Bahasa Indonesia, kid/teacher friendly):
     iOS Safari  -> "iPhone/iPad tidak bisa Bluetooth langsung dari Safari. Pakai mode WiFi
                     (kode robot), atau buka lewat aplikasi Bluefy."
     Firefox     -> "Firefox belum mendukung Web Bluetooth. Pakai Chrome/Edge, atau mode WiFi."
     http page   -> "Halaman ini belum HTTPS, jadi Bluetooth dimatikan browser. Buka https://hub.robotku.id."
 - A "Cek perangkat saya" diagnostic screen listing: secure context, Web Serial, Web Bluetooth,
   camera, WebGL, and the resolved best transport — copyable as text for support.
 - QR pairing: the app can open its camera (cvStore already has the plumbing) to read the pair code.
 - Remember the last successful transport + device per browser (localforage) and offer one-tap
   reconnect.

RELIABILITY (applies to all transports, this is what breaks in a real classroom)
 - Heartbeat + watchdog: if no telemetry for 2 s, mark degraded; at 5 s, treat as lost, e-stop the
   robot and surface a reconnect affordance. BaseTransport already has some of this — verify and
   unify so all four kinds behave identically.
 - Auto-reconnect with exponential backoff, capped, cancellable, and never firing while a program
   is mid-run without telling the user.
 - Command coalescing: joystick/drive sends must be rate-limited (BLE NUS realistically handles
   ~20 Hz of 20-byte writes; MQTT over a school WiFi, less). Drop stale frames rather than queueing
   them — a 3-second-old steering command is worse than none.
 - MTU/chunking: verify BLE writes are chunked to the negotiated MTU and reassembled; add a test.
 - Multiple tabs: if a second tab connects to the same robot, the first must be told (BroadcastChannel)
   rather than silently fighting over the link.

TESTS
 - A FakeTransport in src/test implementing RobotTransport, driving the full connect -> run ->
   telemetry -> disconnect lifecycle, asserting the e-stop path on timeout.
 - Capability matrix unit tests with mocked navigator/UA for: Chrome desktop, Chrome Android,
   Safari iOS, Firefox, http (insecure) context.

ACCEPTANCE
 1. Chrome desktop: serial and BLE both connect; run a program; telemetry flows.
 2. Chrome Android: BLE connects; the UI does not offer serial and explains why.
 3. Safari iOS: BLE and serial are hidden with a clear explanation; the WiFi/pair-code path connects
    and drives a robot end to end. If the cloud broker is not provisioned yet, the UI says exactly
    what is missing instead of spinning.
 4. Unplug/turn off the robot mid-program: e-stop within 5 s, clear message, one-tap reconnect.
 5. docs/CONNECTIVITY.md explains the mixed-content constraint so the next person does not spend a
    day rediscovering it.
```

---

# PROMPT R6 — Deploy statis ke `hub.robotku.id` (shared hosting, FTP)

```
ROLE
Ship this Next.js app (output: 'export') to a shared host reachable only over FTP, served at
https://hub.robotku.id. There is no Node process, no API routes, no server-side rendering — only
static files behind (most likely) Apache with .htaccess. Make the build, the upload and the runtime
behave correctly under those constraints.

BUILD CONFIG (next.config.mjs)
 - Keep output: 'export' and images.unoptimized.
 - Add `trailingSlash: true`. Without it, /control/modes/code exports as control/modes/code.html and
   Apache will 404 or redirect inconsistently; with it you get control/modes/code/index.html, which
   every static host serves correctly.
 - Set `assetPrefix` only if the app will ever live in a subdirectory. At the domain root, leave it
   unset — a wrong assetPrefix is the classic "blank page after deploy".
 - `productionBrowserSourceMaps: false` (do not ship maps to a public host; keep them in CI
   artifacts for debugging).
 - Add a build-time guard that fails if any `getServerSideProps` or `pages/api` exists, since either
   silently breaks a static export.

APACHE (.htaccess, generated into out/ by a script so it is never forgotten)
 - Force HTTPS (Web Bluetooth, Web Serial and getUserMedia all require a secure context — without
   this the entire product is dead on arrival):
     RewriteEngine On
     RewriteCond %{HTTPS} off
     RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
 - SPA-ish fallback for unknown paths -> /404/index.html (Next already exports 404.html; wire it
   with ErrorDocument).
 - Caching: immutable, 1 year for /_next/static/** (content-hashed); no-cache for *.html and
   /index.html so a redeploy is picked up immediately. Getting this backwards is why users see a
   stale app after an update.
 - Enable mod_deflate/brotli for html, css, js, json, svg.
 - Correct MIME types for .wasm (MediaPipe/tfjs need application/wasm), .glb (model/gltf-binary),
   .hdr, .webp.
 - Security headers: X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin,
   Permissions-Policy allowing camera=(self) and bluetooth=(self) — a restrictive default here will
   silently kill the AI panel, so set it explicitly rather than leaving it to the host.
 - A CSP is desirable but the Blockly/tfjs stack needs 'wasm-unsafe-eval' and the runtime's
   `new Function` needs 'unsafe-eval'. Start in Report-Only, tune, then enforce; document why
   'unsafe-eval' is required (ProgramRunner's condition sandbox) so nobody removes it and breaks
   every sensor block.

DEPLOY PIPELINE
 - scripts/deploy.sh using lftp mirror:
     lftp -c "set ftp:ssl-force true; set ssl:verify-certificate true; \
              open -u $FTP_USER,$FTP_PASS $FTP_HOST; \
              mirror -R --delete --parallel=4 --exclude-glob .git* ./out /public_html"
   Notes: `--delete` is what prevents stale chunks accumulating forever on a shared host; add
   `--only-newer` for faster iterative uploads; ALWAYS require FTPS (ftp:ssl-force), never plain FTP.
 - Excludes: add a flag to skip public/sim3d/** (from R1) so a launch upload is a few MB, not 26.
 - GitHub Actions workflow .github/workflows/deploy.yml: on push to main -> npm ci, typecheck, lint,
   test, build, then deploy with FTP_HOST/FTP_USER/FTP_PASS read from repository Secrets. The
   credentials must never appear in the repo, in logs, or in a shell history.
 - Upload order matters on a live site: push /_next/static first, HTML last, so a user mid-navigation
   never requests a chunk that is not there yet. lftp mirror does not guarantee this — do two passes.
 - Emit a build id (git sha + timestamp) into out/version.json and show it in Settings, so support
   can ask "versi berapa?" and get a real answer.

POST-DEPLOY VERIFICATION (scripted, docs/DEPLOY-CHECKLIST.md)
 1. https://hub.robotku.id loads; http:// redirects to https with 301.
 2. Deep link https://hub.robotku.id/control/modes/code/ loads directly (not just via client nav).
 3. Hard refresh on every route: no 404, no blank page.
 4. DevTools > Application: page is a secure context; navigator.bluetooth and navigator.serial exist
    on Chrome desktop.
 5. The AI panel can request the camera (Permissions-Policy is not blocking it).
 6. Lighthouse on a throttled 4G profile: Performance >= 80, Accessibility >= 95 on the landing and
    the editor route. Record the numbers.
 7. First Load JS for /control/modes/code matches the R1 target.
 8. Redeploy once and confirm the new version.json appears without a manual cache clear.

OPERATIONAL EXTRAS (cheap, worth it)
 - PWA: a minimal manifest + an offline-first service worker for the app shell means a classroom with
   flaky WiFi keeps working after the first visit, and the app becomes installable on tablets. Guard
   the SW with a versioned cache keyed on the build id so a deploy always invalidates. Skip Workbox;
   30 lines of hand-written SW is enough and lighter.
 - robots.txt + a simple og:image so shared links look right in WhatsApp (this is how teachers will
   share it).
 - Uptime check on https://hub.robotku.id/version.json.

ACCEPTANCE
 - The whole pipeline runs from a clean clone: npm ci && npm run build && ./scripts/deploy.sh, with
   no manual step and no credential in the repo.
 - Every item in DEPLOY-CHECKLIST.md is ticked with evidence.
 - A rollback path is documented (keep the previous out/ as a dated zip; restore by re-mirroring).
```

---

## Catatan eksekusi

- **R1 dulu, selalu.** Mengukur baseline sebelum refactor adalah satu-satunya cara membuktikan R2–R4 tidak memperburuk keadaan.
- **R2 dan R3 saling mengunci**: refactor tanpa test memori akan menutupi kebocoran, dan sebaliknya. Jalankan `npm test` di antara setiap ekstraksi modul, bukan hanya di akhir.
- **R5 adalah keputusan produk, bukan cuma teknis.** Poin yang harus kamu putuskan sebelum prompt dijalankan: halaman di `https://hub.robotku.id` **tidak bisa** membuka `ws://192.168.4.1` — diblokir sebagai mixed content oleh semua browser modern, dan sertifikat valid untuk IP LAN tidak mungkin didapat. Jadi untuk iPhone/iPad ada dua jalan, pilih salah satu:
  - **MQTT over WSS** (robot perlu WiFi sekolah + broker; jalan di semua device termasuk Safari), atau
  - **UI lokal di firmware** — ESP32 menyajikan halaman ringkasnya sendiri di `http://192.168.4.1` untuk mode offline kelas, sementara `hub.robotku.id` tetap untuk Chrome/Edge/Android.
  
  Rekomendasi saya: kerjakan keduanya — WSS sebagai jalur utama lintas-device, UI firmware sebagai penyelamat saat WiFi sekolah mati. Tapi ini menambah scope firmware yang belum ada di repo sekarang.
- **Aset 3D 26 MB** adalah keputusan cepat yang bisa kamu ambil hari ini: kalau demo peluncuran tidak memakai simulator 3D, jangan diunggah sama sekali. Upload FTP jadi hitungan detik, bukan belasan menit.
- Sekali lagi soal kredensial FTP itu — rotasi dulu sebelum dipakai di CI.