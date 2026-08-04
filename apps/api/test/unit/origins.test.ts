import {describe, expect, it} from 'vitest';
import {authorizedPartiesFor, isAllowedOrigin, originRules} from '../../src/lib/origins';

const ALIAS = 'https://runway-git-develop-acme.vercel.app';
const PR_ALIAS = 'https://runway-git-fix-something-acme.vercel.app';
const DEPLOYMENT = 'https://runway-dbjw4aj53-acme.vercel.app';
const PROD = 'https://runway.example.com';
const PREVIEW_GLOB = 'https://runway-*-acme.vercel.app';

const staging = originRules({WEB_ORIGIN: ALIAS, WEB_ORIGIN_PREVIEW: PREVIEW_GLOB});
const production = originRules({WEB_ORIGIN: PROD});

describe('isAllowedOrigin', () => {
  it('allows every preview hostname of this project, whatever the branch or hash', () => {
    for (const origin of [ALIAS, PR_ALIAS, DEPLOYMENT]) {
      expect(isAllowedOrigin(origin, staging)).toBe(true);
    }
  });

  it('does not let a wildcard cross a dot', () => {
    // The attack the glob has to survive: a hostname the attacker controls,
    // dressed up to look like it sits inside the project's preview space.
    expect(isAllowedOrigin('https://runway-evil.attacker.com-acme.vercel.app', staging)).toBe(
      false,
    );
    expect(isAllowedOrigin('https://runway-x-acme.vercel.app.attacker.com', staging)).toBe(false);
  });

  it('rejects another project or another team under the same suffix', () => {
    expect(isAllowedOrigin('https://runway-abc-someone-else.vercel.app', staging)).toBe(false);
    expect(isAllowedOrigin('https://other-abc-acme.vercel.app', staging)).toBe(false);
  });

  it('holds the scheme and requires the wildcard to match something', () => {
    expect(isAllowedOrigin('http://runway-abc-acme.vercel.app', staging)).toBe(false);
    expect(isAllowedOrigin('https://runway--acme.vercel.app', staging)).toBe(false);
  });

  it('keeps production exact, because no pattern is configured there', () => {
    expect(isAllowedOrigin(PROD, production)).toBe(true);
    expect(isAllowedOrigin(DEPLOYMENT, production)).toBe(false);
    expect(isAllowedOrigin(PR_ALIAS, production)).toBe(false);
  });

  it('still defaults to the local dev web app when nothing is configured', () => {
    const unset = originRules({});
    expect(isAllowedOrigin('http://localhost:3000', unset)).toBe(true);
    expect(isAllowedOrigin('http://localhost:3100', unset)).toBe(false);
    expect(isAllowedOrigin(undefined, unset)).toBe(false);
  });

  it('reads a comma-separated list, trimming as it goes', () => {
    const two = originRules({WEB_ORIGIN: ` ${PROD} , ${ALIAS} `});
    expect(isAllowedOrigin(PROD, two)).toBe(true);
    expect(isAllowedOrigin(ALIAS, two)).toBe(true);
    expect(isAllowedOrigin(DEPLOYMENT, two)).toBe(false);
  });
});

describe('authorizedPartiesFor', () => {
  it('adds the calling origin only when a pattern matches it', () => {
    expect(authorizedPartiesFor(PR_ALIAS, staging)).toEqual([ALIAS, PR_ALIAS]);
    expect(authorizedPartiesFor('https://evil.example', staging)).toEqual([ALIAS]);
  });

  it('never repeats an origin already named exactly', () => {
    expect(authorizedPartiesFor(ALIAS, staging)).toEqual([ALIAS]);
  });

  it('falls back to the configured list when a request carries no origin', () => {
    expect(authorizedPartiesFor(undefined, staging)).toEqual([ALIAS]);
    expect(authorizedPartiesFor(null, production)).toEqual([PROD]);
  });

  it('stays empty when nothing is configured, so the azp check is omitted', () => {
    // Preserves the behaviour local development has always had: with no
    // WEB_ORIGIN, Clerk is not given an authorized-parties list at all.
    expect(authorizedPartiesFor('http://localhost:3100', originRules({}))).toEqual([]);
  });
});
