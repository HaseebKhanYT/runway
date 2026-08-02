'use client';

import {daysUntil, type AppState} from '@runway/shared';
import {formatMoney} from '../../lib/format';
import {useState} from 'react';
import {useFlow} from '../../lib/queries';
import ui from '../ui/ui.module.css';
import {Modal, ModalTitle} from './modal';
import {useModals} from './modal_context';

/** "Borrowing from a friend" (catalog §1.10). */
export function LoanModal({state, prefillAmount}: {state: AppState; prefillAmount?: number}) {
  const {closeModal} = useModals();
  const [who, setWho] = useState('');
  const [amountRaw, setAmountRaw] = useState(prefillAmount ? String(prefillAmount) : '');
  const [dueDate, setDueDate] = useState('');

  const amount = parseFloat(amountRaw) || 0;
  const valid = who.trim().length > 0 && amount > 0 && dueDate.length === 10;

  const save = useFlow<void>(() => ({
    path: '/loans',
    json: {who: who.trim(), amount, dueDate},
  }));

  const today = new Date();
  const paydayOff = state.profile.nextPay ? daysUntil(state.profile.nextPay, today) : null;
  const dueOff = dueDate.length === 10 ? daysUntil(dueDate, today) : null;
  const dueLabel =
    dueDate.length === 10
      ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : '';

  let note = 'No interest, no fees — Runway just remembers who you owe and when.';
  let noteColor = 'var(--muted)';
  if (valid && dueOff != null && paydayOff != null) {
    if (dueOff <= paydayOff) {
      note = `Due ${dueLabel}, before payday — this moves the shortfall rather than clearing it.`;
      noteColor = 'var(--danger)';
    } else {
      note = `Due ${dueLabel}, after payday — ${formatMoney(amount)} comes off that paycheck.`;
    }
  }

  const submit = () => {
    if (!valid || save.isPending) return;
    save.mutate(undefined, {onSuccess: () => closeModal()});
  };

  return (
    <Modal onClose={closeModal}>
      <ModalTitle title="Borrowing from a friend" onClose={closeModal} />
      <div style={{fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.45}}>
        Cash today, no interest — the only thing that matters is paying it back when you said you
        would.
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        <div>
          <div className={ui.label}>WHO</div>
          <input
            autoFocus
            className={ui.inputStrong}
            placeholder="Maya, Dad, Chris…"
            value={who}
            onChange={(e) => setWho(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <div style={{display: 'flex', gap: 10}}>
          <div style={{flex: 1}}>
            <div className={ui.label}>HOW MUCH</div>
            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <span style={{fontSize: 15, fontWeight: 600, color: 'var(--muted)'}}>$</span>
              <input
                className={`${ui.inputStrong} tnum`}
                inputMode="decimal"
                placeholder="0"
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
          </div>
          <div style={{flex: 1}}>
            <div className={ui.label}>PAY BACK BY</div>
            <input
              type="date"
              className={ui.inputStrong}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <div style={{fontSize: 12, color: noteColor, lineHeight: 1.45}}>{note}</div>
        <button className={ui.btnPrimary} disabled={!valid || save.isPending} onClick={submit}>
          {valid ? `Add ${formatMoney(amount)} from ${who.trim()}` : 'Add the loan'}
        </button>
        <div
          style={{
            paddingTop: 12,
            borderTop: '1px dashed var(--border-input)',
            fontSize: 11.5,
            color: 'var(--muted-2)',
            lineHeight: 1.5,
          }}
        >
          It lands in your balance today and shows up under Debt as “Pay back …” — no interest is
          ever added.
        </div>
      </div>
    </Modal>
  );
}
