'use client';

import {fm, ordSuf, type AppState, type Bill, type BillKind, d} from '@runway/shared';
import {useState, type DragEvent, type TouchEvent} from 'react';
import {useModals} from '../../../components/modals/modal_context';
import ui from '../../../components/ui/ui.module.css';
import {useAppState, useFlow} from '../../../lib/queries';
import {useMedia} from '../../../lib/use_media';

const SUB_PRESETS = [
  {name: 'Spotify', amount: 11.99},
  {name: 'iCloud+', amount: 2.99},
  {name: 'YouTube Premium', amount: 13.99},
  {name: 'Disney+', amount: 9.99},
  {name: 'Gym', amount: 35},
];

interface GroupSpec {
  kind: BillKind;
  title: string;
  addLabel: string | null;
  placeholder: string;
}

const GROUPS: GroupSpec[] = [
  {
    kind: 'survival',
    title: 'SURVIVAL',
    addLabel: '+ Add survival bill',
    placeholder: 'Name — rent, water, insurance…',
  },
  {
    kind: 'subscription',
    title: 'SUBSCRIPTIONS',
    addLabel: '+ Add subscription',
    placeholder: 'Name — or tap a preset',
  },
  {kind: 'debt', title: 'DEBT', addLabel: null, placeholder: ''},
];

interface BillForm {
  billId: string | null;
  kind: BillKind;
  name: string;
  amountRaw: string;
  dueRaw: string;
  cycle: 'monthly' | 'yearly';
  payFrom: string;
}

