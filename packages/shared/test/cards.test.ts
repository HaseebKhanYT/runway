import {describe, expect, it} from 'vitest';
import {effectiveApr, minPaymentGuess, payoffProjection, suggestRewards} from '../src/cards';
import type {Card} from '../src/types';

const TODAY = new Date('2026-07-16T12:00:00');

function makeCard(partial: Partial<Card>): Card {
  return {
    id: 'c1',
    name: 'Card A',
    apr: 17.9,
    limit: 3500,
    balance: 1240,
    dueDay: null,
    minPay: null,
    payInFull: false,
    rewards: [],
    promoRate: null,
    promoEnd: null,
    balanceUpdatedAt: '2026-07-16T00:00:00.000Z',
    ...partial,
  };
}

describe('effectiveApr', () => {
  it('uses promo rate while the promo is live', () => {
    expect(effectiveApr(makeCard({promoRate: 0, promoEnd: '2026-12-03'}), TODAY)).toBe(0);
  });
  it('falls back to real APR when promo expired or absent', () => {
    expect(effectiveApr(makeCard({promoRate: 0, promoEnd: '2026-07-01'}), TODAY)).toBe(17.9);
    expect(effectiveApr(makeCard({}), TODAY)).toBe(17.9);
  });
});

describe('payoffProjection', () => {
  it('computes months and interest for a covering payment', () => {
    const p = payoffProjection(makeCard({}), 160);
    // r=17.9/1200; months = ceil(-ln(1-r*1240/160)/ln(1+r)) = 9
    expect(p).toEqual({months: 9, interest: Math.max(0, Math.round(160 * 9 - 1240))});
  });
  it('returns null when the payment cannot cover interest', () => {
    expect(payoffProjection(makeCard({}), 5)).toBeNull();
  });
});

describe('minPaymentGuess', () => {
  it('is 3% with a $25 floor', () => {
    expect(minPaymentGuess(1240)).toBe(38);
    expect(minPaymentGuess(100)).toBe(25);
  });
});

describe('suggestRewards', () => {
  it('matches known card names', () => {
    expect(suggestRewards('Amex Gold')).toEqual([
      {rate: '4x', cat: 'restaurants'},
      {rate: '4x', cat: 'groceries'},
      {rate: '3x', cat: 'flights'},
    ]);
    expect(suggestRewards('Chase Freedom Unlimited')).toEqual([
      {rate: '1.5%', cat: 'everything else'},
      {rate: '3%', cat: 'dining'},
      {rate: '3%', cat: 'drugstores'},
    ]);
    expect(suggestRewards('Some Credit Union Card')).toEqual([]);
  });
});
