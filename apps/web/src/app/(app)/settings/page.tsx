'use client';

import {useClerk} from '@clerk/nextjs';
import {type Cadence} from '@runway/shared';
import {formatMoney} from '../../../lib/format';
import Link from 'next/link';
import {useState, type ReactNode} from 'react';
import {Onboarding} from '../../../components/onboarding/onboarding';
import {Toggle} from '../../../components/ui/toggle';
import ui from '../../../components/ui/ui.module.css';
import {useAppState, useFlow} from '../../../lib/queries';

function Panel({title, children}: {title: string; children: ReactNode}) {
  return (
    <div
      className={ui.card}
      style={{
        breakInside: 'avoid',
        margin: '0 0 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{fontSize: 13, fontWeight: 700, letterSpacing: '.3px'}}>{title}</div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const {data: state} = useAppState();
  const {signOut} = useClerk();
  const [rerunSetup, setRerunSetup] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  const patchProfile = useFlow<Record<string, unknown>>((json) => ({
    path: '/profile',
    method: 'PATCH',
    json,
  }));
  const resetDemo = useFlow<void>(() => ({path: '/reset-demo'}));

  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [balanceRaw, setBalanceRaw] = useState<string | null>(null);
  const [payRaw, setPayRaw] = useState<string | null>(null);

  if (!state) return null;
  if (rerunSetup) return <Onboarding onExit={() => setRerunSetup(false)} />;

  const profile = state.profile;
  const displayName = name ?? profile.name;
  const displayEmail = email ?? profile.email;
  const initials =
    displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';

  const totalDebt = state.cards.reduce((s, c) => s + c.balance, 0);
  const available = Math.max(0, state.cards.reduce((s, c) => s + c.limit, 0) - totalDebt);
  const cardsSummary =
    state.cards.length > 0
      ? `${state.cards.length} card${state.cards.length === 1 ? '' : 's'} · ${formatMoney(totalDebt)} debt · ${formatMoney(available)} available`
      : 'none yet — add them to unlock financing advice';

  const paydayLabel = profile.nextPay
    ? new Date(profile.nextPay + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const settingRow = (label: string, sub: string, control: ReactNode) => (
    <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontSize: 13.5, fontWeight: 650}}>{label}</div>
        <div style={{fontSize: 11.5, color: 'var(--muted)'}}>{sub}</div>
      </div>
      {control}
    </div>
  );

  return (
    <div style={{columns: '340px', columnGap: 16}}>
      <Panel title="Profile">
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--ink)',
              color: 'var(--on-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              flex: 'none',
            }}
          >
            {initials}
          </div>
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 8}}>
            <input
              className={ui.input}
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name !== null && patchProfile.mutate({name})}
            />
            <input
              className={ui.input}
              placeholder="you@example.com"
              value={displayEmail}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => email !== null && patchProfile.mutate({email})}
            />
          </div>
        </div>
        <div style={{borderTop: '1px solid var(--divider-2)', paddingTop: 12, textAlign: 'right'}}>
          <button className={ui.btnGhost} onClick={() => signOut({redirectUrl: '/sign-in'})}>
            Sign out
          </button>
        </div>
      </Panel>

      <Panel title="Money">
        {settingRow(
          'Current balance',
          "what's in checking right now",
          <div style={{display: 'flex', alignItems: 'center', gap: 5}}>
            <span style={{fontSize: 13, fontWeight: 600, color: 'var(--muted)'}}>$</span>
            <input
              className={`${ui.input} tnum`}
              style={{width: 110}}
              inputMode="decimal"
              value={balanceRaw ?? String(profile.primaryBalance)}
              onChange={(e) => setBalanceRaw(e.target.value.replace(/[^0-9.\-]/g, ''))}
              onBlur={() =>
                balanceRaw !== null &&
                patchProfile.mutate({primaryBalance: parseFloat(balanceRaw) || 0})
              }
            />
          </div>,
        )}
        {settingRow(
          'Paycheck amount',
          'what lands on payday',
          <div style={{display: 'flex', alignItems: 'center', gap: 5}}>
            <span style={{fontSize: 13, fontWeight: 600, color: 'var(--muted)'}}>$</span>
            <input
              className={`${ui.input} tnum`}
              style={{width: 110}}
              inputMode="decimal"
              value={payRaw ?? String(profile.payAmount)}
              onChange={(e) => setPayRaw(e.target.value.replace(/[^0-9.]/g, ''))}
              onBlur={() =>
                payRaw !== null && patchProfile.mutate({payAmount: parseFloat(payRaw) || 0})
              }
            />
          </div>,
        )}
        <div>
          {settingRow(
            'Pay cycle',
            'how often you get paid',
            <span style={{fontSize: 12, color: 'var(--muted)'}}>next {paydayLabel}</span>,
          )}
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginTop: 10}}>
            {(
              [
                ['weekly', 'Weekly'],
                ['biweekly', 'Every 2 weeks'],
                ['monthly', 'Monthly'],
              ] as [Cadence, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                className={profile.cadence === value ? ui.chipActive : ui.chip}
                style={{textAlign: 'center'}}
                onClick={() => patchProfile.mutate({cadence: value})}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="date"
            className={ui.input}
            style={{marginTop: 10}}
            value={profile.nextPay ?? ''}
            onChange={(e) => patchProfile.mutate({nextPay: e.target.value || null})}
          />
        </div>
      </Panel>

      <Panel title="Credit cards">
        <div style={{fontSize: 12.5, color: 'var(--muted)'}}>{cardsSummary}</div>
        <Link href="/cards" style={{textDecoration: 'none'}}>
          <span className={ui.btnGhost} style={{display: 'inline-block'}}>
            Manage →
          </span>
        </Link>
      </Panel>

      <Panel title="Notifications">
        {settingRow(
          'Bill reminders',
          'nudge me the day before a bill is due',
          <Toggle
            on={profile.notifBills}
            onFlip={() => patchProfile.mutate({notifBills: !profile.notifBills})}
          />,
        )}
        {settingRow(
          'Payday summary',
          'a recap when your paycheck lands',
          <Toggle
            on={profile.notifWeekly}
            onFlip={() => patchProfile.mutate({notifWeekly: !profile.notifWeekly})}
          />,
        )}
      </Panel>

      <Panel title="Run setup again">
        <div style={{fontSize: 12.5, color: 'var(--muted)'}}>
          the 2-minute first-run flow — replaces your data when you finish
        </div>
        <button
          className={ui.btnGhost}
          style={{alignSelf: 'flex-start'}}
          onClick={() => setRerunSetup(true)}
        >
          Run setup
        </button>
      </Panel>

      <Panel title="Reset app data">
        <div style={{fontSize: 12.5, color: 'var(--muted)'}}>
          wipes balances, bills, activity and goals back to the demo state
        </div>
        <button
          style={{
            alignSelf: 'flex-start',
            padding: '9px 16px',
            borderRadius: 11,
            fontSize: 12.5,
            fontWeight: 650,
            ...(resetArmed
              ? {background: 'var(--danger)', color: '#fff'}
              : {border: '1.5px solid var(--danger)', color: 'var(--danger)'}),
          }}
          onClick={() => {
            if (!resetArmed) {
              setResetArmed(true);
              setTimeout(() => setResetArmed(false), 4000);
            } else {
              resetDemo.mutate(undefined, {onSuccess: () => setResetArmed(false)});
            }
          }}
        >
          {resetArmed ? 'Tap again to confirm' : 'Reset all data'}
        </button>
      </Panel>
    </div>
  );
}
