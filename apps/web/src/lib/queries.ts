'use client';

import type {AppState} from '@runway/shared';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {useApiFetch} from './api_client';

export const STATE_KEY = ['state'] as const;

export function useAppState() {
  const apiFetch = useApiFetch();
  return useQuery({
    queryKey: STATE_KEY,
    queryFn: () => apiFetch<AppState>('/me/state'),
    staleTime: 30_000,
  });
}

/**
 * Every mutating endpoint returns the fresh AppState; the cache is simply
 * replaced. `optimistic` (when given) patches the cached state instantly and
 * rolls back on error.
 */
export function useFlow<TIn = void>(
  makeRequest: (input: TIn) => {path: string; method?: string; json?: unknown},
  optimistic?: (state: AppState, input: TIn) => AppState,
) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TIn) => {
      const {path, method = 'POST', json} = makeRequest(input);
      return apiFetch<AppState>(path, {method, json});
    },
    onMutate: async (input: TIn) => {
      if (!optimistic) return {previous: undefined};
      await queryClient.cancelQueries({queryKey: STATE_KEY});
      const previous = queryClient.getQueryData<AppState>(STATE_KEY);
      if (previous) {
        queryClient.setQueryData(STATE_KEY, optimistic(previous, input));
      }
      return {previous};
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(STATE_KEY, context.previous);
      }
    },
    onSuccess: (state) => {
      queryClient.setQueryData(STATE_KEY, state);
    },
  });
}
