'use client';

import {cardUsage, daysUntil, type AppState, type Card, type CardReward} from '@runway/shared';
import {formatMoney} from '../../../lib/format';
import {useState} from 'react';
import {Toggle} from '../../../components/ui/toggle';
import ui from '../../../components/ui/ui.module.css';
import {cardLine, rewardPillColors} from '../../../lib/card-lines';
import {useAppState, useFlow} from '../../../lib/queries';

interface CardForm {
  cardId: string | null;
  name: string;
  aprRaw: string;
  limitRaw: string;
  balanceRaw: string;
  dueRaw: string;
  minPayRaw: string;
  payInFull: boolean;
  rewards: CardReward[];
  rewardRateRaw: string;
  rewardCatRaw: string;
  promoOn: boolean;
  promoAprRaw: string;
  promoMonthsRaw: string;
}

function emptyForm(): CardForm {
  return {
    cardId: null,
    name: '',
    aprRaw: '',
    limitRaw: '',
    balanceRaw: '',
    dueRaw: '',
    minPayRaw: '',
    payInFull: false,
    rewards: [],
    rewardRateRaw: '',
    rewardCatRaw: '',
    promoOn: false,
    promoAprRaw: '',
    promoMonthsRaw: '',
  };
}

function formFromCard(card: Card, today: Date): CardForm {
  const promoMonths = card.promoEnd
    ? Math.max(1, Math.round(daysUntil(card.promoEnd, today) / 30))
    : null;
  return {
    cardId: card.id,
    name: card.name,
    aprRaw: String(card.apr),
    limitRaw: String(card.limit),
    balanceRaw: String(card.balance),
    dueRaw: card.dueDay != null ? String(card.dueDay) : '',
    minPayRaw: card.minPay != null ? String(card.minPay) : '',
    payInFull: card.payInFull,
    rewards: card.rewards,
    rewardRateRaw: '',
    rewardCatRaw: '',
    promoOn: card.promoRate != null,
    promoAprRaw: card.promoRate != null ? String(card.promoRate) : '',
    promoMonthsRaw: promoMonths != null ? String(promoMonths) : '',
  };
}

