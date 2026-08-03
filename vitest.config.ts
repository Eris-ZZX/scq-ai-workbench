import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@/platform': path.resolve(__dirname, './lib/platform'),
      '@/modules': path.resolve(__dirname, './lib/modules'),
      '@/components': path.resolve(__dirname, './components'),
      '@': path.resolve(__dirname, '.'),
    },
  },
});
