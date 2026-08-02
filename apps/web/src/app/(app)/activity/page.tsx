'use client';

import {type AppState, type Txn} from '@runway/shared';
import {d, fm} from '../../../lib/format';
import {useState} from 'react';
import {ActivityRow} from '../../../components/activity/activity_row';
import ui from '../../../components/ui/ui.module.css';
import {useAppState, useFlow} from '../../../lib/queries';

const FILTERS = ['All', 'Money in', 'Spending', 'Bills & subs', 'Goals'] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(t: Txn, filter: Filter, state: AppState): boolean {
  switch (filter) {
    case 'All':
      return true;
    case 'Money in':
      return t.amount > 0;
    case 'Spending':
      return t.amount < 0 && state.cats.some((c) => c.name === t.cat);
    case 'Bills & subs':
      return t.cat === 'Bills' || t.cat === 'Subscription' || t.cat === 'Debt';
    case 'Goals':
      return t.cat === 'Goals';
  }
}

function dayLabel(off: number, today: Date): string {
  if (off === 0) return 'TODAY';
  if (off === -1) return 'YESTERDAY';
  return d(off, today).toUpperCase();
}

export default function ActivityPage() {
  const {data: state} = useAppState();
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(12);
  const [trashOpen, setTrashOpen] = useState(false);

  const restore = useFlow<string>((id) => ({path: `/transactions/${id}/restore`}));
  const purge = useFlow<string>((id) => ({path: `/transactions/${id}/purge`, method: 'DELETE'}));
  const clearTrash = useFlow<void>(() => ({path: '/transactions/trash/clear'}));

  if (!state) return null;
  const today = new Date();

  const txIn = state.txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const txOut = state.txns.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const net = txIn - txOut;

  const filtered = state.txns.filter(
    (t) =>
      matchesFilter(t, filter, state) &&
      (query.trim() === '' || t.label.toLowerCase().includes(query.trim().toLowerCase())),
  );
  const visible = filtered.slice(0, limit);
  const moreCount = Math.min(15, filtered.length - visible.length);

  const groups: {off: number; txns: Txn[]}[] = [];
  for (const t of visible) {
    const last = groups[groups.length - 1];
    if (last && last.off === t.off) last.txns.push(t);
    else groups.push({off: t.off, txns: [t]});
  }

  const stat = (label: string, value: string, color: string, foot: string) => (
    <div
      style={{
        flex: 1,
        minWidth: 120,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '14px 16px',
      }}
    >
      <div style={{fontSize: 11, fontWeight: 600, letterSpacing: '.8px', color: 'var(--muted)'}}>
        {label}
      </div>
      <div className="tnum" style={{fontSize: 22, fontWeight: 700, color, marginTop: 2}}>
        {value}
      </div>
      <div style={{fontSize: 11.5, color: 'var(--muted)', marginTop: 2}}>{foot}</div>
    </div>
  );

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
        {stat('MONEY IN', `+${fm(txIn)}`, 'var(--success)', 'last 14 days')}
        {stat('MONEY OUT', `−${fm(txOut).replace('−', '')}`, 'var(--ink)', 'last 14 days')}
        {stat('NET', fm(net), net >= 0 ? 'var(--success)' : 'var(--danger)', 'this period')}
      </div>

      <div style={{display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center'}}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={filter === f ? ui.chipActive : ui.chip}
            onClick={() => {
              setFilter(f);
              setLimit(12);
            }}
          >
            {f}
          </button>
        ))}
        <input
          className={ui.chip}
          style={{flex: 1, minWidth: 150, cursor: 'text', background: 'var(--surface)'}}
          placeholder="Search activity…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(12);
          }}
        />
      </div>

      {groups.length === 0 ? (
        <div
          style={{
            border: '1.5px dashed var(--border-dash-2)',
            borderRadius: 20,
            padding: 28,
            textAlign: 'center',
            fontSize: 13.5,
            color: 'var(--muted)',
          }}
        >
          Nothing matches — try a different filter or search.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(min(340px,100%),1fr))',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {groups.map((group) => {
            const dayNet = group.txns.reduce((s, t) => s + t.amount, 0);
            return (
              <div
                key={group.off}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 20,
                  padding: '14px 20px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      letterSpacing: '1px',
                      color: 'var(--muted)',
                    }}
                  >
                    {dayLabel(group.off, today)}
                  </span>
                  <span
                    className="tnum"
                    style={{
                      fontSize: 12,
                      fontWeight: 650,
                      color: dayNet > 0 ? 'var(--success)' : 'var(--muted)',
                    }}
                  >
                    {dayNet > 0 ? `+${fm(dayNet)}` : fm(dayNet)}
                  </span>
                </div>
                {group.txns.map((t, i) => (
                  <ActivityRow
                    key={t.id}
                    txn={t}
                    state={state}
                    last={i === group.txns.length - 1}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {moreCount > 0 && (
        <button
          style={{
            border: '1.5px solid var(--border-input)',
            borderRadius: 14,
            padding: 13,
            fontSize: 13,
            fontWeight: 650,
            color: 'var(--ink-2)',
          }}
          onClick={() => setLimit(limit + 15)}
        >
          View {moreCount} more · older activity
        </button>
      )}
      {limit > 12 && (
        <button className={ui.textBtn} onClick={() => setLimit(12)}>
          Collapse to recent
        </button>
      )}

      {state.deletedTxns.length > 0 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 20,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setTrashOpen(!trashOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '14px 20px',
              textAlign: 'left',
            }}
          >
            <span style={{fontSize: 12}}>{trashOpen ? '▾' : '▸'}</span>
            <span style={{fontSize: 13.5, fontWeight: 700}}>Recently deleted</span>
            <span
              className="tnum"
              style={{
                background: 'var(--chip)',
                borderRadius: 999,
                padding: '2px 9px',
                fontSize: 11.5,
                fontWeight: 650,
              }}
            >
              {state.deletedTxns.length}
            </span>
          </button>
          {trashOpen && (
            <div style={{padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8}}>
              <div style={{fontSize: 12, color: 'var(--muted)'}}>
                Restore an entry to bring it back, or delete it for good.
              </div>
              {state.deletedTxns.map((t) => (
                <div
                  key={t.id}
                  style={{display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0'}}
                >
                  <span style={{flex: 1, minWidth: 0}}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: 'var(--ink-2)',
                      }}
                    >
                      {t.label}
                    </span>
                    <span style={{display: 'block', fontSize: 11.5, color: 'var(--muted-2)'}}>
                      {t.cat} · {fm(t.amount)}
                    </span>
                  </span>
                  <button
                    onClick={() => restore.mutate(t.id)}
                    style={{
                      fontSize: 12,
                      fontWeight: 650,
                      color: 'var(--success)',
                      border: '1px solid var(--restore-border)',
                      borderRadius: 9,
                      padding: '5px 11px',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--restore-hover)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    Restore
                  </button>
                  <button
                    title="Delete forever"
                    className={ui.iconBtn}
                    style={{width: 24, height: 24}}
                    onClick={() => purge.mutate(t.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                style={{
                  fontSize: 12.5,
                  fontWeight: 650,
                  color: 'var(--danger)',
                  alignSelf: 'flex-start',
                }}
                onClick={() => clearTrash.mutate()}
              >
                Empty recently deleted
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
