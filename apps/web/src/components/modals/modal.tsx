'use client';

import {useEffect, type ReactNode} from 'react';

/** Shared modal chrome: scrim, sheet, fadeUp, Escape to close (catalog §2.2). */
export function Modal({
  onClose,
  children,
  z = 50,
  width = 'min(400px,100%)',
}: {
  onClose: () => void;
  children: ReactNode;
  z?: number;
  width?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        zIndex: z,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 22,
          padding: 24,
          width,
          maxHeight: '88vh',
          overflowY: 'auto',
          animation: 'fadeUp .18s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalTitle({title, onClose}: {title: string; onClose: () => void}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
      }}
    >
      <div style={{fontSize: 16, fontWeight: 700}}>{title}</div>
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--chip)',
          color: 'var(--ink-2)',
          fontSize: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  );
}
