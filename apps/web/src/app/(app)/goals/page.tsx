'use client';

import {
  computeRunway,
  goalBarSplit,
  goalBehind,
  goalPer,
  goalPerMonth,
  goalRemaining,
  spareMonthly,
  type AppState,
  type Goal,
} from '@runway/shared';
import {useState} from 'react';
import ui from '../../../components/ui/ui.module.css';
import {fm} from '../../../lib/format';
import {computePlan} from '../../../lib/planner';
import {useAppState, useFlow} from '../../../lib/queries';

function goalStatus(goal: Goal, state: AppState, today: Date): {text: string; color: string} {
  if (goal.saved >= goal.target) return {text: 'Fully funded — enjoy it', color: 'var(--success)'};
  if (goal.paused === '__crunch') {
    return {text: '⏸ Paused this cycle — resumes at payday', color: 'var(--muted)'};
  }
  if (goal.paused) {
    return {text: `⏸ Paused — feeding “${goal.paused}”`, color: 'var(--muted)'};
  }
  if (goal.necessity) return {text: 'Non-negotiable — on plan', color: 'var(--financed)'};
  if (goalBehind(goal, state.profile.cadence, today)) {
    return {text: '⚠ A little behind', color: 'var(--danger)'};
  }
  return {text: 'On track', color: 'var(--success)'};
}

