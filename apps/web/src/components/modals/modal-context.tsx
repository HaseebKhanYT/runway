'use client';

import {createContext, useCallback, useContext, useMemo, useState, type ReactNode} from 'react';

export type ModalName = 'addExpense' | 'category' | 'accounts' | 'paySource' | 'payday' | 'loan';

export interface ModalRequest {
  name: ModalName;
  props?: Record<string, unknown>;
}

interface ModalContextValue {
  stack: ModalRequest[];
  openModal: (name: ModalName, props?: Record<string, unknown>) => void;
  closeModal: () => void;
  closeAll: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({children}: {children: ReactNode}) {
  const [stack, setStack] = useState<ModalRequest[]>([]);
  const openModal = useCallback((name: ModalName, props?: Record<string, unknown>) => {
    setStack((s) => [...s, {name, props}]);
  }, []);
  const closeModal = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const closeAll = useCallback(() => setStack([]), []);
  const value = useMemo(
    () => ({stack, openModal, closeModal, closeAll}),
    [stack, openModal, closeModal, closeAll],
  );
  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModals(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModals outside ModalProvider');
  return ctx;
}
