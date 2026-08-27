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

Every CI deploy uploads the exact deployed `out/` as a 30-day artifact named
`out-<run_number>-<sha>` (sim3d excluded). To roll back to a known-good build:

1. **Get the good `out/`.** Either download that run's artifact
   (Actions → the run → *Artifacts*) and unzip it into `./out`, or rebuild the
   good commit locally:

   ```bash
   git checkout <good-sha>
   npm ci && npm run build      # regenerates out/ + version.json for that commit
   ```

2. **Re-mirror it** (the same script CI uses):

   ```bash
   FTP_HOST=… FTP_USER=… FTP_PASS=… SKIP_SIM3D=1 bash scripts/deploy.sh
   ```

3. **Confirm** `https://hub.robotku.id/version.json` shows the rolled-back sha and
   hard-refresh the landing + editor routes.

For a manual local snapshot before a risky deploy:
`zip -rq "out-$(date +%Y%m%d).zip" out -x 'out/sim3d/*'`.

> NOTE: the CSP is intentionally NOT enforced yet. The Blockly/tfjs stack needs
> `'wasm-unsafe-eval'` and ProgramRunner's condition sandbox needs `'unsafe-eval'`
> (`new Function`). Start in Report-Only, tune, then enforce — do not remove
> `unsafe-eval` or every sensor block stops evaluating.
