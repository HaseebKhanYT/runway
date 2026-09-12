'use client';

import {type AppState} from '@runway/shared';
import {formatMoney} from '../../lib/format';
import {useEffect, useRef, useState} from 'react';
import {useFlow} from '../../lib/queries';
import {useModals} from '../modals/modal-context';
import ui from '../ui/ui.module.css';

/** Spending categories panel (catalog §1.1D). */
export function CategoriesPanel({state}: {state: AppState}) {
  const {openModal} = useModals();
  const [manage, setManage] = useState(false);
  const remove = useFlow<string>((id) => ({path: `/categories/${id}`, method: 'DELETE'}));

  // Deleting a category is a two-tap arm-and-confirm, as in Reset app data.
  const [armedId, setArmedId] = useState<string | null>(null);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  /** Clearing the pending timer matters: otherwise row A's timer disarms row B. */
  const disarm = () => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    disarmTimer.current = null;
    setArmedId(null);
  };

  const arm = (id: string) => {
    if (disarmTimer.current) clearTimeout(disarmTimer.current);
    setArmedId(id);
    disarmTimer.current = setTimeout(() => {
      disarmTimer.current = null;
      setArmedId(null);
    }, 4000);
  };

  useEffect(
    () => () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    },
    [],
  );

  return (
    <div className={ui.card}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{fontSize: 13, fontWeight: 700, letterSpacing: '.3px'}}>
          Spending categories
        </div>
        <button
          style={{fontSize: 12, fontWeight: 650, color: 'var(--accent)'}}
          onClick={() => {
            disarm();
            setManage(!manage);
          }}
        >
          {manage ? 'Done' : 'Edit'}
        </button>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 13}}>
        {state.cats.map((cat) => {
          const over = cat.budget > 0 && cat.spent > cat.budget;
          const armed = armedId === cat.id;
          const pct =
            cat.budget > 0
              ? Math.min(100, (cat.spent / cat.budget) * 100)
              : cat.spent > 0
                ? 100
                : 0;
          return (
            <div key={cat.id}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: cat.color,
                    flex: 'none',
                  }}
                />
                <span style={{fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0}}>
                  {cat.name}
                </span>
                {manage ? (
                  <span style={{display: 'flex', gap: 10, alignItems: 'center'}}>
                    <button
                      style={{fontSize: 11.5, fontWeight: 650, color: 'var(--muted)'}}
                      onClick={() => openModal('category', {categoryId: cat.id})}
                    >
                      Edit
                    </button>
                    {!cat.locked && (
                      <button
                        style={
                          armed
                            ? {
                                padding: '3px 8px',
                                borderRadius: 8,
                                fontSize: 11.5,
                                fontWeight: 650,
                                background: 'var(--danger)',
                                color: '#fff',
                              }
                            : {fontSize: 14, color: 'var(--danger)'}
                        }
                        aria-label={armed ? `Confirm deleting ${cat.name}` : `Delete ${cat.name}`}
                        disabled={remove.isPending}
                        onClick={() => {
                          if (!armed) {
                            arm(cat.id);
                            return;
                          }
                          if (inFlight.current) return;
                          inFlight.current = true;
                          remove.mutate(cat.id, {
                            onSuccess: disarm,
                            onSettled: () => {
                              inFlight.current = false;
                            },
                          });
                        }}
                      >
                        {armed ? 'Delete?' : '✕'}
                      </button>
                    )}
                  </span>
                ) : (
                  <span
                    className="tnum"
                    style={{
                      fontSize: 12.5,
                      color: over ? 'var(--danger)' : 'var(--muted)',
                    }}
                  >
                    {cat.budget > 0
                      ? `${formatMoney(cat.spent)} / ${formatMoney(cat.budget)}`
                      : `${formatMoney(cat.spent)} spent`}
                  </span>
                )}
              </div>
              <div
                className={ui.progressTrack}
                style={over ? {background: 'var(--track-over)'} : undefined}
              >
                <div
                  className={ui.progressFill}
                  style={{width: `${pct}%`, background: cat.color}}
                />
              </div>
            </div>
          );
        })}
        <button className={ui.dashedCta} onClick={() => openModal('category')}>
          + Add category
        </button>
      </div>
    </div>
  );
}
