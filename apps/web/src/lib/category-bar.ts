/**
 * How full a category's budget bar is drawn (catalog §1.1D).
 *
 * A category with no budget has no denominator, so there is no fraction to
 * draw and the honest fill is empty. The panel used to fall back to a full
 * track whenever an unbudgeted category had any spend at all, which rendered
 * `$45.00 spent` against no limit as a fuller bar than a category genuinely at
 * 80% of its own (#153). `bills/page.tsx` already guards the same way.
 *
 * Lives in its own module because `apps/web` has no jsdom and `vitest.config`
 * collects only `test/**` — extracting the arithmetic is the only way a test
 * can reach it (#69).
 */
export function categoryBarPct(spent: number, budget: number): number {
  return budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
}
