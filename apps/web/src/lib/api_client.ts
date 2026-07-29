'use client';

import {useAuth} from '@clerk/nextjs';
import {useCallback} from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

export type ApiFetch = <T>(path: string, init?: RequestInit & {json?: unknown}) => Promise<T>;

/** Typed fetch against the Hono API with the Clerk session token attached. */
export function useApiFetch(): ApiFetch {
  const {getToken} = useAuth();
  return useCallback(
    async <T>(path: string, init?: RequestInit & {json?: unknown}): Promise<T> => {
      const token = await getToken();
      const {json, ...rest} = init ?? {};
      const res = await fetch(`${API_URL}${path}`, {
        ...rest,
        headers: {
          ...(token ? {Authorization: `Bearer ${token}`} : {}),
          ...(json !== undefined ? {'Content-Type': 'application/json'} : {}),
          ...rest.headers,
        },
        ...(json !== undefined ? {body: JSON.stringify(json)} : {}),
      });
      if (!res.ok) {
        throw new Error(`API ${res.status}: ${await res.text()}`);
      }
      return res.json() as Promise<T>;
    },
    [getToken],
  );
}
