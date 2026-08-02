'use client';

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useState, type ReactNode} from 'react';
import {ModalProvider} from '../../components/modals/modal-context';
import {ModalHost} from '../../components/modals/modal-host';
import {Onboarding} from '../../components/onboarding/onboarding';
import {Shell} from '../../components/shell/shell';
import {useAppState} from '../../lib/queries';

function AppFrame({children}: {children: ReactNode}) {
  const {data: state, isLoading, error} = useAppState();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          fontSize: 14,
        }}
      >
        Loading your runway…
      </div>
    );
  }
  if (error || !state) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--danger)',
          fontSize: 14,
          padding: 24,
          textAlign: 'center',
        }}
      >
        Couldn&apos;t reach the Runway API — is it running on port 8787?
      </div>
    );
  }
  if (!state.profile.onboarded) {
    return <Onboarding />;
  }
  return (
    <>
      <Shell state={state}>{children}</Shell>
      <ModalHost state={state} />
    </>
  );
}

export default function AppLayout({children}: {children: ReactNode}) {
  const [queryClient] = useState(() => new QueryClient({defaultOptions: {queries: {retry: 1}}}));
  return (
    <QueryClientProvider client={queryClient}>
      <ModalProvider>
        <AppFrame>{children}</AppFrame>
      </ModalProvider>
    </QueryClientProvider>
  );
}
