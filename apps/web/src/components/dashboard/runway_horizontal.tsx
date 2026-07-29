'use client';

import {d, fm, layoutTimeline, type AppState, type ViewModel} from '@runway/shared';
import {useRef, useState} from 'react';
import {useModals} from '../modals/modal_context';

/** Desktop horizontal runway (catalog §1.1B). */
export function RunwayHorizontal({state, vm}: {state: AppState; vm: ViewModel}) {
  const {openModal} = useModals();
  const today = new Date();
  const [fading, setFading] = useState<Set<string>>(new Set());
  const fadeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const {nodes} = layoutTimeline(state.bills, vm.runway.DAYS, fading);

  const onBillClick = (billId: string) => {
    const bill = state.bills.find((b) => b.id === billId);
    if (!bill) return;
    if (bill.paid) return; // un-pay handled in Bills view; runway only fades
    openModal('paySource', {billId, fromRunway: true});
  };
  void setFading;
  void fadeTimers;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: 10,
        overflowX: 'auto',
      }}
    >
      <div style={{position: 'relative', height: 224, minWidth: 920}}>
        <div
          style={{
            position: 'absolute',
            left: '2.5%',
            right: '2.5%',
            top: '50%',
            height: 2,
            background: 'var(--rail)',
            borderRadius: 2,
          }}
        />
        {/* Today node */}
        <div
          style={{
            position: 'absolute',
            left: '3%',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: 12, fontWeight: 650}}>Today</div>
            <div className="tnum" style={{fontSize: 11.5, color: 'var(--muted)'}}>
              {vm.balanceF}
            </div>
          </div>
          <div style={{width: 16, height: 16, borderRadius: '50%', background: 'var(--ink)'}} />
        </div>

        {nodes.map((node) => {
          if (node.payday) {
            return (
              <div
                key="payday"
                style={{
                  position: 'absolute',
                  left: `${node.pct}%`,
                  top: 'calc(50% - 11px)',
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  alignItems: 'center',
                  gap: 7,
                  transform: 'translateX(-50%)',
                }}
              >
                <div style={{width: 110, textAlign: 'center'}}>
                  <div style={{fontSize: 12, fontWeight: 650, color: 'var(--accent)'}}>
                    Payday · {vm.paydayLabel}
                  </div>
                  <div className="tnum" style={{fontSize: 11.5, color: 'var(--muted)'}}>
                    +{vm.payAmountF}
                  </div>
                  <div
                    className="tnum"
                    style={{fontSize: 11, fontWeight: 600, color: 'var(--goals)'}}
                  >
                    −{vm.setAsideF} → goals
                  </div>
                </div>
                <button
                  title="It landed? Tap to confirm"
                  onClick={() => openModal('payday')}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: '3px solid var(--accent)',
                    background: 'var(--surface)',
                    animation: 'pulse 2.4s infinite',
                    cursor: 'pointer',
                  }}
                />
              </div>
            );
          }
          const bill = state.bills.find((b) => b.id === node.id);
          if (!bill) return null;
          const isFading = fading.has(bill.id);
          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: `${node.pct}%`,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: node.side === 'above' ? 'column' : 'column-reverse',
                alignItems: 'center',
                gap: 7,
                ...(node.side === 'above'
                  ? {bottom: 'calc(50% - 11px)'}
                  : {top: 'calc(50% - 11px)'}),
                ...(isFading
                  ? {
                      transition: 'opacity .5s ease .7s',
                      opacity: 0,
                      pointerEvents: 'none' as const,
                    }
                  : {}),
              }}
            >
              <div style={{width: 100, textAlign: 'center'}}>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 650,
                    ...(bill.paid
                      ? {textDecoration: 'line-through', color: 'var(--muted-2)'}
                      : {}),
                  }}
                >
                  {bill.name}
                </div>
                <div className="tnum" style={{fontSize: 11.5, color: 'var(--muted)'}}>
                  {fm(bill.amount)} · {d(bill.off, today)}
                </div>
              </div>
              <button
                title="mark paid / unpaid"
                onClick={() => onBillClick(bill.id)}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.18)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: '2px solid var(--ink)',
                  background: bill.paid ? 'var(--ink)' : 'var(--surface)',
                  color: bill.paid ? '#fff' : 'transparent',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform .15s',
                }}
              >
                ✓
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
