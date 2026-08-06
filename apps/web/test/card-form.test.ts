import {describe, expect, it} from 'vitest';
import {
  cardFormIncomplete,
  cardFormProblems,
  cardPayload,
  type CardForm,
} from '../src/lib/card-form';

function makeForm(partial: Partial<CardForm>): CardForm {
  return {
    cardId: null,
    name: 'Card A',
    aprRaw: '17.9',
    limitRaw: '3500',
    balanceRaw: '1240',
    dueRaw: '21',
    minPayRaw: '160',
    payInFull: false,
    rewards: [],
    rewardRateRaw: '',
    rewardCatRaw: '',
    promoOn: false,
    promoAprRaw: '',
    promoMonthsRaw: '',
    ...partial,
  };
}

/** The form the page opens with — every box untouched. */
function blankForm(): CardForm {
  return makeForm({
    name: '',
    aprRaw: '',
    limitRaw: '',
    balanceRaw: '',
    dueRaw: '',
    minPayRaw: '',
  });
}

describe('cardPayload', () => {
  it('builds the body the API expects', () => {
    const form = makeForm({
      name: '  Card A  ',
      rewards: [{rate: '3%', cat: 'groceries'}],
      promoOn: true,
      promoAprRaw: '0',
      promoMonthsRaw: '6',
    });
    expect(cardPayload(form)).toEqual({
      name: 'Card A',
      apr: 17.9,
      limit: 3500,
      balance: 1240,
      dueDay: 21,
      minPay: 160,
      payInFull: false,
      rewards: [{rate: '3%', cat: 'groceries'}],
      promoRate: 0,
      promoMonths: 6,
    });
  });

  it('drops the promo when the toggle is off', () => {
    const payload = cardPayload(makeForm({promoOn: false, promoAprRaw: '0', promoMonthsRaw: '6'}));
    expect(payload).toMatchObject({promoRate: null, promoMonths: null});
  });

  it('clamps the due day into the month', () => {
    expect(cardPayload(makeForm({dueRaw: '45'}))).toMatchObject({dueDay: 31});
    expect(cardPayload(makeForm({dueRaw: '0'}))).toMatchObject({dueDay: 1});
    expect(cardPayload(makeForm({dueRaw: ''}))).toMatchObject({dueDay: null});
  });

  it('pays in full with no payment of its own', () => {
    expect(cardPayload(makeForm({payInFull: true, minPayRaw: '160'}))).toMatchObject({
      minPay: null,
      payInFull: true,
    });
  });
});

describe('cardFormIncomplete', () => {
  it('is true until there is a nickname and a limit', () => {
    expect(cardFormIncomplete(blankForm())).toBe(true);
    expect(cardFormIncomplete(makeForm({name: '   '}))).toBe(true);
    expect(cardFormIncomplete(makeForm({limitRaw: ''}))).toBe(true);
    expect(cardFormIncomplete(makeForm({limitRaw: '0'}))).toBe(true);
    expect(cardFormIncomplete(makeForm({limitRaw: '.'}))).toBe(true);
    expect(cardFormIncomplete(makeForm({}))).toBe(false);
  });
});

describe('cardFormProblems', () => {
  it('says nothing about a card that saves', () => {
    expect(cardFormProblems(makeForm({}))).toEqual({});
  });

  it('says nothing about a form that is merely unfinished', () => {
    expect(cardFormProblems(blankForm())).toEqual({});
    expect(cardFormIncomplete(blankForm())).toBe(true);
  });

  it('refuses a zero monthly payment', () => {
    const problems = cardFormProblems(makeForm({minPayRaw: '0'}));
    expect(problems.minPay).toBe(
      '$0 isn’t a payment — leave it blank and we’ll pencil in a minimum.',
    );
    expect(Object.keys(problems)).toEqual(['minPay']);
  });

  it('refuses a monthly payment that is not a number', () => {
    // `JSON.stringify` turns this NaN into `null`, so the server answers 200
    // and the card silently loses its payment. The check has to run here.
    const problems = cardFormProblems(makeForm({minPayRaw: '.'}));
    expect(problems.minPay).toBe(
      '$0 isn’t a payment — leave it blank and we’ll pencil in a minimum.',
    );
  });

  it('leaves the payment alone when the card pays in full', () => {
    const problems = cardFormProblems(makeForm({payInFull: true, minPayRaw: '.'}));
    expect(problems).toEqual({});
  });

  it('refuses an APR past 99', () => {
    const problems = cardFormProblems(makeForm({aprRaw: '129'}));
    expect(problems.apr).toBe('APR runs from 0 to 99%.');
    expect(Object.keys(problems)).toEqual(['apr']);
  });

  it('refuses a promo APR past 99', () => {
    const problems = cardFormProblems(
      makeForm({promoOn: true, promoAprRaw: '129', promoMonthsRaw: '6'}),
    );
    expect(problems.promoRate).toBe('A promo APR runs from 0 to 99%.');
    expect(Object.keys(problems)).toEqual(['promoRate']);
  });

  it('refuses a promo longer than five years', () => {
    const problems = cardFormProblems(
      makeForm({promoOn: true, promoAprRaw: '0', promoMonthsRaw: '72'}),
    );
    expect(problems.promoMonths).toBe('A promo runs 1 to 60 months.');
    expect(Object.keys(problems)).toEqual(['promoMonths']);
  });

  it('refuses a nickname past 120 characters', () => {
    const problems = cardFormProblems(makeForm({name: 'x'.repeat(121)}));
    expect(problems.name).toBe('Nicknames stop at 120 characters.');
    expect(Object.keys(problems)).toEqual(['name']);
  });

  it('reports every refusal at once', () => {
    const problems = cardFormProblems(
      makeForm({
        aprRaw: '129',
        minPayRaw: '0',
        promoOn: true,
        promoAprRaw: '0',
        promoMonthsRaw: '72',
      }),
    );
    expect(Object.keys(problems).sort()).toEqual(['apr', 'minPay', 'promoMonths']);
  });

  it('still refuses bounds while the form is unfinished', () => {
    const problems = cardFormProblems(makeForm({name: '', limitRaw: '', aprRaw: '129'}));
    expect(problems).toEqual({apr: 'APR runs from 0 to 99%.'});
  });

  it('blocks an issue it has no copy for rather than letting it through', () => {
    const problems = cardFormProblems(
      makeForm({rewards: [{rate: '3% forever and ever', cat: 'gas'}]}),
    );
    expect(problems.form).toBe('Something in here is outside what we can save.');
  });
});
