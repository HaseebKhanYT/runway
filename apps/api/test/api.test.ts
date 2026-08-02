import type {AppState} from '@runway/shared';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {app} from '../src/app';
import {prisma} from '../src/lib/db';

process.env.DEV_AUTH_BYPASS = '1';

const USER = `test-user-${Date.now()}`;

async function call(
  method: string,
  path: string,
  body?: unknown,
): Promise<{status: number; state: AppState}> {
  const res = await app.request(path, {
    method,
    headers: {
      'x-dev-user': USER,
      ...(body !== undefined ? {'content-type': 'application/json'} : {}),
    },
    ...(body !== undefined ? {body: JSON.stringify(body)} : {}),
  });
  const json = (await res.json()) as AppState;
  return {status: res.status, state: json};
}

async function wipeUser(): Promise<void> {
  await prisma.txn.deleteMany({where: {userId: USER}});
  await prisma.bill.deleteMany({where: {userId: USER}});
  await prisma.category.deleteMany({where: {userId: USER}});
  await prisma.goal.deleteMany({where: {userId: USER}});
  await prisma.card.deleteMany({where: {userId: USER}});
  await prisma.account.deleteMany({where: {userId: USER}});
  await prisma.profile.deleteMany({where: {userId: USER}});
}

beforeAll(async () => {
  await wipeUser();
});

afterAll(async () => {
  await wipeUser();
  await prisma.$disconnect();
});

describe('test environment', () => {
  it('runs under UTC', () => {
    // Tripwire, matching test/unit/dates.test.ts. Bill and cycle dates are
    // written from local date parts, so a zone other than UTC changes what
    // these expectations mean; vitest.integration.config.ts pins TZ=UTC.
    expect(new Date().getTimezoneOffset()).toBe(0);
  });
});

describe('auth', () => {
  it('rejects without credentials', async () => {
    const res = await app.request('/me/state');
    expect(res.status).toBe(401);
  });
});

describe('state bootstrap', () => {
  it('creates an un-onboarded profile on first hit', async () => {
    const {status, state} = await call('GET', '/me/state');
    expect(status).toBe(200);
    expect(state.profile.onboarded).toBe(false);
    expect(state.bills).toEqual([]);
  });
});

describe('reset-demo', () => {
  it('loads the demo dataset', async () => {
    const {state} = await call('POST', '/reset-demo');
    expect(state.profile.primaryBalance).toBe(6000);
    expect(state.bills).toHaveLength(7);
    expect(state.cats).toHaveLength(6);
    expect(state.txns).toHaveLength(14);
    expect(state.goals).toHaveLength(2);
    expect(state.cards).toHaveLength(2);
    expect(state.profile.onboarded).toBe(true);
    const cardBill = state.bills.find((b) => b.cardId);
    expect(cardBill?.name).toBe('Card A payment');
  });
});

describe('bill pay flows', () => {
  it('pays from checking: debits balance, creates linked txn', async () => {
    const {state: before} = await call('GET', '/me/state');
    const rent = before.bills.find((b) => b.name === 'Rent');
    expect(rent).toBeDefined();
    const {state} = await call('POST', `/bills/${rent?.id}/pay`, {source: 'checking'});
    expect(state.profile.primaryBalance).toBe(5050);
    const bill = state.bills.find((b) => b.id === rent?.id);
    expect(bill?.paid).toBe(true);
    expect(bill?.payFrom).toBe('checking');
    const txn = state.txns.find((t) => t.billId === rent?.id);
    expect(txn?.amount).toBe(-950);
    expect(txn?.cat).toBe('Bills');
  });

  it('unpay reverses everything', async () => {
    const {state: before} = await call('GET', '/me/state');
    const rent = before.bills.find((b) => b.name === 'Rent');
    const {state} = await call('POST', `/bills/${rent?.id}/unpay`);
    expect(state.profile.primaryBalance).toBe(6000);
    expect(state.bills.find((b) => b.id === rent?.id)?.paid).toBe(false);
    expect(state.txns.find((t) => t.billId === rent?.id)).toBeUndefined();
  });

  it('paying a card-payment bill reduces the card balance', async () => {
    const {state: before} = await call('GET', '/me/state');
    const cardBill = before.bills.find((b) => b.cardId);
    const card = before.cards.find((c) => c.id === cardBill?.cardId);
    expect(card?.balance).toBe(1240);
    const {state} = await call('POST', `/bills/${cardBill?.id}/pay`, {source: 'checking'});
    expect(state.cards.find((c) => c.id === card?.id)?.balance).toBe(1080);
    expect(state.profile.primaryBalance).toBe(5840);
    await call('POST', `/bills/${cardBill?.id}/unpay`);
  });

  it('paying a bill WITH a card charges the card and leaves cash alone', async () => {
    const {state: before} = await call('GET', '/me/state');
    const electric = before.bills.find((b) => b.name === 'Electric');
    const cardB = before.cards.find((c) => c.name === 'Card B');
    const {state} = await call('POST', `/bills/${electric?.id}/pay`, {source: cardB?.id});
    expect(state.profile.primaryBalance).toBe(6000);
    expect(state.cards.find((c) => c.id === cardB?.id)?.balance).toBe(724);
    await call('POST', `/bills/${electric?.id}/unpay`);
  });
});

