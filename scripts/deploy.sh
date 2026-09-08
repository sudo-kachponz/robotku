#!/usr/bin/env bash
# scripts/deploy.sh — mirror out/ to the shared host over FTPS with lftp or python.
set -euo pipefail

: "${FTP_HOST:?set FTP_HOST}"
: "${FTP_USER:?set FTP_USER}"
: "${FTP_PASS:?set FTP_PASS}"
REMOTE_DIR="${FTP_REMOTE_DIR:-/}"

if [ ! -d out ]; then
  echo 'out/ not found — run `npm run build` first.' >&2
  exit 1
fi

# ── Preflight ──────────────────────────────────────────────────────────────
echo "── Menjalankan preflight…"
node scripts/preflight.mjs
echo ""

# ── Snapshot rilis ────────────────────────────────────────────────────────
LOCAL_SHA=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('out/version.json','utf8')).sha)}catch{console.log('unknown')}")

EXCLUDES='--exclude-glob .git*'
if [ "${SKIP_SIM3D:-0}" = "1" ]; then
  EXCLUDES="$EXCLUDES --exclude-glob sim3d/*"
fi

if command -v lftp >/dev/null 2>&1; then
  echo "→ Mengunggah via lftp..."
  run_lftp() {
    lftp -c "set ftp:ssl-force false; \
             set ftp:ssl-allow false; \
             set ftp:passive-mode true; \
             set net:timeout 30; \
             set net:max-retries 3; \
             open -u \"$FTP_USER\",\"$FTP_PASS\" \"$FTP_HOST\"; \
             $1"
  }

  ONLY_NEWER_FLAG="--only-newer"
  if [ "${FORCE_FULL:-0}" = "1" ]; then
    ONLY_NEWER_FLAG=""
    echo "→ FORCE_FULL=1: pass 1 akan mengunggah SEMUA file di _next/"
  fi

  TARGET_NEXT="_next"
  TARGET_ROOT="."
  if [ "$REMOTE_DIR" != "/" ] && [ -n "$REMOTE_DIR" ]; then
    TARGET_NEXT="${REMOTE_DIR}/_next"
    TARGET_ROOT="${REMOTE_DIR}"
  fi

  echo "→ pass 1: /_next hashed chunks..."
  run_lftp "mirror -R $ONLY_NEWER_FLAG --delete --parallel=2 $EXCLUDES ./out/_next $TARGET_NEXT"

  echo "→ pass 2: HTML + assets..."
  run_lftp "mirror -R --delete --parallel=2 --exclude-glob _next/* $EXCLUDES ./out $TARGET_ROOT"
else
  echo "→ lftp tidak terinstall, menjalankan python deploy..."
  FTP_HOST="$FTP_HOST" FTP_USER="$FTP_USER" FTP_PASS="$FTP_PASS" python3 scripts/deploy.py
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
