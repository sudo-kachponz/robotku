// scripts/preflight.mjs
//
// Runs at the START of scripts/deploy.sh. Its ONE job is to refuse a deploy that
// could lock the site out — because the operator has FTP only, no hPanel, so the
// only recovery is re-uploading.
//
// Checks:
//   1. TLS on the live host        -> ok | cert-invalid | unreachable
//   2. If out/.htaccess forces HTTPS but TLS is NOT ok -> FAIL (would lock the site)
//   3. If TLS ok but no redirect   -> warn (http works, but Web BLE/Serial won't)
//   4. out/ has index.html, .htaccess, version.json, favicon.ico
//   5. print the total upload size
//
// No third-party deps — node:https / node:fs only.

import { get } from 'node:https';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SITE = process.env.PREFLIGHT_URL || 'https://hub.robotku.id';
const OUT = join(process.cwd(), 'out');
const SKIP_SIM3D = process.env.SKIP_SIM3D === '1';

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

function fail(msg) {
  console.error(red(`\n✖ PREFLIGHT GAGAL — deploy dibatalkan.\n  ${msg}\n`));
  process.exit(1);
}

// --- 1. TLS check ---------------------------------------------------------
function checkTls() {
  return new Promise((resolve) => {
    const req = get(SITE, { timeout: 12000, rejectUnauthorized: true }, (res) => {
      res.resume(); // drain
      resolve({ status: 'ok', code: res.statusCode });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 'unreachable', detail: 'timeout' });
    });
    req.on('error', (err) => {
      const c = err.code || '';
      const certErrs = [
        'CERT_HAS_EXPIRED',
        'DEPTH_ZERO_SELF_SIGNED_CERT',
        'SELF_SIGNED_CERT_IN_CHAIN',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'ERR_TLS_CERT_ALTNAME_INVALID',
        'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
      ];
      if (certErrs.includes(c) || /certificate|cert/i.test(err.message)) {
        resolve({ status: 'cert-invalid', detail: c || err.message });
      } else if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(c)) {
        resolve({ status: 'unreachable', detail: c });
      } else {
        resolve({ status: 'unreachable', detail: c || err.message });
      }
    });
  });
}

// --- helpers --------------------------------------------------------------
function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_SIM3D && entry.name === 'sim3d' && dir === OUT) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) total += dirSizeBytes(p);
    else total += statSync(p).size;
  }
  return total;
}
const mb = (b) => (b / (1024 * 1024)).toFixed(1);

// --- run ------------------------------------------------------------------
console.log(`\n── Preflight deploy ke ${SITE} ──`);

// 4. out/ sanity
if (!existsSync(OUT)) fail("out/ tidak ada. Jalankan `npm run build` dulu.");
for (const f of ['index.html', '.htaccess', 'version.json', 'favicon.ico']) {
  if (!existsSync(join(OUT, f))) fail(`out/${f} tidak ada — build tampaknya belum lengkap.`);
}
const localSha = (() => {
  try {
    return JSON.parse(readFileSync(join(OUT, 'version.json'), 'utf8')).sha;
  } catch {
    return '?';
  }
})();
const redirectOn = readFileSync(join(OUT, '.htaccess'), 'utf8').includes(
  'RewriteRule ^(.*)$ https://',
);
console.log(`  out/ lengkap ✓  (versi build lokal: ${localSha}, redirect HTTPS: ${redirectOn ? 'ON' : 'OFF'})`);

// 5. upload size
console.log(
  `  Ukuran unggahan: ~${mb(dirSizeBytes(OUT))} MB${SKIP_SIM3D ? ' (sim3d dikecualikan)' : ''} — ini bisa lama di FTPS.`,
);

// 1–3. TLS gate
const tls = await checkTls();
if (tls.status === 'ok') {
  console.log(green(`  TLS live: ok (HTTP ${tls.code})`));
  if (!redirectOn) {
    console.log(
      yellow(
        '  ⚠ Redirect HTTPS MATI: situs akan bisa diakses lewat http, dan Web Bluetooth/Serial\n' +
          '    TIDAK akan aktif di http. Setelah TLS terbukti (sekarang ok), build ulang dengan\n' +
          '    ENABLE_HTTPS_REDIRECT=1 lalu deploy lagi untuk mengaktifkan koneksi perangkat.',
      ),
    );
  }
} else if (redirectOn) {
  // The dangerous combination: we'd force HTTPS to a cert that doesn't work.
  fail(
    `TLS ${tls.status} (${tls.detail || '?'}) TAPI out/.htaccess memaksa redirect ke HTTPS.\n` +
      '  Ini akan melempar semua pengunjung ke halaman error sertifikat, dan tanpa hPanel kamu\n' +
      '  tidak bisa membatalkannya cepat. Build ulang TANPA ENABLE_HTTPS_REDIRECT (default mati),\n' +
      '  deploy, lalu minta pemegang hPanel menerbitkan SSL untuk hub.robotku.id sebelum menyalakannya.',
  );
} else {
  console.log(
    yellow(
      `  ⚠ TLS ${tls.status} (${tls.detail || '?'}), tapi redirect HTTPS juga mati — aman untuk deploy.\n` +
        '    Situs akan http-only; Web Bluetooth/Serial belum akan jalan sampai SSL terbit.',
    ),
  );
}

console.log(green('  Preflight lolos.\n'));
