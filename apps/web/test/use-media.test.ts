import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

/**
 * `useMedia` is a hook and this suite runs in node with no DOM, so the tests
 * drive `mediaQueryStore` — the memo the hook is a thin wrapper over — against
 * a hand-written `matchMedia`. What is worth locking here is identity and
 * bookkeeping, not React's plumbing: a real `MediaQueryList` would hide how
 * many were constructed and which listener a cleanup detached, which is exactly
 * what the defect was about.
 */

const MOBILE = '(max-width: 780px)';
const WIDE = '(min-width: 620px)';

interface FakeMediaQueryList {
  query: string;
  matches: boolean;
  listeners: (() => void)[];
  adds: number;
  removes: number;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

/** Every list handed out, in construction order — the count is the assertion. */
let created: FakeMediaQueryList[];

function fakeMatchMedia(query: string): FakeMediaQueryList {
  const listeners: (() => void)[] = [];
  const list: FakeMediaQueryList = {
    query,
    matches: false,
    listeners,
    adds: 0,
    removes: 0,
    addEventListener(_type, listener) {
      list.adds += 1;
      listeners.push(listener);
    },
    removeEventListener(_type, listener) {
      list.removes += 1;
      const at = listeners.indexOf(listener);
      if (at !== -1) listeners.splice(at, 1);
    },
  };
  created.push(list);
  return list;
}

/** The one list built for `query`, asserting on the way that there is only one. */
function onlyListFor(query: string): FakeMediaQueryList {
  const matching = created.filter((list) => list.query === query);
  expect(matching).toHaveLength(1);
  return matching[0];
}

/**
 * The store is module-level state. Without a fresh registry per test a memo
 * built by an earlier test would answer a later one, and the suite would pass
 * for the wrong reason — so reset modules and re-import inside every test.
 */
const load = () => import('../src/lib/use-media');

beforeEach(() => {
  created = [];
  vi.resetModules();
  vi.stubGlobal('window', {matchMedia: fakeMatchMedia});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('mediaQueryStore', () => {
  it('touches no window at lookup time, which is what keeps a server render alive', async () => {
    vi.stubGlobal('window', undefined);
    const {mediaQueryStore} = await load();

    const store = mediaQueryStore(MOBILE);

    expect(created).toHaveLength(0);
    // Proves the stub really was in force, so the line above is not passing
    // because some ambient `window` quietly answered.
    expect(() => store.getSnapshot()).toThrow();
  });

  it('builds one MediaQueryList per query however often it is looked up', async () => {
    const {mediaQueryStore} = await load();

    for (let i = 0; i < 5; i += 1) {
      const store = mediaQueryStore(MOBILE);
      store.getSnapshot();
      store.subscribe(() => {})();
    }

    expect(created).toHaveLength(1);
    expect(created[0].query).toBe(MOBILE);
  });

  it('keeps one subscribe identity per query, which is what stops React re-subscribing', async () => {
    const {mediaQueryStore} = await load();

    expect(mediaQueryStore(MOBILE).subscribe).toBe(mediaQueryStore(MOBILE).subscribe);
    expect(mediaQueryStore(WIDE).subscribe).toBe(mediaQueryStore(WIDE).subscribe);
  });

  it('keeps one getSnapshot identity per query', async () => {
    const {mediaQueryStore} = await load();

    expect(mediaQueryStore(MOBILE).getSnapshot).toBe(mediaQueryStore(MOBILE).getSnapshot);
    expect(mediaQueryStore(WIDE).getSnapshot).toBe(mediaQueryStore(WIDE).getSnapshot);
  });

  it('gives concurrent subscribers their own listener on the shared list', async () => {
    const {mediaQueryStore} = await load();
    const shell = vi.fn();
    const page = vi.fn();

    mediaQueryStore(MOBILE).subscribe(shell);
    mediaQueryStore(MOBILE).subscribe(page);

    const list = onlyListFor(MOBILE);
    expect(list.adds).toBe(2);
    expect(list.listeners).toEqual([shell, page]);
  });

  it('detaches only the listener whose cleanup ran', async () => {
    const {mediaQueryStore} = await load();
    const shell = vi.fn();
    const page = vi.fn();

    const unsubscribeShell = mediaQueryStore(MOBILE).subscribe(shell);
    mediaQueryStore(MOBILE).subscribe(page);
    unsubscribeShell();

    const list = onlyListFor(MOBILE);
    expect(list.removes).toBe(1);
    expect(list.listeners).toEqual([page]);

    // The survivor still hears a breakpoint change.
    for (const listener of [...list.listeners]) listener();
    expect(page).toHaveBeenCalledTimes(1);
    expect(shell).not.toHaveBeenCalled();
  });

  it('reads the current matches rather than the one it was built with', async () => {
    const {mediaQueryStore} = await load();
    const store = mediaQueryStore(MOBILE);
    expect(store.getSnapshot()).toBe(false);

    onlyListFor(MOBILE).matches = true;

    expect(store.getSnapshot()).toBe(true);
  });

  it('keys on the query string, so the two breakpoints never share a store', async () => {
    const {mediaQueryStore} = await load();

    const mobile = mediaQueryStore(MOBILE);
    const wide = mediaQueryStore(WIDE);
    expect(mobile).not.toBe(wide);
    expect(mobile.subscribe).not.toBe(wide.subscribe);
    expect(mobile.getSnapshot).not.toBe(wide.getSnapshot);

    mobile.getSnapshot();
    wide.getSnapshot();
    expect(created.map((list) => list.query)).toEqual([MOBILE, WIDE]);

    onlyListFor(WIDE).matches = true;
    expect(mobile.getSnapshot()).toBe(false);
    expect(wide.getSnapshot()).toBe(true);
  });
});
