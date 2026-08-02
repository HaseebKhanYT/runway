import {prisma} from '../lib/db';
import {parseIsoDateUtc} from '../lib/dates';

/** Friend loan: cash today, a "Pay back" debt bill on the runway (catalog §1.10). */
export async function recordFriendLoan(
  userId: string,
  who: string,
  amount: number,
  dueDate: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.findUniqueOrThrow({where: {userId}});
    await tx.profile.update({
      where: {userId},
      data: {primaryBalance: {increment: amount}},
    });
    await tx.txn.create({
      data: {
        userId,
        label: `Loan from ${who}`,
        amount,
        cat: 'Income',
        postedAt: new Date(),
        src: profile.primaryName,
      },
    });
    await tx.bill.create({
      data: {
        userId,
        name: `Pay back ${who}`,
        amount,
        kind: 'debt',
        dueDate: parseIsoDateUtc(dueDate),
        oneTime: true,
        personal: true,
        lender: who,
        payFrom: 'checking',
      },
    });
  });
}
