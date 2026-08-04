import {describe, expect, it} from 'vitest';
import {branchAliasRedirect} from '../src/lib/preview-alias';

const DEPLOYMENT = 'runway-dbjw4aj53-haseeb-khans-projects.vercel.app';
const ALIAS = 'runway-git-develop-haseeb-khans-projects.vercel.app';
const PREVIEW = {vercelEnv: 'preview', branchHost: ALIAS};

describe('branchAliasRedirect', () => {
  it('sends a deployment hostname to the branch alias', () => {
    expect(branchAliasRedirect(DEPLOYMENT, '/runway', PREVIEW)).toBe(`https://${ALIAS}/runway`);
  });

  it('carries the path and query across, so a deep link survives', () => {
    expect(branchAliasRedirect(DEPLOYMENT, '/bills?filter=unpaid', PREVIEW)).toBe(
      `https://${ALIAS}/bills?filter=unpaid`,
    );
  });

  it('leaves a request already on the alias alone, whatever its case', () => {
    expect(branchAliasRedirect(ALIAS, '/runway', PREVIEW)).toBeNull();
    expect(branchAliasRedirect(ALIAS.toUpperCase(), '/runway', PREVIEW)).toBeNull();
  });

  it('never redirects production', () => {
    expect(
      branchAliasRedirect('runway.example.com', '/runway', {
        vercelEnv: 'production',
        branchHost: ALIAS,
      }),
    ).toBeNull();
  });

  it('never redirects off Vercel, where neither variable is set', () => {
    expect(
      branchAliasRedirect('localhost:3000', '/runway', {
        vercelEnv: undefined,
        branchHost: undefined,
      }),
    ).toBeNull();
  });

  it('stays put rather than guessing when the alias is unknown', () => {
    for (const branchHost of [undefined, '', '   ']) {
      expect(branchAliasRedirect(DEPLOYMENT, '/runway', {vercelEnv: 'preview', branchHost})).toBe(
        null,
      );
    }
  });

  it('stays put when the request carries no host to compare', () => {
    expect(branchAliasRedirect(null, '/runway', PREVIEW)).toBeNull();
  });

  it('tolerates a scheme on the alias rather than doubling it', () => {
    expect(
      branchAliasRedirect(DEPLOYMENT, '/runway', {
        vercelEnv: 'preview',
        branchHost: `https://${ALIAS}`,
      }),
    ).toBe(`https://${ALIAS}/runway`);
  });
});
