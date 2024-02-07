/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    watchExclude: ['**/node_modules/**', '**/src/**'],
    forceRerunTriggers: [
      '**/package.json/**',
      '**/vitest.config.*/**',
      '**/vite.config.*/**',
      '**/dist/**',
    ],
  },
});
