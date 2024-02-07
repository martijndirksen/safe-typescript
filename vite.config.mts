/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    env: {
      LOG_STDOUT: '1',
    },
    watchExclude: ['**/node_modules/**', '**/src/**'],
    forceRerunTriggers: [
      '**/package.json/**',
      '**/vitest.config.*/**',
      '**/vite.config.*/**',
      '**/dist/**',
      '**/samples/**/*.ts',
    ],
  },
});
