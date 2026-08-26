#!/usr/bin/env bash
# scripts/deploy.sh — mirror out/ to the shared host over FTPS with lftp.
#
# Credentials come from the environment (never the repo):
#   FTP_HOST  FTP_USER  FTP_PASS
# Optional:
#   FTP_REMOTE_DIR   (default /public_html)
#   SKIP_SIM3D=1     exclude public/sim3d/** so a launch upload is a few MB, not 26
#
# Usage:  FTP_HOST=… FTP_USER=… FTP_PASS=… ./scripts/deploy.sh
set -euo pipefail

: "${FTP_HOST:?set FTP_HOST}"
: "${FTP_USER:?set FTP_USER}"
: "${FTP_PASS:?set FTP_PASS}"
REMOTE_DIR="${FTP_REMOTE_DIR:-/public_html}"

if [ ! -d out ]; then
  echo "out/ not found — run `npm run build` first." >&2
  exit 1
fi

EXCLUDES='--exclude-glob .git*'
if [ "${SKIP_SIM3D:-0}" = "1" ]; then
  EXCLUDES="$EXCLUDES --exclude-glob sim3d/*"
  echo "→ excluding public/sim3d/** (3D assets) from this upload"
fi

# Upload order matters on a live site: push hashed static chunks FIRST so a user
# mid-navigation never requests a chunk that isn't there yet, then everything
# (HTML last). --delete prunes stale chunks that accumulate forever otherwise.
run_lftp() {
  lftp -c "set ftp:ssl-force true; set ssl:verify-certificate true; \
           open -u \"$FTP_USER\",\"$FTP_PASS\" \"$FTP_HOST\"; \
           $1"
}

echo "→ pass 1: /_next/static (immutable chunks)"
run_lftp "mirror -R --only-newer --parallel=4 $EXCLUDES ./out/_next/static ${REMOTE_DIR}/_next/static"

echo "→ pass 2: full mirror (HTML + .htaccess last, prune stale)"
run_lftp "mirror -R --delete --only-newer --parallel=4 $EXCLUDES ./out ${REMOTE_DIR}"

echo "✓ deployed to ${FTP_HOST}:${REMOTE_DIR}"
