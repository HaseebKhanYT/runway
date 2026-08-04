'use client';

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useEffect, useState, type ReactNode} from 'react';
import {ModalProvider} from '../../components/modals/modal-context';
import {ModalHost} from '../../components/modals/modal-host';
import {Onboarding} from '../../components/onboarding/onboarding';
import {Shell} from '../../components/shell/shell';
import {API_URL} from '../../lib/api-client';
import {describeApiFailure} from '../../lib/api-error';
import {useAppState} from '../../lib/queries';

function AppFrame({children}: {children: ReactNode}) {
  const {data: state, isLoading, error} = useAppState();

  // The screen below is deliberately short; the console keeps the whole error,
  // including the `cause` the browser attached, so there is a second place to
  // look.
  useEffect(() => {
    if (error) console.error('Runway API request failed:', error);
  }, [error]);

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
    const {headline, detail} = describeApiFailure(
      error,
      API_URL,
      typeof window === 'undefined' ? null : window.location.origin,
    );
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{color: 'var(--danger)', fontSize: 14, fontWeight: 650}}>{headline}</div>
        <p style={{color: 'var(--muted)', fontSize: 12.5, lineHeight: 1.5, maxWidth: 460}}>
          {detail}
        </p>
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
