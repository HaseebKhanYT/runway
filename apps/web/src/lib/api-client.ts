'use client';

import {useAuth} from '@clerk/nextjs';
import {useCallback} from 'react';
import {ApiError} from './api-error';

/**
 * The API this build calls. Exported because the shell has to name it when a
 * call fails: the default below is a local dev convenience and is wrong to
 * quote on any deployed build.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

export type ApiFetch = <T>(path: string, init?: RequestInit & {json?: unknown}) => Promise<T>;

/** Typed fetch against the Hono API with the Clerk session token attached. */
export function useApiFetch(): ApiFetch {
  const {getToken} = useAuth();
  return useCallback(
    async <T>(path: string, init?: RequestInit & {json?: unknown}): Promise<T> => {
      const token = await getToken();
      const {json, ...rest} = init ?? {};
      let res: Response;
      try {
        res = await fetch(`${API_URL}${path}`, {
          ...rest,
          headers: {
            ...(token ? {Authorization: `Bearer ${token}`} : {}),
            ...(json !== undefined ? {'Content-Type': 'application/json'} : {}),
            ...rest.headers,
          },
          ...(json !== undefined ? {body: JSON.stringify(json)} : {}),
        });
      } catch (cause) {
        // Nothing usable came back. Classified here, where it is still known
        // that no response existed at all; at the render site every failure
        // looks the same.
        throw new ApiError('no-response', path, {cause});
      }
      if (!res.ok) {
        throw new ApiError('rejected', path, {status: res.status, body: await res.text()});
      }
      return res.json() as Promise<T>;
    },
    [getToken],
  );
}
