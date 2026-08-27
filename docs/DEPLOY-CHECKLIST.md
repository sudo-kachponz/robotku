# Deploy checklist — hub.robotku.id (R6)

Static export (`output: 'export'`) mirrored to Apache shared hosting over FTPS.

## One-time setup

- [ ] **Rotate the FTP credentials** in hPanel (they leaked in chat). Store the new
      ones as GitHub Actions **Secrets**: `FTP_HOST`, `FTP_USER`, `FTP_PASS`.
      Never commit them, never put them in `.env` that is tracked, never log them.
- [ ] Confirm the host allows FTPS (`ftp:ssl-force true` in `scripts/deploy.sh`).

## Pipeline (runs from a clean clone, no manual step)

```bash
npm ci
npm run typecheck && npm test && npm run build   # build emits out/.htaccess + out/version.json
FTP_HOST=… FTP_USER=… FTP_PASS=… SKIP_SIM3D=1 npm run deploy
```

CI equivalent: `.github/workflows/deploy.yml` on push to `main`.

## Config that makes static hosting work

- `next.config.mjs`: `output:'export'`, `images.unoptimized`, `trailingSlash:true`
  (→ `control/modes/code/index.html`, not `.html`), `productionBrowserSourceMaps:false`,
  and a build-time guard that fails if `src/pages/api/*` exists.
- `out/.htaccess` (generated): `Options -Indexes`, force HTTPS, `ErrorDocument 404`,
  immutable caching for hashed assets + `no-cache` for HTML/`version.json`,
  deflate/brotli, wasm/glb/hdr/webp MIME, `Permissions-Policy: camera=(self),
  bluetooth=(self), serial=(self)`. **HSTS is opt-in**: emitted only when
  `ENABLE_HSTS=1` at build time — turn it on only after HTTPS is confirmed in prod
  (a wrong HSTS header is unrecoverable until `max-age` expires).
- Fonts are self-hosted via `next/font` (no runtime `fonts.googleapis.com` request).
- `public/brand/*` is WebP (176 KB total); `public/og-image.png` (1200×630) backs
  the social share preview.

## Upload strategy (scripts/deploy.sh)

Two passes, both with `--delete` to prune stale files within their tree:

1. `/_next` hashed chunks — `--only-newer` is safe (content-hashed names) and
   avoids re-uploading megabytes of unchanged JS.
2. Everything else (HTML, `.htaccess`, `version.json`) — **no** `--only-newer`, so
   these tiny files are always re-uploaded fresh (shared-host clock drift makes
   timestamp comparison unreliable and can silently skip a real change).

`SKIP_SIM3D=1` excludes the 26 MB of 3D assets from the launch payload (and from
`--delete` pruning, so a previously-uploaded `sim3d/` is left intact).

## Post-deploy verification (tick with evidence)

- [ ] `https://hub.robotku.id` loads; `http://` → `https://` 301.
- [ ] Deep link `https://hub.robotku.id/control/modes/code/` loads directly (not just via client nav).
- [ ] Hard refresh on every route: no 404, no blank page.
- [ ] DevTools → Application: secure context; `navigator.bluetooth` / `navigator.serial` on Chrome desktop.
- [ ] AI panel can request the camera (Permissions-Policy not blocking).
- [ ] Lighthouse (throttled 4G): Performance ≥ 80, Accessibility ≥ 95 on landing + editor. Record numbers.
- [ ] `/control/modes/code` First Load JS matches PERF-BASELINE.md.
- [ ] Redeploy once

→ new `version.json` appears without a manual cache clear.

CI does the last check automatically: after the mirror it polls
`https://hub.robotku.id/version.json` and fails the job unless `.sha` matches the
deployed commit (a half-finished FTPS mirror otherwise exits 0 while the site is
stale).

## Pre-deploy gate run — 2026-08-27 (evidence)

Recorded from an actual run on the release candidate. Re-run these before any
subsequent deploy; the TLS answer in particular can change.

### D1 — is TLS actually live? (decides the redirect flag)

```
$ curl -sSI https://hub.robotku.id | head -1
HTTP/2 200

$ curl -sSI http://hub.robotku.id | grep -iE '^(HTTP|location)'
HTTP/1.1 301 Moved Permanently
Location: https://hub.robotku.id/
```

**TLS is live** → deploy with `ENABLE_HTTPS_REDIRECT=1`. (The host already 301s
http→https at the server level; the generated `.htaccess` redirect is belt-and-braces
and, more importantly, is what makes the redirect survive a host-config change.)

If this ever comes back `SSL certificate problem` instead, deploy **without** the
flag and ask the hPanel holder to issue the certificate first. Never turn the
redirect on ahead of TLS: the operator has FTP only and cannot undo it from a panel.

