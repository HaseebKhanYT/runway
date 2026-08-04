import {verifyToken} from '@clerk/backend';
import type {Context, Next} from 'hono';
import {authorizedPartiesFor, originRules} from '../lib/origins';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

/**
 * Origins permitted to mint the session tokens we accept. Passing these to
 * Clerk rejects a valid token issued for some other application, so a token
 * lifted from an unrelated Clerk app cannot be replayed against this API.
 *
 * The set is per-request rather than fixed, because a preview deployment's
 * origin is only known once it calls: `lib/origins.ts` adds the calling origin
 * when it matches a `WEB_ORIGIN_PREVIEW` glob, so Clerk still compares against
 * exact strings and still rejects everything outside that shape.
 */
const rules = originRules(process.env);

/**
 * Clerk session verification. Outside production, `DEV_AUTH_BYPASS=1` allows an
 * `x-dev-user` header so API tests can run without Clerk. The bypass is pinned
 * to non-production builds so a stray env var can never disable auth for real
 * users.
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  if (process.env.NODE_ENV !== 'production' && process.env.DEV_AUTH_BYPASS === '1') {
    const devUser = c.req.header('x-dev-user');
    if (devUser) {
      c.set('userId', devUser);
      return next();
    }
  }
  const header = c.req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return c.json({error: 'Unauthorized'}, 401);
  }
  const authorizedParties = authorizedPartiesFor(c.req.header('origin'), rules);
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY ?? '',
      ...(authorizedParties.length > 0 ? {authorizedParties} : {}),
    });
    c.set('userId', payload.sub);
    return next();
  } catch {
    return c.json({error: 'Unauthorized'}, 401);
  }
}
