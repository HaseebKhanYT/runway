import type {ViewModel} from './view-model';

/**
 * A string that changes exactly when the money picture changes (#88).
 *
 * The trigger is deliberately narrower than `AppState` identity. Every mutating
 * endpoint returns a fresh state, so keying on the state would announce a
 * category rename — which moves no money — as loudly as a paid bill. These four
 * fields are the whole of what the shell says out loud plus the two figures
 * behind it: the per-day pace, the pooled balance, what is safe before payday
 * and what the goals hold back.
 *
 * It is also deliberately wider than the headline figure. A $200 expense
 * against a $6,000 balance leaves `effectivePerDay` pinned to its sustainable
 * term, so `perDayF` does not move at all — the balance is the only field that
 * records it. Signing on `perDayF` alone would go silent in the reporter's own
 * reproduction.
 */
export function moneySignature(vm: ViewModel): string {
  return [vm.perDayF, vm.balanceF, vm.runway.safe, vm.runway.setAside].join('|');
}

/**
 * What a screen reader hears once the money settles.
 *
 * The message restates the figure whether or not it moved. Gating it on the
 * figure changing would be the same mistake as signing on `perDayF`: the
 * frequent case is money moving while the pace holds, and "your pace is
 * unchanged" is exactly the confirmation a sighted user gets for free by
 * watching the number stay put.
 */
export function safeToSpendAnnouncement(vm: ViewModel): string {
  return `${vm.perDayF} a day safe to spend — ${vm.perDaySub}`;
}
