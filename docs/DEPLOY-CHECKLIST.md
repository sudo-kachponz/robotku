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
- `out/.htaccess` (generated): force HTTPS, `ErrorDocument 404`, immutable caching
  for hashed assets + `no-cache` for HTML/`version.json`, deflate/brotli, wasm/glb/hdr/webp
  MIME, `Permissions-Policy: camera=(self), bluetooth=(self)`.

## Post-deploy verification (tick with evidence)

- [ ] `https://hub.robotku.id` loads; `http://` → `https://` 301.
- [ ] Deep link `https://hub.robotku.id/control/modes/code/` loads directly (not just via client nav).
- [ ] Hard refresh on every route: no 404, no blank page.
- [ ] DevTools → Application: secure context; `navigator.bluetooth` / `navigator.serial` on Chrome desktop.
- [ ] AI panel can request the camera (Permissions-Policy not blocking).
- [ ] Lighthouse (throttled 4G): Performance ≥ 80, Accessibility ≥ 95 on landing + editor. Record numbers.
- [ ] `/control/modes/code` First Load JS matches PERF-BASELINE.md.
- [ ] Redeploy once → new `version.json` appears without a manual cache clear.

## Rollback

Keep the previous `out/` as a dated zip (`out-YYYYMMDD.zip`). Restore by
re-mirroring that folder with `scripts/deploy.sh`.

> NOTE: the CSP is intentionally NOT enforced yet. The Blockly/tfjs stack needs
> `'wasm-unsafe-eval'` and ProgramRunner's condition sandbox needs `'unsafe-eval'`
> (`new Function`). Start in Report-Only, tune, then enforce — do not remove
> `unsafe-eval` or every sensor block stops evaluating.