function GoalCard({goal, state}: {goal: Goal; state: AppState}) {
  const today = new Date();
  const cadence = state.profile.cadence;
  const [settingAside, setSettingAside] = useState(false);
  const [editing, setEditing] = useState(false);
  const [amountRaw, setAmountRaw] = useState('');
  const [source, setSource] = useState('checking');
  const [editName, setEditName] = useState(goal.name);
  const [editTargetRaw, setEditTargetRaw] = useState(String(goal.target));
  const [editPerRaw, setEditPerRaw] = useState(String(goal.per));

  const setAside = useFlow<void>(() => ({
    path: `/goals/${goal.id}/set-aside`,
    json: {amount: parseFloat(amountRaw) || 0, source},
  }));
  const patch = useFlow<void>(() => {
    const newPer = parseFloat(editPerRaw) || 0;
    const computedPer = goalPer(goal, cadence, today);
    // Typing within $1 of the computed value keeps the due date live;
    // anything else pins the amount and clears the date (catalog §3.5).
    const keepsDue = Math.abs(newPer - computedPer) <= 1;
    return {
      path: `/goals/${goal.id}`,
      method: 'PATCH',
      json: {
        name: editName.trim(),
        target: parseFloat(editTargetRaw) || goal.target,
        per: newPer,
        ...(keepsDue ? {} : {due: null}),
      },
    };
  });
  const remove = useFlow<void>(() => ({path: `/goals/${goal.id}`, method: 'DELETE'}));

  const {finPct, payPct} = goalBarSplit(goal);
  const remaining = goalRemaining(goal);
  const perMonth = goalPerMonth(goal, cadence, today);
  const per = goalPer(goal, cadence, today);
  const status = goalStatus(goal, state, today);
  const dueLabel = goal.due
    ? new Date(goal.due + 'T00:00:00').toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
    : null;
  const checks = goal.due
    ? Math.max(
        1,
        Math.floor(
          Math.max(
            0,
            Math.round((Date.parse(goal.due + 'T00:00:00') - today.getTime()) / 86400000),
          ) / (cadence === 'weekly' ? 7 : cadence === 'monthly' ? 30 : 14),
        ),
      )
    : null;

  const perLine =
    goal.paused && goal.paused !== '__crunch'
      ? `${fm(goal.per)}/paycheck skips one cycle to cover the crunch · ${goal.note}`
      : goal.note === 'your safety net'
        ? 'Set aside automatically · your safety net'
        : 'Auto-adjusts as you save';

  return (
    <div className={ui.card} style={{display: 'flex', flexDirection: 'column', gap: 10}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
        <span style={{fontSize: 15, fontWeight: 700}}>{goal.name}</span>
        {goal.necessity && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 650,
              border: '1px solid var(--border-input)',
              borderRadius: 5,
              padding: '1px 6px',
              color: 'var(--muted)',
            }}
          >
            non-negotiable
          </span>
        )}
        <span className="tnum" style={{marginLeft: 'auto', fontSize: 13, color: 'var(--muted)'}}>
          {fm(goal.saved)} / {fm(goal.target)}
        </span>
      </div>

      <div className={ui.progressTrack} style={{height: 10, borderRadius: 6}}>
        <div
          className={ui.progressFill}
          style={{width: `${finPct}%`, background: 'var(--financed)'}}
        />
        <div
          className={ui.progressFill}
          style={{width: `${payPct}%`, background: 'var(--goals)'}}
        />
      </div>
      {goal.financed > 0 && (
        <div style={{display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--muted)'}}>
          <span style={{display: 'flex', alignItems: 'center', gap: 5}}>
            <span style={{width: 8, height: 8, borderRadius: 3, background: 'var(--financed)'}} />
            {fm(Math.min(goal.financed, goal.saved))} fronted by {goal.financedFrom}
          </span>
          <span style={{display: 'flex', alignItems: 'center', gap: 5}}>
            <span style={{width: 8, height: 8, borderRadius: 3, background: 'var(--goals)'}} />
            {fm(Math.max(0, goal.saved - goal.financed))} set aside from paychecks
          </span>
        </div>
      )}

      {remaining > 0 && (
        <div>
          <span className="tnum" style={{fontSize: 22, fontWeight: 700, letterSpacing: '-.5px'}}>
            {fm(perMonth)}
          </span>{' '}
          <span style={{fontSize: 11.5, fontWeight: 650, color: 'var(--muted)'}}>
            {goal.necessity
              ? `required each month${dueLabel ? ` · by ${dueLabel}` : ''}`
              : `a month keeps this on pace${dueLabel ? ` · by ${dueLabel}` : ''}`}
          </span>
        </div>
      )}
      {remaining > 0 && (
        <div className="tnum" style={{fontSize: 11.5, color: 'var(--muted)'}}>
          {fm(remaining)} to go
          {checks != null && per > 0 ? ` · ${fm(per)} per paycheck × ${checks} left` : ''}
        </div>
      )}
      <div style={{fontSize: 12.5, fontWeight: 600, color: status.color}}>{status.text}</div>
      <div style={{fontSize: 12.5, color: 'var(--financed)'}}>{perLine}</div>

      {settingAside && (
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          {state.accounts.length > 0 && (
            <div>
              <div className={ui.label}>FROM</div>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
                <button
                  className={source === 'checking' ? ui.chipActive : ui.chip}
                  onClick={() => setSource('checking')}
                >
                  {state.profile.primaryName}
                </button>
                {state.accounts.map((a) => (
                  <button
                    key={a.id}
                    className={source === a.id ? ui.chipActive : ui.chip}
                    onClick={() => setSource(a.id)}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                border: '1.5px solid var(--ink)',
                borderRadius: 999,
                padding: '7px 14px',
                flex: 1,
              }}
            >
              <span style={{fontSize: 13, fontWeight: 600, color: 'var(--muted)'}}>$</span>
              <input
                autoFocus
                className="tnum"
                inputMode="decimal"
                placeholder={String(Math.min(25, remaining))}
                value={amountRaw}
                onChange={(e) => setAmountRaw(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && parseFloat(amountRaw) > 0) {
                    setAside.mutate(undefined, {onSuccess: () => setSettingAside(false)});
                  }
                  if (e.key === 'Escape') setSettingAside(false);
                }}
                style={{
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  width: '100%',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              />
            </div>
            <button
              className={ui.btnPrimary}
              style={{width: 'auto', padding: '9px 16px'}}
              disabled={!(parseFloat(amountRaw) > 0) || setAside.isPending}
              onClick={() => setAside.mutate(undefined, {onSuccess: () => setSettingAside(false)})}
            >
              Set aside
            </button>
            <button
              onClick={() => setSettingAside(false)}
              aria-label="Cancel"
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: 'var(--chip)',
                flex: 'none',
                fontSize: 13,
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          <input
            className={ui.input}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          />
          <div style={{display: 'flex', gap: 8}}>
            <div style={{flex: 1}}>
              <div className={ui.label}>TARGET</div>
              <input
                className={`${ui.input} tnum`}
                inputMode="decimal"
                value={editTargetRaw}
                onChange={(e) => setEditTargetRaw(e.target.value.replace(/[^0-9.]/g, ''))}
              />
            </div>
            <div style={{flex: 1}}>
              <div className={ui.label}>PER PAYCHECK</div>
              <input
                className={`${ui.input} tnum`}
                inputMode="decimal"
                value={editPerRaw}
                onChange={(e) => setEditPerRaw(e.target.value.replace(/[^0-9.]/g, ''))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')
                    patch.mutate(undefined, {onSuccess: () => setEditing(false)});
                  if (e.key === 'Escape') setEditing(false);
                }}
              />
            </div>
          </div>
          <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
            <button className={ui.btnGhost} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              className={ui.btnPrimary}
              style={{width: 'auto', padding: '9px 16px'}}
              onClick={() => patch.mutate(undefined, {onSuccess: () => setEditing(false)})}
            >
              Save changes
            </button>
          </div>
        </div>
      )}

      {!settingAside && !editing && (
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          {remaining > 0 && (
            <button
              onClick={() => setSettingAside(true)}
              style={{
                border: '1.5px solid var(--ink)',
                borderRadius: 999,
                padding: '7px 15px',
                fontSize: 12.5,
                fontWeight: 650,
                transition: 'background .15s, color .15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--ink)';
                e.currentTarget.style.color = 'var(--bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--ink)';
              }}
            >
              + Set aside now
            </button>
          )}
          <span style={{flex: 1}} />
          <button className={ui.textBtn} onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            className={ui.textBtn}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--danger)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            onClick={() => remove.mutate()}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function PlannerCard({state}: {state: AppState}) {
  const today = new Date();
  const runway = computeRunway(state, today);
  const [kind, setKind] = useState<'wish' | 'necessity'>('wish');
  const [name, setName] = useState('');
  const [targetRaw, setTargetRaw] = useState('');
  const [months, setMonths] = useState(0);
  const [pausedIds, setPausedIds] = useState<string[]>([]);
  const [cardId, setCardId] = useState<string | null>(null);
  const [earn, setEarn] = useState(false);

  const target = parseFloat(targetRaw) || 0;
  const plan = computePlan(
    {name, target, months: Math.max(1, months), kind, pausedIds, cardId, earn},
    state,
    runway,
    today,
  );

  const start = useFlow<void>(() => ({
    path: '/planner/start',
    json: {name: name.trim(), target, months: Math.max(1, months), kind, pausedIds, cardId, earn},
  }));

  const monthLabel =
    months > 0
      ? new Date(today.getFullYear(), today.getMonth() + months, 1).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })
      : 'By when?';

  const showMath = name.trim().length > 0 && target > 0 && months > 0;

  const reset = () => {
    setName('');
    setTargetRaw('');
    setMonths(0);
    setPausedIds([]);
    setCardId(null);
    setEarn(false);
  };

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1.5px dashed var(--border-dash-3)',
        borderRadius: 20,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div>
        <div style={{fontSize: 15, fontWeight: 700}}>Plan a big expense</div>
        <div style={{fontSize: 12.5, color: 'var(--muted)', marginTop: 2}}>
          Add a goal and a target date — we&apos;ll work out the rest.
        </div>
      </div>
      <div className={ui.segWrap} style={{borderRadius: 10}}>
        <button
          className={kind === 'wish' ? ui.segBtnActive : ui.segBtn}
          onClick={() => setKind('wish')}
        >
          a wish
        </button>
        <button
          className={kind === 'necessity' ? ui.segBtnActive : ui.segBtn}
          onClick={() => setKind('necessity')}
        >
          a necessity
        </button>
      </div>
      <div style={{fontSize: 11.5, color: 'var(--muted)'}}>
        {kind === 'wish'
          ? 'flexible — adjust the date or amount whenever you like'
          : 'date & amount are fixed — we find the money instead'}
      </div>
      <input
        className={ui.input}
        placeholder="What is it? (new laptop, deposit…)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
        <input
          className={`${ui.input} tnum`}
          style={{flex: 1, minWidth: 120}}
          inputMode="decimal"
          placeholder="How much? ($)"
          value={targetRaw}
          onChange={(e) => setTargetRaw(e.target.value.replace(/[^0-9.]/g, ''))}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            border: '1px solid var(--border-input)',
            borderRadius: 11,
            overflow: 'hidden',
            flex: 1,
            minWidth: 170,
          }}
        >
          <button
            style={{width: 36, padding: '11px 0', transition: 'background .15s'}}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-stepper)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => setMonths(Math.max(0, months - 1))}
          >
            ‹
          </button>
          <span
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: months > 0 ? 'var(--ink)' : 'var(--placeholder)',
            }}
          >
            {monthLabel}
          </span>
          <button
            style={{width: 36, padding: '11px 0', transition: 'background .15s'}}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--hover-stepper)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            onClick={() => setMonths(Math.min(600, months + 1))}
          >
            ›
          </button>
        </div>
      </div>

      {showMath && (
        <div style={{fontSize: 13, fontWeight: 650, color: plan.perColor, lineHeight: 1.45}}>
          {plan.perLine}
        </div>
      )}

      {showMath && kind === 'necessity' && plan.gap0 > 0 && (
        <div
          style={{
            borderTop: '1px dashed var(--border-input)',
            paddingTop: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{fontSize: 11, fontWeight: 700, letterSpacing: '.8px', color: 'var(--muted)'}}
          >
            FIND THE MONEY — CHEAPEST FIRST
          </div>
          {plan.levers.map((lever) => {
            const selected =
              lever.kind === 'pause'
                ? pausedIds.includes(lever.id)
                : lever.kind === 'card'
                  ? cardId === lever.id
                  : lever.kind === 'earn'
                    ? earn
                    : false;
            return (
              <button
                key={`${lever.kind}-${lever.id}`}
                onClick={() => {
                  if (lever.kind === 'pause') {
                    setPausedIds((ids) =>
                      ids.includes(lever.id)
                        ? ids.filter((x) => x !== lever.id)
                        : [...ids, lever.id],
                    );
                  } else if (lever.kind === 'card') {
                    setCardId(cardId === lever.id ? null : lever.id);
                  } else if (lever.kind === 'earn') {
                    setEarn(!earn);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  border: `1.5px solid ${selected ? 'var(--ink)' : 'var(--border-input)'}`,
                  borderRadius: 12,
                  padding: '10px 12px',
                  background: selected ? 'var(--input)' : 'transparent',
                  textAlign: 'left',
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
                    ...(selected
                      ? {background: 'var(--ink)', color: 'var(--bg)'}
                      : {border: '1.5px solid var(--border-input)'}),
                  }}
                >
                  {selected ? '✓' : ''}
                </span>
                <span style={{minWidth: 0}}>
                  <span style={{display: 'block', fontSize: 13, fontWeight: 650}}>
                    {lever.title}
                  </span>
                  <span style={{display: 'block', fontSize: 11.5, color: 'var(--muted)'}}>
                    {lever.sub}
                  </span>
                </span>
              </button>
            );
          })}
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 650,
              color: plan.covered ? 'var(--success)' : 'var(--danger)',
            }}
          >
            {plan.gapLine}
          </div>
        </div>
      )}

      <button
        disabled={!plan.ctaEnabled || months === 0 || start.isPending}
        onClick={() => start.mutate(undefined, {onSuccess: reset})}
        style={{
          width: '100%',
          padding: 13,
          borderRadius: 13,
          fontWeight: 650,
          fontSize: 14,
          ...(!plan.ctaEnabled || months === 0
            ? {background: 'var(--border)', color: 'var(--muted-2)', cursor: 'default'}
            : kind === 'necessity'
              ? {background: 'var(--ink)', color: 'var(--bg)'}
              : {background: 'var(--goals)', color: '#fff'}),
        }}
      >
        {plan.ctaLabel}
      </button>
    </div>
  );
}

