import type {ReactNode} from 'react';
import {BrandMark} from '../components/brand/brand_mark';

/** Clerk appearance tuned to the design's warm auth card (catalog §1.8). */
export const clerkAppearance = {
  variables: {
    colorPrimary: '#2E8C5A',
    colorBackground: '#fffcf6',
    colorText: '#29221a',
    colorTextSecondary: '#8d8070',
    colorInputBackground: '#faf5eb',
    colorInputText: '#29221a',
    borderRadius: '11px',
    fontFamily: 'inherit',
  },
  elements: {
    card: {
      border: '1px solid #e7dcc8',
      borderRadius: '22px',
      boxShadow: 'none',
    },
    headerTitle: {fontWeight: 700},
  },
} as const;

export function AuthShell({tagline, children}: {tagline: string; children: ReactNode}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        overflowY: 'auto',
        zIndex: 80,
      }}
    >
      <div
        style={{
          width: 'min(400px,100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          animation: 'fadeUp .25s ease-out',
        }}
      >
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <BrandMark size={48} stroke={3.5} />
          <div style={{fontSize: 27, fontWeight: 700, letterSpacing: '-.6px'}}>Runway</div>
          <div
            style={{
              fontSize: 13.5,
              color: 'var(--muted)',
              maxWidth: 280,
              textAlign: 'center',
              lineHeight: 1.45,
            }}
          >
            {tagline}
          </div>
        </div>
        {children}
        <div style={{fontSize: 12, color: 'var(--muted-2)', textAlign: 'center'}}>
          No bank login, ever · everything stays on your device.
        </div>
      </div>
    </div>
  );
}
