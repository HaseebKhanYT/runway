'use client';

import {useEffect, useRef, useState} from 'react';

/**
 * The app-wide polite live region pair (#88).
 *
 * Two regions, not one: writing the same string into the same region is not a
 * DOM mutation, so a second bill paid for the same resulting pace would say
 * nothing at all. Each announcement lands in the slot that did not hold the
 * previous one, which makes every settle a real change no matter how the text
 * compares to the last.
 *
 * Both start empty and stay empty through the first effect run. A live region
 * that arrives in the accessibility tree at the same moment as its content is
 * frequently not announced, and a page load is not a money event anyway.
 */
export function LiveRegion({message, signature}: {message: string; signature: string}) {
  const [slotA, setSlotA] = useState('');
  const [slotB, setSlotB] = useState('');
  const lastSignature = useRef<string | null>(null);
  const useSlotA = useRef(true);

  useEffect(() => {
    // `message` is not a dependency on purpose. The announcement is tied to the
    // money settling, not to the string: the same figure can be re-announced
    // after a second mutation, and a re-worded tail with the money untouched is
    // not news. `signature` is the only thing that decides when we speak.
    //
    // The guard compares the stored signature rather than counting mounts.
    // React runs an effect twice on mount under StrictMode, which the App
    // Router turns on in development, so a "have we run yet" flag spends its
    // first run on the baseline and announces on the second — measured in a
    // browser, that put the figure in the region on page load, before anyone
    // had moved any money. A remount is caught by the same comparison.
    if (lastSignature.current === signature) return;
    const baseline = lastSignature.current === null;
    lastSignature.current = signature;
    if (baseline) return;
    if (useSlotA.current) {
      setSlotA(message);
      setSlotB('');
    } else {
      setSlotB(message);
      setSlotA('');
    }
    useSlotA.current = !useSlotA.current;
  }, [signature]);

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="srOnly">
        {slotA}
      </div>
      <div role="status" aria-live="polite" aria-atomic="true" className="srOnly">
        {slotB}
      </div>
    </>
  );
}
