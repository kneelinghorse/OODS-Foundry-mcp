import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/contracts/**/*.spec.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
