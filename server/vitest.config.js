import { defineConfig } from 'vitest/config';
import { testEnv } from './test/env.js';

export default defineConfig({
  test: {
    env: testEnv,
    globalSetup: ['./test/globalSetup.js'],
    setupFiles: ['./test/setup.js'],
    // All test files share one database, so run them one after another.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
