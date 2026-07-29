import type {CSSProperties} from 'react';
import type {View} from '@runway/shared';

/** Pure-CSS nav glyphs (catalog §1.0 navIcons) — no icon font. */
export function NavIcon({view}: {view: View}) {
  const styles: Record<View, CSSProperties> = {
    runway: {
      width: 18,
      height: 2.5,
      background: 'currentColor',
      borderRadius: 2,
      transform: 'rotate(-32deg)',
    },
    bills: {
      width: 12,
      height: 7,
      borderLeft: '2.5px solid currentColor',
      borderBottom: '2.5px solid currentColor',
      transform: 'rotate(-45deg)',
      marginTop: -3,
    },
    goals: {
      width: 14,
      height: 14,
      borderRadius: '50%',
      border: '2.5px solid currentColor',
    },
    activity: {
      width: 15,
      height: 11,
      borderTop: '2.5px solid currentColor',
      borderBottom: '2.5px solid currentColor',
    },
    cards: {
      width: 17,
      height: 12,
      borderRadius: 3.5,
      border: '2px solid currentColor',
      background:
        'linear-gradient(to bottom, transparent 2px, currentColor 2px, currentColor 4px, transparent 4px)',
    },
    settings: {
      width: 15,
      height: 15,
      borderRadius: '50%',
      border: '2.5px solid currentColor',
      background: 'radial-gradient(circle, currentColor 2.5px, transparent 3px)',
    },
  };
  return (
    <span
      style={{
        width: 20,
        height: 18,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={styles[view]} />
    </span>
  );
}
