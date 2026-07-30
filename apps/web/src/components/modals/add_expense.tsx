'use client';

import {fm, pooledBalance, type AppState} from '@runway/shared';
import {useMemo, useState} from 'react';
import {useFlow} from '../../lib/queries';
import ui from '../ui/ui.module.css';
import {Modal, ModalTitle} from './modal';
import {useModals} from './modal_context';

const INCOME_KINDS = ['Side gig', 'Refund', 'Gift', 'Sold something', 'Other'] as const;

export function AddExpenseModal({
  state,
  initialMode = 'expense',
  initialCategory,
}: {
  state: AppState;
  initialMode?: 'expense' | 'income';
  initialCategory?: string;
}) {
  const {closeModal, openModal} = useModals();
  const [mode, setMode] = useState<'expense' | 'income'>(initialMode);
  const [amountRaw, setAmountRaw] = useState('');
  const [category, setCategory] = useState(initialCategory ?? state.cats[0]?.name ?? '');
  const [incomeKind, setIncomeKind] = useState<(typeof INCOME_KINDS)[number]>('Side gig');
  const [source, setSource] = useState('checking');
  const [goalId, setGoalId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const amount = parseFloat(amountRaw) || 0;
  const save = useFlow<void>(() => ({
    path: '/expenses',
    json:
      mode === 'expense'
        ? {kind: 'expense', amount, category, source, note: note || undefined}
        : {kind: 'income', amount, incomeKind, goalId, note: note || undefined},
  }));

  const cat = state.cats.find((c) => c.name === category);
  const goal = state.goals.find((g) => g.id === goalId);

  const saveLabel = useMemo(() => {
    if (amount <= 0) return 'Enter an amount';
    if (mode === 'income') {
      return goal ? `Add ${fm(amount)} → ${goal.name}` : `Add ${fm(amount)} — spendable`;
    }
    if (cat && cat.budget > 0) {
      const left = cat.budget - cat.spent - amount;
      return left >= 0
        ? `Add — leaves ${fm(left)} in ${cat.name.toLowerCase()}`
        : `Add — puts ${cat.name.toLowerCase()} over by ${fm(-left)}`;
    }
    return `Add ${fm(amount)}`;
  }, [amount, mode, goal, cat]);

  const overBudget =
    mode === 'expense' && cat && cat.budget > 0 && cat.budget - cat.spent - amount < 0;
  const btnClass =
    amount <= 0
      ? ui.btnPrimary
      : mode === 'income'
        ? ui.btnSuccess
        : overBudget
          ? ui.btnDangerFill
          : ui.btnAccent;

  const submit = () => {
    if (amount <= 0 || save.isPending) return;
    save.mutate(undefined, {onSuccess: () => closeModal()});
  };

  const unfundedGoals = state.goals.filter((g) => g.saved < g.target && !g.paused);
  void pooledBalance;

  return (
    <Modal onClose={closeModal}>
      <ModalTitle title={mode === 'expense' ? 'Add expense' : 'Money in'} onClose={closeModal} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
        <div className={ui.segWrap}>
          <button
            className={mode === 'expense' ? ui.segBtnActive : ui.segBtn}
            onClick={() => setMode('expense')}
          >
            expense
          </button>
          <button
            className={mode === 'income' ? ui.segBtnActiveSuccess : ui.segBtn}
            onClick={() => setMode('income')}
          >
            money in
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            borderBottom: '2px solid var(--ink)',
            paddingBottom: 6,
          }}
        >
          <span style={{fontSize: 30, fontWeight: 700, color: 'var(--muted)'}}>$</span>
          <input
            autoFocus
            inputMode="decimal"
            placeholder="0"
            value={amountRaw}
            onChange={(e) => setAmountRaw(e.target.value.replace(/[^0-9.]/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="tnum"
            style={{
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: '-1px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              width: '100%',
              color: 'var(--ink)',
            }}
          />
        </div>

        {mode === 'expense' ? (
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 7}}>
            {state.cats
              .filter((c) => !c.locked)
              .map((c) => (
                <button
                  key={c.id}
                  className={category === c.name ? ui.chipActive : ui.chip}
                  onClick={() => setCategory(c.name)}
                >
                  {c.name}
                </button>
              ))}
            <button
              className={ui.chipDashed}
              onClick={() => openModal('category', {returnTo: 'add'})}
            >
              + New
            </button>
          </div>
        ) : (
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 7}}>
            {INCOME_KINDS.map((k) => (
              <button
                key={k}
                className={incomeKind === k ? ui.chipActive : ui.chip}
                onClick={() => setIncomeKind(k)}
              >
                {k}
              </button>
            ))}
          </div>
        )}

        {mode === 'expense' ? (
          <div>
            <div className={ui.label}>PAYING FROM</div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 7}}>
              <button
                className={source === 'checking' ? ui.chipActive : ui.chip}
                onClick={() => setSource('checking')}
              >
                {state.profile.primaryName}
              </button>
              {state.accounts.map((a) => (
                <button
                  key={a.id}
                  className={source === a.id ? ui.chipActive : ui.chip}
                  onClick={() => setSource(a.id)}
                >
                  {a.name}
                </button>
              ))}
              {state.cards.map((c) => (
                <button
                  key={c.id}
                  className={source === c.id ? ui.chipActive : ui.chip}
                  onClick={() => setSource(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          unfundedGoals.length > 0 && (
            <div>
              <div className={ui.label}>WHAT&apos;S IT FOR?</div>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 7}}>
                <button
                  className={goalId === null ? ui.chipActive : ui.chip}
                  onClick={() => setGoalId(null)}
                >
                  Keep it spendable
                </button>
                {unfundedGoals.map((g) => (
                  <button
                    key={g.id}
                    className={goalId === g.id ? ui.chipActive : ui.chip}
                    onClick={() => setGoalId(g.id)}
                  >
                    → {g.name}
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        <input
          className={ui.input}
          placeholder={
            mode === 'expense'
              ? 'Note (optional) — coffee, tickets…'
              : 'Note (optional) — dog-sitting, refund…'
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        <button className={btnClass} disabled={amount <= 0 || save.isPending} onClick={submit}>
          {saveLabel}
        </button>
      </div>
    </Modal>
  );
}
