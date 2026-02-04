import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.js'],
      exclude: ['lib/index.js'],
      thresholds: {
        statements: 20,
        branches: 20,
        functions: 20,
        lines: 20,
      },
    },
  },
});
