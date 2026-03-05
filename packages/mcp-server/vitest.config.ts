import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts', 'src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 180_000,
  },
});
