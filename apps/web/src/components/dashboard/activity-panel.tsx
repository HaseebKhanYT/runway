'use client';

import type {AppState} from '@runway/shared';
import Link from 'next/link';
import {ActivityRow} from '../activity/activity-row';
import ui from '../ui/ui.module.css';

/** Recent activity panel — first 7 txns (catalog §1.1D). */
export function ActivityPanel({state}: {state: AppState}) {
  const txns = state.txns.slice(0, 7);
  return (
    <div className={ui.card}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <div style={{fontSize: 13, fontWeight: 700, letterSpacing: '.3px'}}>Recent activity</div>
        <Link
          href="/activity"
          style={{
            fontSize: 12,
            fontWeight: 650,
            color: 'var(--accent)',
            textDecoration: 'none',
          }}
        >
          View all →
        </Link>
      </div>
      <div>
        {txns.map((t, i) => (
          <ActivityRow key={t.id} txn={t} state={state} last={i === txns.length - 1} />
        ))}
      </div>
    </div>
  );
}
