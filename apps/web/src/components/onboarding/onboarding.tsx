'use client';

import {useUser} from '@clerk/nextjs';
import {maxDaysToPayday, nextPayProblem, toIsoDate, type Cadence} from '@runway/shared';
import {CADENCE_LABELS, CADENCE_OPTIONS, formatMoney, ordinalSuffix} from '../../lib/format';
import {useState} from 'react';
import {onboardingBalance, onboardingPaycheck} from '../../lib/onboarding-money';
import {useFlow} from '../../lib/queries';
import {BrandMark} from '../brand/brand-mark';
import ui from '../ui/ui.module.css';

const SUB_PRESETS = [
  {name: 'Netflix', amount: 15.49},
  {name: 'Spotify', amount: 11.99},
  {name: 'iCloud+', amount: 2.99},
  {name: 'YouTube Premium', amount: 13.99},
  {name: 'Disney+', amount: 9.99},
  {name: 'Gym', amount: 35},
];

const CAT_PRESETS = [
  {key: 'eat', name: 'Eating out', budget: 120},
  {key: 'gro', name: 'Groceries', budget: 300},
  {key: 'tra', name: 'Transit', budget: 60},
  {key: 'fun', name: 'Fun', budget: 80},
  {key: 'per', name: 'Personal', budget: 60},
  {key: 'cof', name: 'Coffee', budget: 40},
  {key: 'sho', name: 'Shopping', budget: 90},
];

interface ObBill {
  name: string;
  amount: number;
  dueDay: number;
  kind: 'survival' | 'subscription';
}

interface ObCard {
  name: string;
  balance: number;
  limit: number;
  apr: number;
}

/**
 * Stable ids, because the message element is always in the DOM: the input
 * points at it with `aria-describedby` only while it has something to say.
 */
const BALANCE_PROBLEM_ID = 'onboarding-balance-problem';
const PAY_PROBLEM_ID = 'onboarding-pay-problem';

/** Matches the font size of the hint line each of these two steps already has. */
const problemStyle = {fontSize: 12, color: 'var(--danger)', lineHeight: 1.45};

