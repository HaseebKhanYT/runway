/**
 * What a failed call to the Runway API was, and how to say it.
 *
 * The shell used to render one hardcoded sentence naming `localhost:8787` for
 * every failure, which on a deployed build points at a port nothing is
 * listening on. These types carry enough of the failure for the shell to name
 * the API the build actually calls and to separate the two failures that are
 * diagnosed in completely different places.
 */

/** Which of the two failures happened. */
export type ApiErrorKind =
  /**
   * `fetch` itself rejected: nothing usable reached the page. The browser
   * reports an unreachable host, a mixed-content block and a CORS rejection
   * identically — all three are a bare `TypeError` with no status — so this
   * kind cannot be narrowed further here, and the copy names the possibilities
   * rather than guessing between them.
   */
  | 'no-response'
  /** The API answered and the answer was not ok, so there is a status to show. */
  | 'rejected';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly path: string;
  readonly status?: number;
  readonly body?: string;

  constructor(
    kind: ApiErrorKind,
    path: string,
    detail?: {status?: number; body?: string; cause?: unknown},
  ) {
    super(
      kind === 'rejected'
        ? `API ${detail?.status} for ${path}`
        : `No response from the API for ${path}`,
      detail?.cause !== undefined ? {cause: detail.cause} : undefined,
    );
    this.name = 'ApiError';
    this.kind = kind;
    this.path = path;
    this.status = detail?.status;
    this.body = detail?.body;
  }
}

/** A headline and a supporting line, both ready to render. */
export type ApiFailureDescription = {
  headline: string;
  detail: string;
};

/**
 * Turn whatever the state query rejected with into something a reader can act
 * on. `apiOrigin` is the origin the build was configured with, and `pageOrigin`
 * is the origin the page is served from — the value that has to appear in the
 * API's allowlist, and the one nobody can read off the screen otherwise. Pass
 * `null` for `pageOrigin` where there is no window.
 */
export function describeApiFailure(
  error: unknown,
  apiOrigin: string,
  pageOrigin: string | null,
): ApiFailureDescription {
  if (error instanceof ApiError && error.kind === 'rejected') {
    const status = error.status;
    if (status === 401 || status === 403) {
      return {
        headline: 'The Runway API refused this session',
        detail:
          `${apiOrigin} answered ${status}. The sign-in may have expired, or the API may be ` +
          `verifying tokens for a different Clerk application than the one this build signs in with.`,
      };
    }
    if (status !== undefined && status >= 500) {
      return {
        headline: 'The Runway API failed this request',
        detail: `${apiOrigin} answered ${status}. The API is reachable, so its own logs hold the reason.`,
      };
    }
    return {
      headline: 'The Runway API rejected this request',
      detail: `${apiOrigin} answered ${status ?? 'an error'}.`,
    };
  }

  if (error instanceof ApiError || error instanceof TypeError) {
    return {
      headline: "Couldn't reach the Runway API",
      detail:
        `Nothing came back from ${apiOrigin}. Either it is unreachable from here, or the browser ` +
        `blocked the response` +
        (pageOrigin ? ` — the API's allowed origins have to include ${pageOrigin}.` : '.'),
    };
  }

  return {
    headline: "Couldn't load your runway",
    detail: `${apiOrigin} did not return the expected state, and reported no reason. The browser console has the error.`,
  };
}