### D2 — verification pipeline

```
$ npm ci                                   # clean install, exit 0
$ npm run lint                             # eslint --max-warnings 0, exit 0, no output
$ npm test                                 # 20 files, 118 tests passed (111 baseline + 7 new)
$ npm run typecheck                        # tsc --noEmit, exit 0, no output
$ SKIP_SIM3D=1 npm run build               # exit 0, 17 pages, 18 exported routes
```

First Load JS, against the ≤125 kB budget for the editor route:

| Route | First Load JS | Budget |
| --- | --- | --- |
| `/control/modes/code` | **122 kB** | ≤ 125 kB ✓ |
| `/control/modes` | 126 kB | — (largest route) |
| `/` | 116 kB | — |

Note a pre-existing **+2 kB drift** against `docs/PERF-BASELINE.md` (recorded
2026-08-26): it lists `/control/modes/code` at 120 kB and shared JS at 112 kB;
this build gives 122 kB and 114 kB. The whole delta is in the **shared** chunk, not
in any route, and the baseline table has no `/cek` row — so it predates
`src/pages/cek.tsx`. Still inside the ≤125 kB budget; refresh PERF-BASELINE.md
from a git clone when convenient.

### D3 — preflight really does block a lock-out

`scripts/preflight.mjs` runs at the top of `deploy.sh`. Verified all three branches
by pointing `PREFLIGHT_URL` at hosts with known TLS states:

| Case | `.htaccess` redirect | TLS state | Expected | Actual |
| --- | --- | --- | --- | --- |
| Real host | OFF | ok (HTTP 200) | pass + warn "Web BLE/Serial won't work on http" | exit 0, warning printed ✓ |
| Real host | ON | ok (HTTP 200) | pass | exit 0, "Preflight lolos" ✓ |
| `https://tls-tidak-ada.hub.robotku.id` | ON | unreachable (`ENOTFOUND`) | **FAIL** | exit 1, "PREFLIGHT GAGAL" ✓ |
| `https://expired.badssl.com` | ON | cert-invalid (`CERT_HAS_EXPIRED`) | **FAIL** | exit 1, "PREFLIGHT GAGAL" ✓ |

Commands used:

```bash
SKIP_SIM3D=1 node scripts/preflight.mjs                       # real host
SKIP_SIM3D=1 PREFLIGHT_URL=https://tls-tidak-ada.hub.robotku.id node scripts/preflight.mjs
SKIP_SIM3D=1 PREFLIGHT_URL=https://expired.badssl.com node scripts/preflight.mjs
```

Upload size reported: **~22.5 MB** with `SKIP_SIM3D=1` (sim3d excluded).

### ⚠ D2 caveat — `version.json` sha

`postbuild.mjs` derives `sha` from `git rev-parse --short HEAD`, falling back to
`"unknown"`. The build above ran from an unzipped archive with **no `.git`**, so it
produced:

```json
{ "sha": "unknown", "builtAt": "2026-08-27T11:57:30.542Z" }
```

The D5 check "`/version.json` sha matches the local build" is meaningless with
`unknown`, and CI's post-mirror sha poll would compare against `GITHUB_SHA` and
fail. **Deploy from a real git clone**, or set `GITHUB_SHA` explicitly:

```bash
GITHUB_SHA=$(git rev-parse HEAD) SKIP_SIM3D=1 npm run build
```

### Firmware gate — `pio run` compiles (acceptance 2)

The firmware moved to `src/main.cpp` + `src/config.h` so PlatformIO finds it with
no `src_dir` override. Verified with a real toolchain (PlatformIO Core 6.1.19):

```
$ cd firmware/robotku-esp32 && pio run
PLATFORM: Espressif 32 (6.9.0) > Espressif ESP32 Dev Module
PACKAGES: framework-arduinoespressif32 @ 3.20017.241212, toolchain-xtensa-esp32 @ 8.4.0
Dependency Graph
|-- NimBLE-Arduino @ 1.4.3      |-- ArduinoJson @ 7.4.3
|-- ESP32Servo @ 3.2.1          |-- Adafruit SSD1306 @ 2.5.17
|-- Adafruit GFX Library @ 1.12.6  |-- Adafruit BusIO @ 1.17.4  |-- Wire @ 2.0.0
RAM:   11.2% (36676 / 327680 bytes)
Flash: 50.4% (660601 / 1310720 bytes)
========================= [SUCCESS] =========================
```

Every pinned library resolved to the exact version in `platformio.ini`, and the
build is clean — no errors, no warnings. `firmware.bin` produced.

Port table logic checked separately against a host compiler, both flag states:

