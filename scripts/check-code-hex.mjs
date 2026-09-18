// scripts/check-code-hex.mjs
//
// Guard for the theme system (py2.md §1d, C4): the Python-editor UI must be fully
// token-driven so all 7 IDE themes can restyle it. Fails the build if a 6-digit hex
// literal (#rrggbb) sneaks into these files — use a var(--token) from tokens.css.
//
// Scope: the theme-critical Python editor components. The rest of src/components is
// tokenised progressively with the theme phase; expand ROOTS as that lands.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['src/components/blockcoding/python'];
const HEX = /#[0-9a-fA-F]{6}\b/;
const EXTS = new Set(['.ts', '.tsx', '.css']);

const bad = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (EXTS.has(extname(p))) {
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (HEX.test(line)) bad.push(`  ${p}:${i + 1}  ${line.trim()}`);
      });
    }
  }
}
for (const r of ROOTS) walk(r);

if (bad.length) {
  console.error('✗ 6-digit hex literals found — use a var(--token) from tokens.css:');
  console.error(bad.join('\n'));
  process.exit(1);
}
console.log(`✓ code-hex check OK (${ROOTS.join(', ')})`);
