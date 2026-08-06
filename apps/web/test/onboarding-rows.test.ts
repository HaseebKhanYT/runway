import {describe, expect, it} from 'vitest';
import {billRowProblem, cardRowProblem} from '../src/lib/onboarding-rows';

const LONG_NAME = 'a'.repeat(121);

describe('billRowProblem', () => {
  it('accepts a row that has both a name and an amount', () => {
    expect(billRowProblem('Rent', '950')).toBeNull();
    expect(billRowProblem('  Rent  ', '  950.50  ')).toBeNull();
    expect(billRowProblem('Netflix', '.5')).toBeNull();
  });

  it('names the name when it is missing', () => {
    // The bug: Add did nothing at all and said nothing (#58).
    const problem = billRowProblem('', '950');
    expect(problem?.field).toBe('name');
  });

  it('names the name when it is only whitespace', () => {
    expect(billRowProblem('   ', '950')?.field).toBe('name');
  });

  it('refuses a name longer than the schema will accept', () => {
    // onboardingCompleteSchema caps it at 120, and only says so at submit.
    expect(billRowProblem('a'.repeat(120), '950')).toBeNull();
    expect(billRowProblem(LONG_NAME, '950')?.field).toBe('name');
  });

  it('names the amount when it is blank', () => {
    expect(billRowProblem('Rent', '')?.field).toBe('amount');
    expect(billRowProblem('Rent', '   ')?.field).toBe('amount');
  });

  it('refuses an amount of zero — a bill nobody pays is not a bill', () => {
    expect(billRowProblem('Rent', '0')?.field).toBe('amount');
    expect(billRowProblem('Rent', '0.00')?.field).toBe('amount');
  });

  it('refuses an amount parseFloat would silently truncate', () => {
    // parseFloat read '1.2.3' as 1.2 and added a bill nobody typed.
    expect(billRowProblem('Rent', '1.2.3')?.field).toBe('amount');
    expect(billRowProblem('Rent', '.')?.field).toBe('amount');
  });

  it('checks the name before the amount, the row is read left to right', () => {
    expect(billRowProblem('', '')?.field).toBe('name');
  });

  it('phrases every refusal as a finished sentence', () => {
    const problems = [
      billRowProblem('', '950'),
      billRowProblem(LONG_NAME, '950'),
      billRowProblem('Rent', ''),
      billRowProblem('Rent', '0'),
      billRowProblem('Rent', '1.2.3'),
    ];
    for (const problem of problems) {
      expect(problem).not.toBeNull();
      expect(problem?.message).toMatch(/\.$/);
    }
  });
});

describe('cardRowProblem', () => {
  it('accepts a row that has both a nickname and a limit', () => {
    expect(cardRowProblem('Chase', '1200')).toBeNull();
    expect(cardRowProblem('  Chase  ', '  1200  ')).toBeNull();
  });

  it('names the nickname when it is missing', () => {
    expect(cardRowProblem('', '1200')?.field).toBe('name');
  });

  it('names the nickname when it is only whitespace', () => {
    expect(cardRowProblem('  ', '1200')?.field).toBe('name');
  });

  it('refuses a nickname longer than the schema will accept', () => {
    expect(cardRowProblem('a'.repeat(120), '1200')).toBeNull();
    expect(cardRowProblem(LONG_NAME, '1200')?.field).toBe('name');
  });

  it('names the limit when it is blank', () => {
    expect(cardRowProblem('Chase', '')?.field).toBe('limit');
    expect(cardRowProblem('Chase', '  ')?.field).toBe('limit');
  });

  it('refuses a limit of zero — a card has to have room on it', () => {
    expect(cardRowProblem('Chase', '0')?.field).toBe('limit');
  });

  it('refuses a limit parseFloat would silently truncate', () => {
    expect(cardRowProblem('Chase', '1.2.3')?.field).toBe('limit');
    expect(cardRowProblem('Chase', '.')?.field).toBe('limit');
  });

  it('checks the nickname before the limit, the row is read left to right', () => {
    expect(cardRowProblem('', '')?.field).toBe('name');
  });

  it('still accepts a card that owes more than its limit', () => {
    // Over-limit is a real state a real card can be in, and the schema allows
    // it, so what is owed is deliberately not a parameter here — there is no
    // argument that could make the row for a $2,000 balance on a $1,200 card
    // refuse where any other row would pass.
    expect(cardRowProblem('Chase', '1200')).toBeNull();
  });

  it('phrases every refusal as a finished sentence', () => {
    const problems = [
      cardRowProblem('', '1200'),
      cardRowProblem(LONG_NAME, '1200'),
      cardRowProblem('Chase', ''),
      cardRowProblem('Chase', '0'),
      cardRowProblem('Chase', '1.2.3'),
    ];
    for (const problem of problems) {
      expect(problem).not.toBeNull();
      expect(problem?.message).toMatch(/\.$/);
    }
  });
});
