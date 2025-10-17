import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/tests/**/*.{test,spec}.{js,ts}',
      'src/tests/**/*.ts' // Include our TDD test files
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.svelte-kit/**'
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '$lib': resolve(__dirname, 'src/lib'),
    },
  },
});