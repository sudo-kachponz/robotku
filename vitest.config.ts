import { defineConfig } from 'vitest/config';

// Parity harness (PROMPT C): headless Blockly + SimSink under jsdom.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/test/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: 'v8',
      include: ['src/runtime/**', 'src/categories/**', 'src/blockcoding/**'],
    },
  },
});
