'use client';

import {buildViewModel, PAGE_TITLES, type AppState, type View} from '@runway/shared';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import {useMedia} from '../../lib/use_media';
import {BrandMark} from '../brand/brand_mark';
import {useModals} from '../modals/modal_context';
import {NavIcon} from './nav_icons';
import styles from './shell.module.css';

const NAV_VIEWS: View[] = ['runway', 'bills', 'goals', 'activity', 'cards', 'settings'];
const NAV_LABELS: Record<View, string> = {
  runway: 'Runway',
  bills: 'Bills',
  goals: 'Goals',
  activity: 'Activity',
  cards: 'Cards',
  settings: 'Settings',
};

function currentView(pathname: string): View {
  const seg = pathname.split('/')[1] as View;
  return NAV_VIEWS.includes(seg) ? seg : 'runway';
}

export function Shell({state, children}: {state: AppState; children: ReactNode}) {
  const pathname = usePathname();
  const {isMobile, wideMobile} = useMedia();
  const {openModal} = useModals();
  const view = currentView(pathname);
  const vm = buildViewModel(state, new Date());

  return (
    <div style={{minHeight: '100vh', display: 'flex', background: 'var(--bg)'}}>
      {!isMobile && (
        <div
          style={{
            width: 230,
            flex: 'none',
            borderRight: '1px solid var(--border)',
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            position: 'sticky',
            top: 0,
            height: '100vh',
            boxSizing: 'border-box',
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 9, padding: '0 8px 18px'}}>
            <BrandMark />
            <div style={{fontSize: 18, fontWeight: 700, letterSpacing: '-.3px'}}>Runway</div>
          </div>
          {NAV_VIEWS.map((v) => (
            <Link
              key={v}
              href={`/${v}`}
              className={v === view ? styles.navItemActive : styles.navItem}
            >
              <span>{NAV_LABELS[v]}</span>
              {v === 'bills' && vm.unpaidBillCount > 0 && (
                <span style={{fontSize: 11.5, fontWeight: 600, color: 'var(--muted)'}}>
                  {vm.unpaidBillCount}
                </span>
              )}
            </Link>
          ))}
          <button className={styles.addExpenseBtn} onClick={() => openModal('addExpense')}>
            + Add expense
          </button>
          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '16px 14px',
              border: '1px solid var(--border)',
              borderRadius: 14,
              background: 'var(--surface)',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '.8px',
                color: 'var(--muted)',
              }}
            >
              SAFE / DAY
            </div>
            <div
              className="tnum"
              style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: '-.5px',
                lineHeight: 1,
                color: vm.perDayColor,
              }}
            >
              {vm.perDayF}
            </div>
            <div style={{fontSize: 11.5, lineHeight: 1.35, color: 'var(--muted)'}}>
              {vm.perDaySub}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: 'clamp(16px,3vw,32px)',
          paddingBottom: 110,
          maxWidth: 1180,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{fontSize: 'clamp(22px,3vw,28px)', fontWeight: 700, letterSpacing: '-.4px'}}
            >
              {PAGE_TITLES[view]}
            </div>
            <div style={{fontSize: 13, color: 'var(--muted)', marginTop: 2}}>{vm.todayLabel}</div>
          </div>
          <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
            <button
              className={`${styles.balanceChip} tnum`}
              title="Manage accounts"
              onClick={() => openModal('accounts')}
            >
              <span style={{color: 'var(--muted)', fontWeight: 600}}>balance</span>
              <span>{vm.balanceF}</span>
              <span style={{fontSize: 11.5, color: 'var(--muted)'}}>{vm.acctChipTag}</span>
            </button>
            <div className={styles.paydayChip}>payday in {vm.daysToPay}d</div>
          </div>
        </div>
        {children}
      </div>

      {isMobile && (
        <>
          <nav className={wideMobile ? styles.padNav : styles.phoneNav}>
            {NAV_VIEWS.map((v) => (
              <Link
                key={v}
                href={`/${v}`}
                className={v === view ? styles.phoneNavItemActive : styles.phoneNavItem}
                aria-label={NAV_LABELS[v]}
              >
                <NavIcon view={v} />
                {wideMobile && <span>{NAV_LABELS[v]}</span>}
              </Link>
            ))}
          </nav>
          <button
            className={wideMobile ? styles.fabPad : styles.fab}
            aria-label="Add expense"
            onClick={() => openModal('addExpense')}
          >
            +
          </button>
        </>
      )}
    </div>
  );
}
