import {parseCadence, perPaycheckFor, type plannerStartSchema} from '@runway/shared';
import type {z} from 'zod';
import {prisma} from '../lib/db';
import {syncCardBill} from './card-bill-sync';

type PlanStartInput = z.infer<typeof plannerStartSchema>;

/** Start a planner goal, pausing wishes and financing on a card (catalog §2.2). */
export async function startPlan(userId: string, body: PlanStartInput): Promise<void> {
  const today = new Date();
  await prisma.$transaction(async (tx) => {
    if (body.pausedIds.length > 0) {
      await tx.goal.updateMany({
        where: {userId, id: {in: body.pausedIds}},
        data: {paused: body.name},
      });
    }
    let financed = 0;
    let financedFrom: string | null = null;
    if (body.cardId) {
      const card = await tx.card.findFirst({where: {id: body.cardId, userId}});
      if (card) {
        // A card over its limit has no headroom to lend, not negative headroom:
        // an unclamped difference used to reach the goal as a negative `saved`.
        const headroom = Math.max(0, Math.floor(Number(card.limit) - Number(card.balance)));
        // Charge what the lever advertised — the shortfall the other levers
        // could not cover — bounded by the same two ceilings the planner used.
        financed = Math.min(headroom, Math.ceil(body.target), Math.ceil(body.financed));
        if (financed > 0) {
          financedFrom = card.name;
          // Putting a plan on a card is a card purchase and nothing more: the
          // balance rises, and syncCardBill — the single choke point — restates
          // the one "{card} payment" bill that represents it. A second,
          // free-standing financing bill would describe the same principal a
          // second time, and the runway, which sums bills without knowing they
          // are the same debt, would subtract it twice.
          // The term is recorded with the principal. Without it syncCardBill
          // cannot tell a plan from ordinary spending, and a pay-in-full card
          // would demand the whole plan on its next due day.
          await tx.card.update({
            where: {id: card.id},
            data: {
              balance: {increment: financed},
              planInstallment: {increment: Math.ceil(financed / body.months)},
              // A second plan on the same card adds its installment to the
              // monthly figure and runs for whichever term is longer, so no
              // plan is ever billed for fewer months than it was sold with.
              planMonthsLeft: Math.max(card.planMonthsLeft, body.months),
              balanceUpdatedAt: new Date(),
            },
          });
          await syncCardBill(tx, userId, card.id);
        }
      }
    }
    const due = new Date(today.getFullYear(), today.getMonth() + body.months, 1);
    // Only the part the card did not front has to come out of paychecks.
    // Dividing the whole target instead asked for money the plan had already
    // borrowed, which is how a goal could open already behind.
    //
    // Spread over the paychecks that land before that due date, not over
    // `months × 2`. The two differ whenever the term does not start on the
    // first of a month, and `goalBehind` compares the stored figure against
    // the first — so a plan begun mid-month opened flagged as behind on the
    // day it was created.
    const profile = await tx.profile.findUnique({where: {userId}});
    const per = perPaycheckFor(
      Math.max(0, body.target - financed),
      // The very string `/me/state` will serve for this goal, so the figure
      // stored beside the date cannot disagree with the one computed from it
      // on a server whose clock is not UTC.
      due.toISOString().slice(0, 10),
      // A profile that does not exist yet has no cadence to disagree with, so
      // it takes the default; one that exists has to mean something.
      parseCadence(profile?.cadence ?? 'biweekly'),
      today,
    );
    await tx.goal.create({
      data: {
        userId,
        name: body.name,
        target: body.target,
        saved: financed,
        per,
        note: due.toLocaleDateString('en-US', {month: 'short', year: 'numeric'}),
        due,
        necessity: body.kind === 'necessity',
        financed,
        financedFrom,
        // The earn lever is a commitment to bring in money that is not in the
        // budget yet. Recording it is what makes it a plan rather than a
        // click: the goal can then say what it is waiting on.
        earnMonthly: body.earn ? body.earnMonthly : 0,
      },
    });
  });
}
