import type {Bill} from '@runway/shared';

/** What an empty surface is for, and the label of the action that fills it. */
export interface EmptyState {
  line: string;
  cta: string;
}

/**
 * The sentence for a runway with no bill on it. The caller has already decided
 * the runway is empty; this only picks which explanation is true of the bills
 * that exist. It deliberately does not re-derive which bills reach the runway —
 * `timelineBills` owns that rule, and a second copy of the filter here would be
 * free to drift from it.
 *
 * The third branch exists because the first two would both be lies: unpaid
 * bills exist, and they are all overdue, so neither "no bills yet" nor
 * "everything is paid" describes the screen.
 */
export function railEmptyState(bills: Bill[]): EmptyState {
  if (bills.length === 0) {
    return {
      line: 'No bills yet — the ones you add appear here with the day they are due.',
      cta: 'Add a bill',
    };
  }
  if (bills.every((b) => b.paid)) {
    return {
      line: 'Every bill is paid — your runway is clear until payday.',
      cta: 'See your bills',
    };
  }
  return {
    line: 'No unpaid bill falls between today and payday.',
    cta: 'See your bills',
  };
}

/**
 * The dashboard activity panel filters nothing, so an empty list has exactly
 * one meaning and needs no branching.
 */
export const ACTIVITY_EMPTY: EmptyState = {
  line: 'Spending and income show up here as you log them.',
  cta: 'Add expense',
};
