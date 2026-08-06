import type {Bill} from '@runway/shared';

/**
 * Whether the Bills page should offer a delete control for this bill.
 *
 * A card's payment bill is derived state — the API's `syncCardBill` creates it,
 * keeps it in step with the card and removes it when the card's due day is
 * cleared. Deleting it from here would take a debt that is still owed off the
 * runway and leave the Cards page claiming the card has no due date, so the
 * control is withheld.
 *
 * `cardId` rather than `kind === 'debt'` is the test: a friend loan is also a
 * debt bill, and it *is* the user's to delete.
 */
export function canDeleteBill(bill: Pick<Bill, 'cardId'>): boolean {
  return bill.cardId == null;
}
