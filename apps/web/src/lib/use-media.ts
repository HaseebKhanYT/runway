'use client';

import {useSyncExternalStore} from 'react';

/** The pair `useSyncExternalStore` compares by identity, for one query string. */
interface MediaQueryStore {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => boolean;
}

const stores = new Map<string, MediaQueryStore>();

/**
 * The hook's store: one `MediaQueryList`, one `subscribe` and one `getSnapshot`
 * per query string, for the life of the page.
 *
 * `useSyncExternalStore` compares `subscribe` by identity and tears the
 * subscription down and back up whenever it changes. Building the closures per
 * call — which is what a curried `subscribe(query)` in the argument list does —
 * therefore churns a `change` listener on every render of every consumer, and
 * churns a `MediaQueryList` on every snapshot read besides. Memoising on the
 * query string is what makes both identities stable across renders and across
 * the three components that call `useMedia`.
 *
 * The `MediaQueryList` is built on first use, not when the entry is created,
 * and that laziness is load-bearing: this module is imported by a server render
 * too, where `window` does not exist. React reads `getServerSnapshot` there and
 * never touches `subscribe` or `getSnapshot`, so nothing calls `matchMedia`
 * until the client takes over — but only as long as the lookup itself stays
 * free of `window`.
 *
 * The map is never pruned. It cannot grow without bound because the only keys
 * are the two breakpoint literals below; a caller passing a computed query
 * string would need this to hold weakly, and none does.
 *
 * Exported for `test/use-media.test.ts`, which has no DOM and so cannot reach
 * this through the hook — it drives the store directly against a fake
 * `matchMedia`. Application code should call `useMedia`.
 */
export function mediaQueryStore(query: string): MediaQueryStore {
  const cached = stores.get(query);
  if (cached) return cached;

  let list: MediaQueryList | undefined;
  const mediaQueryList = () => (list ??= window.matchMedia(query));

  const store: MediaQueryStore = {
    // Each subscriber passes its own `onChange`, so `removeEventListener`
    // matches on that identity and a cleanup can only ever detach its own
    // listener — the shell and both pages watch these queries at once.
    subscribe: (onChange) => {
      const target = mediaQueryList();
      target.addEventListener('change', onChange);
      return () => target.removeEventListener('change', onChange);
    },
    getSnapshot: () => mediaQueryList().matches,
  };
  stores.set(query, store);
  return store;
}

// Two constants rather than `() => serverDefault`, which would hand
// `useSyncExternalStore` a fresh closure on every render and give back the
// identity churn the store exists to remove.
const serverFalse = () => false;
const serverTrue = () => true;

function useMediaQuery(query: string, serverDefault = false): boolean {
  const store = mediaQueryStore(query);
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    serverDefault ? serverTrue : serverFalse,
  );
}

/** The design's breakpoints (catalog §1.0): mobile ≤780, wide-mobile ≥620. */
export function useMedia(): {isMobile: boolean; wideMobile: boolean} {
  const isMobile = useMediaQuery('(max-width: 780px)');
  const wideMobile = useMediaQuery('(min-width: 620px)');
  return {isMobile, wideMobile};
}