/** Six-step first-run flow (catalog §1.9). `onExit` present = launched from Settings. */
export function Onboarding({onExit}: {onExit?: () => void}) {
  const {user} = useUser();
  const [step, setStep] = useState(0);
  const [balanceRaw, setBalanceRaw] = useState('');
  const [balanceProblem, setBalanceProblem] = useState<string | null>(null);
  const [payRaw, setPayRaw] = useState('');
  const [payProblem, setPayProblem] = useState<string | null>(null);
  const [cadence, setCadence] = useState<Cadence>('biweekly');
  const [nextPay, setNextPay] = useState('');
  const [bills, setBills] = useState<ObBill[]>([]);
  const [billName, setBillName] = useState('');
  const [billAmountRaw, setBillAmountRaw] = useState('');
  const [billDueRaw, setBillDueRaw] = useState('');
  const [cards, setCards] = useState<ObCard[]>([]);
  const [cardName, setCardName] = useState('');
  const [cardOweRaw, setCardOweRaw] = useState('');
  const [cardLimitRaw, setCardLimitRaw] = useState('');
  const [cardAprRaw, setCardAprRaw] = useState('');
  const [pickedCats, setPickedCats] = useState<Set<string>>(new Set(['eat', 'gro', 'tra']));

  // `parseFloat` was reading a valid prefix and discarding the rest, so a
  // typeable `1.2.3` became 1.2 in the gate and again in the payload (#57).
  const balanceAmount = onboardingBalance(balanceRaw);
  const payAmount = onboardingPaycheck(payRaw);

  const complete = useFlow<void>(() => ({
    path: '/onboarding/complete',
    json: {
      // The value that was judged, not a second parse of the same string.
      balance: balanceAmount.status === 'ok' ? balanceAmount.value : 0,
      pay: payAmount.status === 'ok' ? payAmount.value : 0,
      cadence,
      nextPay,
      name: user?.fullName ?? undefined,
      email: user?.primaryEmailAddress?.emailAddress ?? undefined,
      bills,
      cards,
      cats: CAT_PRESETS.filter((c) => pickedCats.has(c.key)).map((c) => ({
        name: c.name,
        budget: c.budget,
      })),
    },
  }));

  const billsSum = bills.reduce((s, b) => s + b.amount, 0);
  const cardsOwed = cards.reduce((s, c) => s + c.balance, 0);

  const addBill = () => {
    const amount = parseFloat(billAmountRaw) || 0;
    const dueDay = Math.min(31, Math.max(1, parseInt(billDueRaw, 10) || 1));
    if (!billName.trim() || amount <= 0) return;
    setBills([...bills, {name: billName.trim(), amount, dueDay, kind: 'survival'}]);
    setBillName('');
    setBillAmountRaw('');
    setBillDueRaw('');
  };

  const addCard = () => {
    const owe = parseFloat(cardOweRaw) || 0;
    const limit = parseFloat(cardLimitRaw) || 0;
    const apr = parseFloat(cardAprRaw) || 0;
    if (!cardName.trim() || limit <= 0) return;
    setCards([...cards, {name: cardName.trim(), balance: owe, limit, apr}]);
    setCardName('');
    setCardOweRaw('');
    setCardLimitRaw('');
    setCardAprRaw('');
  };

  const toggleSub = (preset: {name: string; amount: number}) => {
    const existing = bills.find((b) => b.kind === 'subscription' && b.name === preset.name);
    if (existing) {
      setBills(bills.filter((b) => b !== existing));
    } else {
      setBills([
        ...bills,
        {name: preset.name, amount: preset.amount, dueDay: 15, kind: 'subscription'},
      ]);
    }
  };

  // The same rule the API enforces, so the form explains the refusal here
  // instead of the request failing after five more steps of setup.
  const today = new Date();
  const payDateProblem = nextPay ? nextPayProblem(nextPay, cadence, today) : null;
  const payScheduleLine = payDateProblem
    ? payDateProblem
    : nextPay
      ? `${CADENCE_LABELS[cadence]} · next on ${new Date(nextPay + 'T00:00:00').toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'})}. On payday the app asks whether it landed.`
      : 'Pick the date your next paycheck lands so Runway can count down to it.';

  // A blank field leaves Next disabled, exactly as before. Text that cannot be
  // read as an amount now says so instead of advancing on a truncated number.
  const leaveBalance = () => {
    if (balanceAmount.status === 'problem') {
      setBalanceProblem(balanceAmount.message);
      return;
    }
    if (balanceAmount.status === 'ok') setStep(2);
  };

  const leavePay = () => {
    if (payAmount.status === 'problem') {
      setPayProblem(payAmount.message);
      return;
    }
    if (payAmount.status === 'ok' && nextPay && !payDateProblem) setStep(3);
  };

  const stepCard = (heading: string, sub: string, body: React.ReactNode) => (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        padding: 26,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <button
          onClick={() => setStep(step - 1)}
          aria-label="Back"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'var(--chip)',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ‹
        </button>
        <div style={{fontSize: 12, fontWeight: 650, letterSpacing: '.6px', color: 'var(--muted)'}}>
          STEP {step} OF 5
        </div>
        <div style={{display: 'flex', gap: 4, marginLeft: 'auto'}}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              style={{
                width: 22,
                height: 4,
                borderRadius: 3,
                background: n <= step ? 'var(--ink)' : 'var(--border-input)',
              }}
            />
          ))}
        </div>
      </div>
      <div>
        <div style={{fontSize: 20, fontWeight: 700, letterSpacing: '-.3px'}}>{heading}</div>
        <div style={{fontSize: 12.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.45}}>
          {sub}
        </div>
      </div>
      {body}
    </div>
  );

  const bigMoneyInput = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    onEnter: () => void,
    problem: string | null,
    problemId: string,
  ) => (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          borderBottom: '2px solid var(--ink)',
          paddingBottom: 8,
        }}
      >
        <span style={{fontSize: 22, fontWeight: 600, color: 'var(--muted)'}}>$</span>
        <input
          autoFocus
          inputMode="decimal"
          placeholder={placeholder}
          value={value}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && onEnter()}
          className="tnum"
          style={{
            fontSize: 30,
            fontWeight: 700,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            width: '100%',
            color: 'var(--ink)',
          }}
        />
      </div>
      {/* Always mounted, so the text arriving is what gets announced. */}
      <div id={problemId} role="alert" style={{...problemStyle, marginTop: problem ? 8 : 0}}>
        {problem ?? ''}
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: 'min(440px,100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          animation: 'fadeUp .25s ease-out',
        }}
      >
        {step === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              textAlign: 'center',
            }}
          >
            <BrandMark size={56} stroke={4} />
            <div style={{fontSize: 34, fontWeight: 700, letterSpacing: '-.8px'}}>Runway</div>
            <div
              style={{
                fontSize: 15.5,
                lineHeight: 1.55,
                color: 'var(--ink-2)',
                maxWidth: 300,
              }}
            >
              One number tells you what&apos;s safe to spend, every day — after bills, after goals.
            </div>
            <button
              className={ui.btnAccent}
              style={{width: 'auto', padding: '14px 44px', borderRadius: 14}}
              onClick={() => setStep(1)}
            >
              Get started
            </button>
            <div style={{fontSize: 12, color: 'var(--muted-2)'}}>
              Takes about 2 minutes · no bank login — ever
            </div>
          </div>
        )}

        {step === 1 &&
          stepCard(
            "What's in your account right now?",
            '',
            <>
              {bigMoneyInput(
                balanceRaw,
                (v) => {
                  setBalanceRaw(v);
                  setBalanceProblem(null);
                },
                '6,000',
                leaveBalance,
                balanceProblem,
                BALANCE_PROBLEM_ID,
              )}
              <div style={{fontSize: 12, color: 'var(--muted)'}}>
                Check your bank app. Close is fine, you can fix it later.
              </div>
              <button
                className={ui.btnPrimary}
                disabled={balanceAmount.status === 'blank'}
                onClick={leaveBalance}
              >
                Next
              </button>
            </>,
          )}

        {step === 2 &&
          stepCard(
            "What's your paycheck?",
            'Your take-home pay after taxes. This sets how long your runway lasts.',
            <>
              {bigMoneyInput(
                payRaw,
                (v) => {
                  setPayRaw(v);
                  setPayProblem(null);
                },
                '1,700',
                leavePay,
                payProblem,
                PAY_PROBLEM_ID,
              )}
              <div>
                <div className={ui.label}>HOW OFTEN</div>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7}}>
                  {CADENCE_OPTIONS.map(([value, label]) => (
                    <button
                      key={value}
                      className={cadence === value ? ui.chipActive : ui.chip}
                      style={{textAlign: 'center'}}
                      onClick={() => setCadence(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className={ui.label}>NEXT PAYDAY</div>
                <input
                  type="date"
                  className={ui.input}
                  value={nextPay}
                  min={toIsoDate(today)}
                  max={toIsoDate(today, maxDaysToPayday(cadence))}
                  aria-invalid={payDateProblem !== null}
                  onChange={(e) => setNextPay(e.target.value)}
                />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: payDateProblem ? 'var(--danger)' : 'var(--muted)',
                  lineHeight: 1.45,
                }}
              >
                {payScheduleLine}
              </div>
              <button
                className={ui.btnPrimary}
                disabled={payAmount.status === 'blank' || !nextPay || payDateProblem !== null}
                onClick={leavePay}
              >
                Next
              </button>
            </>,
          )}

        {step === 3 &&
          stepCard(
            'What has to get paid?',
            'Rent, utilities, subscriptions — add the big ones; the rest can wait.',
            <>
              {bills.length > 0 && (
                <div style={{display: 'flex', flexDirection: 'column', gap: 7}}>
                  {bills.map((b, i) => (
                    <div
                      key={`${b.name}-${i}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        border: '1px solid var(--border)',
                        borderRadius: 11,
                        padding: '9px 12px',
                      }}
                    >
                      <span style={{fontSize: 13.5, fontWeight: 600, flex: 1}}>{b.name}</span>
                      <span className="tnum" style={{fontSize: 12, color: 'var(--muted)'}}>
                        {b.kind === 'subscription'
                          ? `sub · ${formatMoney(b.amount)}`
                          : `due the ${b.dueDay}${ordinalSuffix(b.dueDay)} · ${formatMoney(b.amount)}`}
                      </span>
                      <button
                        className={ui.iconBtn}
                        style={{width: 22, height: 22}}
                        aria-label={`Remove ${b.name}`}
                        onClick={() => setBills(bills.filter((x) => x !== b))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display: 'flex', gap: 6}}>
                <input
                  className={ui.input}
                  style={{flex: 2}}
                  placeholder="Rent, electric…"
                  value={billName}
                  onChange={(e) => setBillName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBill()}
                />
                <input
                  className={`${ui.input} tnum`}
                  style={{flex: 1}}
                  inputMode="decimal"
                  placeholder="950"
                  value={billAmountRaw}
                  onChange={(e) => setBillAmountRaw(e.target.value.replace(/[^0-9.]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && addBill()}
                />
                <input
                  className={`${ui.input} tnum`}
                  style={{flex: 1}}
                  inputMode="numeric"
                  placeholder="due 15"
                  value={billDueRaw}
                  onChange={(e) => setBillDueRaw(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && addBill()}
                />
                <button className={ui.btnGhost} onClick={addBill}>
                  Add
                </button>
              </div>
              <div>
                <div className={ui.label}>ONE-TAP SUBSCRIPTIONS</div>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: 7}}>
                  {SUB_PRESETS.map((preset) => {
                    const on = bills.some(
                      (b) => b.kind === 'subscription' && b.name === preset.name,
                    );
                    return (
                      <button
                        key={preset.name}
                        className={on ? ui.chipActive : ui.chip}
                        onClick={() => toggleSub(preset)}
                      >
                        {on ? `${preset.name} ✓` : `${preset.name} $${preset.amount}`}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button className={ui.btnPrimary} onClick={() => setStep(4)}>
                {bills.length > 0
                  ? `Next — ${bills.length} bill${bills.length === 1 ? '' : 's'} · ${formatMoney(billsSum)}`
                  : 'Next — skip for now'}
              </button>
            </>,
          )}

        {step === 4 &&
          stepCard(
            'Any credit cards?',
            "Add what you owe so Runway can plan payments and keep them off your safe-to-spend. Skip if you don't carry a balance.",
            <>
              {cards.length > 0 && (
                <div style={{display: 'flex', flexDirection: 'column', gap: 7}}>
                  {cards.map((card, i) => (
                    <div
                      key={`${card.name}-${i}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        border: '1px solid var(--border)',
                        borderRadius: 11,
                        padding: '9px 12px',
                      }}
                    >
                      <span style={{fontSize: 13.5, fontWeight: 600, flex: 1}}>{card.name}</span>
                      <span className="tnum" style={{fontSize: 12, color: 'var(--muted)'}}>
                        {formatMoney(card.balance)} / {formatMoney(card.limit)} · {card.apr}% APR
                      </span>
                      <button
                        className={ui.iconBtn}
                        style={{width: 22, height: 22}}
                        aria-label={`Remove ${card.name}`}
                        onClick={() => setCards(cards.filter((x) => x !== card))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display: 'flex', gap: 6, flexWrap: 'wrap'}}>
                <input
                  className={ui.input}
                  style={{flex: '2 1 120px'}}
                  placeholder="Card nickname…"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCard()}
                />
                <input
                  className={`${ui.input} tnum`}
                  style={{flex: '1 1 70px'}}
                  inputMode="decimal"
                  placeholder="owe"
                  value={cardOweRaw}
                  onChange={(e) => setCardOweRaw(e.target.value.replace(/[^0-9.]/g, ''))}
                />
                <input
                  className={`${ui.input} tnum`}
                  style={{flex: '1 1 70px'}}
                  inputMode="decimal"
                  placeholder="limit"
                  value={cardLimitRaw}
                  onChange={(e) => setCardLimitRaw(e.target.value.replace(/[^0-9.]/g, ''))}
                />
                <input
                  className={`${ui.input} tnum`}
                  style={{flex: '1 1 60px'}}
                  inputMode="decimal"
                  placeholder="APR %"
                  value={cardAprRaw}
                  onChange={(e) => setCardAprRaw(e.target.value.replace(/[^0-9.]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && addCard()}
                />
                <button className={ui.btnGhost} onClick={addCard}>
                  Add
                </button>
              </div>
              <div style={{fontSize: 11.5, color: 'var(--muted)'}}>
                Rough numbers are fine — you can fine-tune APR and due dates later.
              </div>
              <button className={ui.btnPrimary} onClick={() => setStep(5)}>
                {cards.length > 0
                  ? `Next — ${cards.length} card${cards.length === 1 ? '' : 's'} · ${formatMoney(cardsOwed)} owed`
                  : 'Next — no cards'}
              </button>
            </>,
          )}

        {step === 5 &&
          stepCard(
            'Where does the rest go?',
            "Pick what you spend on — we'll start each with a gentle budget you can tune later.",
            <>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 7}}>
                {CAT_PRESETS.map((preset) => {
                  const on = pickedCats.has(preset.key);
                  return (
                    <button
                      key={preset.key}
                      className={on ? ui.chipActive : ui.chip}
                      onClick={() => {
                        const next = new Set(pickedCats);
                        if (on) next.delete(preset.key);
                        else next.add(preset.key);
                        setPickedCats(next);
                      }}
                    >
                      {preset.name} ${preset.budget}
                    </button>
                  );
                })}
              </div>
              <button
                className={ui.btnAccent}
                disabled={pickedCats.size === 0 || complete.isPending}
                onClick={() => complete.mutate(undefined, {onSuccess: onExit})}
              >
                {pickedCats.size === 0 ? 'Pick at least one' : 'Show me my number'}
              </button>
            </>,
          )}

        <div style={{fontSize: 12, color: 'var(--muted-2)'}}>Everything stays on this device.</div>
        {onExit && (
          <button
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--muted)',
              textDecoration: 'underline',
            }}
            onClick={onExit}
          >
            ✕ Never mind — keep my data
          </button>
        )}
      </div>
    </div>
  );
}
