'use client';

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

/**
 * Carries the sheet's `aria-labelledby` target down to `ModalTitle`. Every
 * consumer renders the title as an ordinary child, so a context is what lets the
 * label wire itself up without any of the six modals changing.
 */
const ModalTitleIdContext = createContext<string | undefined>(undefined);

/**
 * The tabbable set that actually occurs in these modals. `[tabindex="-1"]` is
 * excluded so a programmatic-focus target never becomes a Tab stop, and the
 * filter below drops elements with no box, because a hidden branch of a modal is
 * still in the DOM and would otherwise trap Tab on something invisible.
 */
const FOCUSABLE = ['a[href]', 'button', 'input', 'select', 'textarea', '[tabindex]']
  .map((sel) => `${sel}:not(:disabled):not([tabindex="-1"])`)
  .join(',');

function tabStops(sheet: HTMLElement): HTMLElement[] {
  return Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0,
  );
}

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
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Read during render rather than from the layout effect below, and it has to
  // stay that way: React applies a descendant's `autoFocus` through commitMount
  // in the layout phase, and layout effects run child before parent, so by the
  // time the effect runs `document.activeElement` is already add-expense's own
  // amount input. Capturing there recorded the input as the trigger, it
  // unmounted with the modal, and the restore below no-oped onto `<body>`.
  // Render runs before React commits anything, which is the last moment the
  // active element is still the button that opened the modal. Next.js renders
  // this client component on the server too, hence the `document` guard.
  const [trigger] = useState<Element | null>(() =>
    typeof document === 'undefined' ? null : document.activeElement,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useLayoutEffect(() => {
    const sheet = sheetRef.current;

    // add-expense, category, loan and payday each set `autoFocus` on a field, and
    // React has applied it by the time a layout effect runs, so focusing
    // unconditionally would take it straight back off them. When nothing inside
    // claimed focus it goes to the sheet rather than to the first control:
    // that control is the ✕ — and in pay-source a payment button, which would
    // pre-select a money decision — whereas the labelled container is what a
    // screen reader announces as the dialog.
    if (sheet && !sheet.contains(document.activeElement)) sheet.focus();

    return () => {
      // Restoring from the cleanup rather than from each close path is what
      // makes Escape, the ✕ and a scrim click behave alike. A trigger can still
      // vanish while the modal is open — deleting the row it lived in, say — and
      // focusing a detached node is a silent no-op, so the guard is there to say
      // that case is understood rather than overlooked.
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [trigger]);

  // Tab is trapped from the sheet's own handler and not from `window` because
  // modals genuinely stack — add-expense's `+ New` pushes the category modal on
  // top — and one window listener per mounted modal would leave them fighting
  // over the same keypress. A handler here runs only while focus is inside this
  // sheet, which, once the trap holds, is true of the top modal alone.
  const trapTab = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const stops = tabStops(sheet);
    if (stops.length === 0) {
      // Nothing to move to; swallowing Tab keeps focus on the sheet instead of
      // handing it to the page behind the scrim.
      e.preventDefault();
      return;
    }
    const first = stops[0];
    const last = stops[stops.length - 1];
    const active = document.activeElement;
    // Until the first Tab, focus rests on the sheet itself, which counts as
    // standing just outside whichever end the user is heading for.
    let wrapTo: HTMLElement | null = null;
    if (active === sheet) wrapTo = e.shiftKey ? last : first;
    else if (e.shiftKey && active === first) wrapTo = last;
    else if (!e.shiftKey && active === last) wrapTo = first;
    if (!wrapTo) return;
    e.preventDefault();
    wrapTo.focus();
  };

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
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapTab}
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
        <ModalTitleIdContext.Provider value={titleId}>{children}</ModalTitleIdContext.Provider>
      </div>
    </div>
  );
}

export function ModalTitle({title, onClose}: {title: string; onClose: () => void}) {
  // Undefined outside a Modal, which React drops rather than rendering an empty
  // id — the component stays usable on its own, just unlabelled.
  const titleId = useContext(ModalTitleIdContext);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
      }}
    >
      <div id={titleId} style={{fontSize: 16, fontWeight: 700}}>
        {title}
      </div>
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