describe('expenses', () => {
  it('expense from checking updates category spent and balance', async () => {
    const {state} = await call('POST', '/expenses', {
      kind: 'expense',
      amount: 25,
      category: 'Eating out',
      source: 'checking',
      note: 'Tacos',
    });
    expect(state.profile.primaryBalance).toBe(5975);
    expect(state.cats.find((c) => c.name === 'Eating out')?.spent).toBe(121.5);
    expect(state.txns[0]?.label).toBe('Tacos');
  });

  it('expense on a card leaves cash untouched', async () => {
    const {state: before} = await call('GET', '/me/state');
    const cardB = before.cards.find((c) => c.name === 'Card B');
    const {state} = await call('POST', '/expenses', {
      kind: 'expense',
      amount: 40,
      category: 'Fun',
      source: cardB?.id,
    });
    expect(state.profile.primaryBalance).toBe(5975);
    expect(state.cards.find((c) => c.id === cardB?.id)?.balance).toBe(690);
  });

  it('income routed to a goal sets aside immediately', async () => {
    const {state: before} = await call('GET', '/me/state');
    const japan = before.goals.find((g) => g.name === 'Japan trip');
    const {state} = await call('POST', '/expenses', {
      kind: 'income',
      amount: 100,
      incomeKind: 'Side gig',
      goalId: japan?.id,
    });
    expect(state.goals.find((g) => g.id === japan?.id)?.saved).toBe(960);
    expect(state.profile.primaryBalance).toBe(5975);
    expect(state.txns[0]?.label).toBe(`Set aside → Japan trip`);
  });
});

describe('payday', () => {
  it('funds goals first, resets bills, advances nextPay', async () => {
    await call('POST', '/reset-demo');
    const {state: before} = await call('GET', '/me/state');
    const rent = before.bills.find((b) => b.name === 'Rent');
    await call('POST', `/bills/${rent?.id}/pay`, {source: 'checking'});
    const nextPayBefore = before.profile.nextPay;

    const {state} = await call('POST', '/payday/confirm', {amount: 1700});
    // 6000 - 950 (rent) + 1700 (paycheck) - goal set-asides
    const japan = state.goals.find((g) => g.name === 'Japan trip');
    const efund = state.goals.find((g) => g.name === 'Emergency fund');
    expect(japan?.saved).toBeGreaterThan(860);
    expect(efund?.saved).toBe(440);
    expect(state.bills.every((b) => !b.paid)).toBe(true);
    expect(state.profile.nextPay).not.toBe(nextPayBefore);
    const paycheck = state.txns.find((t) => t.label === 'Paycheck' && t.off === 0);
    expect(paycheck?.amount).toBe(1700);
  });
});

