import {goalPerPaycheck, type Cadence} from '@runway/shared';
import {prisma} from '../lib/db';
import {advanceCycle, parseIsoDateUtc} from '../lib/dates';
import {syncCardBill} from './card-bill-sync';

/** Payday: goals fund first, one-time bills drop, the cycle resets (catalog §2.2). */
export async function confirmPayday(userId: string, amount: number): Promise<void> {
  const today = new Date();
  await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.findUniqueOrThrow({where: {userId}});
    await tx.profile.update({
      where: {userId},
      data: {primaryBalance: {increment: amount}},
    });
    await tx.txn.create({
      data: {
        userId,
        label: 'Paycheck',
        amount,
        cat: 'Income',
        postedAt: today,
        src: profile.primaryName,
      },
    });

    // Goals get funded before anything else, in order, clamped to cash on hand.
    let balance =
      Number(profile.primaryBalance) +
      amount +
      (await tx.account.findMany({where: {userId}})).reduce((s, a) => s + Number(a.balance), 0);
    const goals = await tx.goal.findMany({where: {userId}, orderBy: {name: 'asc'}});
    for (const g of goals) {
      if (g.paused) continue;
      const target = Number(g.target);
      const saved = Number(g.saved);
      if (saved >= target) continue;
      const per = goalPerPaycheck(
        {
          id: g.id,
          name: g.name,
          target,
          saved,
          per: Number(g.per),
          note: g.note,
          due: g.due ? g.due.toISOString().slice(0, 10) : null,
          necessity: g.necessity,
          paused: g.paused,
          behind: g.behind,
          financed: Number(g.financed),
          financedFrom: g.financedFrom,
        },
        profile.cadence as Cadence,
        today,
      );
      const put = Math.min(per, target - saved, Math.max(0, balance));
      if (put <= 0) continue;
      balance -= put;
      await tx.profile.update({
        where: {userId},
        data: {primaryBalance: {decrement: put}},
      });
      await tx.goal.update({where: {id: g.id}, data: {saved: {increment: put}}});
      await tx.txn.create({
        data: {
          userId,
          label: `Set aside → ${g.name}`,
          amount: -put,
          cat: 'Goals',
          postedAt: today,
          src: profile.primaryName,
        },
      });
    }

    // Crunch pauses lift automatically at payday.
    await tx.goal.updateMany({
      where: {userId, paused: '__crunch'},
      data: {paused: null},
    });

    // One-time (loan/personal) bills that were paid drop; everything else resets.
    await tx.bill.deleteMany({where: {userId, oneTime: true, paid: true}});
    await tx.bill.updateMany({where: {userId}, data: {paid: false}});

    if (profile.nextPay) {
      const iso = profile.nextPay.toISOString().slice(0, 10);
      await tx.profile.update({
        where: {userId},
        data: {nextPay: parseIsoDateUtc(advanceCycle(iso, profile.cadence))},
      });
    }
    const cards = await tx.card.findMany({where: {userId}});
    for (const card of cards) await syncCardBill(tx, userId, card.id);
  });
}
