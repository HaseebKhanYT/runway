import {verifyToken} from '@clerk/backend';
import type {Context, Next} from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}

/**
 * Clerk session verification. In dev, `DEV_AUTH_BYPASS=1` allows an
 * `x-dev-user` header so API tests can run without Clerk.
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  if (process.env.DEV_AUTH_BYPASS === '1') {
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
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY ?? '',
    });
    c.set('userId', payload.sub);
    return next();
  } catch {
    return c.json({error: 'Unauthorized'}, 401);
  }
}
