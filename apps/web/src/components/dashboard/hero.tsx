'use client';

import type {ViewModel} from '../../lib/view-model';

/** Dashboard hero (catalog §1.1A). */
export function Hero({vm}: {vm: ViewModel}) {
  return (
    <div
      style={{
        background: 'var(--ink)',
        color: 'var(--on-dark)',
        borderRadius: 20,
        padding: '22px 24px',
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: '1px',
          color: 'var(--on-dark-muted)',
        }}
      >
        {vm.heroLabel}
      </div>
      <div
        className="tnum"
        style={{
          fontSize: 'clamp(42px,6vw,58px)',
          fontWeight: 700,
          letterSpacing: '-1.5px',
          lineHeight: 1.05,
          color: vm.heroColor,
        }}
      >
        {vm.heroNumber}
      </div>
      <div style={{fontSize: 13.5, color: 'var(--on-dark-muted)', marginTop: 4}}>{vm.heroSub}</div>
    </div>
  );
}
