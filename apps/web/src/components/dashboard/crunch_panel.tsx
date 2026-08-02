'use client';

import {computeCrunch, fm, type AppState} from '@runway/shared';
import type {ViewModel} from '../../lib/view-model';
import {useState, type ReactNode} from 'react';
import {useFlow} from '../../lib/queries';
import {useModals} from '../modals/modal_context';

function Lever({
  selected,
  onPick,
  title,
  sub,
  dashed = false,
}: {
  selected?: boolean;
  onPick: () => void;
  title: ReactNode;
  sub: string;
  dashed?: boolean;
}) {
  return (
    <button
      onClick={onPick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        border: `1.5px ${dashed ? 'dashed' : 'solid'} ${
          selected ? '#f6f0e6' : 'rgba(246,240,230,.28)'
        }`,
        borderRadius: 12,
        padding: '10px 12px',
        background: selected ? 'rgba(246,240,230,.1)' : 'transparent',
        color: 'var(--on-dark)',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 7,
          flex: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          ...(dashed
            ? {border: '1.5px dashed rgba(246,240,230,.35)'}
            : selected
              ? {background: '#f6f0e6', color: '#29221a'}
              : {border: '1.5px solid rgba(246,240,230,.35)'}),
        }}
      >
        {dashed ? '+' : selected ? '✓' : ''}
      </span>
      <span style={{minWidth: 0}}>
        <span style={{display: 'block', fontSize: 13.5, fontWeight: 650}}>{title}</span>
        <span style={{display: 'block', fontSize: 11.5, color: 'var(--on-dark-muted)'}}>{sub}</span>
      </span>
    </button>
  );
}

/** Cash crunch panel — replaces the hero when safe < 0 (catalog §1.2). */
export function CrunchPanel({state, vm}: {state: AppState; vm: ViewModel}) {
  const {openModal} = useModals();
  const [pausedGoalIds, setPausedGoalIds] = useState<string[]>([]);
  const [cardId, setCardId] = useState<string | null>(null);

  const crunch = computeCrunch(state, vm.runway, {pausedGoalIds, cardId}, new Date());
  const lock = useFlow<void>(() => ({
    path: '/crunch/lock',
    json: {pausedGoalIds, cardId, advance: crunch.advance},
  }));

  const toggleGoal = (id: string) => {
    setPausedGoalIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  return (
    <div
      style={{
        background: 'var(--ink)',
        color: 'var(--on-dark)',
        border: '2px solid var(--danger)',
        borderRadius: 20,
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: '1px',
            color: 'var(--crunch-accent)',
          }}
        >
          CASH CRUNCH · CAUGHT EARLY
        </div>
        <div
          className="tnum"
          style={{
            fontSize: 'clamp(36px,5vw,48px)',
            fontWeight: 700,
            letterSpacing: '-1.2px',
            color: 'var(--crunch-accent)',
          }}
        >
          {fm(crunch.short)} short
        </div>
        <div style={{fontSize: 13.5, color: 'var(--on-dark-muted)'}}>
          {crunch.billLine} — there&apos;s still time to fix it.
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.8px',
          color: 'var(--on-dark-muted)',
        }}
      >
        FIND THE MONEY — CHEAPEST FIRST
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
        {crunch.goalLevers.map((lever) => (
          <Lever
            key={lever.goal.id}
            selected={pausedGoalIds.includes(lever.goal.id)}
            onPick={() => toggleGoal(lever.goal.id)}
            title={lever.title}
            sub={lever.sub}
          />
        ))}
        <Lever
          dashed
          onPick={() => openModal('loan', {prefillAmount: Math.ceil(crunch.rem)})}
          title="Borrow from someone you trust · 0%"
          sub="no interest — Runway tracks who and when you pay back"
        />
        {crunch.cardLevers.map((lever) => (
          <Lever
            key={lever.card.id}
            selected={cardId === lever.card.id}
            onPick={() => setCardId(cardId === lever.card.id ? null : lever.card.id)}
            title={lever.title}
            sub={lever.sub}
          />
        ))}
        <Lever
          dashed
          onPick={() => openModal('addExpense', {initialMode: 'income'})}
          title="Log money in"
          sub="a side gig or refund shrinks this instantly"
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{fontSize: 13, fontWeight: 650, color: crunch.gapColor}}>{crunch.gapLine}</div>
        <button
          disabled={!crunch.covered || lock.isPending}
          onClick={() => lock.mutate()}
          style={{
            padding: '11px 20px',
            borderRadius: 12,
            fontWeight: 650,
            fontSize: 13.5,
            ...(crunch.covered
              ? {background: '#f6f0e6', color: '#29221a'}
              : {
                  background: 'rgba(246,240,230,.15)',
                  color: 'rgba(246,240,230,.5)',
                  cursor: 'default',
                }),
          }}
        >
          Lock this plan
        </button>
      </div>
    </div>
  );
}
