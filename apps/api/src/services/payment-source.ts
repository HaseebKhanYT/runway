import type {PrismaTx} from '../lib/db';

export interface ResolvedSource {
  kind: 'checking' | 'account' | 'card';
  id: string | null;
  /** Display name for transaction rows. */
  label: string;
}

/** Resolve a payment source id: 'checking' | account id | card id. */
export async function resolveSource(
  db: PrismaTx,
  userId: string,
  source: string,
): Promise<ResolvedSource> {
  if (source === 'checking') {
    const profile = await db.profile.findUniqueOrThrow({where: {userId}});
    return {kind: 'checking', id: null, label: profile.primaryName};
  }
  const account = await db.account.findFirst({where: {id: source, userId}});
  if (account) return {kind: 'account', id: account.id, label: account.name};
  const card = await db.card.findFirst({where: {id: source, userId}});
  if (card) return {kind: 'card', id: card.id, label: card.name};
  const profile = await db.profile.findUniqueOrThrow({where: {userId}});
  return {kind: 'checking', id: null, label: profile.primaryName};
}

/**
 * Move cash out of a non-card source (negative delta) or into it (positive).
 * Card sources are handled by callers since they charge the card instead.
 */
export async function adjustCashSource(
  db: PrismaTx,
  userId: string,
  source: ResolvedSource,
  delta: number,
): Promise<void> {
  if (source.kind === 'account' && source.id) {
    await db.account.update({where: {id: source.id}, data: {balance: {increment: delta}}});
  } else {
    await db.profile.update({
      where: {userId},
      data: {primaryBalance: {increment: delta}},
    });
  }
}
