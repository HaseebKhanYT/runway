'use client';

import {type AppState} from '@runway/shared';
import {categoryBarPct} from '../../lib/category-bar';
import {formatMoney} from '../../lib/format';
import {useState} from 'react';
import {useFlow} from '../../lib/queries';
import {useModals} from '../modals/modal-context';
import ui from '../ui/ui.module.css';

/** Spending categories panel (catalog §1.1D). */
export function CategoriesPanel({state}: {state: AppState}) {
  const {openModal} = useModals();
  const [manage, setManage] = useState(false);
  const remove = useFlow<string>((id) => ({path: `/categories/${id}`, method: 'DELETE'}));

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
          onClick={() => setManage(!manage)}
        >
          {manage ? 'Done' : 'Edit'}
        </button>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 13}}>
        {state.cats.map((cat) => {
          const over = cat.budget > 0 && cat.spent > cat.budget;
          const pct = categoryBarPct(cat.spent, cat.budget);
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
                        style={{fontSize: 14, color: 'var(--danger)'}}
                        aria-label={`Delete ${cat.name}`}
                        onClick={() => remove.mutate(cat.id)}
                      >
                        ✕
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
