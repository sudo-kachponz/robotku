# Performance Baseline — Robotku Playground

_Recorded: 2026-08-26_

## Build Output — First Load JS per Route

| Route                     | Size    | First Load JS |
| ------------------------- | ------- | ------------- |
| `/` (homepage)            | 1.78 kB | 114 kB        |
| `/404`                    | 813 B   | 113 kB        |
| `/500`                    | 698 B   | 113 kB        |
| `/academy`                | 5.13 kB | 115 kB        |
| `/academy/lessons`        | 9.05 kB | 121 kB        |
| `/academy/lessons/[id]`   | 5.88 kB | 118 kB        |
| `/control`                | 1.22 kB | 120 kB        |
| `/control/modes`          | 5.86 kB | 124 kB        |
| `/control/modes/base`     | 3.9 kB  | 122 kB        |
| `/control/modes/code`     | 1.96 kB | **120 kB**    |
| `/control/modes/joystick` | 2.08 kB | 121 kB        |
| `/control/modes/port`     | 2.74 kB | 121 kB        |
| `/control/modes/tank`     | 2.24 kB | 121 kB        |
| `/control/projects`       | 1.72 kB | 120 kB        |
| `/control/settings`       | 3.44 kB | 122 kB        |
| `/dashboard`              | 1.57 kB | 111 kB        |

Shared JS: **112 kB** (framework 59.8 kB + main 37.4 kB + other 14.6 kB)

## Asset Sizes

| Directory         | Size      |
| ----------------- | --------- |
| `public/` (total) | **26 MB** |
| `out/` (exported) | **46 MB** |

### public/ Breakdown

| Asset                           | Size         | Category |
| ------------------------------- | ------------ | -------- |
| `Cyberpunk.hdr`                 | 5.8 MB       | 3D-only  |
| `rocks_ground_09_diff_2k.jpg`   | 3.4 MB       | 3D-only  |
| `rubber_tiles_rough_2k.jpg`     | 2.7 MB       | 3D-only  |
| `rubber_tiles_nor_gl_2k.jpg`    | 2.3 MB       | 3D-only  |
| `plastered_wall_05_diff_2k.jpg` | 2.3 MB       | 3D-only  |
| `Asteria-DashMinimal.glb`       | 2.1 MB       | 3D-only  |
| `rubber_tiles_diff_2k.jpg`      | 1.7 MB       | 3D-only  |
| **3D subtotal**                 | **~20.3 MB** |          |
| `public/brand/`                 | 3.7 MB       | branding |
| `public/icons/`                 | 1.8 MB       | icons    |
| `public/sounds/`                | 132 KB       | audio    |
| `public/models/` (README)       | 8 KB         | docs     |
| `levels*.json` (×3)             | 24 KB        | data     |

## R1 Dependency Cleanup (DONE)

- ✅ `@blockly/field-colour` removed (unused)
- ✅ `@blockly/field-colour-hsv-sliders` removed (unused, registration removed from core.ts)
- ✅ ML packages pinned to exact versions (no `^`)
- ✅ `@mediapipe/tasks-vision` WASM CDN aligned to installed version `1.0.1`
- ✅ three.js uses `import type` + dynamic `import()` — NOT in initial chunk
- ✅ `tsconfig.tsbuildinfo` removed from git + `.gitignore`
- ✅ Root prompt `.md` files deleted (kept in `docs/`)
- ✅ `.gitignore` updated: `out/`, `coverage/`, `*.tsbuildinfo`, `.env*`
- ✅ `package.json` name → `robotku`, engines `>=20`

## R1 Remaining: Asset Diet

3D assets (~20.3 MB) still in `public/` root. Target: move to `public/sim3d/` and exclude from FTP deploy.
