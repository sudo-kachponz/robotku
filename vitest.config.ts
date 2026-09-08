import { defineConfig } from 'vitest/config';

// Parity harness (PROMPT C): headless Blockly + SimSink under jsdom.
export default defineConfig({
  // Match Next.js: automatic JSX runtime so components render in tests without a
  // manual `import React` (needed by the sim board render tests).
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    include: ['src/test/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/runtime/**', 'src/categories/**', 'src/blockcoding/**'],
    },
  },
});