describe('loans and crunch', () => {
  it('loan credits balance and creates a one-time debt bill', async () => {
    await call('POST', '/reset-demo');
    const due = new Date();
    due.setDate(due.getDate() + 20);
    const dueIso = due.toISOString().slice(0, 10);
    const {state} = await call('POST', '/loans', {who: 'Maya', amount: 300, dueDate: dueIso});
    expect(state.profile.primaryBalance).toBe(6300);
    const bill = state.bills.find((b) => b.name === 'Pay back Maya');
    expect(bill?.kind).toBe('debt');
    expect(bill?.oneTime).toBe(true);
    expect(bill?.personal).toBe(true);
    expect(state.txns[0]?.label).toBe('Loan from Maya');
  });

  it('crunch lock pauses goals and advances cash from a card', async () => {
    await call('POST', '/reset-demo');
    const {state: before} = await call('GET', '/me/state');
    const japan = before.goals.find((g) => g.name === 'Japan trip');
    const cardB = before.cards.find((c) => c.name === 'Card B');
    const {state} = await call('POST', '/crunch/lock', {
      pausedGoalIds: [japan?.id],
      cardId: cardB?.id,
      advance: 300,
    });
    expect(state.goals.find((g) => g.id === japan?.id)?.paused).toBe('__crunch');
    expect(state.profile.primaryBalance).toBe(6300);
    expect(state.cards.find((c) => c.id === cardB?.id)?.balance).toBe(950);
    expect(state.txns[0]?.label).toBe('Advance from Card B');

    // Payday lifts the crunch pause.
    const {state: after} = await call('POST', '/payday/confirm', {amount: 1700});
    expect(after.goals.find((g) => g.id === japan?.id)?.paused).toBeNull();
  });
});

describe('cards', () => {
  it('pay-in-full card keeps its bill pinned to the live balance', async () => {
    await call('POST', '/reset-demo');
    const {state: withCard} = await call('POST', '/cards', {
      name: 'Apple Card',
      apr: 26.9,
      limit: 5000,
      balance: 200,
      dueDay: 15,
      payInFull: true,
      rewards: [],
    });
    const apple = withCard.cards.find((c) => c.name === 'Apple Card');
    expect(apple?.rewards.length).toBeGreaterThan(0); // suggested from name
    let bill = withCard.bills.find((b) => b.cardId === apple?.id);
    expect(bill?.amount).toBe(200);

    const {state: afterSpend} = await call('POST', '/expenses', {
      kind: 'expense',
      amount: 50,
      category: 'Fun',
      source: apple?.id,
    });
    bill = afterSpend.bills.find((b) => b.cardId === apple?.id);
    expect(bill?.amount).toBe(250);
  });

  it('log payment reduces card balance and cash', async () => {
    const {state: before} = await call('GET', '/me/state');
    const apple = before.cards.find((c) => c.name === 'Apple Card');
    const cash = before.profile.primaryBalance;
    const {state} = await call('POST', `/cards/${apple?.id}/log-payment`, {
      amount: 100,
      source: 'checking',
    });
    expect(state.cards.find((c) => c.id === apple?.id)?.balance).toBe(150);
    expect(state.profile.primaryBalance).toBe(cash - 100);
  });
});

describe('transactions trash', () => {
  it('soft delete, restore, purge', async () => {
    await call('POST', '/reset-demo');
    const {state: before} = await call('GET', '/me/state');
    const coffee = before.txns.find((t) => t.label === 'Coffee');
    const {state: deleted} = await call('DELETE', `/transactions/${coffee?.id}`);
    expect(deleted.txns.find((t) => t.id === coffee?.id)).toBeUndefined();
    expect(deleted.deletedTxns.find((t) => t.id === coffee?.id)).toBeDefined();
    // record only — balance untouched
    expect(deleted.profile.primaryBalance).toBe(6000);

    const {state: restored} = await call('POST', `/transactions/${coffee?.id}/restore`);
    expect(restored.txns.find((t) => t.id === coffee?.id)).toBeDefined();

    await call('DELETE', `/transactions/${coffee?.id}`);
    const {state: purged} = await call('DELETE', `/transactions/${coffee?.id}/purge`);
    expect(purged.deletedTxns.find((t) => t.id === coffee?.id)).toBeUndefined();
  });

  it('recategorize moves spent between categories', async () => {
    await call('POST', '/reset-demo');
    const {state: before} = await call('GET', '/me/state');
    const coffee = before.txns.find((t) => t.label === 'Coffee');
    const {state} = await call('PATCH', `/transactions/${coffee?.id}/category`, {
      category: 'Fun',
    });
    expect(state.cats.find((c) => c.name === 'Eating out')?.spent).toBe(92);
    expect(state.cats.find((c) => c.name === 'Fun')?.spent).toBe(39.5);
    expect(state.txns.find((t) => t.id === coffee?.id)?.cat).toBe('Fun');
  });
});

