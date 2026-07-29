'use client';

/** The design's 44×26 toggle (catalog §1.6). */
export function Toggle({on, onFlip}: {on: boolean; onFlip: () => void}) {
  return (
    <button
      onClick={onFlip}
      role="switch"
      aria-checked={on}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        background: on ? 'var(--accent)' : 'var(--border-input)',
        position: 'relative',
        flex: 'none',
        transition: 'background .2s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(41,34,26,.25)',
          transform: on ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform .2s',
        }}
      />
    </button>
  );
}
