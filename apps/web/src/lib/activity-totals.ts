import type {Txn} from '@runway/shared';

/**
 * How many days the Activity headline tiles cover. The caption the tiles print
 * is built from this constant and so is the filter below, so the words and the
 * arithmetic cannot drift apart the way they have since the page was written
 * (#144): the tiles said "last 14 days" while summing every transaction on the
 * account, which was only ever true of the demo fixture.
 */
export const ACTIVITY_WINDOW_DAYS = 14;

export interface ActivityTotals {
  /** Sum of the positive amounts in the window. */
  moneyIn: number;
  /** Sum of the negative amounts, as a positive number. */
  moneyOut: number;
  /** `moneyIn − moneyOut`. */
  net: number;
}

/**
 * Total the transactions inside the last `days` days, today included — for 14
 * days that is offsets −13 through 0.
 *
 * The filter reads `Txn.off`, the day offset the server derives against local
 * midnights, rather than re-deriving one from `postedAt`: it is the day frame
 * every other surface here already groups and labels by, so a row can never
 * fall in one place and out of the other.
 *
 * The upper bound looks redundant — no app path writes a `postedAt` in the
 * future — but a window captioned "last 14 days" must not be inflated by a
 * backdated import or a clock-skewed row, and neither is under our control.
 */
export function windowTotals(txns: Txn[], days: number = ACTIVITY_WINDOW_DAYS): ActivityTotals {
  const inWindow = txns.filter((t) => t.off <= 0 && t.off > -days);
  const moneyIn = inWindow.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const moneyOut = inWindow.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  return {moneyIn, moneyOut, net: moneyIn - moneyOut};
}
