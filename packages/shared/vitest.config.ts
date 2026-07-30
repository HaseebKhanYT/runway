import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Every suite here reads local date parts. Pin the zone so results are the
    // same on a laptop as they are in CI.
    env: {TZ: 'UTC'},
  },
});
