import {z} from 'zod';

const money = z.number().finite();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const profilePatchSchema = z
  .object({
    name: z.string().max(120),
    email: z.string().max(200),
    cadence: z.enum(['weekly', 'biweekly', 'semimonthly', 'monthly']),
    nextPay: isoDate.nullable(),
    payAmount: money.nonnegative(),
    primaryName: z.string().max(120),
    primaryBalance: money,
    primaryLogo: z.string().max(300).nullable(),
    notifBills: z.boolean(),
    notifWeekly: z.boolean(),
  })
  .partial();

export const accountUpsertSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['checking', 'cash', 'savings']),
  balance: money,
  logo: z.string().max(300).nullable().optional(),
});

export const billCreateSchema = z.object({
  name: z.string().min(1).max(120),
  amount: money.positive(),
  kind: z.enum(['survival', 'subscription', 'debt']),
  dueDay: z.number().int().min(1).max(31),
  cycle: z.enum(['monthly', 'yearly']).default('monthly'),
  payFrom: z.string().nullable().optional(),
});

export const billPatchSchema = z
  .object({
    name: z.string().min(1).max(120),
    amount: money.positive(),
    kind: z.enum(['survival', 'subscription', 'debt']),
    dueDay: z.number().int().min(1).max(31),
    cycle: z.enum(['monthly', 'yearly']),
    payFrom: z.string().nullable(),
  })
  .partial();

export const categoryUpsertSchema = z.object({
  name: z.string().min(1).max(80),
  budget: money.nonnegative(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const goalCreateSchema = z.object({
  name: z.string().min(1).max(120),
  target: money.positive(),
  per: money.nonnegative().default(0),
  due: isoDate.nullable().optional(),
  note: z.string().max(200).default(''),
  necessity: z.boolean().default(false),
});

export const goalPatchSchema = z
  .object({
    name: z.string().min(1).max(120),
    target: money.positive(),
    per: money.nonnegative(),
    due: isoDate.nullable(),
    note: z.string().max(200),
    paused: z.string().nullable(),
  })
  .partial();

export const cardUpsertSchema = z.object({
  name: z.string().min(1).max(120),
  apr: z.number().min(0).max(99),
  limit: money.positive(),
  balance: money.nonnegative(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
  minPay: money.positive().nullable().optional(),
  payInFull: z.boolean().default(false),
  rewards: z.array(z.object({rate: z.string().max(10), cat: z.string().max(60)})).default([]),
  promoRate: z.number().min(0).max(99).nullable().optional(),
  promoMonths: z.number().int().min(1).max(60).nullable().optional(),
});

export const payBillSchema = z.object({
  /** 'checking' | account id | card id. */
  source: z.string().min(1),
});

export const paydayConfirmSchema = z.object({
  amount: money.positive(),
});

export const expenseCreateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('expense'),
    amount: money.positive(),
    category: z.string().min(1),
    source: z.string().min(1).default('checking'),
    note: z.string().max(200).optional(),
  }),
  z.object({
    kind: z.literal('income'),
    amount: money.positive(),
    incomeKind: z.enum(['Side gig', 'Refund', 'Gift', 'Sold something', 'Other']).default('Other'),
    goalId: z.string().nullable().optional(),
    note: z.string().max(200).optional(),
  }),
]);

export const setAsideSchema = z.object({
  amount: money.positive(),
  source: z.string().min(1).default('checking'),
});

export const crunchLockSchema = z.object({
  pausedGoalIds: z.array(z.string()),
  cardId: z.string().nullable().optional(),
  advance: money.nonnegative().optional(),
});

export const loanCreateSchema = z.object({
  who: z.string().min(1).max(80),
  amount: money.positive(),
  dueDate: isoDate,
});

export const plannerStartSchema = z.object({
  name: z.string().min(1).max(120),
  target: money.positive(),
  months: z.number().int().min(1).max(600),
  kind: z.enum(['wish', 'necessity']),
  pausedIds: z.array(z.string()).default([]),
  cardId: z.string().nullable().optional(),
  /**
   * The principal the planner advertised on the chosen card — the shortfall
   * left after the other levers, not the whole target. The server clamps it
   * to the card's headroom and the target, so this can only ever finance
   * less than those bounds; defaulting to 0 means a caller that forgets the
   * field finances nothing rather than silently charging the full target.
   */
  financed: money.nonnegative().default(0),
  earn: z.boolean().default(false),
  /** The extra monthly income the "Earn the rest" lever asked the user for. */
  earnMonthly: money.nonnegative().default(0),
});

export const onboardingCompleteSchema = z.object({
  balance: money.nonnegative(),
  /**
   * Nonnegative, matching `profilePatchSchema.payAmount` — the two doors into
   * the same column used to disagree (#85). A user between jobs has a real
   * paycheck of zero to record, and the dashboard says so out loud rather
   * than treating it as calm. Negative pay stays impossible.
   */
  pay: money.nonnegative(),
  cadence: z.enum(['weekly', 'biweekly', 'monthly']),
  nextPay: isoDate,
  name: z.string().max(120).optional(),
  email: z.string().max(200).optional(),
  bills: z.array(
    z.object({
      name: z.string().min(1).max(120),
      amount: money.positive(),
      dueDay: z.number().int().min(1).max(31),
      kind: z.enum(['survival', 'subscription']),
    }),
  ),
  cards: z.array(
    z.object({
      name: z.string().min(1).max(120),
      balance: money.nonnegative(),
      limit: money.positive(),
      apr: z.number().min(0).max(99),
    }),
  ),
  cats: z.array(
    z.object({
      name: z.string().min(1).max(80),
      budget: money.nonnegative(),
    }),
  ),
});

export const txnCategoryPatchSchema = z.object({
  category: z.string().min(1),
});

export const cardLogPaymentSchema = z.object({
  amount: money.positive(),
  source: z.string().min(1).default('checking'),
});

export type ProfilePatch = z.infer<typeof profilePatchSchema>;
export type AccountUpsert = z.infer<typeof accountUpsertSchema>;
export type BillCreate = z.infer<typeof billCreateSchema>;
export type BillPatch = z.infer<typeof billPatchSchema>;
export type CategoryUpsert = z.infer<typeof categoryUpsertSchema>;
export type GoalCreate = z.infer<typeof goalCreateSchema>;
export type GoalPatch = z.infer<typeof goalPatchSchema>;
export type CardUpsert = z.infer<typeof cardUpsertSchema>;
export type ExpenseCreate = z.infer<typeof expenseCreateSchema>;
export type CrunchLock = z.infer<typeof crunchLockSchema>;
export type LoanCreate = z.infer<typeof loanCreateSchema>;
export type PlannerStart = z.infer<typeof plannerStartSchema>;
export type OnboardingComplete = z.infer<typeof onboardingCompleteSchema>;
