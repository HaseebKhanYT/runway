'use client';

import {fm, type AppState} from '@runway/shared';
import {useState} from 'react';
import {useFlow} from '../../lib/queries';
import {buildViewModel} from '../../lib/view-model';
import ui from '../ui/ui.module.css';
import {Modal, ModalTitle} from './modal';
import {useModals} from './modal_context';

/** Payday confirm (catalog §1.11). */
export function PaydayModal({state}: {state: AppState}) {
  const {closeModal} = useModals();
  const [editing, setEditing] = useState(false);
  const [amountRaw, setAmountRaw] = useState(String(state.profile.payAmount));
  const vm = buildViewModel(state, new Date());

  const confirm = useFlow<number>((amount) => ({
    path: '/payday/confirm',
    json: {amount},
  }));

  const run = (amount: number) => {
    if (amount <= 0 || confirm.isPending) return;
    confirm.mutate(amount, {onSuccess: () => closeModal()});
  };

  return (
    <Modal onClose={closeModal} width="min(380px,100%)">
      <ModalTitle title="Payday" onClose={closeModal} />
      <div style={{fontSize: 12.5, color: 'var(--muted)', marginBottom: 14}}>
        Runway can&apos;t see your bank — did the paycheck land?
      </div>
      {!editing ? (
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          <button
            className={ui.btnAccent}
            onClick={() => run(state.profile.payAmount)}
            disabled={confirm.isPending}
          >
            Yes — {fm(state.profile.payAmount)} landed
          </button>
          <button
            style={{
              padding: 13,
              borderRadius: 13,
              border: '1.5px solid var(--ink)',
              fontSize: 14,
              fontWeight: 650,
              transition: 'background .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-soft)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => setEditing(true)}
          >
            A different amount…
          </button>
          <button
            style={{
              padding: 11,
              borderRadius: 13,
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--muted)',
              transition: 'background .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--chip)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={closeModal}
          >
            Not yet — ask me later
          </button>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{fontSize: 18, fontWeight: 700, color: 'var(--muted)'}}>$</span>
            <input
              autoFocus
              className={`${ui.inputStrong} tnum`}
              style={{borderColor: 'var(--ink)'}}
              inputMode="decimal"
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value.replace(/[^0-9.]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && run(parseFloat(amountRaw) || 0)}
            />
          </div>
          <div style={{fontSize: 11.5, color: 'var(--muted)'}}>
            fewer shifts, overtime — the cycle plans around the real number
          </div>
          <button
            className={ui.btnAccent}
            disabled={(parseFloat(amountRaw) || 0) <= 0 || confirm.isPending}
            onClick={() => run(parseFloat(amountRaw) || 0)}
          >
            Confirm
          </button>
        </div>
      )}
      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: '1px dashed var(--border-input)',
          fontSize: 11.5,
          color: 'var(--muted)',
          lineHeight: 1.5,
        }}
      >
        What happens next: goals get {vm.setAsideF} first · bills reset for the new cycle · fresh
        safe/day
      </div>
    </Modal>
  );
}