function CardTile({card, state, onEdit}: {card: Card; state: AppState; onEdit: () => void}) {
  const today = new Date();
  const [paying, setPaying] = useState(false);
  const [payAmountRaw, setPayAmountRaw] = useState('');
  const [paySource, setPaySource] = useState('checking');

  const remove = useFlow<void>(() => ({path: `/cards/${card.id}`, method: 'DELETE'}));
  const logPayment = useFlow<void>(() => ({
    path: `/cards/${card.id}/log-payment`,
    json: {amount: parseFloat(payAmountRaw) || 0, source: paySource},
  }));

  const paymentBill = state.bills.find((b) => b.cardId === card.id);
  const line = cardLine(card, paymentBill, today);
  const {pct, overEighty} = cardUsage(card);

  const updatedDays = Math.max(
    0,
    Math.round((today.getTime() - Date.parse(card.balanceUpdatedAt)) / 86400000),
  );
  const stale = updatedDays >= 30;

  const promoLive = card.promoRate != null && card.promoEnd && daysUntil(card.promoEnd, today) > 0;
  const aprTag = promoLive
    ? `${card.promoRate}% until ${new Date(card.promoEnd + 'T00:00:00').toLocaleDateString('en-US', {month: 'short'})} · then ${card.apr}%`
    : `${card.apr}% APR`;

  const dueTag = paymentBill
    ? paymentBill.paid
      ? `${formatMoney(paymentBill.amount)} paid ✓`
      : `${formatMoney(paymentBill.amount)} due ${new Date(paymentBill.dueDate + 'T00:00:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`
    : null;

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap'}}>
        <span
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '40%',
          }}
        >
          {card.name}
        </span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            border: `1px solid ${promoLive ? 'var(--accent)' : 'var(--border-input)'}`,
            color: promoLive ? 'var(--accent)' : 'var(--muted)',
            borderRadius: 5,
            padding: '1px 6px',
          }}
        >
          {aprTag}
        </span>
        {dueTag && (
          <span
            className="tnum"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              background: 'var(--chip)',
              color: 'var(--ink-2)',
              borderRadius: 5,
              padding: '1px 6px',
            }}
          >
            {dueTag}
          </span>
        )}
        <span style={{marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center'}}>
          <button style={{fontSize: 12, fontWeight: 650, color: 'var(--muted)'}} onClick={onEdit}>
            Edit
          </button>
          <button
            style={{fontSize: 13, color: 'var(--icon-idle)'}}
            aria-label={`Remove ${card.name}`}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--icon-idle)')}
            onClick={() => remove.mutate()}
          >
            ✕
          </button>
        </span>
      </div>

      {card.rewards.length > 0 && (
        <div style={{display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
          <span
            style={{fontSize: 10, fontWeight: 700, letterSpacing: '.8px', color: 'var(--muted-2)'}}
          >
            USE FOR
          </span>
          {card.rewards.map((reward, i) => {
            const colors = rewardPillColors(reward.cat);
            return (
              <span
                key={i}
                style={{
                  fontSize: 11.5,
                  fontWeight: 650,
                  borderRadius: 999,
                  padding: '3px 9px',
                  background: colors.bg,
                  color: colors.fg,
                }}
              >
                <b className="tnum">{reward.rate}</b> {reward.cat}
              </span>
            );
          })}
        </div>
      )}

      <div style={{display: 'flex', alignItems: 'baseline', gap: 6}}>
        <span style={{fontSize: 12, color: 'var(--muted)'}}>balance</span>
        <span className="tnum" style={{fontSize: 15, fontWeight: 650}}>
          {formatMoney(card.balance)}
        </span>
        <span className="tnum" style={{fontSize: 11.5, fontWeight: 600, color: 'var(--muted)'}}>
          of {formatMoney(card.limit)}
        </span>
      </div>
      <div className={ui.progressTrack}>
        <div
          className={ui.progressFill}
          style={{width: `${pct}%`, background: overEighty ? 'var(--danger)' : 'var(--ink)'}}
        />
      </div>
      <div style={{fontSize: 12, fontWeight: 600, color: line.color, lineHeight: 1.4}}>
        {line.text}
      </div>

      {paying ? (
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          <div>
            <div className={ui.label}>PAY FROM</div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
              <button
                className={paySource === 'checking' ? ui.chipActive : ui.chip}
                onClick={() => setPaySource('checking')}
              >
                {state.profile.primaryName}
              </button>
              {state.accounts.map((a) => (
                <button
                  key={a.id}
                  className={paySource === a.id ? ui.chipActive : ui.chip}
                  onClick={() => setPaySource(a.id)}
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
          <div style={{display: 'flex', gap: 8}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 6, flex: 1}}>
              <span style={{fontSize: 14, fontWeight: 600, color: 'var(--muted)'}}>$</span>
              <input
                autoFocus
                className={`${ui.input} tnum`}
                inputMode="decimal"
                placeholder={paymentBill ? String(paymentBill.amount) : '0'}
                value={payAmountRaw}
                onChange={(e) => setPayAmountRaw(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && parseFloat(payAmountRaw) > 0) {
                    logPayment.mutate(undefined, {onSuccess: () => setPaying(false)});
                  }
                  if (e.key === 'Escape') setPaying(false);
                }}
              />
            </div>
            <button
              className={ui.btnPrimary}
              style={{width: 'auto', padding: '9px 16px'}}
              disabled={!(parseFloat(payAmountRaw) > 0) || logPayment.isPending}
              onClick={() => logPayment.mutate(undefined, {onSuccess: () => setPaying(false)})}
            >
              Log it
            </button>
            <button
              aria-label="Cancel"
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'var(--chip)',
                flex: 'none',
                fontSize: 13,
              }}
              onClick={() => setPaying(false)}
            >
              ✕
            </button>
          </div>
          <div style={{fontSize: 11.5, color: 'var(--muted)'}}>
            comes out of the source above — safe/day recalculates
          </div>
        </div>
      ) : (
        <button
          className={ui.btnPrimary}
          style={{padding: 9, borderRadius: 10}}
          onClick={() => setPaying(true)}
        >
          Log payment
        </button>
      )}

      <div
        style={{
          fontSize: 11,
          textAlign: 'right',
          color: stale ? 'var(--danger)' : 'var(--muted-2)',
        }}
      >
        {stale
          ? `⚠ updated ${updatedDays} days ago — statement out?`
          : updatedDays === 0
            ? 'updated today ✓'
            : `updated ${updatedDays} day${updatedDays === 1 ? '' : 's'} ago`}
      </div>
    </div>
  );
}

