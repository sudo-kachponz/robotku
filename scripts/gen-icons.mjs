// scripts/gen-icons.mjs
//
// One-shot asset generator (run manually, not in the build):  node scripts/gen-icons.mjs
// Produces the favicon + PWA/Apple icon set from the mascot logo. The raw
// 2000x2000 / 648 KB logo is never shipped as an icon — everything here is
// downscaled and PNG-optimised (192 < 15 KB, 512 < 60 KB).
//
// Maskable icons keep the mascot inside the inner ~80% "safe zone" on a solid
// brand background so Android/adaptive masks never clip it.

import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'public/brand/Robotku-Mascot-Logo.png');
const ICONS = join(ROOT, 'public/icons');
const BG = { r: 0x1e, g: 0x1b, b: 0x4b, alpha: 1 }; // manifest background_color #1E1B4B

mkdirSync(ICONS, { recursive: true });

/** Mascot centred at `inner` fraction of `size`, on the solid brand background. */
async function maskable(size, inner, out) {
  const content = Math.round(size * inner);
  const logo = await sharp(SRC)
    .resize(content, content, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  const off = Math.round((size - content) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, top: off, left: off }])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(out);
}

async function main() {
  // PWA maskable icons (safe-zone padding ~10%).
  await maskable(192, 0.8, join(ICONS, 'icon-192.png'));
  await maskable(512, 0.8, join(ICONS, 'icon-512.png'));
  // Apple touch icon — iOS rounds the corners itself; a little padding is enough.
  await maskable(180, 0.86, join(ICONS, 'apple-touch-icon.png'));

  // favicon.ico — build 16/32/48 PNGs, then pack into a multi-size .ico via ImageMagick.
  const tmp = [];
  for (const s of [16, 32, 48]) {
    const p = join(ICONS, `_fav-${s}.png`);
    await maskable(s, 0.92, p);
    tmp.push(p);
  }
  execFileSync('convert', [...tmp, join(ROOT, 'public/favicon.ico')]);
  for (const p of tmp) rmSync(p);
  console.log('[gen-icons] wrote favicon.ico + icons/icon-{192,512}.png + apple-touch-icon.png');
}

main().catch((err) => {
  console.error('[gen-icons] failed:', err);
  process.exit(1);
});
