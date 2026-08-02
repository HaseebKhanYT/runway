import {MS_PER_DAY} from '@runway/shared';
import {describe, expect, it} from 'vitest';

// Proves the two things every moved presentation test will rely on: vitest
// compiles TypeScript here, and workspace imports from @runway/shared resolve.
describe('web test runner', () => {
  it('resolves workspace imports', () => {
    expect(MS_PER_DAY).toBe(86_400_000);
  });
});