export default function CardsPage() {
  const {data: state} = useAppState();
  const [form, setForm] = useState<CardForm | null>(null);
  const today = new Date();

  const save = useFlow<CardForm>((f) => ({
    path: f.cardId ? `/cards/${f.cardId}` : '/cards',
    method: f.cardId ? 'PATCH' : 'POST',
    json: {
      name: f.name.trim(),
      apr: parseFloat(f.aprRaw) || 0,
      limit: parseFloat(f.limitRaw) || 0,
      balance: parseFloat(f.balanceRaw) || 0,
      dueDay: f.dueRaw ? Math.min(31, Math.max(1, parseInt(f.dueRaw, 10))) : null,
      minPay: f.payInFull ? null : f.minPayRaw ? parseFloat(f.minPayRaw) : null,
      payInFull: f.payInFull,
      rewards: f.rewards,
      promoRate: f.promoOn ? parseFloat(f.promoAprRaw) || 0 : null,
      promoMonths: f.promoOn && f.promoMonthsRaw ? parseInt(f.promoMonthsRaw, 10) : null,
    },
  }));

  if (!state) return null;

  const totalDebt = state.cards.reduce((s, c) => s + c.balance, 0);
  const totalLimit = state.cards.reduce((s, c) => s + c.limit, 0);
  const available = Math.max(0, totalLimit - totalDebt);
  const usedPct = totalLimit > 0 ? Math.round((totalDebt / totalLimit) * 100) : 0;

  const formValid = form && form.name.trim() && parseFloat(form.limitRaw) > 0;

  const addReward = () => {
    if (!form || !form.rewardRateRaw.trim() || !form.rewardCatRaw.trim()) return;
    setForm({
      ...form,
      rewards: [...form.rewards, {rate: form.rewardRateRaw.trim(), cat: form.rewardCatRaw.trim()}],
      rewardRateRaw: '',
      rewardCatRaw: '',
    });
  };

  return (
    <div className={ui.card}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{fontSize: 13, fontWeight: 700, letterSpacing: '.3px'}}>Credit cards</div>
        {state.cards.length > 0 && (
          <div style={{fontSize: 12, color: 'var(--muted)'}}>{usedPct}% of limit used</div>
        )}
      </div>

      {state.cards.length > 0 && (
        <div style={{display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap'}}>
          <div
            style={{
              flex: 1,
              minWidth: 140,
              background: 'var(--ink)',
              color: 'var(--on-dark)',
              borderRadius: 14,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '.7px',
                color: 'var(--on-dark-muted)',
              }}
            >
              TOTAL DEBT
            </div>
            <div className="tnum" style={{fontSize: 20, fontWeight: 700}}>
              {formatMoney(totalDebt)}
            </div>
            <div style={{fontSize: 11, color: 'var(--on-dark-muted)'}}>
              across {state.cards.length} card{state.cards.length === 1 ? '' : 's'}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 140,
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '.7px',
                color: 'var(--muted)',
              }}
            >
              AVAILABLE
            </div>
            <div className="tnum" style={{fontSize: 20, fontWeight: 700}}>
              {formatMoney(available)}
            </div>
            <div style={{fontSize: 11, color: 'var(--muted)'}}>
              of {formatMoney(totalLimit)} limit
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(min(320px,100%),1fr))',
          gap: 10,
          alignItems: 'start',
        }}
      >
        {state.cards.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            state={state}
            onEdit={() => setForm(formFromCard(card, today))}
          />
        ))}

        {form && (
          <div
            style={{
              gridColumn: '1/-1',
              border: '1.5px solid var(--ink)',
              borderRadius: 14,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 11,
              animation: 'fadeUp .18s ease-out',
            }}
          >
            <div style={{fontSize: 14, fontWeight: 700}}>
              {form.cardId ? `Editing ${form.name}` : 'New card'}
            </div>
            <input
              autoFocus
              className={ui.input}
              placeholder="Nickname — Card B, the blue one…"
              value={form.name}
              onChange={(e) => setForm({...form, name: e.target.value})}
            />
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
              <input
                className={`${ui.input} tnum`}
                style={{flex: 1, minWidth: 80}}
                inputMode="decimal"
                placeholder="APR %"
                value={form.aprRaw}
                onChange={(e) => setForm({...form, aprRaw: e.target.value.replace(/[^0-9.]/g, '')})}
              />
              <input
                className={`${ui.input} tnum`}
                style={{flex: 1, minWidth: 80}}
                inputMode="decimal"
                placeholder="$ limit"
                value={form.limitRaw}
                onChange={(e) =>
                  setForm({...form, limitRaw: e.target.value.replace(/[^0-9.]/g, '')})
                }
              />
              <input
                className={`${ui.input} tnum`}
                style={{flex: 1, minWidth: 80}}
                inputMode="decimal"
                placeholder="$ balance"
                value={form.balanceRaw}
                onChange={(e) =>
                  setForm({...form, balanceRaw: e.target.value.replace(/[^0-9.]/g, '')})
                }
              />
            </div>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
              <input
                className={`${ui.input} tnum`}
                style={{flex: 1, minWidth: 120}}
                inputMode="numeric"
                placeholder="21  due day of month"
                value={form.dueRaw}
                onChange={(e) => setForm({...form, dueRaw: e.target.value.replace(/[^0-9]/g, '')})}
              />
              <input
                className={`${ui.input} tnum`}
                style={{
                  flex: 1,
                  minWidth: 120,
                  ...(form.payInFull
                    ? {background: 'var(--chip)', opacity: 0.6, cursor: 'not-allowed'}
                    : {}),
                }}
                inputMode="decimal"
                placeholder={form.payInFull ? 'full balance' : '$ payment / mo'}
                disabled={form.payInFull}
                title={
                  form.payInFull
                    ? 'Turn off "Always pay in full" to set your own payment'
                    : undefined
                }
                value={form.payInFull ? '' : form.minPayRaw}
                onChange={(e) =>
                  setForm({...form, minPayRaw: e.target.value.replace(/[^0-9.]/g, '')})
                }
              />
            </div>
            <div style={{fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.45}}>
              set a due day and the payment shows up in Bills and on your runway — leave the $ blank
              and we&apos;ll pencil in a minimum
            </div>

            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <div style={{flex: 1}}>
                <div style={{fontSize: 13, fontWeight: 650}}>Always pay in full</div>
                <div style={{fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.4}}>
                  the whole statement, every month — this card never carries a balance or interest,
                  and the payment tracks the balance as it moves
                </div>
              </div>
              <Toggle
                on={form.payInFull}
                onFlip={() => setForm({...form, payInFull: !form.payInFull})}
              />
            </div>

            <div
              style={{
                border: '1px solid var(--border-input)',
                borderRadius: 10,
                padding: '11px 12px',
                background: 'var(--input)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div>
                <span style={{fontSize: 13, fontWeight: 650}}>Rewards</span>{' '}
                <span style={{fontSize: 11.5, color: 'var(--muted)'}}>
                  what the card pays back — leave empty and we&apos;ll guess from the name
                </span>
              </div>
              {form.rewards.length > 0 && (
                <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                  {form.rewards.map((reward, i) => {
                    const colors = rewardPillColors(reward.cat);
                    return (
                      <span
                        key={i}
                        style={{
                          fontSize: 11.5,
                          fontWeight: 650,
                          borderRadius: 999,
                          padding: '3px 9px',
                          background: colors.bg,
                          color: colors.fg,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <b className="tnum">{reward.rate}</b> {reward.cat}
                        <button
                          aria-label="Remove reward"
                          style={{fontSize: 11, color: 'inherit'}}
                          onClick={() =>
                            setForm({...form, rewards: form.rewards.filter((_, j) => j !== i)})
                          }
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div style={{display: 'flex', gap: 6}}>
                <input
                  className={ui.input}
                  style={{width: 86, flex: 'none'}}
                  placeholder="3%"
                  value={form.rewardRateRaw}
                  onChange={(e) => setForm({...form, rewardRateRaw: e.target.value})}
                  onKeyDown={(e) => e.key === 'Enter' && addReward()}
                />
                <input
                  className={ui.input}
                  placeholder="groceries, gas, dining, travel…"
                  value={form.rewardCatRaw}
                  onChange={(e) => setForm({...form, rewardCatRaw: e.target.value})}
                  onKeyDown={(e) => e.key === 'Enter' && addReward()}
                />
                <button className={ui.btnGhost} onClick={addReward}>
                  + Add
                </button>
              </div>
            </div>

            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <div style={{flex: 1}}>
                <div style={{fontSize: 13, fontWeight: 650}}>Promotional rate?</div>
                <div style={{fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.4}}>
                  0% intro APR and the like — with an end date, so the math never lies later
                </div>
              </div>
              <Toggle on={form.promoOn} onFlip={() => setForm({...form, promoOn: !form.promoOn})} />
            </div>
            {form.promoOn && (
              <div style={{display: 'flex', gap: 8}}>
                <input
                  className={`${ui.input} tnum`}
                  style={{flex: 1}}
                  inputMode="decimal"
                  placeholder="promo APR %"
                  value={form.promoAprRaw}
                  onChange={(e) =>
                    setForm({...form, promoAprRaw: e.target.value.replace(/[^0-9.]/g, '')})
                  }
                />
                <input
                  className={`${ui.input} tnum`}
                  style={{flex: 1}}
                  inputMode="numeric"
                  placeholder="6  months left"
                  value={form.promoMonthsRaw}
                  onChange={(e) =>
                    setForm({...form, promoMonthsRaw: e.target.value.replace(/[^0-9]/g, '')})
                  }
                />
              </div>
            )}

            <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
              <button className={ui.btnGhost} onClick={() => setForm(null)}>
                Cancel
              </button>
              <button
                className={ui.btnPrimary}
                style={{width: 'auto', padding: '9px 18px'}}
                disabled={!formValid || save.isPending}
                onClick={() => save.mutate(form, {onSuccess: () => setForm(null)})}
              >
                {form.cardId ? 'Save changes' : 'Add card'}
              </button>
            </div>
          </div>
        )}

        {!form && (
          <button
            className={ui.dashedCta}
            style={{padding: 13, borderRadius: 14}}
            onClick={() => setForm(emptyForm())}
          >
            + Add a card
          </button>
        )}
      </div>
    </div>
  );
}
