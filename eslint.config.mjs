// eslint.config.mjs — flat config (ESLint 9).
//
// A real gate: bridges Next 15's eslintrc-based config (next/core-web-vitals +
// next/typescript) via FlatCompat, forbids unused imports, and warns on stray
// console.log (console.warn/error are allowed). eslint-config-prettier goes last
// to switch off the stylistic rules Prettier owns.

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import unusedImports from 'eslint-plugin-unused-imports';
import prettier from 'eslint-config-prettier';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'coverage/**',
      'next-env.d.ts',
      'public/**',
      'eslint.config.mjs',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    plugins: { 'unused-imports': unusedImports },
    rules: {
      // The gate's teeth: no dead imports, no stray console.log.
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': 'off', // superseded by the plugin below
      'unused-imports/no-unused-vars': [
        'error',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Deliberately relaxed — tracked as debt / intentional for this app:
      //  - no-explicit-any: 100+ call sites; reduced incrementally (see docs/HANDOFF.md).
      //  - no-img-element: static export (output:'export') uses plain <img> on purpose.
      //  - exhaustive-deps: noisy; the codebase suppresses it inline where needed.
      '@typescript-eslint/no-explicit-any': 'off',
      '@next/next/no-img-element': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    // Build/deploy scripts log to stdout on purpose.
    files: ['scripts/**/*.{mjs,js}'],
    rules: { 'no-console': 'off' },
  },
  prettier,
];
