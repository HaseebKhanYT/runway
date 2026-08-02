'use client';

import {type AppState} from '@runway/shared';
import {fm} from '../../lib/format';
import {useState} from 'react';
import {useFlow} from '../../lib/queries';
import ui from '../ui/ui.module.css';
import {Modal, ModalTitle} from './modal';
import {useModals} from './modal_context';

interface SourceRow {
  id: string;
  name: string;
  glyph: string;
  glyphBg: string;
  glyphFg: string;
  nowLine: string;
  afterLine: string;
  afterColor: string;
}

/** "Pay bill — pick source" (catalog §1.12), z-index 55 above other modals. */
export function PaySourceModal({state, billId}: {state: AppState; billId: string}) {
  const {closeModal} = useModals();
  const bill = state.bills.find((b) => b.id === billId);
  const [source, setSource] = useState(bill?.payFrom ?? 'checking');

  const pay = useFlow<void>(() => ({
    path: `/bills/${billId}/pay`,
    json: {source},
  }));

  if (!bill) return null;
  const amount = bill.amount;

  const rows: SourceRow[] = [
    {
      id: 'checking',
      name: state.profile.primaryName,
      glyph: '⌂',
      glyphBg: '#29221a',
      glyphFg: '#f6f0e6',
      nowLine: `${fm(state.profile.primaryBalance)} now`,
      afterLine:
        state.profile.primaryBalance - amount >= 0
          ? `${fm(state.profile.primaryBalance - amount)} left`
          : `${fm(state.profile.primaryBalance - amount)} — short`,
      afterColor: state.profile.primaryBalance - amount >= 0 ? 'var(--muted)' : 'var(--danger)',
    },
    ...state.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      glyph: a.type === 'cash' ? '$' : a.type === 'savings' ? '★' : '⌂',
      glyphBg: a.type === 'cash' ? '#2e6d4f' : a.type === 'savings' ? '#8b6fd8' : '#29221a',
      glyphFg: '#f6f0e6',
      nowLine: `${fm(a.balance)} now`,
      afterLine:
        a.balance - amount >= 0
          ? `${fm(a.balance - amount)} left`
          : `${fm(a.balance - amount)} — short`,
      afterColor: a.balance - amount >= 0 ? 'var(--muted)' : 'var(--danger)',
    })),
    ...state.cards
      .filter((c) => c.id !== bill.cardId)
      .map((c) => {
        const overLimit = c.balance + amount > c.limit;
        return {
          id: c.id,
          name: c.name,
          glyph: '□',
          glyphBg: '#5c5142',
          glyphFg: '#f6f0e6',
          nowLine: `${fm(Math.max(0, c.limit - c.balance))} avail`,
          afterLine: overLimit
            ? `over limit by ${fm(c.balance + amount - c.limit)}`
            : `charges the card · ${fm(c.balance + amount)} owed`,
          afterColor: overLimit ? 'var(--danger)' : 'var(--muted)',
        };
      }),
  ];

  return (
    <Modal onClose={closeModal} z={55}>
      <ModalTitle title={`Pay ${bill.name}`} onClose={closeModal} />
      <div style={{fontSize: 12.5, color: 'var(--muted)', marginBottom: 14}}>
        Paying <b style={{color: 'var(--ink)'}}>{fm(amount)}</b> — which source is it coming from?
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
        {rows.map((row) => {
          const selected = source === row.id;
          return (
            <button
              key={row.id}
              onClick={() => setSource(row.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                border: `1.5px solid ${selected ? 'var(--ink)' : 'var(--border-input)'}`,
                background: selected ? 'var(--input)' : 'transparent',
                borderRadius: 14,
                padding: '12px 14px',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background: row.glyphBg,
                  color: row.glyphFg,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flex: 'none',
                }}
              >
                {row.glyph}
              </span>
              <span style={{flex: 1, minWidth: 0}}>
                <span style={{display: 'block', fontSize: 14, fontWeight: 650}}>{row.name}</span>
                <span className="tnum" style={{display: 'block', fontSize: 11.5}}>
                  <span style={{color: 'var(--muted)'}}>{row.nowLine}</span>
                  <span style={{color: 'var(--muted)'}}> · </span>
                  <span style={{color: row.afterColor}}>{row.afterLine}</span>
                </span>
              </span>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  flex: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  ...(selected
                    ? {background: 'var(--ink)', color: 'var(--bg)'}
                    : {border: '1.5px solid var(--icon-idle)', color: 'transparent'}),
                }}
              >
                ✓
              </span>
            </button>
          );
        })}
      </div>
      <button
        className={ui.btnPrimary}
        style={{marginTop: 14}}
        disabled={pay.isPending}
        onClick={() => pay.mutate(undefined, {onSuccess: () => closeModal()})}
      >
        Mark paid
      </button>
      <div style={{fontSize: 11, color: 'var(--muted-2)', textAlign: 'center', marginTop: 8}}>
        we&apos;ll remember this source for {bill.name} next time
      </div>
    </Modal>
  );
}
