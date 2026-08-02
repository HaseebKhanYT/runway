import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Mirrors packages/shared: suites read local date parts, so pin the zone
    // to make results the same on a laptop as they are in CI.
    env: {TZ: 'UTC'},
  },
});