function BillRow({
  bill,
  state,
  isMobile,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  bill: Bill;
  state: AppState;
  isMobile: boolean;
  onEdit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const {openModal} = useModals();
  const [tx, setTx] = useState(0);
  const [touchStart, setTouchStart] = useState<{x: number; y: number} | null>(null);
  const [dragging, setDragging] = useState(false);
  const unpay = useFlow<void>(() => ({path: `/bills/${bill.id}/unpay`}));
  const remove = useFlow<void>(() => ({path: `/bills/${bill.id}`, method: 'DELETE'}));

  const swipeMax = bill.kind === 'debt' ? 70 : 140;
  const today = new Date();

  const toggle = () => {
    if (bill.paid) unpay.mutate();
    else openModal('paySource', {billId: bill.id});
  };

  const tag = bill.personal ? '0% · personal' : bill.cycle === 'yearly' ? 'yearly' : null;

  const onTouchStart = (e: TouchEvent) => {
    setTouchStart({x: e.touches[0].clientX, y: e.touches[0].clientY});
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!touchStart) return;
    const dx = e.touches[0].clientX - touchStart.x;
    const dy = e.touches[0].clientY - touchStart.y;
    if (Math.abs(dy) > 10 && Math.abs(dx) < 8) {
      setTouchStart(null);
      setTx(0);
      return;
    }
    if (dx < 0) setTx(Math.max(dx, -swipeMax));
  };
  const onTouchEnd = () => {
    setTx(tx < -swipeMax / 2 ? -swipeMax : 0);
    setTouchStart(null);
  };

  return (
    <div style={{position: 'relative', overflow: 'hidden', borderRadius: 14}}>
      {isMobile && tx < 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          {bill.kind !== 'debt' && (
            <button
              onClick={() => {
                setTx(0);
                onEdit();
              }}
              style={{
                width: 70,
                background: 'var(--ink-2)',
                color: 'var(--bg)',
                fontSize: 12.5,
                fontWeight: 650,
              }}
            >
              Edit
            </button>
          )}
          <button
            onClick={() => remove.mutate()}
            style={{
              width: 70,
              background: 'var(--danger)',
              color: '#fff',
              fontSize: 12.5,
              fontWeight: 650,
            }}
          >
            Delete
          </button>
        </div>
      )}
      <div
        draggable={!isMobile && bill.kind !== 'debt'}
        onDragStart={(e: DragEvent) => {
          e.dataTransfer.setData('text/plain', bill.id);
          setDragging(true);
          onDragStart();
        }}
        onDragEnd={() => {
          setDragging(false);
          onDragEnd();
        }}
        onTouchStart={isMobile ? onTouchStart : undefined}
        onTouchMove={isMobile ? onTouchMove : undefined}
        onTouchEnd={isMobile ? onTouchEnd : undefined}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '13px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: dragging ? 0.45 : 1,
          transform: `translateX(${tx}px)`,
          transition: touchStart ? 'none' : 'transform .28s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <button
          onClick={toggle}
          aria-label={bill.paid ? `Unmark ${bill.name}` : `Pay ${bill.name}`}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            border: '2px solid var(--ink)',
            background: bill.paid ? 'var(--ink)' : 'transparent',
            color: bill.paid ? '#fff' : 'transparent',
            fontSize: 12,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform .15s',
          }}
        >
          ✓
        </button>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <span
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                ...(bill.paid ? {textDecoration: 'line-through', color: 'var(--muted-2)'} : {}),
              }}
            >
              {bill.name}
            </span>
            {tag && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  border: '1px solid var(--border-input)',
                  borderRadius: 5,
                  padding: '1px 6px',
                  color: 'var(--muted)',
                  flex: 'none',
                }}
              >
                {tag}
              </span>
            )}
          </div>
          <div style={{fontSize: 12, color: 'var(--muted)'}}>
            {bill.paid ? 'paid ✓' : `due ${d(bill.off, today)}`}
          </div>
        </div>
        <span className="tnum" style={{fontSize: 15, fontWeight: 650}}>
          {fm(bill.amount)}
        </span>
        {!isMobile && (
          <button
            onClick={() => remove.mutate()}
            aria-label={`Delete ${bill.name}`}
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              color: 'var(--icon-idle)',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color .15s, background .15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--danger)';
              e.currentTarget.style.background = 'var(--hover-danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--icon-idle)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function BillsPage() {
  const {data: state} = useAppState();
  const {isMobile} = useMedia();
  const [form, setForm] = useState<BillForm | null>(null);
  const [dragOver, setDragOver] = useState<BillKind | null>(null);
  const [draggingBill, setDraggingBill] = useState(false);

  const saveBill = useFlow<BillForm>((f) => ({
    path: f.billId ? `/bills/${f.billId}` : '/bills',
    method: f.billId ? 'PATCH' : 'POST',
    json: {
      name: f.name.trim(),
      amount: parseFloat(f.amountRaw) || 0,
      kind: f.kind,
      dueDay: Math.min(31, Math.max(1, parseInt(f.dueRaw, 10) || 1)),
      cycle: f.cycle,
      ...(f.payFrom !== 'checking' ? {payFrom: f.payFrom} : {payFrom: 'checking'}),
    },
  }));
  const refile = useFlow<{billId: string; kind: BillKind}>((input) => ({
    path: `/bills/${input.billId}`,
    method: 'PATCH',
    json: {kind: input.kind},
  }));

  if (!state) return null;

  const monthly = (b: Bill) => (b.cycle === 'yearly' ? b.amount / 12 : b.amount);
  const total = state.bills.reduce((s, b) => s + b.amount, 0);
  const left = state.bills.filter((b) => !b.paid).reduce((s, b) => s + b.amount, 0);
  const paidPct = total > 0 ? ((total - left) / total) * 100 : 0;

  const submit = () => {
    if (!form || !form.name.trim() || !(parseFloat(form.amountRaw) > 0)) return;
    saveBill.mutate(form, {onSuccess: () => setForm(null)});
  };

  const startAdd = (kind: BillKind) =>
    setForm({
      billId: null,
      kind,
      name: '',
      amountRaw: '',
      dueRaw: '',
      cycle: 'monthly',
      payFrom: 'checking',
    });

  const startEdit = (bill: Bill) =>
    setForm({
      billId: bill.id,
      kind: bill.kind,
      name: bill.name,
      amountRaw: String(bill.amount),
      dueRaw: String(new Date(bill.dueDate + 'T00:00:00').getDate()),
      cycle: bill.cycle,
      payFrom: bill.payFrom ?? 'checking',
    });

  const formValid = form && form.name.trim() && parseFloat(form.amountRaw) > 0;
  const hasExtraSources = state.accounts.length > 0 || state.cards.length > 0;

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <div className={ui.card}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{fontSize: 15, fontWeight: 700}}>This month</div>
          <div className="tnum" style={{fontSize: 13, color: 'var(--muted)'}}>
            {fm(left)} left of {fm(total)}
          </div>
        </div>
        <div className={ui.progressTrack} style={{height: 10, borderRadius: 6}}>
          <div
            className={ui.progressFill}
            style={{width: `${paidPct}%`, background: 'var(--ink)'}}
          />
        </div>
      </div>

      {GROUPS.map((group) => {
        const bills = state.bills.filter((b) => b.kind === group.kind);
        const sum = bills.reduce((s, b) => s + monthly(b), 0);
        const isDropTarget = dragOver === group.kind && draggingBill;
        return (
          <div
            key={group.kind}
            onDragOver={(e) => {
              if (group.kind === 'debt') return;
              e.preventDefault();
              setDragOver(group.kind);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const billId = e.dataTransfer.getData('text/plain');
              const bill = state.bills.find((b) => b.id === billId);
              if (bill && group.kind !== 'debt' && bill.kind !== group.kind) {
                refile.mutate({billId, kind: group.kind});
              }
            }}
            style={{
              borderRadius: 18,
              padding: 4,
              ...(isDropTarget
                ? {background: 'var(--hover-drop)', boxShadow: 'inset 0 0 0 2px var(--ink)'}
                : {}),
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 4px 8px',
              }}
            >
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: '1px',
                  color: 'var(--muted)',
                }}
              >
                {group.title}
              </span>
              <span className="tnum" style={{fontSize: 11.5, color: 'var(--muted)'}}>
                {fm(sum)} / month
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(min(320px,100%),1fr))',
                gap: 8,
                alignItems: 'start',
              }}
            >
              {bills.map((bill) => (
                <BillRow
                  key={bill.id}
                  bill={bill}
                  state={state}
                  isMobile={isMobile}
                  onEdit={() => startEdit(bill)}
                  onDragStart={() => setDraggingBill(true)}
                  onDragEnd={() => {
                    setDraggingBill(false);
                    setDragOver(null);
                  }}
                />
              ))}

              {form && form.kind === group.kind && (
                <div
                  style={{
                    gridColumn: '1/-1',
                    background: 'var(--surface)',
                    border: '1.5px solid var(--ink)',
                    borderRadius: 14,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    animation: 'fadeUp .18s ease-out',
                  }}
                >
                  {group.kind === 'subscription' && !form.billId && (
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: 7}}>
                      {SUB_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          className={ui.chip}
                          onClick={() =>
                            setForm({
                              ...form,
                              name: preset.name,
                              amountRaw: String(preset.amount),
                            })
                          }
                        >
                          {preset.name} ${preset.amount}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                    <input
                      autoFocus
                      className={ui.input}
                      style={{flex: 2, minWidth: 140}}
                      placeholder={group.placeholder}
                      value={form.name}
                      onChange={(e) => setForm({...form, name: e.target.value})}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submit();
                        if (e.key === 'Escape') setForm(null);
                      }}
                    />
                    <div
                      style={{display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 90}}
                    >
                      <span style={{fontSize: 14, fontWeight: 600, color: 'var(--muted)'}}>$</span>
                      <input
                        className={`${ui.input} tnum`}
                        inputMode="decimal"
                        placeholder="0"
                        value={form.amountRaw}
                        onChange={(e) =>
                          setForm({...form, amountRaw: e.target.value.replace(/[^0-9.]/g, '')})
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submit();
                          if (e.key === 'Escape') setForm(null);
                        }}
                      />
                    </div>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                    <span style={{fontSize: 12.5, color: 'var(--muted)'}}>Due on the</span>
                    <input
                      className={`${ui.input} tnum`}
                      style={{width: 64, textAlign: 'center'}}
                      inputMode="numeric"
                      placeholder="15"
                      value={form.dueRaw}
                      onChange={(e) =>
                        setForm({...form, dueRaw: e.target.value.replace(/[^0-9]/g, '')})
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submit();
                        if (e.key === 'Escape') setForm(null);
                      }}
                    />
                    <span style={{fontSize: 12.5, color: 'var(--muted)'}}>
                      {form.dueRaw ? ordSuf(parseInt(form.dueRaw, 10) || 1) : ''} of the month
                    </span>
                    {group.kind === 'subscription' && (
                      <span className={ui.segWrap} style={{marginLeft: 'auto'}}>
                        <button
                          className={form.cycle === 'monthly' ? ui.segBtnActive : ui.segBtn}
                          onClick={() => setForm({...form, cycle: 'monthly'})}
                        >
                          monthly
                        </button>
                        <button
                          className={form.cycle === 'yearly' ? ui.segBtnActive : ui.segBtn}
                          onClick={() => setForm({...form, cycle: 'yearly'})}
                        >
                          yearly
                        </button>
                      </span>
                    )}
                  </div>
                  {hasExtraSources && (
                    <div>
                      <div className={ui.label}>PAY FROM</div>
                      <div style={{display: 'flex', flexWrap: 'wrap', gap: 7}}>
                        <button
                          className={form.payFrom === 'checking' ? ui.chipActive : ui.chip}
                          onClick={() => setForm({...form, payFrom: 'checking'})}
                        >
                          {state.profile.primaryName}
                        </button>
                        {state.accounts.map((a) => (
                          <button
                            key={a.id}
                            className={form.payFrom === a.id ? ui.chipActive : ui.chip}
                            onClick={() => setForm({...form, payFrom: a.id})}
                          >
                            {a.name}
                          </button>
                        ))}
                        {state.cards.map((c) => (
                          <button
                            key={c.id}
                            className={form.payFrom === c.id ? ui.chipActive : ui.chip}
                            onClick={() => setForm({...form, payFrom: c.id})}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
                    <button className={ui.btnGhost} onClick={() => setForm(null)}>
                      Cancel
                    </button>
                    <button
                      className={ui.btnPrimary}
                      style={{width: 'auto', padding: '9px 18px'}}
                      disabled={!formValid || saveBill.isPending}
                      onClick={submit}
                    >
                      {form.billId
                        ? `Save ${form.name.trim() || 'bill'}`
                        : group.kind === 'subscription'
                          ? 'Add subscription'
                          : 'Add survival bill'}
                    </button>
                  </div>
                </div>
              )}

              {group.addLabel && (!form || form.kind !== group.kind) && (
                <button
                  className={ui.dashedCta}
                  style={{padding: 13, borderRadius: 14}}
                  onClick={() => startAdd(group.kind)}
                >
                  {group.addLabel}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
