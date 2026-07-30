'use client';

import {CAT_PALETTE, type AppState, type Category} from '@runway/shared';
import {useState} from 'react';
import {useFlow} from '../../lib/queries';
import ui from '../ui/ui.module.css';
import {Modal, ModalTitle} from './modal';
import {useModals} from './modal_context';

export function CategoryModal({
  state,
  categoryId,
  returnTo,
}: {
  state: AppState;
  categoryId?: string;
  returnTo?: 'add';
}) {
  const {closeModal, openModal} = useModals();
  const editing: Category | undefined = state.cats.find((c) => c.id === categoryId);
  const usedColors = new Set(state.cats.map((c) => c.color));
  const firstUnused = CAT_PALETTE.find((c) => !usedColors.has(c)) ?? CAT_PALETTE[0];

  const [name, setName] = useState(editing?.name ?? '');
  const [color, setColor] = useState(editing?.color ?? firstUnused);
  const [budgetRaw, setBudgetRaw] = useState(
    editing && editing.budget > 0 ? String(editing.budget) : '',
  );

  const save = useFlow<void>(() => ({
    path: editing ? `/categories/${editing.id}` : '/categories',
    method: editing ? 'PATCH' : 'POST',
    json: {name: name.trim(), color, budget: parseFloat(budgetRaw) || 0},
  }));
  const remove = useFlow<void>(() => ({
    path: `/categories/${editing?.id}`,
    method: 'DELETE',
  }));

  const done = (categoryName?: string) => {
    closeModal();
    if (returnTo === 'add') {
      openModal('addExpense', categoryName ? {initialCategory: categoryName} : undefined);
    }
  };

  const submit = () => {
    if (!name.trim() || save.isPending) return;
    const savedName = name.trim();
    save.mutate(undefined, {onSuccess: () => done(savedName)});
  };

  return (
    <Modal onClose={() => done()} width="min(380px,100%)">
      <ModalTitle title={editing ? 'Edit category' : 'New category'} onClose={() => done()} />
      <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
        <div>
          <div className={ui.label}>NAME</div>
          <input
            autoFocus
            className={ui.input}
            placeholder="e.g. Groceries, Pets…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <div>
          <div className={ui.label}>COLOR</div>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 11}}>
            {CAT_PALETTE.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: c,
                  boxShadow: color === c ? `0 0 0 2.5px var(--surface), 0 0 0 4.5px ${c}` : 'none',
                }}
              />
            ))}
          </div>
        </div>
        <div>
          <div className={ui.label}>MONTHLY BUDGET</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{fontSize: 15, fontWeight: 600, color: 'var(--muted)'}}>$</span>
            <input
              className={`${ui.input} tnum`}
              inputMode="decimal"
              placeholder="0 — leave blank for no limit"
              value={budgetRaw}
              onChange={(e) => setBudgetRaw(e.target.value.replace(/[^0-9.]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        </div>
        <button
          className={ui.btnPrimary}
          disabled={!name.trim() || save.isPending}
          onClick={submit}
        >
          Save category
        </button>
        {editing && !editing.locked && (
          <button
            style={{fontSize: 13, fontWeight: 600, color: 'var(--danger)'}}
            onClick={() => remove.mutate(undefined, {onSuccess: () => done()})}
          >
            Delete category
          </button>
        )}
      </div>
    </Modal>
  );
}
