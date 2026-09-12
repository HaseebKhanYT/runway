import {describe, expect, it} from 'vitest';
import {commitPayday} from '../src/lib/payday-input';

describe('commitPayday', () => {
  // Pinned, because every refusal below is relative to "today" (#147).
  const today = new Date('2026-07-16T12:00:00');

  it('sends nothing for a field that was never edited', () => {
    expect(commitPayday(null, '2026-07-30', 'biweekly', today)).toEqual({status: 'unchanged'});
    expect(commitPayday(null, null, 'biweekly', today)).toEqual({status: 'unchanged'});
  });

  it('sends nothing when the draft is what is already stored', () => {
    expect(commitPayday('2026-07-30', '2026-07-30', 'biweekly', today)).toEqual({
      status: 'unchanged',
    });
    // An empty field and a stored `null` are the same state.
    expect(commitPayday('', null, 'biweekly', today)).toEqual({status: 'unchanged'});
  });

  it('reads a cleared field as a deliberate null', () => {
    expect(commitPayday('', '2026-07-30', 'biweekly', today)).toEqual({
      status: 'write',
      value: null,
    });
  });

  it('writes a date one cycle or less away', () => {
    expect(commitPayday('2026-07-24', null, 'biweekly', today)).toEqual({
      status: 'write',
      value: '2026-07-24',
    });
    // Today still counts: the paycheck has not been confirmed as landed yet.
    expect(commitPayday('2026-07-16', null, 'biweekly', today)).toEqual({
      status: 'write',
      value: '2026-07-16',
    });
  });

  it('refuses a day that has already passed', () => {
    const commit = commitPayday('2026-07-15', null, 'biweekly', today);
    expect(commit.status).toBe('invalid');
    if (commit.status !== 'invalid') return;
    expect(commit.message).toMatch(/already passed/);
  });

  it('refuses a day more than one cycle away, per cadence', () => {
    // 14, 7, 16 and 31 days out are the last date each cadence accepts.
    expect(commitPayday('2026-07-30', null, 'biweekly', today).status).toBe('write');
    expect(commitPayday('2026-07-31', null, 'biweekly', today)).toMatchObject({
      status: 'invalid',
      message: expect.stringMatching(/one pay cycle/),
    });

    expect(commitPayday('2026-07-23', null, 'weekly', today).status).toBe('write');
    expect(commitPayday('2026-07-24', null, 'weekly', today)).toMatchObject({
      status: 'invalid',
      message: expect.stringMatching(/one pay cycle/),
    });

    expect(commitPayday('2026-08-01', null, 'semimonthly', today).status).toBe('write');
    expect(commitPayday('2026-08-02', null, 'semimonthly', today)).toMatchObject({
      status: 'invalid',
      message: expect.stringMatching(/one pay cycle/),
    });

    expect(commitPayday('2026-08-16', null, 'monthly', today).status).toBe('write');
    expect(commitPayday('2026-08-17', null, 'monthly', today)).toMatchObject({
      status: 'invalid',
      message: expect.stringMatching(/one pay cycle/),
    });
  });

  it('refuses a string that is not a date', () => {
    expect(commitPayday('2026-13-45', null, 'biweekly', today)).toMatchObject({
      status: 'invalid',
      message: expect.stringMatching(/not a real date/),
    });
    expect(commitPayday('2026-07', null, 'biweekly', today)).toMatchObject({
      status: 'invalid',
      message: expect.stringMatching(/not a real date/),
    });
  });

  it('refuses the half-typed year the old field used to store', () => {
    // Typing `2027` into the year sent exactly one PATCH, `{"nextPay":"0002-08-19"}`.
    expect(commitPayday('0002-08-19', null, 'biweekly', today)).toMatchObject({
      status: 'invalid',
      message: expect.stringMatching(/already passed/),
    });
  });

  it('never judges the stored value, only the draft', () => {
    // A payday on file slides into the past when the app simply is not opened.
    expect(commitPayday(null, '2020-01-01', 'biweekly', today)).toEqual({status: 'unchanged'});
    expect(commitPayday('2020-01-01', '2020-01-01', 'biweekly', today)).toEqual({
      status: 'unchanged',
    });
  });
});
