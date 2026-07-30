import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // Deliberately NOT recursive: matches test/api.test.ts and skips test/unit/.
    include: ['test/*.test.ts'],
    // One shared Postgres schema, and wipeUser() does a blanket deleteMany —
    // concurrent files would delete each other's rows.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
