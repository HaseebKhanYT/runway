'use client';

import {type AppState} from '@runway/shared';
import {formatShortDate, formatMoney} from '../../lib/format';
import {spineGap} from '../../lib/timeline';
import type {ViewModel} from '../../lib/view-model';
import {useModals} from '../modals/modal_context';

/** Mobile vertical runway spine (catalog §1.1C). */
export function RunwayVertical({state, vm}: {state: AppState; vm: ViewModel}) {
  const {openModal} = useModals();
  const today = new Date();
  const daysToPayday = vm.runway.daysToPayday;

  const events: {
    kind: 'bill' | 'payday';
    id: string;
    off: number;
  }[] = [
    ...state.bills
      .filter((b) => b.off >= 0)
      .map((b) => ({kind: 'bill' as const, id: b.id, off: b.off})),
    {kind: 'payday' as const, id: 'payday', off: daysToPayday},
  ].sort((a, b) => a.off - b.off || (a.kind === 'payday' ? 1 : -1));

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: 18,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 9}}>
        <span style={{width: 14, height: 14, borderRadius: '50%', background: 'var(--ink)'}} />
        <span style={{fontSize: 13, fontWeight: 650}}>Today · {vm.todayShort}</span>
        <span className="tnum" style={{marginLeft: 'auto', fontSize: 13, fontWeight: 650}}>
          {vm.balanceF}
        </span>
      </div>
      <div
        style={{
          borderLeft: '2px solid var(--rail)',
          marginLeft: 9,
          padding: '4px 0 4px 16px',
        }}
      >
        {events.map((ev, i) => {
          const gapDays = i === 0 ? ev.off : ev.off - events[i - 1].off;
          const marginTop = spineGap(gapDays);
          if (ev.kind === 'payday') {
            return (
              <div key="payday">
                <div
                  style={{display: 'flex', alignItems: 'center', gap: 10, marginTop}}
                  onClick={() => openModal('payday')}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: '3px solid var(--accent)',
                      background: 'var(--surface)',
                      marginLeft: -26,
                      flex: 'none',
                      animation: 'pulse 2.4s infinite',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{fontSize: 13, fontWeight: 650, color: 'var(--accent)'}}>
                    Payday · {vm.paydayLabel}
                  </span>
                  <span
                    className="tnum"
                    style={{
                      marginLeft: 'auto',
                      fontSize: 13,
                      fontWeight: 650,
                      color: 'var(--accent)',
                    }}
                  >
                    +{vm.payAmountF}
                  </span>
                </div>
                {vm.runway.setAside > 0 && (
                  <div style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: 9}}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: 'var(--goals)',
                        marginLeft: -22,
                        flex: 'none',
                      }}
                    />
                    <span style={{fontSize: 12.5, color: 'var(--muted)'}}>
                      then set aside for goals
                    </span>
                    <span
                      className="tnum"
                      style={{
                        marginLeft: 'auto',
                        fontSize: 12.5,
                        fontWeight: 650,
                        color: 'var(--goals)',
                      }}
                    >
                      −{vm.setAsideF}
                    </span>
                  </div>
                )}
              </div>
            );
          }
          const bill = state.bills.find((b) => b.id === ev.id);
          if (!bill) return null;
          return (
            <div
              key={bill.id}
              style={{display: 'flex', alignItems: 'center', gap: 10, marginTop}}
              onClick={() => !bill.paid && openModal('paySource', {billId: bill.id})}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: '2px solid var(--ink)',
                  background: bill.paid ? 'var(--ink)' : 'var(--surface)',
                  color: bill.paid ? '#fff' : 'transparent',
                  marginLeft: -29,
                  flex: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ✓
              </span>
              <span style={{minWidth: 0}}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    ...(bill.paid ? {textDecoration: 'line-through', color: 'var(--muted-2)'} : {}),
                  }}
                >
                  {bill.name}
                </span>
                <span style={{display: 'block', fontSize: 11.5, color: 'var(--muted)'}}>
                  due {formatShortDate(bill.off, today)}
                </span>
              </span>
              <span
                className="tnum"
                style={{
                  marginLeft: 'auto',
                  fontSize: 14,
                  fontWeight: 600,
                  ...(bill.paid ? {textDecoration: 'line-through', color: 'var(--muted-2)'} : {}),
                }}
              >
                −{formatMoney(bill.amount).replace('−', '')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
