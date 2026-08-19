/** @type {import('next').NextConfig} */
const nextConfig = {
  // Match Stick'em's stack: statically-exported Next.js Pages Router app.
  // Produces plain static files (no Node server) — deployable to any static host,
  // and served over HTTPS/localhost so Web Bluetooth / Web Serial work.
  output: 'export',
  reactStrictMode: true,
  // Static export cannot use the Image Optimization server.
  images: { unoptimized: true },
};

export default nextConfig;
