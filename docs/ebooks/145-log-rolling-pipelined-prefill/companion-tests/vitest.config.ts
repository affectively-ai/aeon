import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// Works from both monorepo (docs/ebooks/.../companion-tests/) and aeon submodule
const aeonSrc = resolve(__dirname, '../../../../src');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@aeon/flow': resolve(aeonSrc, 'flow/index.ts'),
      '@aeon/compression': resolve(aeonSrc, 'compression/index.ts'),
    },
  },
});
