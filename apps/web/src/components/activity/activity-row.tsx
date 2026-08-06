'use client';

import {type AppState, type Txn} from '@runway/shared';
import {catHue} from '../../lib/category-colors';
import {formatShortDate, formatMoney} from '../../lib/format';
import {useEffect, useRef, useState} from 'react';
import {useFlow} from '../../lib/queries';

function whenLabel(off: number, today: Date): string {
  if (off === 0) return 'Today';
  if (off === -1) return 'Yesterday';
  return formatShortDate(off, today);
}

/** Spend txns (negative, in a real spending category) can be recategorized. */
function isSpendTxn(t: Txn, state: AppState): boolean {
  return t.amount < 0 && state.cats.some((c) => c.name === t.cat);
}

/** Shared activity row + expand panel (catalog §1.13). */
export function ActivityRow({
  txn,
  state,
  last = false,
}: {
  txn: Txn;
  state: AppState;
  last?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const today = new Date();
  const hue = catHue(txn.cat, state.cats);

  const recat = useFlow<string>((category) => ({
    path: `/transactions/${txn.id}/category`,
    method: 'PATCH',
    json: {category},
  }));
  const remove = useFlow<void>(() => ({
    path: `/transactions/${txn.id}`,
    method: 'DELETE',
  }));

  // Deleting a transaction is a two-tap arm-and-confirm, as in Reset app data.
  const [armed, setArmed] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  /** Clearing the pending timer matters: otherwise a stale timer disarms a re-arm. */
  const disarm = () => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    disarmTimer.current = null;
    setArmed(false);
  };

  const arm = () => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setArmed(true);
    disarmTimer.current = setTimeout(() => {
      disarmTimer.current = null;
      setArmed(false);
    }, 4000);
  };

  useEffect(
    () => () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    },
    [],
  );

  const positive = txn.amount > 0;

  return (
    <div>
      <div
        onClick={() => {
          disarm();
          setOpen(!open);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '9px 0',
          cursor: 'pointer',
          borderBottom: open || last ? 'none' : '1px solid var(--divider)',
        }}
      >
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            background: `${hue}1f`,
            color: hue,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            flex: 'none',
          }}
        >
          {txn.cat.slice(0, 2).toUpperCase()}
        </span>
        <span style={{flex: 1, minWidth: 0}}>
          <span
            style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {txn.label}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 11.5,
              color: 'var(--muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {whenLabel(txn.off, today)} · from {txn.src ?? 'Main checking'}
          </span>
        </span>
        <span
          className="tnum"
          style={{
            fontSize: 14,
            fontWeight: 650,
            color: positive ? 'var(--success)' : 'var(--ink)',
          }}
        >
          {positive ? `+${formatMoney(txn.amount)}` : formatMoney(txn.amount)}
        </span>
        <span
          style={{
            fontSize: 17,
            color: 'var(--chevron)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform .18s',
          }}
        >
          ›
        </span>
      </div>

      {open && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '13px 22px',
            padding: '12px 14px',
            background: `${hue}14`,
            borderRadius: 13,
            margin: '0 0 10px',
            alignItems: 'center',
          }}
        >
          {(
            [
              ['CATEGORY', txn.cat, hue],
              ['ACCOUNT', txn.src ?? 'Main checking', 'var(--ink)'],
              ['DATE', whenLabel(txn.off, today), 'var(--ink)'],
            ] as const
          ).map(([label, value, color]) => (
            <span key={label}>
              <span
                style={{
                  display: 'block',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '.9px',
                  color: 'var(--muted-2)',
                }}
              >
                {label}
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: 13,
                  color,
                  fontWeight: label === 'CATEGORY' ? 700 : 400,
                }}
              >
                {value}
              </span>
            </span>
          ))}
          <span style={{display: 'flex', gap: 8, marginLeft: 'auto'}}>
            {isSpendTxn(txn, state) && (
              <button
                onClick={() => setPicking(!picking)}
                style={{
                  border: '1px solid var(--border-dash)',
                  borderRadius: 10,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 650,
                  background: 'var(--surface)',
                }}
              >
                {picking ? 'Pick one below…' : 'Change category'}
              </button>
            )}
            <button
              onClick={() => {
                if (!armed) {
                  arm();
                  return;
                }
                if (inFlight.current) return;
                inFlight.current = true;
                remove.mutate(undefined, {
                  onSuccess: disarm,
                  onSettled: () => {
                    inFlight.current = false;
                  },
                });
              }}
              disabled={remove.isPending}
              style={{
                borderRadius: 10,
                padding: '6px 10px',
                fontSize: 12,
                fontWeight: 650,
                ...(armed
                  ? {
                      border: '1px solid var(--danger)',
                      color: '#fff',
                      background: 'var(--danger)',
                    }
                  : {
                      border: '1px solid #e2cfc0',
                      color: 'var(--danger)',
                      background: 'var(--surface)',
                    }),
              }}
            >
              {armed ? 'Tap again to confirm' : 'Delete'}
            </button>
          </span>
          {picking && (
            <span style={{display: 'flex', flexWrap: 'wrap', gap: 6, width: '100%'}}>
              {state.cats
                .filter((c) => !c.locked)
                .map((c) => {
                  const active = c.name === txn.cat;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        recat.mutate(c.name);
                        setPicking(false);
                      }}
                      style={{
                        padding: '5px 11px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        border: `1.5px solid ${active ? c.color : 'var(--border-input)'}`,
                        background: active ? `${c.color}1f` : 'var(--surface)',
                        color: active ? c.color : 'var(--ink-2)',
                      }}
                    >
                      {c.name}
                    </button>
                  );
                })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
