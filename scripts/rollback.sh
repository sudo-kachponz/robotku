#!/usr/bin/env bash
# scripts/rollback.sh — restore a previous release archive and re-mirror to the host.
#
# Usage:
#   FTP_HOST=… FTP_USER=… FTP_PASS=… bash scripts/rollback.sh releases/out-abc1234-20260827-143000.tar.gz
#
# If no archive is given, lists available releases so you can pick one.
set -euo pipefail

ARCHIVE="${1:-}"

# ── List available releases if none specified ──────────────────────────────
if [ -z "$ARCHIVE" ]; then
  echo "Arsip rilis yang tersedia:"
  echo ""
  if [ -d releases ] && [ "$(ls -A releases/ 2>/dev/null)" ]; then
    ls -lhtr releases/out-*.tar.gz 2>/dev/null || echo "  (tidak ada arsip .tar.gz di releases/)"
  else
    echo "  (folder releases/ kosong atau belum ada)"
  fi
  echo ""
  echo "Gunakan:"
  echo "  FTP_HOST=… FTP_USER=… FTP_PASS=… bash scripts/rollback.sh releases/out-XXXX.tar.gz"
  exit 1
fi

if [ ! -f "$ARCHIVE" ]; then
  echo "File arsip tidak ditemukan: $ARCHIVE" >&2
  exit 1
fi

: "${FTP_HOST:?set FTP_HOST}"
: "${FTP_USER:?set FTP_USER}"
: "${FTP_PASS:?set FTP_PASS}"
REMOTE_DIR="${FTP_REMOTE_DIR:-/public_html}"

echo "── Rollback dari $ARCHIVE ──"

# ── Extract ────────────────────────────────────────────────────────────────
echo "→ Menghapus out/ lama…"
rm -rf out/

echo "→ Mengekstrak arsip…"
tar xzf "$ARCHIVE"

if [ ! -f out/index.html ]; then
  echo "Arsip tidak mengandung out/index.html — arsip rusak?" >&2
  exit 1
fi

RESTORED_SHA=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('out/version.json','utf8')).sha)}catch{console.log('?')}")
echo "→ Versi yang dipulihkan: $RESTORED_SHA"

# ── Re-mirror ─────────────────────────────────────────────────────────────
EXCLUDES='--exclude-glob .git*'
if [ "${SKIP_SIM3D:-0}" = "1" ]; then
  EXCLUDES="$EXCLUDES --exclude-glob sim3d/*"
fi

run_lftp() {
  lftp -c "set ftp:ssl-force true; set ssl:verify-certificate true; \
           open -u \"$FTP_USER\",\"$FTP_PASS\" \"$FTP_HOST\"; \
           $1"
}

TOTAL=$(du -sh ./out 2>/dev/null | cut -f1)
echo "→ Mengunggah ~${TOTAL} ke ${FTP_HOST}:${REMOTE_DIR}…"

echo "→ pass 1: /_next"
run_lftp "mirror -R --delete --parallel=4 $EXCLUDES ./out/_next ${REMOTE_DIR}/_next"

echo "→ pass 2: everything else"
run_lftp "mirror -R --delete --parallel=4 --exclude-glob _next/* $EXCLUDES ./out ${REMOTE_DIR}"

echo ""
echo "✓ Rollback selesai ke versi $RESTORED_SHA"
echo "  Buka https://hub.robotku.id/version.json untuk memastikan."
echo ""
