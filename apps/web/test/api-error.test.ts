import {describe, expect, it} from 'vitest';
import {ApiError, describeApiFailure} from '../src/lib/api-error';

const API = 'https://runway-staging.up.railway.app';
const PAGE = 'https://runway-abc123-someone.vercel.app';

describe('describeApiFailure', () => {
  it('names the configured API, never the local dev port', () => {
    const cases: unknown[] = [
      new ApiError('no-response', '/me/state'),
      new ApiError('rejected', '/me/state', {status: 401}),
      new ApiError('rejected', '/me/state', {status: 500}),
      new ApiError('rejected', '/me/state', {status: 404}),
      undefined,
    ];
    for (const error of cases) {
      const {headline, detail} = describeApiFailure(error, API, PAGE);
      expect(`${headline} ${detail}`).toContain(API);
      expect(`${headline} ${detail}`).not.toContain('8787');
    }
  });

  it('points a dropped call at the page origin, which is what an allowlist needs', () => {
    const {headline, detail} = describeApiFailure(
      new ApiError('no-response', '/me/state'),
      API,
      PAGE,
    );
    expect(headline).toBe("Couldn't reach the Runway API");
    expect(detail).toContain(PAGE);
  });

  it('omits the allowlist hint when there is no window to read an origin from', () => {
    const {detail} = describeApiFailure(new ApiError('no-response', '/me/state'), API, null);
    expect(detail).not.toContain('allowed origins');
    expect(detail).toContain(API);
  });

  it('treats a bare TypeError as a dropped call, since that is how fetch reports one', () => {
    const {headline} = describeApiFailure(new TypeError('Failed to fetch'), API, PAGE);
    expect(headline).toBe("Couldn't reach the Runway API");
  });

  it('separates a refused session from a call that never landed', () => {
    for (const status of [401, 403]) {
      const {headline, detail} = describeApiFailure(
        new ApiError('rejected', '/me/state', {status}),
        API,
        PAGE,
      );
      expect(headline).toBe('The Runway API refused this session');
      expect(detail).toContain(String(status));
    }
  });

  it('sends a 5xx to the API logs rather than to the reader', () => {
    const {headline, detail} = describeApiFailure(
      new ApiError('rejected', '/me/state', {status: 503}),
      API,
      PAGE,
    );
    expect(headline).toBe('The Runway API failed this request');
    expect(detail).toContain('503');
  });

  it('falls back without pretending to know why when the query rejected with nothing', () => {
    const {headline, detail} = describeApiFailure(undefined, API, PAGE);
    expect(headline).toBe("Couldn't load your runway");
    expect(detail).toContain('console');
  });
});

describe('ApiError', () => {
  it('keeps the status and the browser cause for the console', () => {
    const cause = new TypeError('Failed to fetch');
    const dropped = new ApiError('no-response', '/me/state', {cause});
    expect(dropped.cause).toBe(cause);
    expect(dropped.kind).toBe('no-response');

    const refused = new ApiError('rejected', '/me/state', {status: 401, body: 'Unauthorized'});
    expect(refused.status).toBe(401);
    expect(refused.body).toBe('Unauthorized');
    expect(refused.message).toContain('401');
  });
});