| `HAS_SERVO_R` | `PORT_CHANNEL` | `HELLO_ACK ports` | `TURN_TIMED` cap | `SET_PORT` 2 |
| --- | --- | --- | --- | --- |
| `0` (shipped) | `[-1,0,-1,…]` | `[1]` | absent | `UNSUPPORTED` |
| `1` | `[-1,0,1,…]` | `[1,2]` | present | drives right servo |

Still needs a board on a desk (nothing here can substitute):

- [ ] `cw 2000` → servo spins 2 s and stops **by itself**
- [ ] `help` → the command list appears
- [ ] a JSON `MOVE_TIMED` still behaves exactly as before
- [ ] OLED shows the real servo angle, `STOP`/`CW`/`CCW`, and `USB`/`BLE`/`Terputus`
- [ ] `HELLO` over Serial replies `ports:[1]`, and `SET_PORT` port 2 → `UNSUPPORTED`

### D4 — deploy (manual, not CI)

Not yet run — needs the rotated FTP credentials (see One-time setup). First deploy
must be a **full** mirror:

```bash
FTP_HOST=… FTP_USER=… FTP_PASS=… \
  ENABLE_HTTPS_REDIRECT=1 SKIP_SIM3D=1 FORCE_FULL=1 npm run deploy
```

`ENABLE_HTTPS_REDIRECT=1` is correct **because D1 came back HTTP/2 200**. Re-run D1
first if any time has passed.

### D5 — post-deploy verification (fill in after D4)

- [ ] `https://hub.robotku.id/` opens
- [ ] `https://hub.robotku.id/control/modes/code/` opens on a **hard refresh**, not
      just client-side navigation
- [ ] `https://hub.robotku.id/version.json` sha matches the local build
      (see the caveat above — must not be `unknown`)
- [ ] `https://hub.robotku.id/cek/` opens on a phone, and **"Salin Hasil"** yields
      text that pastes into WhatsApp

### D6 — release archive exists before the mirror

- [ ] `releases/out-<sha>-<timestamp>.tar.gz` written by `deploy.sh` **before** it
      uploads anything
- [ ] `bash scripts/rollback.sh` (no args) lists it
- [ ] one restore rehearsal done, and `/version.json` shows the rolled-back sha

## Rollback

`scripts/deploy.sh` saves a snapshot of `out/` as
`releases/out-<sha>-<timestamp>.tar.gz` **before** every mirror. To roll back:

1. **Pick the good archive:**

   ```bash
   bash scripts/rollback.sh           # lists available releases
   ```

2. **Restore and re-mirror:**

   ```bash
   FTP_HOST=… FTP_USER=… FTP_PASS=… bash scripts/rollback.sh releases/out-abc1234-20260827-143000.tar.gz
   ```

   This extracts the archive into `out/` and runs a full mirror (no `--only-newer`).

3. **Confirm** `https://hub.robotku.id/version.json` shows the rolled-back sha.

Alternative: rebuild from a known-good commit:
```bash
git checkout <good-sha>
npm ci && npm run build
FTP_HOST=… FTP_USER=… FTP_PASS=… FORCE_FULL=1 SKIP_SIM3D=1 bash scripts/deploy.sh
```

## Emergency: .htaccess locks the site

If a bad `.htaccess` makes the site completely inaccessible (infinite redirect loop,
500 errors, etc.) and you only have FTP access — **no hPanel** — the fix is to upload
a minimal `.htaccess` via any FTP client (FileZilla, command-line `lftp`, etc.).

**Copy-paste this entire file** as `.htaccess` in the `public_html` root:

```apache
# EMERGENCY .htaccess — replaces the broken one.
# Upload this via FTP to restore basic site access.
# Then rebuild and redeploy properly.

Options -Indexes

ErrorDocument 404 /404/index.html

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json
</IfModule>

<IfModule mod_mime.c>
  AddType application/wasm .wasm
  AddType image/webp .webp
</IfModule>
```

This deliberately has **no** HTTPS redirect, **no** HSTS, **no** aggressive caching —
just enough to serve the static files and stop the bleeding. Once the site is
accessible again, do a proper rebuild with the correct flags and redeploy.

Quick FTP upload from command line:
```bash
echo 'Options -Indexes
ErrorDocument 404 /404/index.html' > /tmp/htaccess-emergency
lftp -c "set ftp:ssl-force true; open -u \"$FTP_USER\",\"$FTP_PASS\" \"$FTP_HOST\"; \
         put /tmp/htaccess-emergency -o /public_html/.htaccess"
```

> NOTE: the CSP is intentionally NOT enforced yet. The Blockly/tfjs stack needs
> `'wasm-unsafe-eval'` and ProgramRunner's condition sandbox needs `'unsafe-eval'`
> (`new Function`). Start in Report-Only, tune, then enforce — do not remove
> `unsafe-eval` or every sensor block stops evaluating.
