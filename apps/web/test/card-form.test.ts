import {describe, expect, it} from 'vitest';
import {cardPayload, type CardForm} from '../src/lib/card-form';

/** An edit form seeded from a saved card, as `formFromCard` leaves it. */
function editForm(partial: Partial<CardForm> = {}): CardForm {
  return {
    cardId: 'c1',
    name: 'Card A',
    aprRaw: '17.9',
    limitRaw: '3500',
    balanceRaw: '1240',
    balanceTouched: false,
    dueRaw: '21',
    minPayRaw: '160',
    payInFull: false,
    rewards: [{rate: '3%', cat: 'groceries'}],
    rewardRateRaw: '',
    rewardCatRaw: '',
    promoOn: false,
    promoAprRaw: '',
    promoMonthsRaw: '',
    ...partial,
  };
}

describe('cardPayload', () => {
  it('omits the balance key on an edit that never touched the field', () => {
    // #160: PATCH stamps balanceUpdatedAt whenever a balance arrives, so a
    // nickname-only edit used to claim the statement had just been checked.
    const payload = cardPayload(editForm({name: 'the blue one'}));
    expect('balance' in payload).toBe(false);
    expect(payload.name).toBe('the blue one');
  });

  it('sends the balance on an edit that touched the field', () => {
    const payload = cardPayload(editForm({balanceRaw: '980.50', balanceTouched: true}));
    expect(payload.balance).toBe(980.5);
  });

  it('sends the balance on creation even though nobody touched the field', () => {
    // The POST schema is not partial — balance is required there.
    const payload = cardPayload(editForm({cardId: null, balanceTouched: false}));
    expect('balance' in payload).toBe(true);
    expect(payload.balance).toBe(1240);
  });

  it('reads a cleared balance field as zero, not as untouched', () => {
    const payload = cardPayload(editForm({balanceRaw: '', balanceTouched: true}));
    expect(payload.balance).toBe(0);
  });

  it('changes nothing but the balance key between the two edit payloads', () => {
    const rest = {
      name: '  Card A  ',
      aprRaw: '0',
      limitRaw: '',
      dueRaw: '44',
      minPayRaw: '',
      payInFull: false,
      rewards: [{rate: '5%', cat: 'gas'}],
      promoOn: true,
      promoAprRaw: '',
      promoMonthsRaw: '6',
    };
    const untouched = cardPayload(editForm({...rest, balanceTouched: false}));
    const touched = cardPayload(editForm({...rest, balanceTouched: true}));

    const touchedWithoutBalance = {...touched};
    delete touchedWithoutBalance.balance;
    expect(untouched).toEqual(touchedWithoutBalance);

    // Pinned so that a future edit to any of these cannot slip through above.
    expect(untouched).toEqual({
      name: 'Card A',
      apr: 0,
      limit: 0,
      dueDay: 31,
      minPay: null,
      payInFull: false,
      rewards: [{rate: '5%', cat: 'gas'}],
      promoRate: 0,
      promoMonths: 6,
    });
  });
});
