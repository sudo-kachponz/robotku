import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Build-time guard (R6): a static export silently breaks if any server-only Next
// feature sneaks in. Fail the build loudly instead of shipping a broken site.
function assertStaticExportSafe() {
  const apiDir = join(process.cwd(), 'src', 'pages', 'api');
  if (existsSync(apiDir) && readdirSync(apiDir).length > 0) {
    throw new Error('[static-export] src/pages/api/* exists — API routes cannot be exported. Remove them.');
  }
}
assertStaticExportSafe();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Match Stick'em's stack: statically-exported Next.js Pages Router app.
  // Produces plain static files (no Node server) — deployable to any static host,
  // and served over HTTPS/localhost so Web Bluetooth / Web Serial work.
  output: 'export',
  reactStrictMode: true,
  // Static export cannot use the Image Optimization server.
  images: { unoptimized: true },
  // Apache serves control/modes/code/index.html reliably; without this the export
  // is control/modes/code.html which 404s / redirects inconsistently on shared hosts.
  trailingSlash: true,
  // Never ship source maps to a public host (they stay in CI artifacts).
  productionBrowserSourceMaps: false,
};

export default nextConfig;
