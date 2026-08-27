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
- [ ] Redeploy once → new `version.json` appears without a manual cache clear.

CI does the last check automatically: after the mirror it polls
`https://hub.robotku.id/version.json` and fails the job unless `.sha` matches the
deployed commit (a half-finished FTPS mirror otherwise exits 0 while the site is
stale).

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

