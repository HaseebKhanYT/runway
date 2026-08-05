import type {CardReward} from '@runway/shared';

export interface CardForm {
  cardId: string | null;
  name: string;
  aprRaw: string;
  limitRaw: string;
  balanceRaw: string;
  balanceTouched: boolean;
  dueRaw: string;
  minPayRaw: string;
  payInFull: boolean;
  rewards: CardReward[];
  rewardRateRaw: string;
  rewardCatRaw: string;
  promoOn: boolean;
  promoAprRaw: string;
  promoMonthsRaw: string;
}

export interface CardPayload {
  name: string;
  apr: number;
  limit: number;
  balance?: number;
  dueDay: number | null;
  minPay: number | null;
  payInFull: boolean;
  rewards: CardReward[];
  promoRate: number | null;
  promoMonths: number | null;
}

/** Request body for `POST /cards` and `PATCH /cards/:id`. */
export function cardPayload(form: CardForm): CardPayload {
  return {
    name: form.name.trim(),
    apr: parseFloat(form.aprRaw) || 0,
    limit: parseFloat(form.limitRaw) || 0,
    // An edit leaves the balance key off entirely unless the user typed in that
    // field. `apps/api/src/routes/cards.ts:54` refreshes `balanceUpdatedAt` only
    // when a balance is actually supplied, and sending the key unconditionally
    // meant the guard could never fire: renaming a card told the server the
    // figure had just been re-checked, and the ⚠ asking for the new statement
    // disappeared with the old balance still on file (#160). Creation keeps
    // sending it — the non-partial POST schema requires a balance.
    ...(form.cardId !== null && !form.balanceTouched
      ? {}
      : {balance: parseFloat(form.balanceRaw) || 0}),
    dueDay: form.dueRaw ? Math.min(31, Math.max(1, parseInt(form.dueRaw, 10))) : null,
    minPay: form.payInFull ? null : form.minPayRaw ? parseFloat(form.minPayRaw) : null,
    payInFull: form.payInFull,
    rewards: form.rewards,
    promoRate: form.promoOn ? parseFloat(form.promoAprRaw) || 0 : null,
    promoMonths: form.promoOn && form.promoMonthsRaw ? parseInt(form.promoMonthsRaw, 10) : null,
  };
}
