'use client';

import type {AppState} from '@runway/shared';
import {AccountsModal} from './accounts-modal';
import {AddExpenseModal} from './add-expense';
import {CategoryModal} from './category-modal';
import {LoanModal} from './loan-modal';
import {useModals} from './modal-context';
import {PaydayModal} from './payday-modal';
import {PaySourceModal} from './pay-source-modal';

/** Renders the modal stack (catalog §2.2 overlay table). */
export function ModalHost({state}: {state: AppState}) {
  const {stack} = useModals();
  return (
    <>
      {stack.map((req, i) => {
        const key = `${req.name}-${i}`;
        const p = req.props ?? {};
        switch (req.name) {
          case 'addExpense':
            return (
              <AddExpenseModal
                key={key}
                state={state}
                initialMode={p.initialMode as 'expense' | 'income' | undefined}
                initialCategory={p.initialCategory as string | undefined}
              />
            );
          case 'category':
            return (
              <CategoryModal
                key={key}
                state={state}
                categoryId={p.categoryId as string | undefined}
                returnTo={p.returnTo as 'add' | undefined}
              />
            );
          case 'accounts':
            return <AccountsModal key={key} state={state} />;
          case 'paySource':
            return <PaySourceModal key={key} state={state} billId={p.billId as string} />;
          case 'payday':
            return <PaydayModal key={key} state={state} />;
          case 'loan':
            return (
              <LoanModal
                key={key}
                state={state}
                prefillAmount={p.prefillAmount as number | undefined}
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}