describe('goals crud rules', () => {
  it('deleting a goal returns saved to balance', async () => {
    await call('POST', '/reset-demo');
    const {state: before} = await call('GET', '/me/state');
    const japan = before.goals.find((g) => g.name === 'Japan trip');
    const {state} = await call('DELETE', `/goals/${japan?.id}`);
    expect(state.profile.primaryBalance).toBe(6860);
    expect(state.txns[0]?.label).toBe('Returned from Japan trip');
  });
});

describe('categories rules', () => {
  it('locked category cannot be deleted', async () => {
    const {state} = await call('GET', '/me/state');
    const unc = state.cats.find((c) => c.locked);
    const res = await app.request(`/categories/${unc?.id}`, {
      method: 'DELETE',
      headers: {'x-dev-user': USER},
    });
    expect(res.status).toBe(400);
  });
});

describe('onboarding', () => {
  it('replaces data and stamps onboarded', async () => {
    const nextPay = new Date();
    nextPay.setDate(nextPay.getDate() + 7);
    const {state} = await call('POST', '/onboarding/complete', {
      balance: 2500,
      pay: 2000,
      cadence: 'biweekly',
      nextPay: nextPay.toISOString().slice(0, 10),
      bills: [{name: 'Rent', amount: 1200, dueDay: 1, kind: 'survival'}],
      cards: [{name: 'Card X', balance: 300, limit: 1500, apr: 19.9}],
      cats: [
        {name: 'Groceries', budget: 300},
        {name: 'Eating out', budget: 120},
      ],
    });
    expect(state.profile.onboarded).toBe(true);
    expect(state.profile.primaryBalance).toBe(2500);
    expect(state.bills).toHaveLength(1);
    expect(state.cards).toHaveLength(1);
    // 2 picked + locked Uncategorized
    expect(state.cats).toHaveLength(3);
    expect(state.txns).toHaveLength(0);
    expect(state.goals).toHaveLength(0);
  });
});

