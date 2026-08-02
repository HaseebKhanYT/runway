'use client';

import {useSyncExternalStore} from 'react';

function subscribe(query: string) {
  return (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  };
}

function useMediaQuery(query: string, serverDefault = false): boolean {
  return useSyncExternalStore(
    subscribe(query),
    () => window.matchMedia(query).matches,
    () => serverDefault,
  );
}

/** The design's breakpoints (catalog §1.0): mobile ≤780, wide-mobile ≥620. */
export function useMedia(): {isMobile: boolean; wideMobile: boolean} {
  const isMobile = useMediaQuery('(max-width: 780px)');
  const wideMobile = useMediaQuery('(min-width: 620px)');
  return {isMobile, wideMobile};
}
