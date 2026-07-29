'use client';

import {fm, pooledBalance, type AccountType, type AppState} from '@runway/shared';
import {useState} from 'react';
import {useFlow} from '../../lib/queries';
import ui from '../ui/ui.module.css';
import {Modal, ModalTitle} from './modal';
import {useModals} from './modal_context';

const TYPE_META: Record<AccountType, {label: string; glyph: string; bg: string; fg: string}> = {
  checking: {label: 'Checking', glyph: '⌂', bg: '#29221a', fg: '#f6f0e6'},
  cash: {label: 'Cash', glyph: '$', bg: '#2e6d4f', fg: '#eef6f0'},
  savings: {label: 'Savings', glyph: '★', bg: '#8b6fd8', fg: '#f4f0fc'},
};

const LOGOS: {value: string; label: string}[] = [
  {value: '', label: 'Default icon'},
  {value: '/banks/chase.png', label: 'Chase'},
  {value: '/banks/bank-of-america.png', label: 'Bank of America'},
];

interface FormState {
  id: string | null;
  isPrimary: boolean;
  name: string;
  type: AccountType;
  logo: string;
  balanceRaw: string;
}

export function AccountsModal({state}: {state: AppState}) {
  const {closeModal} = useModals();
  const [form, setForm] = useState<FormState | null>(null);

  const saveAccount = useFlow<FormState>((f) => ({
    path: f.id ? `/accounts/${f.id}` : '/accounts',
    method: f.id ? 'PATCH' : 'POST',
    json: {
      name: f.name.trim(),
      type: f.type,
      balance: parseFloat(f.balanceRaw) || 0,
      logo: f.logo || null,
    },
  }));
  const savePrimary = useFlow<FormState>((f) => ({
    path: '/profile',
    method: 'PATCH',
    json: {
      primaryName: f.name.trim(),
      primaryBalance: parseFloat(f.balanceRaw) || 0,
      primaryLogo: f.logo || null,
    },
  }));
  const removeAccount = useFlow<string>((id) => ({path: `/accounts/${id}`, method: 'DELETE'}));

  const submit = () => {
    if (!form || !form.name.trim()) return;
    const flow = form.isPrimary ? savePrimary : saveAccount;
    flow.mutate(form, {onSuccess: () => setForm(null)});
  };

  const iconTile = (type: AccountType, logo: string | null) => {
    if (logo) {
      return (
        <span
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: '#fff',
            border: '1px solid #eadfca',
            padding: 5,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" style={{maxWidth: '100%', maxHeight: '100%'}} />
        </span>
      );
    }
    const meta = TYPE_META[type];
    return (
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: meta.bg,
          color: meta.fg,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 17,
          flex: 'none',
        }}
      >
        {meta.glyph}
      </span>
    );
  };

  const rows = [
    {
      id: 'primary',
      isPrimary: true,
      name: state.profile.primaryName,
      type: 'checking' as AccountType,
      balance: state.profile.primaryBalance,
      logo: state.profile.primaryLogo,
    },
    ...state.accounts.map((a) => ({
      id: a.id,
      isPrimary: false,
      name: a.name,
      type: a.type,
      balance: a.balance,
      logo: a.logo,
    })),
  ];

  return (
    <Modal onClose={closeModal}>
      <ModalTitle title="Your accounts" onClose={closeModal} />
      <div style={{fontSize: 12.5, color: 'var(--muted)', marginBottom: 14}}>
        Everything spendable — the total drives your runway.
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
        <div
          style={{
            background: 'var(--ink)',
            color: 'var(--on-dark)',
            borderRadius: 16,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.8px',
              color: 'var(--on-dark-muted-2)',
            }}
          >
            TOTAL BALANCE
          </span>
          <span className="tnum" style={{fontSize: 24, fontWeight: 700, letterSpacing: '-.5px'}}>
            {fm(pooledBalance(state))}
          </span>
        </div>

        {rows.map((row) => (
          <div
            key={row.id}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '13px 15px',
              background: 'var(--surface-alt)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {iconTile(row.type, row.logo)}
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 14, fontWeight: 650}}>{row.name}</div>
              <div style={{fontSize: 11.5, color: 'var(--muted)'}}>{TYPE_META[row.type].label}</div>
            </div>
            <div className="tnum" style={{fontSize: 15, fontWeight: 700}}>
              {fm(row.balance)}
            </div>
            <button
              className={ui.iconBtn}
              aria-label={`Edit ${row.name}`}
              onClick={() =>
                setForm({
                  id: row.isPrimary ? 'primary' : row.id,
                  isPrimary: row.isPrimary,
                  name: row.name,
                  type: row.type,
                  logo: row.logo ?? '',
                  balanceRaw: String(row.balance),
                })
              }
            >
              ✎
            </button>
            {!row.isPrimary && (
              <button
                className={ui.iconBtn}
                aria-label={`Remove ${row.name}`}
                onClick={() => removeAccount.mutate(row.id)}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        {!form && (
          <>
            <button
              className={ui.dashedCta}
              onClick={() =>
                setForm({
                  id: null,
                  isPrimary: false,
                  name: '',
                  type: 'checking',
                  logo: '',
                  balanceRaw: '',
                })
              }
            >
              + Add an account
            </button>
            <div
              className={ui.dashedCta}
              style={{opacity: 0.55, cursor: 'default'}}
              title="Plaid integration coming soon"
            >
              Connect a bank — coming soon
            </div>
          </>
        )}

        {form && (
          <div
            style={{
              border: '1.5px solid var(--ink)',
              borderRadius: 14,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              animation: 'fadeUp .18s ease-out',
            }}
          >
            <div>
              <div className={ui.label}>NAME</div>
              <input
                autoFocus
                className={ui.input}
                placeholder="e.g. Chase Checking, Wallet cash…"
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
            {!form.isPrimary && (
              <div>
                <div className={ui.label}>TYPE</div>
                <div style={{display: 'flex', gap: 7}}>
                  {(Object.keys(TYPE_META) as AccountType[]).map((t) => (
                    <button
                      key={t}
                      className={form.type === t ? ui.chipActive : ui.chip}
                      onClick={() => setForm({...form, type: t})}
                    >
                      {TYPE_META[t].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className={ui.label}>LOGO</div>
              <select
                className={ui.input}
                value={form.logo}
                onChange={(e) => setForm({...form, logo: e.target.value})}
              >
                {LOGOS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className={ui.label}>BALANCE</div>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <span style={{fontSize: 15, fontWeight: 600, color: 'var(--muted)'}}>$</span>
                <input
                  className={`${ui.input} tnum`}
                  inputMode="decimal"
                  placeholder="0"
                  value={form.balanceRaw}
                  onChange={(e) =>
                    setForm({...form, balanceRaw: e.target.value.replace(/[^0-9.\-]/g, '')})
                  }
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </div>
            </div>
            <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
              <button className={ui.btnGhost} onClick={() => setForm(null)}>
                Cancel
              </button>
              <button
                className={ui.btnPrimary}
                style={{width: 'auto', padding: '9px 18px'}}
                disabled={!form.name.trim()}
                onClick={submit}
              >
                {form.id ? 'Save changes' : 'Add account'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