describe('planner', () => {
  it('a card over its limit finances nothing and funds no goal', async () => {
    await call('POST', '/reset-demo');
    const {state: withCard} = await call('POST', '/cards', {
      name: 'Maxed',
      apr: 22,
      limit: 1000,
      balance: 1500,
      dueDay: 12,
    });
    const maxed = withCard.cards.find((c) => c.name === 'Maxed');
    expect(maxed?.balance).toBe(1500);

    const {state} = await call('POST', '/planner/start', {
      name: 'Roof repair',
      target: 3000,
      months: 6,
      kind: 'necessity',
      pausedIds: [],
      cardId: maxed?.id,
    });

    const goal = state.goals.find((g) => g.name === 'Roof repair');
    // Headroom is -500. Clamped to 0, so nothing is financed and no card is
    // credited with funding the goal.
    expect(goal?.financed).toBe(0);
    expect(goal?.saved).toBe(0);
    expect(goal?.financedFrom).toBeNull();
    expect(state.cards.find((c) => c.id === maxed?.id)?.balance).toBe(1500);
  });

  it('charges the card the advertised shortfall, not the whole target', async () => {
    await call('POST', '/reset-demo');
    const {state: withCard} = await call('POST', '/cards', {
      name: 'Roomy',
      apr: 24.99,
      limit: 10000,
      balance: 0,
      dueDay: 11,
    });
    const roomy = withCard.cards.find((c) => c.name === 'Roomy');

    const {state} = await call('POST', '/planner/start', {
      name: 'Hospital bill',
      target: 8000,
      months: 12,
      kind: 'necessity',
      pausedIds: [],
      cardId: roomy?.id,
      financed: 2153,
    });

    // The lever said $2,153. The card is charged $2,153 — the remaining
    // $5,847 of the target stays a paycheck set-aside.
    expect(state.cards.find((c) => c.id === roomy?.id)?.balance).toBe(2153);
    const goal = state.goals.find((g) => g.name === 'Hospital bill');
    expect(goal?.financed).toBe(2153);
    expect(goal?.saved).toBe(2153);
    expect(goal?.financedFrom).toBe('Roomy');
  });

  it('never finances more than the headroom the card actually has', async () => {
    await call('POST', '/reset-demo');
    const {state: withCard} = await call('POST', '/cards', {
      name: 'Tight',
      apr: 19.9,
      limit: 1000,
      balance: 400,
      dueDay: 9,
    });
    const tight = withCard.cards.find((c) => c.name === 'Tight');

    const {state} = await call('POST', '/planner/start', {
      name: 'Overreach',
      target: 5000,
      months: 10,
      kind: 'necessity',
      pausedIds: [],
      cardId: tight?.id,
      // A client asking for more than the card can lend is still bounded.
      financed: 5000,
    });

    expect(state.cards.find((c) => c.id === tight?.id)?.balance).toBe(1000);
    expect(state.goals.find((g) => g.name === 'Overreach')?.financed).toBe(600);
  });

  it('records the financed principal once, on the card that funded it', async () => {
    await call('POST', '/reset-demo');
    const {state: withCard} = await call('POST', '/cards', {
      name: 'Single',
      apr: 24.99,
      limit: 10000,
      balance: 0,
      dueDay: 11,
    });
    const single = withCard.cards.find((c) => c.name === 'Single');

    const {state} = await call('POST', '/planner/start', {
      name: 'Hospital bill',
      target: 8000,
      months: 12,
      kind: 'necessity',
      pausedIds: [],
      cardId: single?.id,
      financed: 6000,
    });

    expect(state.cards.find((c) => c.id === single?.id)?.balance).toBe(6000);
    // One debt, one obligation. There is no free-standing "<plan> financing"
    // bill beside the card's own payment bill describing the same principal.
    expect(state.bills.filter((b) => b.name.includes('financing'))).toEqual([]);
    expect(state.bills.filter((b) => b.cardId === single?.id)).toHaveLength(1);
  });

  it('paying a financed plan reduces the balance on the card that funded it', async () => {
    await call('POST', '/reset-demo');
    const {state: withCard} = await call('POST', '/cards', {
      name: 'Repayable',
      apr: 24.99,
      limit: 10000,
      balance: 0,
      dueDay: 11,
    });
    const repayable = withCard.cards.find((c) => c.name === 'Repayable');

    const {state: locked} = await call('POST', '/planner/start', {
      name: 'Boiler',
      target: 6000,
      months: 12,
      kind: 'necessity',
      pausedIds: [],
      cardId: repayable?.id,
      financed: 6000,
    });
    const before = locked.cards.find((c) => c.id === repayable?.id);
    const bill = locked.bills.find((b) => b.cardId === repayable?.id);
    expect(bill).toBeDefined();
    // The plan owns no bill of its own. Anything it put on the runway is the
    // card's payment bill, so there is no debt bill whose payment clears
    // nothing for want of a cardId.
    expect(locked.bills.filter((b) => b.name.startsWith('Boiler'))).toEqual([]);
    expect(locked.bills.filter((b) => b.kind === 'debt' && b.cardId == null)).toEqual([]);

    const {state: after} = await call('POST', `/bills/${bill?.id}/pay`, {source: 'checking'});
    // Every dollar of the installment lands on the principal, because the only
    // bill describing the plan is the card's own — it carries a cardId.
    expect(after.cards.find((c) => c.id === repayable?.id)?.balance).toBe(
      (before?.balance ?? 0) - (bill?.amount ?? 0),
    );
  });
});

describe('plaid stubs', () => {
  it('reserved endpoints return 501', async () => {
    const res = await app.request('/plaid/link-token', {
      method: 'POST',
      headers: {'x-dev-user': USER},
    });
    expect(res.status).toBe(501);
  });
});
