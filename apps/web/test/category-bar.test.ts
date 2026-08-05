import {describe, expect, it} from 'vitest';
import {categoryBarPct} from '../src/lib/category-bar';

describe('categoryBarPct', () => {
  it('draws an unbudgeted category empty however much it has taken', () => {
    // #153: the panel used to fill the whole track whenever an unbudgeted
    // category had any spend, so $45 against no limit outdrew a category
    // genuinely at 80% of its own. With no denominator there is no fraction.
    expect(categoryBarPct(45, 0)).toBe(0);
    expect(categoryBarPct(0, 0)).toBe(0);
  });

  it('is the plain fraction inside the budget', () => {
    expect(categoryBarPct(150, 300)).toBe(50);
    expect(categoryBarPct(0, 300)).toBe(0);
  });

  it('clamps at a full track once the budget is blown', () => {
    // The bar cannot say how far over; the `over` colour and the figures do.
    expect(categoryBarPct(400, 300)).toBe(100);
    expect(categoryBarPct(300, 300)).toBe(100);
  });
});