export default function GoalsPage() {
  const {data: state} = useAppState();
  if (!state) return null;
  const today = new Date();
  const runway = computeRunway(state, today);
  const spare = Math.max(0, spareMonthly(runway.cycleSurplus, state.profile.cadence));
  const horizon = new Date(today.getFullYear(), today.getMonth() + 10, 1);
  const big = spare * 10;

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <div
        style={{
          background: 'var(--ink)',
          color: 'var(--on-dark)',
          borderRadius: 20,
          padding: '18px 20px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.8px',
            color: 'var(--on-dark-muted-2)',
          }}
        >
          SPARE TO SAVE EACH MONTH
        </div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap'}}>
          <span className="tnum" style={{fontSize: 30, fontWeight: 700, letterSpacing: '-.5px'}}>
            {fm(spare)}
          </span>
          <span style={{fontSize: 12.5, color: 'var(--on-dark-muted-2)'}}>
            left over after bills &amp; goals
          </span>
        </div>
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.4,
            color: 'var(--on-dark-muted-2)',
            marginTop: 4,
          }}
        >
          {spare >= 10
            ? `Set it aside and you could afford something worth ${fm(big)} by ${horizon.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}.`
            : 'Your paycheck is fully committed right now — free up a little and you could start saving toward something big.'}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(320px,100%),1fr))',
          gap: 16,
        }}
      >
        {state.goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} state={state} />
        ))}
        <PlannerCard state={state} />
      </div>
    </div>
  );
}
