/** Next occurrence of a day-of-month, as a UTC date (clamped to month length). */
export function nextDueDate(dueDay: number, today: Date): Date {
  const year = today.getFullYear();
  const month = today.getMonth();
  const clamp = (y: number, m: number): Date => {
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(dueDay, last)));
  };
  const thisMonth = clamp(year, month);
  if (thisMonth.getUTCDate() >= today.getDate() && dueDay >= today.getDate()) {
    return thisMonth;
  }
  return clamp(year, month + 1);
}

export function parseIsoDateUtc(iso: string): Date {
  return new Date(iso + 'T00:00:00.000Z');
}

/** Advance an ISO date by one pay cycle. */
export function advanceCycle(iso: string, cadence: string): string {
  const d = parseIsoDateUtc(iso);
  switch (cadence) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'semimonthly':
      d.setUTCDate(d.getUTCDate() + 15);
      break;
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    default:
      d.setUTCDate(d.getUTCDate() + 14);
  }
  return d.toISOString().slice(0, 10);
}
