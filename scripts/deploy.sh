#!/usr/bin/env bash
# scripts/deploy.sh — mirror out/ to the shared host over FTPS with lftp.
#
# Credentials come from the environment (never the repo):
#   FTP_HOST  FTP_USER  FTP_PASS
# Optional:
#   FTP_REMOTE_DIR   (default /public_html)
#   SKIP_SIM3D=1     exclude public/sim3d/** so a launch upload is a few MB, not 26
#   FORCE_FULL=1     skip --only-newer on pass 1 (first deploy or clock-drift fix)
#
# Usage:  FTP_HOST=… FTP_USER=… FTP_PASS=… ./scripts/deploy.sh
set -euo pipefail

: "${FTP_HOST:?set FTP_HOST}"
: "${FTP_USER:?set FTP_USER}"
: "${FTP_PASS:?set FTP_PASS}"
REMOTE_DIR="${FTP_REMOTE_DIR:-/public_html}"

if [ ! -d out ]; then
  echo 'out/ not found — run `npm run build` first.' >&2
  exit 1
fi

# ── Preflight ──────────────────────────────────────────────────────────────
echo "── Menjalankan preflight…"
node scripts/preflight.mjs
echo ""

# ── Snapshot rilis (sebelum mirror) ────────────────────────────────────────
LOCAL_SHA=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('out/version.json','utf8')).sha)}catch{console.log('unknown')}")
STAMP=$(date +%Y%m%d-%H%M%S)
RELEASE_DIR="releases"
ARCHIVE="${RELEASE_DIR}/out-${LOCAL_SHA}-${STAMP}.tar.gz"
mkdir -p "$RELEASE_DIR"

TAR_EXCLUDE=""
if [ "${SKIP_SIM3D:-0}" = "1" ]; then
  TAR_EXCLUDE="--exclude=out/sim3d"
fi
tar czf "$ARCHIVE" $TAR_EXCLUDE out/
echo "→ Arsip rilis tersimpan: $ARCHIVE ($(du -sh "$ARCHIVE" | cut -f1))"

# ── Upload size ────────────────────────────────────────────────────────────
EXCLUDES='--exclude-glob .git*'
DU_EXCLUDE=''
if [ "${SKIP_SIM3D:-0}" = "1" ]; then
  EXCLUDES="$EXCLUDES --exclude-glob sim3d/*"
  DU_EXCLUDE='--exclude=./out/sim3d'
  echo "→ excluding public/sim3d/** (3D assets) from this upload"
fi

# Tell the operator up front how big this mirror is — the first launch upload is
# ~26 MB (or a few MB with SKIP_SIM3D=1), which is slow on shared-host FTPS.
TOTAL=$(du -sh $DU_EXCLUDE ./out 2>/dev/null | cut -f1)
echo "→ uploading ~${TOTAL} to ${FTP_HOST}:${REMOTE_DIR} (this can take a while over FTPS)"

if command -v lftp >/dev/null 2>&1; then
  run_lftp() {
    lftp -c "set ftp:ssl-force true; set ssl:verify-certificate true; \
             open -u \"$FTP_USER\",\"$FTP_PASS\" \"$FTP_HOST\"; \
             $1"
  }

  ONLY_NEWER_FLAG="--only-newer"
  if [ "${FORCE_FULL:-0}" = "1" ]; then
    ONLY_NEWER_FLAG=""
    echo "→ FORCE_FULL=1: pass 1 akan mengunggah SEMUA file di _next/ (tanpa --only-newer)"
  fi

  echo "→ pass 1: /_next hashed chunks ${ONLY_NEWER_FLAG:+(--only-newer + }prune stale${ONLY_NEWER_FLAG:+)}"
  run_lftp "mirror -R $ONLY_NEWER_FLAG --delete --parallel=4 $EXCLUDES ./out/_next ${REMOTE_DIR}/_next"

  echo "→ pass 2: everything else — HTML + .htaccess + version.json, always fresh"
  run_lftp "mirror -R --delete --parallel=4 --exclude-glob _next/* $EXCLUDES ./out ${REMOTE_DIR}"
else
  echo "→ lftp tidak terinstall, menggunakan fallback unggah via python3..."
  FTP_HOST="$FTP_HOST" FTP_USER="$FTP_USER" FTP_PASS="$FTP_PASS" python3 scripts/clean_upload.py
fi

# ── Post-deploy smoke check ───────────────────────────────────────────────
echo ""
echo "── Smoke check…"
SITE_URL="${DEPLOY_URL:-https://hub.robotku.id}"
REMOTE_VERSION=$(curl -sSf "${SITE_URL}/version.json" 2>/dev/null || echo '{}')
REMOTE_SHA=$(echo "$REMOTE_VERSION" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).sha||'?')}catch{console.log('?')}})")

if [ "$REMOTE_SHA" = "$LOCAL_SHA" ]; then
  echo "✓ version.json cocok: $REMOTE_SHA == $LOCAL_SHA (build lokal)"
else
  echo "⚠ version.json TIDAK COCOK!"
  echo "  Server: $REMOTE_SHA"
  echo "  Lokal:  $LOCAL_SHA"
  echo "  Mirror mungkin belum selesai, atau CDN cache masih lama."
  echo "  Coba hard refresh atau tunggu beberapa menit."
fi

echo ""
echo "✓ Deployed ke ${FTP_HOST}:${REMOTE_DIR}"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Kirim ke penguji:"
echo "  ${SITE_URL}/cek/"
echo "════════════════════════════════════════════════════════════════"
echo ""
