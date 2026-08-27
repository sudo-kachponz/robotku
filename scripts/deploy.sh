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
  echo 'out/ not found — run `npm run build` first.' >&2
  exit 1
fi

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

run_lftp() {
  lftp -c "set ftp:ssl-force true; set ssl:verify-certificate true; \
           open -u \"$FTP_USER\",\"$FTP_PASS\" \"$FTP_HOST\"; \
           $1"
}

# Upload order matters on a live site: push hashed static chunks FIRST so a user
# mid-navigation never requests a chunk that isn't there yet, then HTML last.
#
# Timestamp-based --only-newer is SAFE only for /_next: filenames are content
# hashed, so a changed file is a NEW name (never same-name-newer-mtime). For HTML,
# .htaccess and version.json it is NOT safe — shared-host clocks drift, so a real
# change can look "older" and get skipped. Those files are tiny, so pass 2 always
# re-uploads them. --delete in each pass prunes stale files within that pass's tree.
echo "→ pass 1: /_next hashed chunks (--only-newer + prune stale)"
run_lftp "mirror -R --only-newer --delete --parallel=4 $EXCLUDES ./out/_next ${REMOTE_DIR}/_next"

echo "→ pass 2: everything else — HTML + .htaccess + version.json, always fresh"
run_lftp "mirror -R --delete --parallel=4 --exclude-glob _next/* $EXCLUDES ./out ${REMOTE_DIR}"

echo "✓ deployed to ${FTP_HOST}:${REMOTE_DIR}"
