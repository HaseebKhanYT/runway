import {daysUntil, payoffProjection, type Bill, type Card} from '@runway/shared';
import {formatMoney} from './format';

/** Reward-pill palette by category keyword (catalog §4.1). */
export function rewardPillColors(cat: string): {bg: string; fg: string} {
  const c = cat.toLowerCase();
  if (/grocer|supermarket|whole foods|costco run/.test(c)) return {bg: '#e3eedd', fg: '#2e5c38'};
  if (/gas|fuel/.test(c)) return {bg: '#f4e3cf', fg: '#8a5a1e'};
  if (/restaurant|dining|food/.test(c)) return {bg: '#f6ded7', fg: '#9c4326'};
  if (/travel|miles|hotel|flight/.test(c)) return {bg: '#dce7ee', fg: '#2f5a74'};
  if (/stream|apple|amazon|online|drugstore/.test(c)) return {bg: '#e7deef', fg: '#5b4176'};
  if (/rotating|quarter|top category/.test(c)) return {bg: '#f2e8cc', fg: '#77621f'};
  return {bg: '#eee7d9', fg: '#5c5142'};
}

function monthYear(date: Date): string {
  return date.toLocaleDateString('en-US', {month: 'short', year: 'numeric'});
}

/** The five status-line variants (catalog §3.7), exact copy. */
export function cardLine(
  c: Card,
  paymentBill: Bill | undefined,
  today: Date,
): {text: string; color: string} {
  if (c.balance <= 0) {
    return {text: `Paid off — ${formatMoney(c.limit)} available`, color: '#2e7d4f'};
  }
  if (c.payInFull) {
    if (paymentBill) {
      const due = new Date(paymentBill.dueDate + 'T00:00:00');
      const dueLabel = due.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
      return {
        text: `Pays in full ${dueLabel} — ${formatMoney(c.balance)}, $0 interest`,
        color: '#2e7d4f',
      };
    }
    return {
      text: 'Pays in full — add a due day so it lands on your runway',
      color: '#c2410c',
    };
  }
  if (c.promoRate != null && c.promoEnd && daysUntil(c.promoEnd, today) >= 0) {
    const daysLeft = daysUntil(c.promoEnd, today);
    const months = Math.max(1, Math.round(daysLeft / 30));
    const end = new Date(c.promoEnd + 'T00:00:00');
    return {
      text: `⏳ ${c.promoRate}% ends ${monthYear(end)} (${months} mo) — clear ${formatMoney(c.balance)} by then or it costs ${c.apr}%`,
      color: daysLeft < 90 ? '#c2410c' : '#5c5142',
    };
  }
  if (paymentBill) {
    const projection = payoffProjection(c, paymentBill.amount);
    if (!projection) {
      return {
        text: `${formatMoney(paymentBill.amount)}/mo doesn't cover the interest — raise the payment`,
        color: '#c2410c',
      };
    }
    const clearDate = new Date(today.getFullYear(), today.getMonth() + projection.months, 1);
    return {
      text: `At ${formatMoney(paymentBill.amount)}/mo → clear by ${monthYear(clearDate)} · ≈${formatMoney(projection.interest)} interest on the way`,
      color: '#5c5142',
    };
  }
  const monthlyInterest = Math.max(1, Math.round((c.balance * c.apr) / 1200));
  return {
    text: `No due date set — Edit to add one · interest ≈ ${formatMoney(monthlyInterest)}/mo at ${c.apr}%`,
    color: '#5c5142',
  };
}

/**
 * The APR chip on a card tile: the promo rate while it is live, else the APR.
 * It carries the promo flag because the chip's border and colour key off the
 * same predicate as its text, so the predicate is evaluated here only once.
 */
export function cardAprTag(c: Card, today: Date): {text: string; promoLive: boolean} {
  const promoLive = c.promoRate != null && c.promoEnd != null && daysUntil(c.promoEnd, today) >= 0;
  return {
    text: promoLive
      ? `${c.promoRate}% until ${new Date(c.promoEnd + 'T00:00:00').toLocaleDateString('en-US', {month: 'short'})} · then ${c.apr}%`
      : `${c.apr}% APR`,
    promoLive,
  };
}
