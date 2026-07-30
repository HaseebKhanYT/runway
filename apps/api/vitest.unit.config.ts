import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // Recursive, and scoped to test/unit — the integration suite lives at
    // test/*.test.ts and must not be picked up here.
    include: ['test/unit/**/*.test.ts'],
    env: {TZ: 'UTC'},
  },
});
